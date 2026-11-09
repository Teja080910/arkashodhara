import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';

const RESPONSE_TTL_MS = 60_000;

const caches = new Map();

// ---------------------------------------------------------------------------
// Server registry: ADMIN_SERVERS="id|label|target|key,id|label|target|key"
// target = "local" (run on this host) or "user@host" (connect over SSH).
// key is optional and only used for remote targets.
// Entries are comma-separated; fields are pipe-separated.
// ---------------------------------------------------------------------------
export function listServers() {
  const raw = process.env.ADMIN_SERVERS || '';
  const entries = raw
    .split(/[,\n]/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const servers = entries
    .map((entry) => {
      const [id, label, target, key] = entry.split('|').map((part) => (part ?? '').trim());
      if (!id || !target) return null;

      if (target === 'local') {
        return { id, label: label || id, local: true, host: 'local' };
      }

      const at = target.lastIndexOf('@');
      if (at < 0) return null;

      return {
        id,
        label: label || id,
        local: false,
        user: target.slice(0, at),
        host: target.slice(at + 1),
        key: key || undefined,
      };
    })
    .filter(Boolean);

  if (servers.length > 0) return servers;

  return [{ id: 'local', label: 'This server', local: true, host: 'local' }];
}

export function findServer(id) {
  const servers = listServers();
  return servers.find((server) => server.id === id) ?? servers[0];
}

// ---------------------------------------------------------------------------
// Remote probe: one bash script emits base64 sections, parsed below.
// Runs locally (no SSH) when server.local is true.
// ---------------------------------------------------------------------------
const PROBE = String.raw`
b64() { base64 -w0 2>/dev/null || base64 | tr -d '\n'; }
mark() { printf '##%s##' "$1"; }
line() { printf '\n'; }
mark hostname; hostname 2>/dev/null | b64; line
mark uname; uname -srm 2>/dev/null | b64; line
mark nproc; nproc 2>/dev/null | b64; line
mark uptime; cut -d' ' -f1 /proc/uptime 2>/dev/null | b64; line
mark load; cut -d' ' -f1-3 /proc/loadavg 2>/dev/null | b64; line
mark meminfo; cat /proc/meminfo 2>/dev/null | b64; line
mark disk; df -P -B1 / 2>/dev/null | tail -1 | b64; line
mark node; (command -v node >/dev/null 2>&1 && node -v || echo '') | b64; line
mark pm2; (command -v pm2 >/dev/null 2>&1 && pm2 jlist 2>/dev/null || echo '[]') | b64; line
mark dockerps; (command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}	{{.Status}}	{{.Label "com.docker.compose.project"}}	{{.Label "com.docker.compose.project.working_dir"}}' 2>/dev/null || true) | b64; line
mark dockerstats; (command -v docker >/dev/null 2>&1 && docker stats --no-stream --format '{{.Name}}	{{.CPUPerc}}	{{.MemUsage}}' 2>/dev/null || true) | b64; line
mark du; (du -sb /var/www/* /var/www/.../* /home/*/projects/* /home/*/* /opt/* /opt/supabase/* 2>/dev/null | grep -vE '\t/(home/[^/]+|opt|opt/supabase)$|/home/[^/]+/\.' || true) | b64; line
`;

function sshArgs(server) {
  const args = [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=8',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
    '-o', 'LogLevel=ERROR',
    '-o', 'IdentitiesOnly=yes',
  ];
  if (server.key) args.push('-i', server.key);
  args.push(`${server.user}@${server.host}`, 'bash -s');
  return args;
}

function runScript(server, script, timeoutMs = 45_000) {
  return new Promise((resolve) => {
    const [bin, args] = server.local ? ['bash', ['-s']] : ['ssh', sshArgs(server)];
    const child = spawn(bin, args, { stdio: ['pipe', 'pipe', 'pipe'] });

    let stdout = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      resolve(null);
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', () => {});
    child.on('error', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(null);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(code === 0 ? stdout : null);
    });

    child.stdin.end(script);
  });
}

function decodeSections(stdout) {
  const sections = {};
  const re = /##([a-z0-9_]+)##([^\n]*)/gi;
  let match;
  while ((match = re.exec(stdout)) !== null) {
    const [, key, payload] = match;
    try {
      sections[key] = Buffer.from(payload, 'base64').toString('utf8');
    } catch {
      sections[key] = '';
    }
  }
  return sections;
}

