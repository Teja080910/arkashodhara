'use client';

import { motion } from 'framer-motion';
import { LayoutDashboard, FolderKanban, CalendarClock, Briefcase, UserCheck, Clock, ArrowRight, ArrowUpRight } from 'lucide-react';

// Replace with your live tool URLs — any box with an href opens in a new tab.
const tools = [
  {
    icon: FolderKanban,
    title: 'Project Tracker',
    desc: 'Live status of every client and internal project — tasks, owners and deadlines in one board.',
    href: 'https://tracker.arkasodhara.tech',
  },
  {
    icon: CalendarClock,
    title: 'Meetings',
    desc: 'Agendas, schedules and notes for every team meeting — nothing gets lost.',
    href: '',
  },
  {
    icon: Briefcase,
    title: 'Portfolio',
    desc: 'Every project we deliver, documented with results and case studies.',
    href: 'https://portfoli.store',
  },
  {
    icon: UserCheck,
    title: 'Attendance',
    desc: 'Daily check-ins, leaves and working hours tracked automatically.',
    href: '',
  },
];

const dashStats = [
  { icon: Clock, label: 'Hours tracked', value: '132h', color: 'text-emerald-400' },
  { icon: UserCheck, label: 'Attendance', value: '96%', color: 'text-brand-400' },
  { icon: CalendarClock, label: 'Meetings', value: '8', color: 'text-amber-400' },
  { icon: FolderKanban, label: 'Active projects', value: '6', color: 'text-violet-400' },
];

export default function TeamPlatform() {
  return (
    <section id="platform" className="relative py-28 bg-ink-800 border-b border-white/5 overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-brand-600/10 blur-[140px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-brand-400 text-sm font-semibold tracking-widest uppercase">
              Team Platform
            </span>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              We run Arkasodhara on tools{' '}
              <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                we built ourselves
              </span>
            </h2>
            <p className="mt-5 text-slate-400 text-lg leading-relaxed">
              Tracker, meetings, portfolio and attendance — one workspace our
              team uses every day to stay in sync and deliver on time. Need
              something like this for your company? We can build it for you.
            </p>

            <div className="mt-10 grid sm:grid-cols-2 gap-4">
              {tools.map((t, i) => {
                const Box = t.href ? motion.a : motion.div;
                return (
                  <Box
                    key={t.title}
                    {...(t.href
                      ? { href: t.href, target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                    whileHover={t.href ? { y: -6 } : undefined}
                    className={`group relative rounded-2xl border border-white/10 bg-white/5 p-5 transition-colors ${
                      t.href ? 'hover:border-brand-500/40 cursor-pointer' : ''
                    }`}
                  >
                    <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <t.icon className="w-5 h-5 text-brand-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-white font-semibold">{t.title}</div>
                      {t.href && (
                        <ArrowUpRight className="w-4 h-4 text-brand-400 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                      )}
                    </div>
                    <div className="text-slate-500 text-sm mt-1">{t.desc}</div>
                  </Box>
                );
              })}
            </div>

            <motion.a
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:shadow-xl hover:shadow-brand-600/40 hover:-translate-y-0.5 transition-all"
            >
              Build Something Like This
              <ArrowRight className="w-4 h-4" />
            </motion.a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            whileInView={{ opacity: 1, scale: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-brand-900/40">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
                    <LayoutDashboard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">Arkasodhara Workspace</div>
                    <div className="text-slate-500 text-xs">Team dashboard · This week</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-brand-500/15 text-brand-300 text-xs font-medium">
                  6 members
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {dashStats.map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="rounded-2xl bg-ink-900/60 border border-white/5 p-4"
                  >
                    <s.icon className={`w-4 h-4 ${s.color} mb-2`} />
                    <div className="text-white text-lg font-bold">{s.value}</div>
                    <div className="text-slate-500 text-[11px]">{s.label}</div>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-2xl bg-ink-900/60 border border-white/10 p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <CalendarClock className="w-4 h-4 text-brand-400" />
                  Today&apos;s meetings
                </div>
                <div className="space-y-2.5">
                  {[
                    { time: '10:00 AM', title: 'Sprint planning', color: 'bg-brand-500' },
                    { time: '3:30 PM', title: 'Client demo — E-Commerce', color: 'bg-fuchsia-500' },
                  ].map((m, i) => (
                    <motion.div
                      key={m.title}
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.7 + i * 0.15 }}
                      className="flex items-center gap-3 rounded-xl bg-white/5 border border-white/5 px-3 py-2.5"
                    >
                      <span className={`w-2 h-2 rounded-full ${m.color}`} />
                      <span className="text-xs text-slate-300">{m.title}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{m.time}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-6 -left-6 rounded-2xl border border-white/10 bg-ink-800/90 backdrop-blur-xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <UserCheck className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">Team checked in</div>
                  <div className="text-slate-500 text-xs">6/6 online · 9:02 AM</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
