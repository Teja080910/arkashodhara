import { Inject, Injectable } from '@nestjs/common';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { desc, eq, sql } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { ForbiddenError } from '@platform/common';
import { DB, type Database } from '../../core.module';

const execFileAsync = promisify(execFile);

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  ip?: string;
  userAgent?: string;
}

interface ServerEntry {
  id: string;
  label: string;
  local: boolean;
  host: string;
  user?: string;
  key?: string;
}

const metricsCache = new Map<string, { at: number; data: unknown }>();
const CACHE_TTL_MS = 60_000;

@Injectable()
export class ArkasodharaService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async recordContact(input: ContactInput): Promise<void> {
    await this.db.execute(sql`
      insert into contact_messages (name, email, message, ip, user_agent)
      values (${input.name}, ${input.email}, ${input.message}, ${input.ip ?? null}, ${input.userAgent ?? null})
    `);
  }

  async listContact(limit = 100): Promise<unknown[]> {
    return this.db.execute(sql`
      select id, name, email, message, created_at as "createdAt"
        from contact_messages
       order by created_at desc
       limit ${limit}
    `).then((result) => (result as unknown as { rows: unknown[] }).rows);
  }

  async servers(): Promise<unknown[]> {
    const raw = process.env.ADMIN_SERVERS ?? '';
    const entries = raw
      .split(/[,\n]/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const servers = entries
      .map((entry): ServerEntry | null => {
        const [id, label, target, key] = entry.split('|').map((part) => (part ?? '').trim());
        if (!id || !target) return null;
        if (target === 'local') return { id, label: label || id, local: true, host: 'local' };
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
      .filter((server): server is ServerEntry => server !== null);

    return servers.length > 0 ? servers : [{ id: 'local', label: 'This server', local: true, host: 'local' }];
  }

  async collectMetrics(serverId: string, user: AuthUser): Promise<unknown> {
    const allowed = (process.env.METRICS_ALLOWED_ROLES ?? 'admin').split(',').map((s) => s.trim());
    if (!allowed.includes(user.role)) throw new ForbiddenError('Metrics are admin-only');

    const cached = metricsCache.get(serverId);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.data;

    const servers = (await this.servers()) as ServerEntry[];
    const server = servers.find((entry) => entry.id === serverId) ?? servers[0]!;

    const script = PROBE_SCRIPT;
    let stdout = '';
    try {
      if (server.local) {
        const result = await runLocal(script);
        stdout = result;
      } else {
        stdout = await runRemote(server, script);
      }
    } catch {
      stdout = '';
    }

    const data = parseProbe(stdout, server);
    metricsCache.set(serverId, { at: Date.now(), data });

    await this.db.execute(sql`
      insert into metrics_audit (actor_id, actor_email, action, detail)
      values (${user.id}, ${user.email}, 'metrics.read', ${JSON.stringify({ server: server.id })}::jsonb)
    `);

    return data;
  }

  async metricsAudit(limit = 100): Promise<unknown[]> {
    return this.db.execute(sql`
      select id, actor_id as "actorId", actor_email as "actorEmail", action, detail, created_at as "createdAt"
        from metrics_audit
       order by created_at desc
       limit ${limit}
    `).then((result) => (result as unknown as { rows: unknown[] }).rows);
  }
}

const PROBE_SCRIPT = String.raw`
b64() { base64 -w0 2>/dev/null || base64 | tr -d '\n'; }
echo "==host=="; uname -a | b64
echo "==uptime=="; cat /proc/uptime 2>/dev/null | b64
echo "==mem=="; free -b 2>/dev/null | b64
echo "==disk=="; df -B1 / 2>/dev/null | tail -1 | b64
echo "==cpu=="; nproc 2>/dev/null | b64
echo "==load=="; cat /proc/loadavg 2>/dev/null | b64
echo "==pm2=="; pm2 jlist 2>/dev/null | b64
echo "==dockerps=="; docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' 2>/dev/null | b64
echo "==dockerstats=="; docker stats --no-stream --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null | b64
echo "==du=="; du -sb /var/www/* /home/*/projects/* /opt/* 2>/dev/null | b64
echo "==end=="
`;

function runLocal(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-lc', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || output.length > 0 ? resolve(output) : reject(new Error(`exit ${code}`))));
  });
}