function parseUnits(value) {
  const match = /([\d.]+)\s*(B|kB|KiB|MB|MiB|GB|GiB|TB|TiB)/i.exec(String(value || ''));
  if (!match) return 0;

  const table = {
    b: 1,
    kb: 1000,
    kib: 1024,
    mb: 1000 ** 2,
    mib: 1024 ** 2,
    gb: 1000 ** 3,
    gib: 1024 ** 3,
    tb: 1000 ** 4,
    tib: 1024 ** 4,
  };

  return Math.round(Number(match[1]) * (table[match[2].toLowerCase()] ?? 0));
}

function parsePm2(raw) {
  if (!raw) return [];
  const start = raw.indexOf('[');
  if (start < 0) return [];

  try {
    return JSON.parse(raw.slice(start)).map((app) => ({
      name: app.name,
      cwd: app.pm2_env?.pm_cwd || null,
      status: app.pm2_env?.status || 'unknown',
      memory: app.monit?.memory || 0,
      cpu: app.monit?.cpu || 0,
      restarts: app.pm2_env?.restart_time || 0,
    }));
  } catch {
    return [];
  }
}

function parseDockerPs(raw) {
  if (!raw) return [];

  return raw
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => {
      const [name, status, project, workdir] = line.split('\t');
      return { name, status, project: project || null, workdir: workdir || null, memory: 0, cpu: 0 };
    });
}

function parseDockerStats(raw) {
  const stats = new Map();
  if (!raw) return stats;

  for (const line of raw.split('\n').filter((line) => line.trim())) {
    const [name, cpu, memUsage] = line.split('\t');
    if (!name) continue;
    const [used] = String(memUsage || '').split('/');
    stats.set(name, { cpu, memory: parseUnits(used) });
  }

  return stats;
}

function parseMeminfo(raw) {
  const read = (key) => {
    const match = new RegExp(`${key}:\\s+(\\d+) kB`).exec(raw || '');
    return match ? Number(match[1]) * 1024 : 0;
  };

  const total = read('MemTotal');
  const available = read('MemAvailable') || read('MemFree');
  return { total, free: read('MemFree'), available, used: Math.max(total - available, 0) };
}

function parseDisk(raw) {
  const parts = String(raw || '').trim().split(/\s+/);
  const total = Number(parts[1]) || 0;
  const used = Number(parts[2]) || 0;
  const free = Number(parts[3]) || 0;
  return { total, used, free };
}

function parseDu(raw) {
  const sizes = new Map();
  for (const line of String(raw || '').split('\n')) {
    const [size, path] = line.split('\t');
    if (!size || !path) continue;
    const value = Number(size);
    if (Number.isFinite(value)) sizes.set(path.replace(/\/+$/, ''), value);
  }
  return sizes;
}

