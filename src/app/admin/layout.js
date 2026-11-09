'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Server } from 'lucide-react';

const tabs = [{ href: '/admin/server', label: 'Server Manager', icon: Server }];

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  if (pathname === '/admin') return children;

  return (
    <div className="min-h-screen bg-ink-900">
      <nav className="border-b border-white/10 bg-ink-800">
        <div className="mx-auto flex max-w-6xl items-center gap-4 overflow-x-auto px-4 py-3 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <img src="/logo.svg" alt="Arkasodhara" className="h-7 w-7" />
            <span className="text-sm font-bold text-white">Admin</span>
          </Link>

          <span className="h-5 w-px bg-white/10" />

          {tabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-brand-600/20 text-brand-200'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>

      {children}
    </div>
  );
}