function runRemote(server: ServerEntry, script: string): Promise<string> {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10'];
  if (server.key) args.push('-i', server.key);
  args.push(`${server.user ?? 'root'}@${server.host}`, 'bash -s');
  return new Promise((resolve, reject) => {
    const child = spawn('ssh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 || output.length > 0 ? resolve(output) : reject(new Error(`ssh exit ${code}`))));
    child.stdin.write(script);
    child.stdin.end();
  });
}

function parseProbe(stdout: string, server: ServerEntry): unknown {
  const sections = new Map<string, string>();
  let current: string | null = null;
  const buffer: string[] = [];

  for (const line of stdout.split('\n')) {
    const match = /^==(.+)==$/.exec(line.trim());
    if (match) {
      if (current) sections.set(current, buffer.join('\n'));
      current = match[1]!;
      buffer.length = 0;
    } else if (current) {
      buffer.push(line);
    }
  }
  if (current) sections.set(current, buffer.join('\n'));

  const decode = (name: string): string => {
    const raw = (sections.get(name) ?? '').trim();
    if (!raw) return '';
    try {
      return Buffer.from(raw, 'base64').toString('utf8');
    } catch {
      return '';
    }
  };

  const mem = parseFree(decode('mem'));
  const disk = parseDf(decode('disk'));
  const pm2 = parsePm2(decode('pm2'));
  const containers = parseDocker(decode('dockerps'), decode('dockerstats'));
  const projects = parseDu(decode('du'));

  return {
    generatedAt: new Date().toISOString(),
    unreachable: !decode('host'),
    server: { id: server.id, label: server.label, host: server.host },
    host: {
      hostname: server.host,
      platform: decode('host').split(' ')[0] ?? '',
      arch: decode('host').split(' ').slice(-2, -1)[0] ?? '',
      cpuCount: Number(decode('cpu').trim()) || 0,
      uptimeSeconds: Number(decode('uptime').split(' ')[0] ?? 0),
    },
    load: decode('load').trim(),
    memory: mem,
    disk,
    pm2,
    containers,
    projects,
    totals: {
      projectDisk: projects.reduce((sum, project) => sum + project.diskBytes, 0),
    },
  };
}

function parseFree(raw: string): unknown {
  const line = raw.split('\n').find((row) => row.trim().startsWith('Mem:'));
  if (!line) return { total: 0, used: 0, available: 0, free: 0 };
  const parts = line.trim().split(/\s+/);
  return {
    total: Number(parts[1] ?? 0),
    used: Number(parts[2] ?? 0),
    free: Number(parts[3] ?? 0),
    available: Number(parts[6] ?? parts[3] ?? 0),
  };
}

function parseDf(raw: string): unknown {
  const parts = raw.trim().split(/\s+/);
  return {
    total: Number(parts[1] ?? 0),
    used: Number(parts[2] ?? 0),
    free: Number(parts[3] ?? 0),
  };
}

function parsePm2(raw: string): unknown[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((app) => {
      const env = app.pm2_env as Record<string, unknown> | undefined;
      const monit = app.monit as Record<string, unknown> | undefined;
      return {
        name: app.name,
        status: env?.status,
        cpu: monit?.cpu,
        memory: monit?.memory,
        cwd: env?.pm_cwd,
      };
    });
  } catch {
    return [];
  }
}

function parseDocker(psRaw: string, statsRaw: string): unknown[] {
  const stats = new Map<string, { cpu: string; mem: string }>();
  for (const line of statsRaw.split('\n')) {
    const [name, cpu, mem] = line.split('\t');
    if (name) stats.set(name, { cpu: cpu ?? '', mem: mem ?? '' });
  }

  return psRaw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [name, image, status] = line.split('\t');
      const stat = stats.get(name ?? '');
      return { name, image, status, cpu: stat?.cpu, memory: stat?.mem };
    });
}

function parseDu(raw: string): Array<{ path: string; diskBytes: number }> {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [size, path] = line.split('\t');
      return { path: path ?? '', diskBytes: Number(size ?? 0) };
    })
    .filter((entry) => Boolean(entry.path));
}

void execFileAsync;
void eq;
void desc;
