'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Server, RefreshCw, LogOut, Cpu, HardDrive, MemoryStick, Boxes } from 'lucide-react';

const numberFormat = new Intl.NumberFormat('en-US');

function bytes(value) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  const amount = value / 1024 ** index;
  return `${amount.toFixed(amount >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function percent(used, total) {
  if (!total) return 0;
  return Math.min(Math.round((used / total) * 100), 100);
}

function duration(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
}

function Meter({ used, total, tone = 'brand' }) {
  const value = percent(used, total);
  const tones = {
    brand: 'from-brand-500 to-violet-500',
    amber: 'from-amber-400 to-orange-500',
    rose: 'from-rose-500 to-red-500',
  };

  return (
    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full bg-gradient-to-r ${tones[tone]}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, used, total, tone }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800 p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {typeof used === 'number' && typeof total === 'number' && (
        <Meter used={used} total={total} tone={tone} />
      )}
    </div>
  );
}

export default function ServerManagerPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);

      try {
        const res = await fetch('/api/admin/server', { cache: 'no-store' });

        if (res.status === 401) {
          router.replace('/admin');
          return;
        }

        const payload = await res.json();
        if (!res.ok) {
          setError(payload?.error || 'Could not load server metrics');
          return;
        }

        setData(payload);
        setError('');
      } catch {
        setError('Could not load server metrics');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => void load(true), 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const signOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' });
    router.replace('/admin');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-slate-400">
        Loading server metrics...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-900 px-4 py-8 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-violet-600">
              <Server className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-bold">Server Manager</h1>
              <p className="text-xs text-slate-500">
                {data?.host?.hostname} · {data?.host?.platform} · {data?.host?.arch} ·{' '}
                {data?.host?.cpuCount} vCPU · Node {data?.host?.nodeVersion}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">
              Updated {new Date(data?.generatedAt).toLocaleTimeString()}
            </span>
            <button
              onClick={() => void load(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={MemoryStick}
            label="RAM"
            value={`${bytes(data?.memory?.used)} / ${bytes(data?.memory?.total)}`}
            hint={`${percent(data?.memory?.used, data?.memory?.total)}% used · ${bytes(data?.memory?.available)} available`}
            used={data?.memory?.used}
            total={data?.memory?.total}
            tone={percent(data?.memory?.used, data?.memory?.total) > 85 ? 'rose' : 'brand'}
          />
          <StatCard
            icon={HardDrive}
            label="Disk"
            value={`${bytes(data?.disk?.used)} / ${bytes(data?.disk?.total)}`}
            hint={`${percent(data?.disk?.used, data?.disk?.total)}% used · ${bytes(data?.disk?.free)} free`}
            used={data?.disk?.used}
            total={data?.disk?.total}
            tone={percent(data?.disk?.used, data?.disk?.total) > 85 ? 'rose' : 'brand'}
          />
          <StatCard
            icon={Boxes}
            label="Projects"
            value={numberFormat.format(data?.projects?.length || 0)}
            hint={`${numberFormat.format(data?.pm2?.length || 0)} PM2 apps · ${numberFormat.format(data?.containers?.length || 0)} containers`}
          />
          <StatCard
            icon={Cpu}
            label="Load average"
            value={(data?.host?.loadAverage || []).join(' / ')}
            hint={`Uptime ${duration(data?.host?.uptimeSeconds || 0)}`}
          />
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-ink-800">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Projects</h2>
            <p className="text-xs text-slate-500">
              RAM from PM2 + Docker processes, disk from the project directory. Click a row for
              details.
            </p>
          </div>

          <div className="hidden grid-cols-[2fr_repeat(3,1fr)] gap-3 border-b border-white/10 px-5 py-3 text-[11px] uppercase tracking-widest text-slate-500 sm:grid">
            <span>Project</span>
            <span className="text-right">RAM</span>
            <span className="text-right">Disk</span>
            <span className="text-right">Processes</span>
          </div>

          {(data?.projects || []).map((project) => {
            const open = expanded === project.root;
            return (
              <div key={project.root} className="border-b border-white/5 last:border-b-0">
                <button
                  onClick={() => setExpanded(open ? null : project.root)}
                  className="grid w-full grid-cols-1 gap-2 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] sm:grid-cols-[2fr_repeat(3,1fr)] sm:items-center sm:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{project.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{project.root}</p>
                  </div>
                  <div className="flex justify-between sm:block sm:text-right">
                    <span className="text-[11px] uppercase text-slate-500 sm:hidden">RAM</span>
                    <span className="text-sm font-semibold text-brand-300">
                      {bytes(project.ramBytes)}
                    </span>
                  </div>
                  <div className="flex justify-between sm:block sm:text-right">
                    <span className="text-[11px] uppercase text-slate-500 sm:hidden">Disk</span>
                    <span className="text-sm text-slate-300">{bytes(project.diskBytes)}</span>
                  </div>
                  <div className="flex justify-between sm:block sm:text-right">
                    <span className="text-[11px] uppercase text-slate-500 sm:hidden">Processes</span>
                    <span className="text-sm text-slate-300">
                      {project.apps.length + project.containers.length}
                    </span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-white/5 bg-black/20 px-5 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">
                          PM2 apps
                        </p>
                        {project.apps.length === 0 && (
                          <p className="text-xs text-slate-600">No PM2 apps</p>
                        )}
                        {project.apps.map((app) => (
                          <div
                            key={app.name}
                            className="flex items-center justify-between border-b border-white/5 py-1.5 text-xs last:border-b-0"
                          >
                            <span className="text-slate-300">
                              {app.name}{' '}
                              <span
                                className={
                                  app.status === 'online' ? 'text-emerald-400' : 'text-amber-400'
                                }
                              >
                                · {app.status}
                              </span>
                            </span>
                            <span className="text-slate-400">
                              {bytes(app.memory)} · {app.cpu}%
                            </span>
                          </div>
                        ))}
                      </div>

                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-widest text-slate-500">
                          Containers
                        </p>
                        {project.containers.length === 0 && (
                          <p className="text-xs text-slate-600">No containers</p>
                        )}
                        {project.containers.map((container) => (
                          <div
                            key={container.name}
                            className="flex items-center justify-between border-b border-white/5 py-1.5 text-xs last:border-b-0"
                          >
                            <span className="truncate text-slate-300">{container.name}</span>
                            <span className="shrink-0 text-slate-400">
                              {bytes(container.memory)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {(data?.projects || []).length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No projects found.</p>
          )}
        </section>

        <p className="mt-6 text-center text-[11px] text-slate-600">
          Signed in as {data?.viewer} · auto-refresh every 30s
        </p>
      </div>
    </div>
  );
}
