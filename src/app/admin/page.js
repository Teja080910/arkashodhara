'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-slate-500 focus:border-brand-400/60';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/session', { cache: 'no-store' });
      const data = await res.json();
      if (data?.email) {
        router.replace('/admin/server');
        return;
      }
    } finally {
      setChecking(false);
    }
  }, [router]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const submit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error || 'Could not sign in');
        setLoading(false);
        return;
      }

      router.replace('/admin/server');
    } catch {
      setError('Could not sign in');
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900 text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-900 px-6 py-16">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <img src="/logo.svg" alt="Arkasodhara" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage the Arkasodhara server.</p>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-ink-800 p-6">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            autoComplete="email"
            required
            className={inputClass}
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
            className={inputClass}
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/40 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <a href="/" className="mt-6 block text-center text-xs text-slate-500 hover:text-white">
          ← Back to arkasodhara.tech
        </a>
      </div>
    </div>
  );
}
