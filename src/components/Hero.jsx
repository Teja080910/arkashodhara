'use client';

import { motion } from 'framer-motion';
import { GraduationCap, FolderKanban, ArrowRight, PlayCircle, CheckCircle2, Sparkles } from 'lucide-react';

const stats = [
  { value: '500+', label: 'Students Taught' },
  { value: '120+', label: 'Projects Built' },
  { value: '15+', label: 'Expert Mentors' },
  { value: '98%', label: 'Success Rate' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Hero() {
  return (
    <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 bg-ink-900" />
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-brand-600/20 blur-[120px] animate-pulse-glow" />
      <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[120px] animate-pulse-glow" />
      <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-fuchsia-600/10 blur-[100px] animate-float-slow" />

      <div className="relative max-w-7xl mx-auto px-6 pt-32 pb-20 grid lg:grid-cols-2 gap-16 items-center">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 text-brand-300 text-xs font-medium mb-6"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Learn. Build. Manage. Grow.
          </motion.div>

          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.05]"
          >
            Master Skills.{' '}
            <span className="bg-gradient-to-r from-brand-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent animate-gradient-x bg-[length:200%_auto]">
              Build Projects.
            </span>{' '}
            <br />
            Manage Everything.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 text-lg text-slate-400 max-w-xl leading-relaxed"
          >
            Arkasodhara brings expert-led classes and a powerful project management
            platform together — so you can learn new skills, ship real projects,
            and track every milestone in one place.
          </motion.p>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a
              href="#classes"
              className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:shadow-xl hover:shadow-brand-600/40 hover:-translate-y-0.5 transition-all"
            >
              Explore Classes
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#projects"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-slate-200 border border-white/15 hover:border-brand-400/50 hover:bg-white/5 transition-all"
            >
              <PlayCircle className="w-5 h-5 text-brand-400" />
              View Projects
            </a>
          </motion.div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={4}
            className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-6"
          >
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl md:text-3xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden lg:block"
        >
          <div className="relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 shadow-2xl shadow-brand-900/50 animate-float-slow">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-white font-semibold text-sm">Web Development</div>
                <div className="text-slate-500 text-xs">Live Class · 24 students</div>
              </div>
              <span className="ml-auto px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
                Live
              </span>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { label: 'React & Next.js', pct: 85 },
                { label: 'UI / UX Design', pct: 70 },
                { label: 'Deployment', pct: 60 },
              ].map((p) => (
                <div key={p.label}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-slate-300">{p.label}</span>
                    <span className="text-brand-300">{p.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${p.pct}%` }}
                      transition={{ duration: 1.2, delay: 0.8, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-ink-900/60 border border-white/10 p-4">
              <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                <FolderKanban className="w-4 h-4 text-violet-400" />
                Project: E-Commerce Platform
              </div>
              <div className="flex items-center gap-2">
                {['Design', 'Frontend', 'Backend', 'Deploy'].map((t, i) => (
                  <motion.span
                    key={t}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + i * 0.15 }}
                    className="px-2.5 py-1 rounded-full text-[11px] bg-brand-500/15 text-brand-300 border border-brand-500/20"
                  >
                    {t}
                  </motion.span>
                ))}
                <span className="ml-auto flex items-center gap-1 text-emerald-400 text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> On track
                </span>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.1, duration: 0.7 }}
            className="absolute -bottom-8 -left-10 rounded-2xl border border-white/10 bg-ink-800/90 backdrop-blur-xl p-5 shadow-xl animate-float-slower"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
                A
              </div>
              <div>
                <div className="text-white text-sm font-semibold">Milestone reached</div>
                <div className="text-slate-500 text-xs">Project submitted for review</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
