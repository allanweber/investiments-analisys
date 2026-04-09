import { Link, useRouterState } from '@tanstack/react-router'

import BetterAuthHeader from '#/integrations/better-auth/header-user'
import ThemeToggle from './ThemeToggle'

const NAV = [
  { to: '/dashboard', label: 'Início', shortLabel: 'Início', icon: 'dashboard' as const },
  { to: '/investimentos', label: 'Investimentos', shortLabel: 'Invest', icon: 'payments' as const },
  {
    to: '/tipos',
    label: 'Tipos de Investimento',
    shortLabel: 'Tipos',
    icon: 'account_balance_wallet' as const,
  },
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isLogin = pathname === '/login'

  if (isLogin) {
    return <>{children}</>
  }

  return (
    <>
      <header className="fa-glass fixed top-0 z-50 w-full border-b border-outline-variant/15 shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Link
              to="/dashboard"
              className="font-headline text-lg font-bold tracking-tight text-on-surface no-underline"
            >
              The Financial Architect
            </Link>
            <nav className="hidden items-center gap-6 font-headline text-sm font-semibold tracking-tight md:flex">
              {NAV.map(({ to, label, icon }) => {
                const active =
                  to === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === to || pathname.startsWith(`${to}/`)
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`inline-flex items-center gap-1.5 border-b-2 pb-1 no-underline transition-colors ${
                      active
                        ? 'border-on-surface text-on-surface'
                        : 'border-transparent text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined shrink-0 text-xl leading-none">
                      {icon}
                    </span>
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/investimentos"
              className="hidden items-center gap-1.5 rounded-xl bg-primary-container px-3 py-2 font-headline text-xs font-bold text-on-primary no-underline shadow-sm transition-opacity hover:opacity-95 sm:inline-flex"
            >
              <span className="material-symbols-outlined shrink-0 text-lg leading-none">
                add_circle
              </span>
              Novo investimento
            </Link>
            <ThemeToggle />
            <BetterAuthHeader variant="topbar" />
          </div>
        </div>
      </header>

      <div className="min-h-screen pt-16">
        <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-x-hidden pb-24 md:pb-8">
          {children}
        </div>
      </div>

      <nav className="fa-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-outline-variant/20 bg-surface-container-lowest/95 px-4 py-3 backdrop-blur-md md:hidden">
        {NAV.map(({ to, icon, shortLabel }) => {
          const active =
            to === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 no-underline ${
                active ? 'text-primary' : 'text-outline'
              }`}
            >
              <span className="material-symbols-outlined shrink-0 text-[22px] leading-none">
                {icon}
              </span>
              <span className="text-[10px] font-bold uppercase">
                {shortLabel}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
