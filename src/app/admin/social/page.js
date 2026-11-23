'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, Copy, ExternalLink, Save, X } from 'lucide-react';

import { useSocial } from './context';
import { Badge, Card, CardHeader, ConnectionCard, formatDate } from '@/components/admin/social/ui';

function MetaCard({ settings }) {
  const ready = Boolean(settings.appId && settings.secretSet);
  const dot = ready ? 'bg-emerald-400' : 'bg-red-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800 p-4">
      <div className="flex items-start gap-2.5">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-white">Meta app</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">
            {settings.appId || 'App ID not set'}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">
            {settings.secretSet
              ? `Secret ${settings.source === 'ui' ? 'saved in admin' : 'from env'}`
              : 'Secret not set'}
          </p>
          {settings.verifiedAt && (
            <p className="mt-1 text-[10px] text-slate-500">
              Verified {formatDate(settings.verifiedAt)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function checklistStatus(key, state) {
  const { settings, setup } = state;
  if (key === 'credentials') {
    return settings.appId &&
      settings.secretSet &&
      (settings.verifiedAt || (setup.facebook && setup.instagram))
      ? 'done'
      : 'action';
  }
  if (key === 'instagram') return setup.instagram && setup.pageLinked ? 'done' : 'action';
  if (key === 'connect') return setup.facebook && setup.instagram ? 'done' : 'action';
  if (key === 'verify') {
    return setup.facebook && setup.instagram && setup.pageLinked ? 'done' : 'action';
  }
  if (key === 'telegram') return setup.telegram ? 'done' : 'optional';
  return 'manual';
}

function StatusBadge({ status }) {
  if (status === 'done') return <Badge tone="green">Done</Badge>;
  if (status === 'action') return <Badge tone="amber">Action needed</Badge>;
  if (status === 'optional') return <Badge tone="slate">Optional</Badge>;
  return <Badge tone="blue">Manual</Badge>;
}

export default function SocialOverviewPage() {
  const { state, refresh } = useSocial();
  const { settings, setup } = state;
  const [appId, setAppId] = useState(settings.appId || '');
  const [appSecret, setAppSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setAppId(settings.appId || '');
  }, [settings.appId]);

  useEffect(() => {
    if (!guideOpen) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setGuideOpen(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [guideOpen]);

  const baseUrl = (state.baseUrl || 'https://social.arkasodhara.tech').replace(/\/$/, '');
  const connectUrl = `${baseUrl}/auth/meta`;
  const appDashboard = settings.appId
    ? `https://developers.facebook.com/apps/${encodeURIComponent(settings.appId)}`
    : 'https://developers.facebook.com/apps/';

  const accounts = useMemo(
    () => ({
      facebook: state.accounts.find((account) => account.platform === 'facebook'),
      instagram: state.accounts.find((account) => account.platform === 'instagram'),
      linkedin: state.accounts.find((account) => account.platform === 'linkedin'),
    }),
    [state.accounts],
  );

  const steps = [
    {
      key: 'meta-app',
      title: 'Create the Meta app',
      description:
        'Create a Business app and add "Manage everything on your Page" and "Manage messaging and content on Instagram". For Instagram choose "API setup with Facebook login", then add the required content permissions.',
      link: `${appDashboard}/use_cases/`,
      linkLabel: 'Open use cases',
    },
    {
      key: 'credentials',
      title: 'Save App ID and App Secret',
      description:
        'Copy them from App settings → Basic, paste them in the form, and click Save & build connection.',
    },
    {
      key: 'redirect',
      title: 'Add the redirect URI',
      description:
        'In Facebook Login for Business → Settings → Client OAuth Settings → Valid OAuth Redirect URIs, add this exact URL:',
      code: settings.redirectUri,
      link: `${appDashboard}/fb-login-business/settings/`,
      linkLabel: 'Open login settings',
    },
    {
      key: 'domains',
      title: 'Add app domains',
      description:
        'In App settings → Basic → App domains add arkasodhara.tech and social.arkasodhara.tech, then save.',
      link: `${appDashboard}/settings/basic/`,
      linkLabel: 'Open app settings',
    },
    {
      key: 'permissions',
      title: 'Enable permissions',
      description:
        'Instagram use case: instagram_basic, instagram_content_publish, pages_read_engagement, pages_show_list, business_management. Pages use case: pages_manage_posts and pages_read_engagement.',
    },
    {
      key: 'instagram',
      title: 'Prepare Instagram and the Page',
      description:
        'Instagram must be a Business or Creator account linked to the Facebook Page. Create a Page, then link Instagram from Page settings → Linked accounts → Instagram.',
      link: 'https://www.facebook.com/pages/create',
      linkLabel: 'Create a Page',
    },
    {
      key: 'connect',
      title: 'Connect Facebook and Instagram',
      description:
        'Click Connect Facebook + Instagram, sign in with the account that manages the Page, and approve every Page and Instagram account.',
    },
    {
      key: 'verify',
      title: 'Verify the accounts',
      description:
        'The cards above should show the Facebook Page and the Instagram username. New posts can then be approved from the Queue tab.',
    },
    {
      key: 'review',
      title: 'App Review for other users',
      description:
        'App Review is only needed when people without a role on the app will use it. As the app admin, the current setup works without review.',
      link: `${appDashboard}/app-review/`,
      linkLabel: 'Open App Review',
    },
    {
      key: 'telegram',
      title: 'Telegram approval (optional)',
      description:
        'Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID on the social agent to receive drafts with Approve / Reject buttons.',
    },
  ];

  const saveCredentials = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/social/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ appId, appSecret }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Could not save credentials');
      setAppSecret('');
      setMessage('Saved and verified with Meta.');
      await refresh();
    } catch (err) {
      setError(err.message || 'Could not save credentials');
    } finally {
      setSaving(false);
    }
  };

  const copyRedirect = async () => {
    if (!settings.redirectUri) return;
    try {
      await navigator.clipboard.writeText(settings.redirectUri);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Could not copy the redirect URI');
    }
  };

  const ready = Boolean(settings.appId && settings.secretSet);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetaCard settings={settings} />
        <ConnectionCard
          label="Facebook Page"
          account={accounts.facebook}
          detail={accounts.facebook ? '' : 'Page required'}
        />
        <ConnectionCard
          label="Instagram"
          account={accounts.instagram}
          detail={
            accounts.instagram
              ? accounts.instagram.extra?.pageId
                ? `Linked to Page ${accounts.instagram.extra.pageId}`
                : 'No linked Page'
              : 'Professional account required'
          }
        />
        <ConnectionCard label="LinkedIn" account={accounts.linkedin} detail="Optional" optional />
        <ConnectionCard
          label="Telegram approval"
          account={setup.telegram ? { accountName: 'Configured', accountId: '' } : null}
          detail={setup.telegram ? 'Approve / reject in chat' : 'Optional'}
          optional
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader
            title="Meta app credentials"
            description="Saving tests the App ID and App Secret against Meta before storing them encrypted on the social agent."
          />
          <form onSubmit={saveCredentials} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-slate-400">App ID</span>
                <input
                  value={appId}
                  onChange={(event) => setAppId(event.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="123456789012345"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand-400/60"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium text-slate-400">
                  App Secret
                </span>
                <input
                  value={appSecret}
                  onChange={(event) => setAppSecret(event.target.value)}
                  type="password"
                  autoComplete="off"
                  placeholder={settings.secretSet ? 'Leave blank to keep current' : 'Paste App Secret'}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-brand-400/60"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-600 to-violet-600 px-4 py-2.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/30 disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Testing with Meta...' : 'Save & build connection'}
              </button>
              {message && <span className="text-xs text-emerald-300">{message}</span>}
              {error && <span className="text-xs text-red-300">{error}</span>}
            </div>
          </form>

          <div className="my-5 h-px bg-white/5" />

          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">
              Redirect URI — add this in Meta
            </p>
            <div className="flex gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-[11px] text-brand-200">
                {settings.redirectUri || '—'}
              </code>
              <button
                type="button"
                onClick={() => void copyRedirect()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-semibold text-slate-300 hover:bg-white/10"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={connectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                ready
                  ? 'bg-gradient-to-r from-brand-600 to-violet-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-600/30'
                  : 'pointer-events-none border border-white/10 bg-white/5 text-slate-600'
              }`}
            >
              Connect Facebook + Instagram
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span className="text-[11px] text-slate-500">
              {ready
                ? setup.facebook && setup.instagram
                  ? 'Connected. Reconnect only if you change accounts.'
                  : 'Opens Meta OAuth in a new tab. Return here and refresh.'
                : 'Save and verify credentials first.'}
            </span>
          </div>
        </Card>

        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Setup guide"
              description="Step-by-step Meta app, Page and Instagram verification."
            />
            <p className="text-xs leading-relaxed text-slate-500">
              Open the guide to see what is done, what needs action, and what must be checked manually in Meta.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {steps.filter((step) => checklistStatus(step.key, state) === 'done').length > 0 && (
                <Badge tone="green">
                  {steps.filter((step) => checklistStatus(step.key, state) === 'done').length} done
                </Badge>
              )}
              {steps.filter((step) => checklistStatus(step.key, state) === 'action').length > 0 && (
                <Badge tone="amber">
                  {steps.filter((step) => checklistStatus(step.key, state) === 'action').length} action
                </Badge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Open setup guide
          </button>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Permissions requested"
          description="These scopes are sent when Connect is clicked. They must be enabled on the app's use cases."
        />
        <div className="flex flex-wrap gap-2">
          {(settings.scopes || []).map((scope) => (
            <code
              key={scope}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-300"
            >
              {scope}
            </code>
          ))}
        </div>
      </Card>

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => setGuideOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Setup guide"
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-800 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-ink-800/95 px-5 py-4 backdrop-blur">
              <div>
                <h2 className="text-sm font-semibold text-white">Setup guide</h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  Done and Action needed are detected automatically. Manual steps must be confirmed in Meta.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                aria-label="Close setup guide"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ol className="space-y-0 px-5 py-2">
              {steps.map((step, index) => {
                const status = checklistStatus(step.key, state);
                return (
                  <li
                    key={step.key}
                    className="flex gap-3 border-b border-dashed border-white/5 py-3 last:border-0"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                        status === 'done'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                          : status === 'action'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                            : 'border-white/10 bg-white/5 text-slate-500'
                      }`}
                    >
                      {status === 'done' ? <Check className="h-3 w-3" /> : index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs font-semibold text-white">{step.title}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {step.description}
                      </p>
                      {step.code && (
                        <code className="mt-2 block overflow-x-auto whitespace-nowrap rounded-lg border border-white/10 bg-black/20 px-2.5 py-2 text-[10px] text-brand-200">
                          {step.code}
                        </code>
                      )}
                      {step.link && (
                        <a
                          href={step.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-300 hover:text-brand-200"
                        >
                          {step.linkLabel}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
