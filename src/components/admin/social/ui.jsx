'use client';

import { ExternalLink } from 'lucide-react';

export function Card({ children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-white/10 bg-ink-800 p-5 ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({ title, description, action }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800 p-5">
      <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

const toneClasses = {
  green: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  red: 'border-red-500/30 bg-red-500/10 text-red-300',
  amber: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  blue: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
  slate: 'border-white/10 bg-white/5 text-slate-400',
};

export function Badge({ children, tone = 'slate', className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone] || toneClasses.slate} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status) {
  if (status === 'published') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'pending_approval') return 'amber';
  return 'slate';
}

export function statusLabel(status) {
  if (status === 'pending_approval') return 'Pending approval';
  return String(status || 'unknown').replace(/_/g, ' ');
}

export function Empty({ children = 'Nothing here yet.' }) {
  return <p className="py-10 text-center text-xs text-slate-500">{children}</p>;
}

export function ConnectionCard({ label, account, detail, optional = false }) {
  const connected = Boolean(account);
  const dot = connected ? 'bg-emerald-400' : optional ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800 p-4">
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">{label}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {connected ? account.accountName || account.accountId : 'Not connected'}
          </p>
          {connected && account.accountId && (
            <p className="mt-0.5 truncate text-[10px] text-slate-600">{account.accountId}</p>
          )}
          {detail && <p className="mt-1 text-[10px] text-slate-500">{detail}</p>}
        </div>
      </div>
    </div>
  );
}

export function formatDate(ms) {
  if (!ms) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function daysLeft(ms) {
  if (!ms) return '';
  const days = Math.floor((ms - Date.now()) / 86400000);
  if (days < 0) return 'expired';
  return `${days} day${days === 1 ? '' : 's'} left`;
}

export function mediaUrl(baseUrl, path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(baseUrl || '').replace(/\/$/, '')}/media/${encodeURIComponent(path)}`;
}

export function Thumb({ baseUrl, path }) {
  const url = mediaUrl(baseUrl, path);
  if (!url) return <span className="text-xs text-slate-600">—</span>;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="h-11 w-11 rounded-lg border border-white/10 object-cover"
    />
  );
}

function ResultChips({ results }) {
  if (!results.length) return <span className="text-xs text-slate-600">—</span>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {results.map((result) => {
        const ok = result.status === 'published';
        return (
          <span
            key={result.id}
            title={result.external_id || result.error || ''}
            className={`inline-flex max-w-[240px] items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] ${
              ok
                ? 'border-emerald-500/25 bg-emerald-500/5 text-emerald-300'
                : 'border-red-500/25 bg-red-500/5 text-red-300'
            }`}
          >
            <span className="truncate">
              {result.platform}: {ok ? 'ok' : result.error || 'failed'}
            </span>
            {ok && result.url && (
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        );
      })}
    </div>
  );
}

function shorten(text, max = 120) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max - 1).trimEnd()}…` : value;
}

function Caption({ text }) {
  if (!text) return null;
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-[10px] text-slate-500 hover:text-slate-300">
        Caption
      </summary>
      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/20 p-3 font-sans text-[11px] leading-relaxed text-slate-400">
        {text}
      </pre>
    </details>
  );
}

