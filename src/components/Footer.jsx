'use client';

import { motion } from 'framer-motion';
import { GraduationCap, FolderKanban, Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="relative border-t border-white/10 bg-ink-900">
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <a href="#home" className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">Arkasodhara</span>
            </a>
            <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
              Learn new skills, build real projects and manage everything in one
              place. Classes and project management, together.
            </p>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Classes</h4>
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li><a href="#classes" className="hover:text-brand-400 transition-colors">Web Development</a></li>
              <li><a href="#classes" className="hover:text-brand-400 transition-colors">UI / UX Design</a></li>
              <li><a href="#classes" className="hover:text-brand-400 transition-colors">Mobile Development</a></li>
              <li><a href="#classes" className="hover:text-brand-400 transition-colors">AI & Automation</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm text-slate-500">
              <li><a href="#home" className="hover:text-brand-400 transition-colors">Home</a></li>
              <li><a href="#projects" className="hover:text-brand-400 transition-colors">Projects</a></li>
              <li><a href="#features" className="hover:text-brand-400 transition-colors">Features</a></li>
              <li><a href="#contact" className="hover:text-brand-400 transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-slate-600">
            © {new Date().getFullYear()} Arkasodhara. All rights reserved.
          </p>
          <p className="text-xs text-slate-600 flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> for learners & builders
          </p>
        </div>
      </div>
    </footer>
  );
}
