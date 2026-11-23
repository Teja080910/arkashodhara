'use client';

import { useState } from 'react';
import { ListChecks, Play, RefreshCw } from 'lucide-react';

import { useSocial } from '../context';
import {
  Card,
  CardHeader,
  PendingTable,
  SeriesTable,
  StatCard,
} from '@/components/admin/social/ui';

export default function SocialQueuePage() {
  const { state, refresh } = useSocial();
  const [busyId, setBusyId] = useState(null);
  const [dispatching, setDispatching] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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

  const deletePost = async (post) => {
    if (!window.confirm(`Delete draft #${post.id}?\n\nThis removes it permanently from the queue.`)) return;
    setBusyId(post.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/social/posts/${post.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not delete');
      setMessage(`Draft #${post.id} deleted.`);
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not delete');
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

  const dispatchNext = async () => {
    if (!state.series.enabled || state.stats.queued === 0) return;
    if (!window.confirm('Create the next series draft now?')) return;
    setDispatching(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/social/series/next', { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not dispatch');
      setMessage(data?.postId ? `Draft #${data.postId} created.` : 'Series queue is empty.');
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not dispatch the next series entry');
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Series queued"
          value={state.stats.queued}
          hint={`${state.stats.seriesTotal} total in series`}
        />
        <StatCard
          label="Pending drafts"
          value={state.stats.pending}
          hint="Waiting for approval"
        />
        <StatCard label="Published" value={state.stats.published} hint="All time" />
        <StatCard label="Failed" value={state.stats.failed} hint="Needs attention" />
      </div>

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

      <Card>
        <CardHeader
          title="Series queue"
          description="Fixed content queue. One entry is dispatched per scheduled run."
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void refresh()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </button>
              <button
                type="button"
                onClick={() => void dispatchNext()}
                disabled={dispatching || !state.series.enabled || state.stats.queued === 0}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40"
              >
                <Play className="h-3 w-3" />
                {dispatching ? 'Dispatching...' : 'Dispatch next'}
              </button>
            </div>
          }
        />
        <SeriesTable
          items={state.series.items}
          baseUrl={state.baseUrl}
          enabled={state.series.enabled}
          targets={state.setup.seriesTargets}
        />
      </Card>

      <Card>
        <CardHeader
          title="Pending drafts"
          description="Drafts waiting for approval. Publishing from here bypasses Telegram and posts immediately."
          action={
            <span className="inline-flex items-center gap-1.5 text-[10px] text-slate-500">
              <ListChecks className="h-3 w-3" />
              {state.posts.pending.length} waiting
            </span>
          }
        />
        <PendingTable
          posts={state.posts.pending}
          baseUrl={state.baseUrl}
          onPublish={(post) => void publish(post)}
          onDelete={(post) => void deletePost(post)}
          onReject={(post) => void reject(post)}
          busyId={busyId}
        />
      </Card>
    </div>
  );
}
