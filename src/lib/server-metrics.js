import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const PM2_BIN = process.env.PM2_BIN || 'pm2';
const DOCKER_BIN = process.env.DOCKER_BIN || 'docker';

const RESPONSE_TTL_MS = 15_000;
const DIR_SIZE_TTL_MS = 5 * 60_000;

let responseCache = { at: 0, data: null };
const dirSizeCache = new Map();

async function run(bin, args, timeout = 10_000) {
  try {
    const { stdout } = await exec(bin, args, { timeout, maxBuffer: 16 * 1024 * 1024 });
    return stdout;
  } catch {
    return null;
  }
}

function parseUnits(value) {
  const match = /([\d.]+)\s*(B|kB|KiB|MB|MiB|GB|GiB|TB|TiB)/i.exec(String(value || ''));
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
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

  return Math.round(amount * (table[unit] ?? 0));
}

function parsePm2(stdout) {
  if (!stdout) return [];

  const start = stdout.indexOf('[');
  if (start < 0) return [];

  try {
    const list = JSON.parse(stdout.slice(start));
    return list.map((app) => ({
      name: app.name,
      cwd: app.pm2_env?.pm_cwd || null,
      status: app.pm2_env?.status || 'unknown',
      memory: app.monit?.memory || 0,
      cpu: app.monit?.cpu || 0,
      restarts: app.pm2_env?.restart_time || 0,
      uptimeMs: app.pm2_env?.pm_uptime ? Date.now() - app.pm2_env.pm_uptime : 0,
    }));
  } catch {
    return [];
  }
}

function parseDockerPs(stdout) {
  if (!stdout) return [];

  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, status, project, workdir] = line.split('\t');
      return {
        name,
        status,
        project: project || null,
        workdir: workdir || null,
        memory: 0,
        cpu: 0,
      };
    });
}

function parseDockerStats(stdout) {
  const stats = new Map();
  if (!stdout) return stats;

  for (const line of stdout.split('\n').filter(Boolean)) {
    const [name, cpu, memUsage] = line.split('\t');
    if (!name) continue;
    const [used] = String(memUsage || '').split('/');
    stats.set(name, {
      cpu,
      memory: parseUnits(used),
    });
  }

  return stats;
}

function projectRoot(cwd) {
  if (!cwd) return null;

  const wwwMatch = cwd.match(/^(\/var\/www\/[^/]+)/);
  if (wwwMatch) return wwwMatch[1];

  const homeProjects = cwd.match(/^(\/home\/[^/]+\/projects\/[^/]+)/);
  if (homeProjects) return homeProjects[1];

  return null;
}

// Some deployments sit under oddly named directories (e.g. /var/www/.../app).
// Use the first child that actually contains the process cwd as the project.
async function resolveProjectRoot(cwd) {
  const direct = projectRoot(cwd);
  if (!direct || !direct.endsWith('/...')) return direct;

  try {
    const entries = await fs.readdir(direct, { withFileTypes: true });
    const match = entries.find(
      (entry) => entry.isDirectory() && cwd.startsWith(`${direct}/${entry.name}`),
    );
    if (match) return `${direct}/${match.name}`;
  } catch {
    // fall back to the literal root
  }

  return direct;
}

