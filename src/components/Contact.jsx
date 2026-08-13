'use client';

import { motion } from 'framer-motion';
import { Mail, MapPin, Phone, Send, GraduationCap, FolderKanban, Sparkles } from 'lucide-react';
import { useState } from 'react';

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <section id="contact" className="relative py-28 bg-ink-900 overflow-hidden">
      <div className="absolute -top-40 right-1/4 w-[500px] h-[500px] rounded-full bg-brand-600/10 blur-[140px]" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
          >
            <span className="text-brand-400 text-sm font-semibold tracking-widest uppercase">
              Get in touch
            </span>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold text-white tracking-tight">
              Ready to start your{' '}
              <span className="bg-gradient-to-r from-brand-400 to-violet-400 bg-clip-text text-transparent">
                journey?
              </span>
            </h2>
            <p className="mt-5 text-slate-400 text-lg leading-relaxed">
              Join a class, manage your projects, or just say hello. We&apos;d
              love to hear from you.
            </p>

            <div className="mt-10 space-y-5">
              {[
                { icon: Mail, label: 'Email', value: 'hello@arkasodhara.tech' },
                { icon: Phone, label: 'Phone', value: '+91 98765 43210' },
                { icon: MapPin, label: 'Location', value: 'Hyderabad, India' },
              ].map((c, i) => (
                <motion.div
                  key={c.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1, duration: 0.5 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <c.icon className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{c.label}</div>
                    <div className="text-white text-sm font-medium">{c.value}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
              className="space-y-5"
            >
              <div className="grid sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Name</label>
                  <input
                    required
                    type="text"
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-ink-800/70 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Email</label>
                  <input
                    required
                    type="email"
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-ink-800/70 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">I&apos;m interested in</label>
                <select className="w-full px-4 py-3 rounded-xl bg-ink-800/70 border border-white/10 text-white focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all">
                  <option>Joining a class</option>
                  <option>Project management</option>
                  <option>Both</option>
                  <option>Something else</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Message</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Tell us what you need..."
                  className="w-full px-4 py-3 rounded-xl bg-ink-800/70 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-brand-500/50 focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-brand-600 to-violet-600 hover:shadow-xl hover:shadow-brand-600/40 transition-all"
              >
                {sent ? (
                  <>
                    <Sparkles className="w-4 h-4" /> Message sent — we&apos;ll get back soon!
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Send Message
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
