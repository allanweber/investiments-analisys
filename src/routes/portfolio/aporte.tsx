import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { DisplayCurrencySelector } from '@/components/portfolio/display-currency-selector'
import { CurrencyInput } from '@/components/portfolio/holdings/CurrencyInput'
import { authClient } from '@/lib/auth-client'
import type { AporteSimulationResult, ContributionSuggestion, TypeProjection } from '@/lib/aporte-server'
import { simulateAporteFn } from '@/lib/aporte-server'
import { SUPPORTED_FX_CURRENCIES, type FxCurrency } from '@/lib/fx'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/portfolio/aporte')({
  component: AportePage,
})

function AportePage() {
  const { data: session, isPending } = authClient.useSession()
  const [currency, setCurrency] = useState<FxCurrency>('BRL')
  const [amount, setAmount] = useState(0)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AporteSimulationResult | null>(null)

  if (isPending) {
    return (
      <main
        role="status"
        className="flex min-h-[50vh] items-center justify-center"
      >
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
          aria-hidden
        />
        <span className="sr-only">{m.common.loading}</span>
      </main>
    )
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setAmountError(null)
    setError(null)

    if (!amount || amount <= 0) {
      setAmountError(m.aporte.amountRequired)
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const res = await simulateAporteFn({ data: { amount, currency } })
      setResult(res)
    } catch {
      setError(m.aporte.errorCalc)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="w-full max-w-4xl px-4 py-8 sm:p-8">
      <h1 className="font-headline mb-1 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
        {m.aporte.title}
      </h1>
      <p className="mb-8 text-sm text-on-surface-variant">{m.aporte.subtitle}</p>

      <form onSubmit={handleSubmit} className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-outline">
            {m.aporte.currencyLabel}
          </span>
          <DisplayCurrencySelector
            value={currency}
            options={SUPPORTED_FX_CURRENCIES}
            onChange={setCurrency}
          />
        </div>

        <div className="flex flex-col gap-1">
          <CurrencyInput
            value={amount}
            currency={currency}
            label={m.aporte.amountLabel}
            hasError={!!amountError}
            onChange={setAmount}
          />
          {amountError && (
            <p className="text-xs text-error">{amountError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-95 disabled:opacity-60"
        >
          {loading ? m.aporte.calculating : m.aporte.calcularButton}
        </button>
      </form>

      {loading && (
        <div
          role="status"
          className="flex items-center gap-3 text-sm text-on-surface-variant"
        >
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
            aria-hidden
          />
          <span>{m.aporte.calculating}</span>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
          {error}
        </p>
      )}

      {result && <ResultsSection result={result} />}
    </main>
  )
}

function ResultsSection({ result }: { result: AporteSimulationResult }) {
  if (result.reason === 'NO_TARGETS') {
    return (
      <section className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center">
        <p className="mb-4 text-sm text-on-surface-variant">{m.aporte.noTargets}</p>
        <Link
          to="/portfolio"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline hover:opacity-80"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Portfólio
        </Link>
      </section>
    )
  }

  if (result.reason === 'NO_ELIGIBLE_INVESTMENTS') {
    return (
      <section className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center">
        <p className="text-sm text-on-surface-variant">{m.aporte.noEligible}</p>
      </section>
    )
  }

  const suggestionsByType = result.suggestions.reduce<Record<string, ContributionSuggestion[]>>(
    (acc, s) => {
      ;(acc[s.investmentTypeId] ??= []).push(s)
      return acc
    },
    {},
  )

  return (
    <section className="space-y-3">
      {result.typeProjections.map((proj) => {
        const items = suggestionsByType[proj.investmentTypeId]
        return (
          <div key={proj.investmentTypeId} className="overflow-x-auto rounded-2xl border border-outline-variant/30">
            <TypeHeader proj={proj} />
            {items && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/15 text-left text-xs font-semibold text-on-surface-variant">
                    <th className="px-4 py-2">{m.aporte.colInvestimento}</th>
                    <th className="px-4 py-2 text-right">{m.aporte.colValor}</th>
                    <th className="px-4 py-2 text-right">{m.aporte.colUnidades}</th>
                    <th className="px-4 py-2 text-right">{m.aporte.colPct}</th>
                    <th className="px-4 py-2 text-right">{m.aporte.colScore}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <SuggestionRow key={s.investmentId} suggestion={s} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </section>
  )
}

function TypeHeader({ proj: p }: { proj: TypeProjection }) {
  const hitTarget = p.projectedTypePct >= p.targetTypePct && p.targetTypePct > 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 bg-surface-variant/30 px-4 py-3">
      <span className="text-sm font-semibold text-on-surface">{p.investmentTypeName}</span>
      <span className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="tabular-nums">{p.currentTypePct.toFixed(1)}%</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        <span className={`font-semibold tabular-nums ${hitTarget ? 'text-primary' : 'text-on-surface'}`}>
          {p.projectedTypePct.toFixed(1)}%
        </span>
        {p.targetTypePct > 0 && (
          <span className="text-outline">/ meta {p.targetTypePct.toFixed(1)}%</span>
        )}
      </span>
    </div>
  )
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function SuggestionRow({ suggestion: s }: { suggestion: ContributionSuggestion }) {
  const showDual = s.suggestedCurrency.toUpperCase() !== s.contributionCurrency.toUpperCase()

  return (
    <tr className="border-b border-outline-variant/10 hover:bg-surface-variant/20">
      <td className="px-4 py-3 font-medium text-on-surface">
        <span className="flex items-center gap-1.5">
          {s.investmentName}
          {s.missingQuote && (
            <span
              className="material-symbols-outlined text-[16px] text-tertiary"
              title={m.aporte.missingQuoteTooltip}
              aria-label={m.aporte.missingQuoteTooltip}
            >
              info
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface">
        {showDual ? (
          <span className="flex flex-col items-end gap-0.5">
            <span>{formatCurrency(s.suggestedAmount, s.suggestedCurrency)}</span>
            <span className="text-xs text-on-surface-variant">
              {formatCurrency(s.contributionAmount, s.contributionCurrency)}
            </span>
          </span>
        ) : (
          formatCurrency(s.suggestedAmount, s.suggestedCurrency)
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
        {s.units != null
          ? Number.isInteger(s.units)
            ? s.units
            : s.units.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
          : m.aporte.dash}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface">
        {s.contributionPct.toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">{s.score}</td>
    </tr>
  )
}
