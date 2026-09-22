'use client';

import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Sai Kiran',
    role: 'Founder, Retail Startup',
    quote:
      'Arkasodhara built our entire e-commerce platform from scratch — on time, on budget and better than we imagined. They felt like our own in-house team.',
    initials: 'SK',
    color: 'from-brand-500 to-indigo-600',
  },
  {
    name: 'Ananya Reddy',
    role: 'Full-Stack Developer (Student)',
    quote:
      'I joined the web development class with zero coding experience. Six months later I landed my first developer job — the mentors guided me at every step.',
    initials: 'AR',
    color: 'from-violet-500 to-fuchsia-600',
  },
  {
    name: 'Rahul Verma',
    role: 'Product Manager, FinTech',
    quote:
      'From the first call to launch, communication was clear and the code quality was excellent. Our app now serves thousands of users every day.',
    initials: 'RV',
    color: 'from-emerald-500 to-teal-600',
  },
];

export default function Testimonials() {
  return (
    <section className="relative py-28 bg-ink-800 overflow-hidden">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-600/10 blur-[120px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-100px' }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-brand-400 text-sm font-semibold tracking-widest uppercase">
            Testimonials
          </span>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold text-white tracking-tight">
            Loved by clients{' '}
            <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
              & students
            </span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-100px' }}
              transition={{ delay: i * 0.15, duration: 0.6 }}
              whileHover={{ y: -6 }}
              className="relative rounded-3xl border border-white/10 bg-white/5 p-7"
            >
              <Quote className="w-8 h-8 text-brand-500/40 mb-4" />
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, j) => (
                  <Star key={j} className="w-4 h-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <p className="text-slate-300 leading-relaxed mb-6">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-sm font-bold`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-white text-sm font-semibold">{t.name}</div>
                  <div className="text-slate-500 text-xs">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