export function PostTable({ posts, results, baseUrl, empty = 'Nothing published yet.' }) {
  if (!posts.length) return <Empty>{empty}</Empty>;

  const byPost = new Map();
  for (const result of results || []) {
    if (!byPost.has(result.post_id)) byPost.set(result.post_id, []);
    byPost.get(result.post_id).push(result);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-slate-500">
            <th className="px-3 py-3 font-medium">Image</th>
            <th className="px-3 py-3 font-medium">Post</th>
            <th className="px-3 py-3 font-medium">Targets</th>
            <th className="px-3 py-3 font-medium">Status</th>
            <th className="px-3 py-3 font-medium">Date</th>
            <th className="px-3 py-3 font-medium">Results</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id} className="border-b border-white/5 last:border-b-0">
              <td className="px-3 py-3 align-top">
                <Thumb baseUrl={baseUrl} path={post.image_path} />
              </td>
              <td className="px-3 py-3 align-top">
                <p className="text-xs font-semibold text-white" title={post.topic}>
                  #{post.id} · {shorten(post.topic)}
                </p>
                <Caption text={post.caption} />
              </td>
              <td className="px-3 py-3 align-top">
                <div className="flex flex-wrap gap-1">
                  {String(post.targets || '')
                    .split(',')
                    .filter(Boolean)
                    .map((target) => (
                      <Badge key={target} tone="slate">
                        {target}
                      </Badge>
                    ))}
                </div>
              </td>
              <td className="px-3 py-3 align-top">
                <Badge tone={statusTone(post.status)}>{statusLabel(post.status)}</Badge>
              </td>
              <td className="whitespace-nowrap px-3 py-3 align-top text-[11px] text-slate-400">
                {formatDate(post.published_at || post.created_at)}
              </td>
              <td className="px-3 py-3 align-top">
                <ResultChips results={byPost.get(post.id) || []} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PendingTable({
  posts,
  baseUrl,
  onPublish,
  onReject,
  busyId = null,
  empty = 'No drafts waiting for approval.',
}) {
  if (!posts.length) return <Empty>{empty}</Empty>;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full min-w-[700px] border-collapse">
        <thead>
          <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-slate-500">
            <th className="px-3 py-3 font-medium">Image</th>
            <th className="px-3 py-3 font-medium">Draft</th>
            <th className="px-3 py-3 font-medium">Targets</th>
            <th className="px-3 py-3 font-medium">Created</th>
            <th className="px-3 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => {
            const busy = busyId === post.id;
            return (
              <tr key={post.id} className="border-b border-white/5 last:border-b-0">
                <td className="px-3 py-3 align-top">
                  <Thumb baseUrl={baseUrl} path={post.image_path} />
                </td>
                <td className="px-3 py-3 align-top">
                  <p className="text-xs font-semibold text-white" title={post.topic}>
                    #{post.id} · {shorten(post.topic)}
                  </p>
                  <Caption text={post.caption} />
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-1">
                    {String(post.targets || '')
                      .split(',')
                      .filter(Boolean)
                      .map((target) => (
                        <Badge key={target} tone="slate">
                          {target}
                        </Badge>
                      ))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 align-top text-[11px] text-slate-400">
                  {formatDate(post.created_at)}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onPublish(post)}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      Publish
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReject(post)}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SeriesTable({ items, baseUrl, enabled, targets, empty = 'No series entries found.' }) {
  if (!enabled) {
    return (
      <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200">
        Series mode is off. Set <code className="text-blue-100">SERIES_ENABLED=true</code> on the
        social agent to use the fixed queue.
      </p>
    );
  }

  if (!items.length) return <Empty>{empty}</Empty>;

  return (
    <>
      <p className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-200">
        Series posts publish to: {targets?.length ? targets.join(', ') : 'no targets configured'}.
      </p>
      <div className="overflow-x-auto rounded-xl border border-white/5">
        <table className="w-full min-w-[620px] border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02] text-left text-[10px] uppercase tracking-widest text-slate-500">
              <th className="px-3 py-3 font-medium">Image</th>
              <th className="px-3 py-3 font-medium">Day</th>
              <th className="px-3 py-3 font-medium">Title</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Draft</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.day} className="border-b border-white/5 last:border-b-0">
                <td className="px-3 py-3 align-top">
                  <Thumb baseUrl={baseUrl} path={item.imageFile} />
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-400">{item.day}</td>
                <td className="px-3 py-3 align-top">
                  <p className="text-xs font-semibold text-white">{item.title}</p>
                  <Caption text={item.caption} />
                </td>
                <td className="px-3 py-3 align-top">
                  {item.dispatched ? (
                    <Badge tone={statusTone(item.postStatus)}>
                      {statusLabel(item.postStatus || 'drafted')}
                    </Badge>
                  ) : (
                    <Badge tone="amber">Queued</Badge>
                  )}
                </td>
                <td className="px-3 py-3 align-top text-xs text-slate-400">
                  {item.postId ? `#${item.postId}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