function projectName(root) {
  const parts = root.split('/').filter(Boolean);
  const last = parts[parts.length - 1] || root;

  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

async function directorySize(root) {
  const cached = dirSizeCache.get(root);
  if (cached && Date.now() - cached.at < DIR_SIZE_TTL_MS) return cached.size;

  const stdout = await run('du', ['-sb', root], 20_000);
  const size = stdout ? Number(stdout.split('\t')[0]) || 0 : 0;

  dirSizeCache.set(root, { at: Date.now(), size });
  return size;
}

async function memoryInfo() {
  const total = os.totalmem();
  const free = os.freemem();
  let available = free;

  try {
    const meminfo = await fs.readFile('/proc/meminfo', 'utf8');
    const match = /MemAvailable:\s+(\d+) kB/.exec(meminfo);
    if (match) available = Number(match[1]) * 1024;
  } catch {
    // non-Linux platforms fall back to os.freemem
  }

  return { total, free, available, used: Math.max(total - available, 0) };
}

async function diskInfo() {
  try {
    const stats = await fs.statfs('/');
    const total = stats.blocks * stats.bsize;
    const free = stats.bavail * stats.bsize;

    return { total, free, used: Math.max(total - free, 0) };
  } catch {
    return { total: 0, free: 0, used: 0 };
  }
}

async function listVarWwwDirs() {
  try {
    const entries = await fs.readdir('/var/www', { withFileTypes: true });
    const dirs = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name === 'html' || entry.name === 'apk') continue;

      const root = `/var/www/${entry.name}`;

      // Containers-only parents (e.g. /var/www/...) are skipped: their children
      // are reported individually from the process working directory.
      if (entry.name === '...') continue;

      dirs.push(root);
    }

    return dirs;
  } catch {
    return [];
  }
}

export async function collectServerMetrics() {
  if (responseCache.data && Date.now() - responseCache.at < RESPONSE_TTL_MS) {
    return responseCache.data;
  }

  const [pm2Out, psOut, statsOut, wwwDirs, memory, disk] = await Promise.all([
    run(PM2_BIN, ['jlist']),
    run(DOCKER_BIN, [
      'ps',
      '--format',
      '{{.Names}}\t{{.Status}}\t{{.Label "com.docker.compose.project"}}\t{{.Label "com.docker.compose.project.working_dir"}}',
    ]),
    run(DOCKER_BIN, ['stats', '--no-stream', '--format', '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}']),
    listVarWwwDirs(),
    memoryInfo(),
    diskInfo(),
  ]);

  const pm2Apps = parsePm2(pm2Out);
  const dockerStats = parseDockerStats(statsOut);
  const containers = parseDockerPs(psOut).map((container) => ({
    ...container,
    ...(dockerStats.get(container.name) || {}),
  }));

  const projects = new Map();

  const ensureProject = (root, name) => {
    if (!root) return null;
    if (!projects.has(root)) {
      projects.set(root, {
        root,
        name: name || projectName(root),
        diskBytes: 0,
        appRam: 0,
        containerRam: 0,
        apps: [],
        containers: [],
      });
    }
    return projects.get(root);
  };

  for (const app of pm2Apps) {
    const root = await resolveProjectRoot(app.cwd);
    const project = ensureProject(root);
    if (project) {
      project.appRam += app.memory;
      project.apps.push({ name: app.name, status: app.status, memory: app.memory, cpu: app.cpu });
    }
  }

  for (const container of containers) {
    const root = container.workdir
      ? (await resolveProjectRoot(container.workdir)) || container.workdir
      : null;
    const project = ensureProject(root);
    if (project) {
      project.containerRam += container.memory || 0;
      project.containers.push({
        name: container.name,
        status: container.status,
        memory: container.memory || 0,
        cpu: container.cpu || 0,
      });
    }
  }

  for (const dir of wwwDirs) ensureProject(dir);

  await Promise.all(
    [...projects.values()].map(async (project) => {
      project.diskBytes = await directorySize(project.root);
    }),
  );

  const projectList = [...projects.values()]
    .map((project) => ({
      ...project,
      ramBytes: project.appRam + project.containerRam,
      totalBytes: project.appRam + project.containerRam,
    }))
    .sort((a, b) => b.ramBytes - a.ramBytes || b.diskBytes - a.diskBytes);

  const data = {
    generatedAt: new Date().toISOString(),
    host: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      cpuCount: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'unknown',
      loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100),
      uptimeSeconds: Math.round(os.uptime()),
      nodeVersion: process.version,
    },
    memory,
    disk,
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

  responseCache = { at: Date.now(), data };
  return data;
}
