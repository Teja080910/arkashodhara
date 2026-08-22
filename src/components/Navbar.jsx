'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useState } from 'react';

const links = [
  { label: 'Home', href: '#home' },
  { label: 'Classes', href: '#classes' },
  { label: 'Projects', href: '#projects' },
  { label: 'Features', href: '#features' },
  { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();
  const bg = useTransform(scrollY, [0, 80], ['rgba(11,16,32,0)', 'rgba(11,16,32,0.85)']);
  const border = useTransform(scrollY, [0, 80], ['rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']);

  return (
    <motion.header
      style={{ backgroundColor: bg, borderColor: border }}
      className="fixed top-0 inset-x-0 z-50 border-b backdrop-blur-xl"
    >
      <nav className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="#home" className="flex items-center gap-2.5 group">
          <img
            src="/logo.svg"
            alt="Arkasodhara"
            className="w-9 h-9 drop-shadow-lg shadow-brand-600/30 group-hover:scale-110 transition-transform"
          />
          <span className="text-lg font-bold tracking-tight text-white">
            Arkasodhara
          </span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-slate-300 hover:text-white transition-colors relative group"
            >
              {l.label}
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-gradient-to-r from-brand-400 to-violet-400 group-hover:w-full transition-all duration-300" />
            </a>
          ))}
          <a
            href="#contact"
            className="px-5 py-2 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:shadow-lg hover:shadow-brand-600/40 hover:-translate-y-0.5 transition-all"
          >
            Get Started
          </a>
        </div>

        <button
          className="md:hidden text-white p-2"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="md:hidden border-t border-white/10 bg-ink-900/95 backdrop-blur-xl px-6 py-4 flex flex-col gap-4"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-slate-200 hover:text-white transition-colors"
            >
              {l.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="px-5 py-2.5 rounded-full text-center text-sm font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600"
          >
            Get Started
          </a>
        </motion.div>
      )}
    </motion.header>
  );
}