function projectLabel(root) {
  if (root.startsWith('compose:')) {
    const base = root.slice('compose:'.length);
    return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  if (/^\/home\/[^/]+$/.test(root)) {
    return `Home apps (${root.split('/').pop()})`;
  }

  const parts = root.split('/').filter(Boolean);
  const base = parts[parts.length - 1] || root;

  // /opt/supabase/<stack> and similar: keep the parent for context.
  if (parts.length >= 2 && ['supabase'].includes(parts[parts.length - 2])) {
    return `${parts[parts.length - 2]} / ${base}`.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  return base.replace(/[-_]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function matchRoot(cwd, roots) {
  if (!cwd) return null;

  let best = null;
  for (const root of roots) {
    if (cwd === root || cwd.startsWith(`${root}/`)) {
      if (!best || root.length > best.length) best = root;
    }
  }

  return best;
}

const quoted = (value) => `'${String(value).replace(/'/g, `'\\''`)}'`;

async function duExtra(server, paths) {
  if (paths.length === 0) return new Map();

  const script = `du -sb ${paths.map(quoted).join(' ')} 2>/dev/null || true`;
  const out = await runScript(server, script, 20_000);
  return parseDu(out);
}

export async function collectServerMetrics(serverId) {
  const server = findServer(serverId);
  const cached = caches.get(server.id);

  if (cached && Date.now() - cached.at < RESPONSE_TTL_MS) return cached.data;

  const stdout = await runScript(server, PROBE);

  if (!stdout) {
    const data = {
      generatedAt: new Date().toISOString(),
      unreachable: true,
      server: { id: server.id, label: server.label, host: server.host },
      host: { hostname: server.host, platform: 'unreachable', arch: '', cpuCount: 0, nodeVersion: '' },
      memory: { total: 0, used: 0, available: 0, free: 0 },
      disk: { total: 0, used: 0, free: 0 },
      pm2: [],
      containers: [],
      projects: [],
      totals: { projectRam: 0, containerRam: 0, pm2Ram: 0, projectDisk: 0 },
    };
    return data;
  }

  const sections = decodeSections(stdout);
  const pm2Apps = parsePm2(sections.pm2);
  const dockerStats = parseDockerStats(sections.dockerstats);
  const containers = parseDockerPs(sections.dockerps).map((container) => ({
    ...container,
    ...(dockerStats.get(container.name) || {}),
  }));

  const duSizes = parseDu(sections.du);
  const roots = [...duSizes.keys()].filter((root) => root.split('/').pop() !== '...');

  const unmatched = new Set();
  for (const app of pm2Apps) {
    if (app.cwd && !matchRoot(app.cwd, roots)) unmatched.add(app.cwd);
  }
  for (const container of containers) {
    if (container.workdir && !matchRoot(container.workdir, roots)) unmatched.add(container.workdir);
  }

  if (unmatched.size > 0) {
    const extra = await duExtra(server, [...unmatched]);
    for (const [path, size] of extra) {
      duSizes.set(path, size);
      roots.push(path);
    }
  }

  const projects = new Map();
  const ensure = (root) => {
    if (!root) return null;
    if (!projects.has(root)) {
      projects.set(root, {
        root,
        name: projectLabel(root),
        diskBytes: duSizes.get(root) || 0,
        appRam: 0,
        containerRam: 0,
        apps: [],
        containers: [],
      });
    }
    return projects.get(root);
  };

  for (const root of roots) ensure(root);

  for (const app of pm2Apps) {
    const root = matchRoot(app.cwd, roots) ?? app.cwd ?? null;
    const project = ensure(root);
    if (!project) continue;
    project.appRam += app.memory;
    project.apps.push({ name: app.name, status: app.status, memory: app.memory, cpu: app.cpu });
  }

  for (const container of containers) {
    const byWorkdir = matchRoot(container.workdir, roots);
    const root = byWorkdir ?? container.workdir ?? (container.project ? "compose:" + container.project : null);
    const project = ensure(root);
    if (!project) continue;
    project.containerRam += container.memory || 0;
    project.containers.push({
      name: container.name,
      status: container.status,
      memory: container.memory || 0,
      cpu: container.cpu || 0,
    });
  }

  const projectList = [...projects.values()]
    .map((project) => ({ ...project, ramBytes: project.appRam + project.containerRam }))
    .filter((project) => project.ramBytes > 0 || project.diskBytes > 0)
    .sort((a, b) => b.ramBytes - a.ramBytes || b.diskBytes - a.diskBytes);

  const load = String(sections.load || '').trim().split(/\s+/).map(Number).filter(Number.isFinite);

  const data = {
    generatedAt: new Date().toISOString(),
    server: { id: server.id, label: server.label, host: server.host, local: server.local === true },
    host: {
      hostname: String(sections.hostname || '').trim() || server.host,
      platform: String(sections.uname || '').trim(),
      arch: '',
      cpuCount: Number(sections.nproc) || 0,
      cpuModel: '',
      loadAverage: load,
      uptimeSeconds: Math.round(Number(sections.uptime) || 0),
      nodeVersion: String(sections.node || '').trim() || 'n/a',
    },
    memory: parseMeminfo(sections.meminfo),
    disk: parseDisk(sections.disk),
    pm2: pm2Apps,
    containers,
    projects: projectList,
    totals: {
      projectRam: projectList.reduce((sum, project) => sum + project.ramBytes, 0),
      containerRam: containers.reduce((sum, container) => sum + (container.memory || 0), 0),
      pm2Ram: pm2Apps.reduce((sum, app) => sum + app.memory, 0),
      projectDisk: projectList.reduce((sum, project) => sum + project.diskBytes, 0),
    },
  };

  caches.set(server.id, { at: Date.now(), data });
  return data;
}

export async function collectAllServers() {
  const servers = listServers();
  const results = await Promise.all(servers.map((server) => collectServerMetrics(server.id)));
  return results;
}
