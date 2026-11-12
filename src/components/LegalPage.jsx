import Link from "next/link";

export default function LegalPage({ eyebrow, title, updated, intro, sections }) {
  return (
    <main className="min-h-screen bg-ink-900 text-slate-300">
      <header className="border-b border-white/10 bg-ink-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Arkasodhara" className="h-9 w-9" />
            <span className="text-lg font-bold text-white">Arkasodhara</span>
          </Link>
          <nav className="flex items-center gap-5 text-sm text-slate-400">
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <Link href="/" className="hover:text-white transition-colors">
              Home
            </Link>
          </nav>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-400">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: {updated}</p>

        {intro ? (
          <p className="mt-8 text-base leading-7 text-slate-300">{intro}</p>
        ) : null}

        <div className="mt-10 space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-white">{section.title}</h2>
              {section.body?.map((paragraph) => (
                <p key={paragraph} className="text-[15px] leading-7 text-slate-400">
                  {paragraph}
                </p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-400">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-semibold text-white">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Questions about this page? Email{" "}
            <a
              className="text-brand-300 hover:text-brand-200"
              href="mailto:tejasimma36@gmail.com"
            >
              tejasimma36@gmail.com
            </a>
            .
          </p>
        </div>
      </article>

      <footer className="border-t border-white/10 px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Arkasodhara. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-300">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-300">
              Terms of Service
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
