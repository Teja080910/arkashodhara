'use client';

import { useMemo, useState } from 'react';

import { useSocial } from '../context';
import { Card, CardHeader, PostTable, StatCard } from '@/components/admin/social/ui';

const filters = [
  { id: 'all', label: 'All' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'linkedin', label: 'LinkedIn' },
];

export default function SocialPostedPage() {
  const { state } = useSocial();
  const [filter, setFilter] = useState('all');

  const history = useMemo(() => {
    if (filter === 'all') return state.posts.history;
    return state.posts.history.filter((post) =>
      String(post.targets || '')
        .split(',')
        .includes(filter),
    );
  }, [state.posts.history, filter]);

  const results = useMemo(() => {
    if (filter === 'all') return state.posts.results;
    return state.posts.results.filter((result) => result.platform === filter);
  }, [state.posts.results, filter]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published" value={state.stats.published} hint="All time" />
        <StatCard label="Failed" value={state.stats.failed} hint="Needs attention" />
        <StatCard label="Pending" value={state.stats.pending} hint="Waiting for approval" />
        <StatCard label="Queue" value={state.stats.queued} hint="Series entries left" />
      </div>

      <Card>
        <CardHeader
          title="Post history"
          description="Published, failed and rejected posts. Links open the live platform post when available."
          action={
            <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    filter === item.id
                      ? 'bg-brand-600/25 text-brand-200'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          }
        />
        <PostTable
          posts={history}
          results={results}
          baseUrl={state.baseUrl}
          empty="No posts match this filter."
        />
      </Card>
    </div>
  );
}
