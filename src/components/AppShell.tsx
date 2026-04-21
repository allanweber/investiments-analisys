import { Link, Navigate, useRouterState } from '@tanstack/react-router'

import { TooltipProvider } from '#/components/ui/tooltip'
import BetterAuthHeader from '#/integrations/better-auth/header-user'
import { authClient } from '#/lib/auth-client'
import { messages as m } from '#/messages'
import ThemeToggle from './ThemeToggle'

const NAV_CONFIG = [
  {
    to: '/dashboard' as const,
    icon: 'dashboard' as const,
    labelKey: 'inicio' as const,
    shortKey: 'inicio' as const,
  },
  {
    to: '/investimentos' as const,
    icon: 'payments' as const,
    labelKey: 'invest' as const,
    shortKey: 'investShort' as const,
  },
  {
    to: '/tipos' as const,
    icon: 'account_balance_wallet' as const,
    labelKey: 'tipos' as const,
    shortKey: 'tiposShort' as const,
  },
  {
    to: '/portfolio' as const,
    icon: 'pie_chart' as const,
    labelKey: 'carteira' as const,
    shortKey: 'carteira' as const,
  },
]

function navLabels() {
  return {
    inicio: m.shell.navInicio,
    invest: m.shell.navInvestimentos,
    investShort: m.shell.navInvestimentosShort,
    tipos: m.shell.navTiposLong,
    tiposShort: m.shell.navTiposShort,
    carteira: m.shell.navCarteira,
  }
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { data: session, isPending } = authClient.useSession()
  const isLogin = pathname === '/login'
  const L = navLabels()
  const NAV = NAV_CONFIG.map((c) => ({
    ...c,
    label: L[c.labelKey],
    shortLabel: L[c.shortKey],
  }))

  if (isLogin) {
    return <>{children}</>
  }

  if (isPending) {
    return null
  }

  if (!session?.user) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      <header className="fa-glass fixed top-0 z-50 w-full border-b border-outline-variant/15 shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-6">
            <Link
              to="/dashboard"
              className="shrink-0 font-headline text-lg font-bold tracking-tight text-on-surface no-underline"
            >
              {m.shell.brand}
            </Link>
            <nav
              aria-label="Principal"
              className="hidden min-w-0 flex-1 items-center gap-2 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] lg:flex lg:gap-5 xl:gap-6 [&::-webkit-scrollbar]:hidden"
            >
              {NAV.map(({ to, label, shortLabel, icon }) => {
                const active =
                  to === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname === to || pathname.startsWith(`${to}/`)
                return (
                  <Link
                    key={to}
                    to={to}
                    title={label}
                    className={`inline-flex shrink-0 items-center gap-1.5 border-b-2 pb-1 text-xs font-semibold no-underline transition-colors xl:text-sm ${
                      active
                        ? 'border-on-surface text-on-surface'
                        : 'border-transparent text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined shrink-0 text-lg leading-none xl:text-xl">
                      {icon}
                    </span>
                    <span className="hidden xl:inline">{label}</span>
                    <span className="xl:hidden">{shortLabel}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <Link
              to="/investimentos"
              className="hidden items-center gap-1.5 rounded-xl bg-primary-container px-3 py-2 font-headline text-xs font-bold text-on-primary no-underline shadow-sm transition-opacity hover:opacity-95 xl:inline-flex"
            >
              <span className="material-symbols-outlined shrink-0 text-lg leading-none">
                add_circle
              </span>
              {m.shell.newInvestment}
            </Link>
            <Link
              to="/investimentos"
              className="hidden h-9 w-9 items-center justify-center rounded-xl bg-primary-container text-on-primary no-underline shadow-sm transition-opacity hover:opacity-95 lg:inline-flex xl:hidden"
              aria-label={m.shell.newInvestment}
            >
              <span className="material-symbols-outlined shrink-0 text-[20px] leading-none">
                add_circle
              </span>
            </Link>
            <ThemeToggle />
            <BetterAuthHeader variant="topbar" />
          </div>
        </div>
      </header>

      <div className="min-h-screen pt-16">
        <TooltipProvider delayDuration={200}>
          <div className="mx-auto min-h-[calc(100vh-4rem)] max-w-7xl overflow-x-hidden pb-24 lg:pb-8">
            {children}
          </div>
        </TooltipProvider>
      </div>

      <nav
        aria-label="Navegação principal"
        className="fa-mobile-nav fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-outline-variant/20 bg-surface-container-lowest/95 px-2 py-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:px-4 sm:py-3 lg:hidden"
      >
        {NAV.map(({ to, icon, shortLabel }) => {
          const active =
            to === '/dashboard'
              ? pathname === '/dashboard'
              : pathname === to || pathname.startsWith(`${to}/`)
          return (
            <Link
              key={to}
              to={to}
              className={`flex min-w-0 max-w-[25%] flex-1 flex-col items-center gap-0.5 px-0.5 no-underline ${
                active ? 'text-primary' : 'text-outline'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="material-symbols-outlined shrink-0 text-[22px] leading-none sm:text-[24px]">
                {icon}
              </span>
              <span className="line-clamp-2 w-full text-center text-[9px] font-semibold leading-tight tracking-tight sm:text-[10px]">
                {shortLabel}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
