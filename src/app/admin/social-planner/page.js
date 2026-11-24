'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Bot,
  CalendarDays,
  Check,
  FileText,
  ListChecks,
  PartyPopper,
  Play,
  Plus,
  RefreshCw,
  Send,
  X,
} from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand-400/60';
const smallButton =
  'inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/10 disabled:opacity-40';

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-white/10 bg-ink-800 p-5 ${className}`}>{children}</section>;
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
    red: 'border-red-500/30 bg-red-500/10 text-red-300',
    blue: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    slate: 'border-white/10 bg-white/5 text-slate-400',
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

function statusTone(status) {
  if (status === 'published' || status === 'approved') return 'green';
  if (status === 'pending_approval' || status === 'planned') return 'amber';
  if (status === 'rejected' || status === 'failed') return 'red';
  if (status === 'superseded') return 'slate';
  return 'blue';
}

const tabs = [
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'series', label: 'Series', icon: ListChecks },
  { id: 'festivals', label: 'Festivals', icon: PartyPopper },
];

export default function SocialPlannerPage() {
  const router = useRouter();
  const [tab, setTab] = useState('calendar');
  const [overview, setOverview] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [filters, setFilters] = useState({ platform: '', status: '' });
  const [series, setSeries] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [seriesForm, setSeriesForm] = useState({ topic: '', totalDays: 30, startDate: today(1), audience: 'beginners' });
  const [festivalForm, setFestivalForm] = useState({ date: today(30), name: '', greeting: '', hashtags: '' });

  const api = useCallback(
    async (path, options = {}) => {
      const response = await fetch(`/api/admin/social-planner${path}`, {
        cache: 'no-store',
        ...options,
        headers: {
          ...(options.body ? { 'content-type': 'application/json' } : {}),
          ...(options.headers || {}),
        },
      });
      if (response.status === 401) {
        router.replace('/admin');
        return null;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      return data;
    },
    [router],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setBusy('refresh');
      setError('');
      try {
        const [o, c, s, f] = await Promise.all([
          api('/overview'),
          api(`/calendar?from=${today(-7)}&to=${today(120)}`),
          api('/series'),
          api('/festivals'),
        ]);
        setOverview(o);
        setCalendar(c?.items || []);
        setSeries(s?.series || []);
        setFestivals(f?.festivals || []);
      } catch (err) {
        setError(err.message || 'Could not load the social planner');
      } finally {
        setLoading(false);
        setBusy('');
      }
    },
    [api],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setFilters({ platform: params.get('platform') || '', status: params.get('status') || '' });
  }, []);

  const visibleCalendar = useMemo(() => {
    return calendar.filter((item) => {
      if (filters.platform && !(item.platforms || []).includes(filters.platform)) return false;
      if (filters.status && item.status !== filters.status) return false;
      return true;
    });
  }, [calendar, filters]);

  const run = async (key, fn, success) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      await fn();
      setMessage(success);
      await load();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const createSeries = async (event) => {
    event.preventDefault();
    await run(
      'series-create',
      async () => {
        const data = await api('/series', {
          method: 'POST',
          body: JSON.stringify({
            topic: seriesForm.topic.trim(),
            totalDays: Number(seriesForm.totalDays),
            startDate: seriesForm.startDate,
            audience: seriesForm.audience || 'beginners',
          }),
        });
        if (data?.series?.id) await api(`/series/${data.series.id}/activate`, { method: 'POST' });
      },
      'Series created and scheduled.',
    );
    setSeriesForm((current) => ({ ...current, topic: '' }));
  };

  const createFestival = async (event) => {
    event.preventDefault();
    await run(
      'festival-create',
      async () => {
        const data = await api('/festivals', {
          method: 'POST',
          body: JSON.stringify({
            date: festivalForm.date,
            name: festivalForm.name.trim(),
            greeting: festivalForm.greeting.trim() || `Happy ${festivalForm.name.trim()}!`,
            hashtags: festivalForm.hashtags
              .split(',')
              .map((tag) => tag.trim().replace(/^#/, ''))
              .filter(Boolean),
          }),
        });
        if (data?.id) await api(`/festivals/${data.id}/schedule`, { method: 'POST' });
      },
      'Festival created and added to the calendar.',
    );
    setFestivalForm((current) => ({ ...current, name: '', greeting: '', hashtags: '' }));
  };

  const counts = useMemo(() => {
    const base = { planned: 0, pending_approval: 0, approved: 0, published: 0, superseded: 0 };
    return { ...base, ...(overview?.counts || {}) };
  }, [overview]);

  if (loading) {
    return <div className="p-10 text-center text-sm text-slate-500">Loading social planner...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Social Planner</h1>
            <Badge tone={overview?.enabled ? 'green' : 'red'}>
              {overview?.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Calendar, topic series, festival posts and two-bot approval routing.
          </p>
        </div>
        <button type="button" onClick={() => void load(true)} className={smallButton}>
          <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </header>

      {(error || message) && (
        <p
          className={`mb-5 rounded-xl border px-4 py-3 text-xs ${
            error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Planned', counts.planned],
          ['Pending approval', counts.pending_approval],
          ['Approved', counts.approved],
          ['Published', counts.published],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-white">{value ?? 0}</p>
          </Card>
        ))}
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-white">LinkedIn bot</p>
            <p className="mt-1 text-[11px] text-slate-500">LinkedIn only</p>
          </div>
          <Badge tone={overview?.bots?.linkedin?.configured ? 'green' : 'amber'}>
            {overview?.bots?.linkedin?.configured ? 'Configured' : 'Missing'}
          </Badge>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs font-semibold text-white">Video bot</p>
            <p className="mt-1 text-[11px] text-slate-500">Instagram + Facebook</p>
          </div>
          <Badge tone={overview?.bots?.video?.configured ? 'green' : 'amber'}>
            {overview?.bots?.video?.configured ? 'Configured' : 'Missing'}
          </Badge>
        </Card>
      </div>

      <div className="mb-5 flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              tab === id ? 'bg-brand-600/25 text-brand-200' : 'text-slate-500 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' && (
        <Card>
          <h2 className="text-sm font-semibold text-white">Content calendar</h2>
          <p className="mb-4 mt-1 text-[11px] text-slate-500">
            Generation starts 3 days before. Push unlocks on the publish date and time.
          </p>
          {(filters.platform || filters.status) && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                {filters.platform ? `platform: ${filters.platform}` : `status: ${filters.status}`}
              </span>
              <a href="/admin/social-planner" className="text-brand-300 hover:text-brand-200">clear filter</a>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full min-w-[900px] border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-slate-500">
                  {['Date', 'Item', 'Platforms', 'Status', 'Approvals', 'Actions'].map((head) => (
                    <th key={head} className="px-3 py-3 font-medium">{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleCalendar.map((item) => (
                  <tr key={item.id} className="border-b border-white/5 last:border-0">
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-300">
                      {item.publishDate} <span className="text-slate-600">{item.publishTime}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2">
                        {(item.coverPath || item.assetPath) && (
                          <a
                            href={item.assetKind === 'video' ? item.assetPath || item.coverPath : item.coverPath || item.assetPath}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block h-11 w-11 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/40"
                            title={item.assetKind === 'video' ? 'Play video asset' : 'Open image asset'}
                          >
                            <img src={item.coverPath || item.assetPath} alt="" className="h-full w-full object-cover" />
                            {item.assetKind === 'video' && (
                              <span className="absolute inset-0 grid place-items-center bg-black/35 text-[10px] font-semibold text-white">▶</span>
                            )}
                          </a>
                        )}
                        <div>
                          <p className="text-xs font-semibold text-white">{item.title}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{item.kind}{item.assetKind ? ` · ${item.assetKind}` : ''}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.platforms?.map((platform) => (
                          <Badge key={platform} tone="slate">{platform}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={statusTone(item.status)}>{item.status.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(item.approvals || []).map((approval) => (
                          <Badge key={approval.bot} tone={approval.status === 'approved' ? 'green' : approval.status === 'rejected' ? 'red' : 'amber'}>
                            {approval.bot}
                          </Badge>
                        ))}
                        {(!item.approvals || item.approvals.length === 0) && <span className="text-[10px] text-slate-600">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {['planned', 'script_ready'].includes(item.status) && (
                          <button
                            type="button"
                            disabled={busy === `script-${item.id}`}
                            onClick={() => void run(`script-${item.id}`, () => api(`/calendar/${item.id}/script`, { method: 'POST' }), `Script ready for ${item.title}`)}
                            className={smallButton}
                          >
                            <FileText className="h-3 w-3" /> Script
                          </button>
                        )}
                        {(item.coverPath || item.assetPath) && (
                          <button
                            type="button"
                            disabled={busy === `regen-${item.id}`}
                            onClick={() => void run(`regen-${item.id}`, () => api(`/calendar/${item.id}/regenerate`, { method: 'POST' }), `Assets cleared for ${item.title}`)}
                            className={smallButton}
                            title="Clear assets and re-render on the next worker run"
                          >
                            <RefreshCw className="h-3 w-3" /> Regen
                          </button>
                        )}
                        {['planned', 'script_ready', 'video_ready'].includes(item.status) && (
                          <button
                            type="button"
                            disabled={busy === `notify-${item.id}`}
                            onClick={() => void run(`notify-${item.id}`, () => api(`/calendar/${item.id}/notify`, { method: 'POST' }), `Sent ${item.title} to Telegram`)}
                            className={smallButton}
                          >
                            <Bot className="h-3 w-3" /> Send
                          </button>
                        )}
                        {['planned', 'pending_approval'].includes(item.status) && (
                          <button
                            type="button"
                            disabled={busy === `approve-${item.id}`}
                            onClick={() => void run(`approve-${item.id}`, () => api(`/calendar/${item.id}/approve`, { method: 'POST' }), `Approved ${item.title}`)}
                            className={smallButton}
                          >
                            <Check className="h-3 w-3" /> Approve
                          </button>
                        )}
                        {item.status === 'approved' && item.canPush && (
                          <button
                            type="button"
                            disabled={busy === `publish-${item.id}`}
                            onClick={() => {
                              if (!window.confirm(`Push ${item.title} to ${item.platforms.join(', ')} now?`)) return;
                              void run(`publish-${item.id}`, () => api(`/calendar/${item.id}/publish`, { method: 'POST' }), `Pushed ${item.title}`);
                            }}
                            className={smallButton}
                          >
                            <Send className="h-3 w-3" /> Push
                          </button>
                        )}
                        {item.status === 'approved' && !item.canPush && (
                          <span className="text-[10px] text-slate-500">
                            Opens {item.publishDate} {item.publishTime}
                          </span>
                        )}
                        {['planned', 'pending_approval', 'approved'].includes(item.status) && (
                          <button
                            type="button"
                            disabled={busy === `reject-${item.id}`}
                            onClick={() => void run(`reject-${item.id}`, () => api(`/calendar/${item.id}/reject`, { method: 'POST' }), `Rejected ${item.title}`)}
                            className={smallButton}
                          >
                            <X className="h-3 w-3" /> Reject
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {calendar.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-xs text-slate-500">No calendar items yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'series' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <h2 className="text-sm font-semibold text-white">New topic series</h2>
            <p className="mt-1 text-xs text-slate-500">Creates one daily post per day and schedules it at 09:00.</p>
            <form onSubmit={createSeries} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Topic</span>
                <input className={inputClass} value={seriesForm.topic} onChange={(e) => setSeriesForm({ ...seriesForm, topic: e.target.value })} placeholder="HTML" required />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400">Days</span>
                  <input className={inputClass} type="number" min="1" max="365" value={seriesForm.totalDays} onChange={(e) => setSeriesForm({ ...seriesForm, totalDays: e.target.value })} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] text-slate-400">Start date</span>
                  <input className={inputClass} type="date" value={seriesForm.startDate} onChange={(e) => setSeriesForm({ ...seriesForm, startDate: e.target.value })} />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Audience</span>
                <input className={inputClass} value={seriesForm.audience} onChange={(e) => setSeriesForm({ ...seriesForm, audience: e.target.value })} />
              </label>
              <button type="submit" disabled={busy === 'series-create'} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">
                <Plus className="h-3.5 w-3.5" /> Create & schedule
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-white">Series</h2>
            <div className="space-y-3">
              {series.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.topic}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {item.totalDays} days · starts {item.startDate} · {item.dayCount} scripts
                      </p>
                    </div>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span>{item.scheduledCount} scheduled</span>
                    <span>·</span>
                    <span>{item.publishedCount} published</span>
                  </div>
                </div>
              ))}
              {series.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No series yet.</p>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'festivals' && (
        <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <h2 className="text-sm font-semibold text-white">New festival post</h2>
            <p className="mt-1 text-xs text-slate-500">One post, all three platforms. Replaces the series post for that date.</p>
            <form onSubmit={createFestival} className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Date</span>
                <input className={inputClass} type="date" value={festivalForm.date} onChange={(e) => setFestivalForm({ ...festivalForm, date: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Festival</span>
                <input className={inputClass} value={festivalForm.name} onChange={(e) => setFestivalForm({ ...festivalForm, name: e.target.value })} placeholder="Independence Day" required />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Greeting</span>
                <input className={inputClass} value={festivalForm.greeting} onChange={(e) => setFestivalForm({ ...festivalForm, greeting: e.target.value })} placeholder="Happy Independence Day!" />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-slate-400">Hashtags (comma separated)</span>
                <input className={inputClass} value={festivalForm.hashtags} onChange={(e) => setFestivalForm({ ...festivalForm, hashtags: e.target.value })} placeholder="IndependenceDay, India" />
              </label>
              <button type="submit" disabled={busy === 'festival-create'} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-60">
                <Plus className="h-3.5 w-3.5" /> Create & schedule
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-sm font-semibold text-white">Festivals</h2>
            <div className="space-y-3">
              {festivals.map((festival) => (
                <div key={festival.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{festival.name}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{festival.date} · {festival.region}</p>
                    </div>
                    <Badge tone="blue">All platforms</Badge>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">{festival.greeting}</p>
                </div>
              ))}
              {festivals.length === 0 && <p className="py-8 text-center text-xs text-slate-500">No festivals yet.</p>}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
