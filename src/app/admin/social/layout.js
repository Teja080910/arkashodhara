'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, RefreshCw } from 'lucide-react';

import { SocialContext } from './context';

function ConnectionPill({ setup, settings }) {
  let label = 'Setup needed';
  let tone = 'border-red-500/30 bg-red-500/10 text-red-300';

  if (setup?.facebook && setup?.instagram) {
    label = 'Instagram connected';
    tone = 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
  } else if (settings?.appId && settings?.secretSet) {
    label = 'Ready to connect';
    tone = 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}

export default function SocialLayout({ children }) {
  const router = useRouter();
  const [state, setState] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch('/api/admin/social/state', { cache: 'no-store' });
    if (response.status === 401) {
      router.replace('/admin');
      return null;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || 'Could not load the social agent.');
    }
    return data;
  }, [router]);

  const refresh = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        const data = await load();
        if (data) {
          setState(data);
          setError('');
        }
      } catch (err) {
        setError(err.message || 'Could not load the social agent.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = async () => {
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => null);
    router.replace('/admin');
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-slate-500">
        Loading social agent...
      </div>
    );
  }

  if (!state) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <h1 className="text-lg font-bold text-white">Social agent unavailable</h1>
          <p className="mt-2 text-sm text-red-200">{error || 'Could not load the social agent.'}</p>
          <button
            type="button"
            onClick={() => void refresh(true)}
            className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <SocialContext.Provider value={{ state, refresh: () => refresh(true), setState }}>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">Social Agent</h1>
              <ConnectionPill setup={state.setup} settings={state.settings} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Connect accounts, manage the queue and review everything that was published.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refresh(true)}
              disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
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

        {children}
      </div>
    </SocialContext.Provider>
  );
}
