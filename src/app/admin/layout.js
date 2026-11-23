'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Briefcase,
  Camera,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  Menu,
  Send,
  Server,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

const socialLinks = [
  { href: '/admin/social', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/social/instagram', label: 'Instagram', icon: Camera },
  { href: '/admin/social/facebook', label: 'Facebook', icon: Users },
  { href: '/admin/social/linkedin', label: 'LinkedIn', icon: Briefcase },
  { href: '/admin/social/queue', label: 'Queue', icon: ListChecks },
  { href: '/admin/social/posted', label: 'Posted', icon: Send },
];

function isActive(pathname, href, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({ children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (pathname === '/admin') return children;

  const socialActive = pathname.startsWith('/admin/social');

  return (
    <div className="min-h-screen bg-ink-900 text-white lg:flex">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-white/10 bg-ink-800 transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
          <img src="/logo.svg" alt="Arkasodhara" className="h-9 w-9" />
          <div>
            <p className="text-sm font-bold leading-tight text-white">Arkasodhara</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Admin panel</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5 text-sm">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Operations
          </p>
          <Link
            href="/admin/server"
            onClick={() => setMobileOpen(false)}
            aria-current={isActive(pathname, '/admin/server') ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold transition-colors ${
              isActive(pathname, '/admin/server')
                ? 'bg-brand-600/20 text-brand-200'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Server className="h-4 w-4" />
            Server Manager
          </Link>

          <p className="mt-6 px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Social
          </p>
          <Link
            href="/admin/social"
            onClick={() => setMobileOpen(false)}
            aria-current={pathname === '/admin/social' ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold transition-colors ${
              socialActive
                ? 'text-brand-200'
                : 'text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Social Agent
          </Link>

          <div className="mt-1 space-y-0.5 border-l border-white/10 pl-4">
            {socialLinks.map(({ href, label, icon: Icon, exact }) => {
              const active = isActive(pathname, href, exact);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors ${
                    active
                      ? 'bg-white/5 font-semibold text-white'
                      : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${active ? 'text-brand-300' : ''}`} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white/5 hover:text-white"
          >
            arkasodhara.tech
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/10 bg-ink-800/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-300"
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <img src="/logo.svg" alt="Arkasodhara" className="h-7 w-7" />
          <span className="text-sm font-bold">Admin</span>
        </div>
        {children}
      </div>
    </div>
  );
}
