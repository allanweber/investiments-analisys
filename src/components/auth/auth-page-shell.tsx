import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import ThemeToggle from '@/components/ThemeToggle'
import { messages as m } from '@/messages'

type AuthPageShellProps = {
  icon: string
  title: string
  subtitle: string
  children: ReactNode
}

export function AuthPageShell({
  icon,
  title,
  subtitle,
  children,
}: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-surface font-body text-on-surface">
      <header className="fa-glass sticky top-0 z-50 border-b border-outline-variant/15">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
            {m.shell.brand}
          </span>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-6 font-headline text-sm font-semibold md:flex">
              <Link
                to="/dashboard"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                {m.auth.navInicio}
              </Link>
              <Link
                to="/investimentos"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                {m.auth.navInvestimentos}
              </Link>
              <Link
                to="/tipos"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                {m.auth.navTipos}
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="relative flex flex-grow flex-col items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-30">
          <div className="absolute right-[-5%] top-[-10%] h-96 w-96 rounded-full bg-primary-fixed blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-5%] h-96 w-96 rounded-full bg-tertiary-fixed-dim blur-3xl" />
        </div>

        <div className="z-10 w-full max-w-[440px]">
          <div className="mb-10 text-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container shadow-lg">
              <span className="material-symbols-outlined text-3xl text-on-primary">
                {icon}
              </span>
            </div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              {title}
            </h1>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              {subtitle}
            </p>
          </div>

          <div className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-8 shadow-float md:p-10">
            {children}
          </div>

          <div className="mt-12 flex justify-center gap-8">
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              {m.auth.legalPrivacy}
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              {m.auth.legalTerms}
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              {m.auth.legalSupport}
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
