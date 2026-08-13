'use client';

import { motion } from 'framer-motion';
import { FolderKanban, ListTodo, Users, BarChart3, GitBranch, CalendarCheck, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: FolderKanban,
    title: 'Project Boards',
    desc: 'Kanban-style boards to organize tasks, track progress and keep every project on schedule.',
  },
  {
    icon: ListTodo,
    title: 'Task Management',
    desc: 'Break projects into tasks, assign owners, set deadlines and never miss a milestone.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    desc: 'Invite teammates, share progress and collaborate in real time with comments and mentions.',
  },
  {
    icon: BarChart3,
    title: 'Progress Analytics',
    desc: 'Visual dashboards showing velocity, completion rates and where your team stands.',
  },
  {
    icon: GitBranch,
    title: 'Milestones & Versions',
    desc: 'Plan releases with milestones and keep a clean history of every project version.',
  },
  {
    icon: CalendarCheck,
    title: 'Deadline Tracking',
    desc: 'Smart reminders and calendar views so nothing slips through the cracks.',
  },
];

const steps = [
  { num: '01', title: 'Create a project', desc: 'Set up a workspace and invite your team in seconds.' },
  { num: '02', title: 'Plan & assign', desc: 'Break work into tasks, set priorities and assign owners.' },
  { num: '03', title: 'Track & ship', desc: 'Watch progress live, hit milestones and deliver on time.' },
];

export default function Projects() {
  return (
    <section id="projects" className="relative py-28 bg-ink-900 overflow-hidden">
      <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-violet-600/10 blur-[140px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-24">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-violet-400 text-sm font-semibold tracking-widest uppercase">
              Project Management
            </span>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Manage every project from{' '}
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
                idea to launch
              </span>
            </h2>
            <p className="mt-5 text-slate-400 text-lg leading-relaxed">
              Whether it&apos;s a class assignment, a client project or your own
              startup — Arkasodhara gives you the tools to plan, collaborate and
              ship with confidence.
            </p>

            <div className="mt-10 space-y-6">
              {steps.map((s, i) => (
                <motion.div
                  key={s.num}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, duration: 0.6 }}
                  className="flex gap-5"
                >
                  <div className="text-2xl font-bold bg-gradient-to-b from-violet-400 to-fuchsia-500 bg-clip-text text-transparent">
                    {s.num}
                  </div>
                  <div>
                    <div className="text-white font-semibold">{s.title}</div>
                    <div className="text-slate-500 text-sm mt-1">{s.desc}</div>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.a
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.5 }}
              href="#contact"
              className="mt-10 inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-xl hover:shadow-violet-600/40 hover:-translate-y-0.5 transition-all"
            >
              Start Managing Projects
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
            <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 shadow-2xl shadow-violet-900/30">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="text-white text-sm font-semibold">E-Commerce Platform</div>
                    <div className="text-slate-500 text-xs">Sprint 4 · 12 tasks</div>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                  78% complete
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { title: 'To Do', count: 3, color: 'bg-slate-500' },
                  { title: 'In Progress', count: 4, color: 'bg-amber-500' },
                  { title: 'Done', count: 5, color: 'bg-emerald-500' },
                ].map((col) => (
                  <div key={col.title} className="rounded-2xl bg-ink-800/70 border border-white/5 p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2 h-2 rounded-full ${col.color}`} />
                      <span className="text-[11px] text-slate-400">{col.title}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{col.count}</span>
                    </div>
                    <div className="space-y-2">
                      {Array.from({ length: col.count }).map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.4 + i * 0.1 }}
                          className="h-8 rounded-lg bg-white/5 border border-white/5"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['from-brand-500 to-indigo-600', 'from-violet-500 to-fuchsia-600', 'from-emerald-500 to-teal-600'].map((g, i) => (
                      <div
                        key={i}
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${g} border-2 border-ink-800 flex items-center justify-center text-[10px] text-white font-bold`}
                      >
                        {['A', 'S', 'K'][i]}
                      </div>
                    ))}
                  </div>
                  <span>4 collaborators</span>
                </div>
                <span className="flex items-center gap-1.5">
                  <CalendarCheck className="w-3.5 h-3.5 text-violet-400" />
                  Due in 5 days
                </span>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.6 }}
              className="absolute -bottom-6 -right-4 rounded-2xl border border-white/10 bg-ink-800/90 backdrop-blur-xl p-4 shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                  <BarChart3 className="w-4.5 h-4.5 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">+32% velocity</div>
                  <div className="text-slate-500 text-xs">This sprint vs last</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.7 }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              whileHover={{ y: -6 }}
              className="group rounded-3xl border border-white/10 bg-white/5 p-7 hover:border-violet-500/40 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <f.icon className="w-5.5 h-5.5 text-violet-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
