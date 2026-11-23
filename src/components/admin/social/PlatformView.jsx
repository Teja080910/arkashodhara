'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

import { useSocial } from '@/app/admin/social/context';
import {
  Badge,
  Card,
  CardHeader,
  ConnectionCard,
  PendingTable,
  PostTable,
  StatCard,
  daysLeft,
} from './ui';

export default function PlatformView({
  platform,
  title,
  description,
  connectPlatform,
  notes = [],
}) {
  const { state, refresh } = useSocial();
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const account = state.accounts.find((item) => item.platform === platform);
  const pending = useMemo(
    () =>
      state.posts.pending.filter((post) =>
        String(post.targets || '')
          .split(',')
          .includes(platform),
      ),
    [state.posts.pending, platform],
  );
  const history = useMemo(
    () =>
      state.posts.history.filter((post) =>
        String(post.targets || '')
          .split(',')
          .includes(platform),
      ),
    [state.posts.history, platform],
  );
  const results = useMemo(
    () => state.posts.results.filter((result) => result.platform === platform),
    [state.posts.results, platform],
  );

  const published = history.filter((post) => post.status === 'published').length;
  const failed = history.filter((post) => post.status === 'failed').length;
  const connectUrl = `${String(state.baseUrl || '').replace(/\/$/, '')}/auth/${connectPlatform}`;

  const publish = async (post) => {
    if (
      !window.confirm(
        `Publish draft #${post.id} to ${post.targets} now?\n\nThis posts publicly.`,
      )
    ) {
      return;
    }
    setBusyId(post.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/social/publish/${post.id}`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not publish');
      const outcomes = data?.outcomes || [];
      setMessage(
        outcomes
          .map((outcome) => `${outcome.platform}: ${outcome.ok ? 'published' : outcome.error || 'failed'}`)
          .join(' · '),
      );
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not publish');
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (post) => {
    if (!window.confirm(`Reject draft #${post.id}?`)) return;
    setBusyId(post.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/social/reject/${post.id}`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not reject');
      setMessage(`Draft #${post.id} rejected.`);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <Badge tone={account ? 'green' : 'red'}>
                {account ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">{description}</p>
          </div>
          <a
            href={connectUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/30"
          >
            {account ? 'Reconnect' : 'Connect'}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ConnectionCard
            label="Account"
            account={account}
            detail={account?.expiresAt ? daysLeft(account.expiresAt) : 'Not connected'}
          />
          <div className="rounded-2xl border border-white/10 bg-ink-800 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Pending</p>
            <p className="mt-2 text-xl font-bold text-white">{pending.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-800 p-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">Published</p>
            <p className="mt-2 text-xl font-bold text-white">{published}</p>
          </div>
        </div>

        {notes.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-white/5 pt-4">
            {notes.map((note) => (
              <li key={note} className="flex gap-2 text-[11px] leading-relaxed text-slate-500">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {note}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {(error || message) && (
        <p
          className={`rounded-xl border px-4 py-3 text-xs ${
            error
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Pending drafts" value={pending.length} hint="Waiting for approval" />
        <StatCard label="Published" value={published} hint="All time" />
        <StatCard label="Failed" value={failed} hint="Needs attention" />
      </div>

      <Card>
        <CardHeader
          title={`Pending ${title} drafts`}
          description="Publishing from here goes live immediately."
          action={
            <button
              type="button"
              onClick={() => void refresh()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          }
        />
        <PendingTable
          posts={pending}
          baseUrl={state.baseUrl}
          onPublish={(post) => void publish(post)}
          onReject={(post) => void reject(post)}
          busyId={busyId}
        />
      </Card>

      <Card>
        <CardHeader
          title={`${title} history`}
          description="Published, failed and rejected posts for this platform."
        />
        <PostTable
          posts={history}
          results={results}
          baseUrl={state.baseUrl}
          empty={`No ${title} posts yet.`}
        />
      </Card>
    </div>
  );
}
