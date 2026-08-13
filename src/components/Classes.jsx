'use client';

import { motion } from 'framer-motion';
import { Code2, Palette, Database, Smartphone, Cloud, Brain, ArrowRight } from 'lucide-react';

const classes = [
  {
    icon: Code2,
    title: 'Web Development',
    desc: 'HTML to full-stack with React, Next.js and Node. Build production-ready apps.',
    level: 'Beginner → Advanced',
    students: '180+',
    color: 'from-brand-500 to-indigo-600',
  },
  {
    icon: Palette,
    title: 'UI / UX Design',
    desc: 'Design beautiful interfaces with Figma, design systems and prototyping.',
    level: 'All levels',
    students: '120+',
    color: 'from-violet-500 to-fuchsia-600',
  },
  {
    icon: Database,
    title: 'Databases & Backend',
    desc: 'PostgreSQL, Supabase, REST APIs and authentication done right.',
    level: 'Intermediate',
    students: '95+',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Smartphone,
    title: 'Mobile Development',
    desc: 'Cross-platform apps with React Native and Flutter for iOS & Android.',
    level: 'Beginner → Advanced',
    students: '110+',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: Cloud,
    title: 'DevOps & Deployment',
    desc: 'Docker, CI/CD, VPS and cloud deployment — ship like a pro.',
    level: 'Intermediate',
    students: '70+',
    color: 'from-sky-500 to-blue-600',
  },
  {
    icon: Brain,
    title: 'AI & Automation',
    desc: 'Prompt engineering, AI integrations and building smart automations.',
    level: 'All levels',
    students: '140+',
    color: 'from-rose-500 to-pink-600',
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

export default function Classes() {
  return (
    <section id="classes" className="relative py-28 bg-ink-800 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand-600/10 blur-[140px] rounded-full" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-brand-400 text-sm font-semibold tracking-widest uppercase">
            Our Classes
          </span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold text-white tracking-tight">
            Learn from experts who{' '}
            <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
              actually build
            </span>
          </h2>
          <p className="mt-4 text-slate-400 text-lg">
            Hands-on, project-based classes designed to take you from zero to
            job-ready — with real projects you can show off.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-100px' }}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {classes.map((c) => (
            <motion.div
              key={c.title}
              variants={item}
              whileHover={{ y: -8 }}
              className="group relative rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-7 overflow-hidden transition-colors hover:border-brand-500/40"
            >
              <div
                className={`absolute -top-20 -right-20 w-48 h-48 rounded-full bg-gradient-to-br ${c.color} opacity-0 group-hover:opacity-20 blur-3xl transition-opacity duration-500`}
              />
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${c.color} flex items-center justify-center shadow-lg mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
              >
                <c.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{c.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed mb-5">{c.desc}</p>
              <div className="flex items-center justify-between text-xs">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
                  {c.level}
                </span>
                <span className="text-slate-500">{c.students} students</span>
              </div>
              <a
                href="#contact"
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand-400 group-hover:text-brand-300 transition-colors"
              >
                Enroll now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
