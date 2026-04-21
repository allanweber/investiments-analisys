import { Link, Navigate, Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { AllocationTargetsByCategory } from '#/components/portfolio/allocation-targets-by-category'
import { PortfolioAllocationCurrentVsTarget } from '#/components/portfolio/portfolio-allocation-current-vs-target'
import { PortfolioContributionSuggestions } from '#/components/portfolio/portfolio-contribution-suggestions'
import { PortfolioDriftAnalysis } from '#/components/portfolio/portfolio-drift-analysis'
import { PortfolioSummaryCards } from '#/components/portfolio/portfolio-summary-cards'
import { authClient } from '#/lib/auth-client'
import {
  listPortfolioCurrenciesFn,
  loadPortfolioOverviewFn,
  saveAllocationTargetsBulkFn,
} from '#/lib/investment-server'
import { messages as m } from '#/messages'

export const Route = createFileRoute('/portfolio')({
  component: PortfolioPage,
})

function PortfolioPage() {
  const { data: session, isPending } = authClient.useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isPortfolioIndex = pathname === '/portfolio' || pathname === '/portfolio/'
  const [currencies, setCurrencies] = useState<string[] | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof loadPortfolioOverviewFn>> | null>(
    null,
  )
  const [allocationSaving, setAllocationSaving] = useState(false)

  /** Refetch when entering `/portfolio`: layout stays mounted on `/portfolio/holdings`, so holdings changes would stay stale otherwise. */
  useEffect(() => {
    if (!session?.user) return
    if (!isPortfolioIndex) return
    setOverview(null)
    listPortfolioCurrenciesFn()
      .then((cs) => {
        setCurrencies(cs)
        setCurrency((prev) => {
          if (cs.length === 0) return null
          if (prev && cs.includes(prev)) return prev
          return cs[0] ?? null
        })
      })
      .catch(() => {
        setCurrencies([])
        setCurrency(null)
      })
  }, [session?.user, isPortfolioIndex])

  useEffect(() => {
    if (!session?.user) return
    if (!currencies) return
    void loadPortfolioOverviewFn({ data: { currency } }).then((o) => setOverview(o))
  }, [session?.user, currencies, currency])

  const targetSegments = useMemo(() => {
    const t = overview?.targets ?? []
    return t.map((row) => ({
      investmentTypeId: row.investmentTypeId,
      investmentTypeName: row.investmentTypeName,
      value: row.targetPct,
    }))
  }, [overview?.targets])

  async function handleSaveAllocationTargets(
    targets: { investmentTypeId: string; targetPct: number }[],
  ) {
    setAllocationSaving(true)
    try {
      await saveAllocationTargetsBulkFn({ data: { targets } })
      const o = await loadPortfolioOverviewFn({ data: { currency } })
      setOverview(o)
    } catch {
      // keep local state; user can retry
    } finally {
      setAllocationSaving(false)
    }
  }

  if (isPending) {
    return (
      <main
        role="status"
        className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4"
      >
        <span className="sr-only">{m.common.loading}</span>
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
          aria-hidden
        />
      </main>
    )
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  const currenciesLoaded = currencies !== null
  const hasHoldings = (currencies?.length ?? 0) > 0
  /** Avoid empty state before we know currencies; avoid dashboard before overview when user has positions. */
  const portfolioLoading = !currenciesLoaded || (hasHoldings && overview === null)

  const total = overview?.totals.marketValue ?? 0
  const totalTarget = overview?.totals.targetTotalPct ?? 0
  const unrealized = overview?.totals.unrealizedPl ?? 0
  const plSharePct = total > 0 ? (unrealized / total) * 100 : 0

  return (
    <>
      {isPortfolioIndex ? (
        portfolioLoading ? (
          <main
            role="status"
            className="flex min-h-[50vh] w-full max-w-7xl flex-col items-center justify-center gap-2 px-4 py-8 sm:p-8 lg:p-12"
          >
            <span className="sr-only">{m.common.loading}</span>
            <div
              className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
              aria-hidden
            />
          </main>
        ) : (
        <main className="w-full max-w-7xl px-4 py-8 sm:p-8 lg:p-12">
          <section className="mb-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
                  Carteira
                </h1>
                <p className="mt-2 max-w-2xl text-sm italic leading-relaxed text-on-surface-variant md:not-italic">
                  Sem conversão cambial: totais ficam separados por moeda.
                </p>
                {currencies && currencies.length > 0 && (
                  <div className="mt-4 inline-flex rounded-full bg-surface-container-low p-1 shadow-inner">
                    {currencies.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCurrency(c)}
                        className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${c === currency
                            ? 'bg-surface text-on-surface shadow-sm'
                            : 'text-outline hover:text-on-surface'
                          }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Link
                  to="/portfolio/holdings"
                  className="text-center text-sm font-semibold text-outline no-underline hover:text-on-surface sm:order-2 sm:px-2"
                >
                  Ver posições
                </Link>
                <Link
                  to="/portfolio/holdings"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-md no-underline transition-opacity hover:opacity-95 sm:order-1"
                >
                  <span className="material-symbols-outlined text-[20px] leading-none">add</span>
                  Novo aporte
                </Link>
              </div>
            </div>
          </section>

          {!hasHoldings ? (
            <section className="mx-auto max-w-xl rounded-3xl bg-surface p-10 text-center shadow-lg ring-1 ring-outline-variant/10 md:max-w-2xl md:p-14">
              <p className="mb-6 text-sm text-on-surface-variant md:hidden">
                Consolide seus ativos e visualize sua saúde financeira.
              </p>
              <div className="relative mx-auto mb-8 flex max-w-sm justify-center">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-tertiary-fixed-dim/15 to-transparent blur-2xl" />
                <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-surface shadow-md ring-1 ring-outline-variant/15">
                  <span className="material-symbols-outlined text-5xl text-primary">account_balance_wallet</span>
                </div>
              </div>
              <h2 className="font-headline mb-3 text-2xl font-extrabold text-on-surface md:text-3xl">
                Sua carteira está pronta para ser construída.
              </h2>
              <p className="mx-auto mb-2 hidden max-w-md text-sm text-on-surface-variant md:block">
                Consolide seus ativos e visualize sua saúde financeira.
              </p>
              <p className="mx-auto mb-8 max-w-md text-sm text-on-surface-variant">
                Adicione seus primeiros investimentos para visualizar sua alocação e ranking estratégico.
              </p>
              <Link
                to="/portfolio/holdings"
                search={{ add: '1' }}
                className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-bold text-primary-foreground no-underline shadow-md transition-opacity hover:opacity-95 md:w-auto"
              >
                <span className="material-symbols-outlined text-[20px] leading-none">add</span>
                Adicionar investimento
              </Link>
              <p className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-surface-container-high px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-outline">
                <span className="material-symbols-outlined text-sm">info</span>
                Sem conversão cambial: totais ficam separados por moeda.
              </p>
            </section>
          ) : (
            <>
              <PortfolioSummaryCards
                total={total}
                unrealized={unrealized}
                currency={currency}
                plSharePct={plSharePct}
                lastUpdatedAt={overview?.lastUpdatedAt ?? null}
                totalTargetPct={totalTarget}
              />

              {overview?.quotesStale && (
                <section className="mb-8 rounded-2xl border border-error/15 bg-error-container/40 p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="material-symbols-outlined mt-0.5 text-xl text-error">
                        warning
                      </span>
                      <div>
                        <p className="font-headline text-sm font-bold text-on-surface">
                          Cotações desatualizadas
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Detectamos instabilidade na conexão com os provedores de mercado.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/portfolio/holdings"
                      className="inline-flex items-center justify-center rounded-xl bg-error-container px-4 py-2 text-xs font-bold text-on-error-container no-underline hover:opacity-95"
                    >
                      Tentar reconectar
                    </Link>
                  </div>
                </section>
              )}

              <PortfolioAllocationCurrentVsTarget
                allocation={overview?.allocation ?? []}
                targetSegments={targetSegments}
              />

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AllocationTargetsByCategory
                  rows={overview?.targets ?? []}
                  onSave={handleSaveAllocationTargets}
                  saving={allocationSaving}
                />
                <PortfolioDriftAnalysis drift={overview?.drift ?? []} />
              </section>

              <PortfolioContributionSuggestions suggestions={overview?.suggestions ?? []} />
            </>
          )}
        </main>
        )
      ) : null}
      <Outlet />
    </>
  )
}
