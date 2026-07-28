import { Link, Navigate, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { DisplayCurrencySelector } from '@/components/portfolio/display-currency-selector'
import { CurrencyInput } from '@/components/portfolio/holdings/CurrencyInput'
import { authClient } from '@/lib/auth-client'
import type {
  AporteSimulationResult,
  ContributionSuggestion,
  TypeProjection,
} from '@/lib/aporte-server'
import { simulateAporteFn } from '@/lib/aporte-server'
import { SUPPORTED_FX_CURRENCIES } from '@/lib/fx'
import type { FxCurrency } from '@/lib/fx'
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
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [removedNames, setRemovedNames] = useState<Map<string, string>>(
    new Map(),
  )
  const [recomputing, setRecomputing] = useState(false)

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

    setExcludedIds(new Set())
    setRemovedNames(new Map())
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

  async function recompute(nextExcluded: Set<string>) {
    setRecomputing(true)
    try {
      const res = await simulateAporteFn({
        data: { amount, currency, excludedInvestmentIds: [...nextExcluded] },
      })
      setResult(res)
    } catch {
      setError(m.aporte.errorCalc)
    } finally {
      setRecomputing(false)
    }
  }

  function handleRemoveSuggestion(
    investmentId: string,
    investmentName: string,
  ) {
    const next = new Set(excludedIds)
    next.add(investmentId)
    setExcludedIds(next)
    setRemovedNames((prev) => new Map(prev).set(investmentId, investmentName))
    void recompute(next)
  }

  function handleAddBack(investmentId: string) {
    const next = new Set(excludedIds)
    next.delete(investmentId)
    setExcludedIds(next)
    setRemovedNames((prev) => {
      const copy = new Map(prev)
      copy.delete(investmentId)
      return copy
    })
    void recompute(next)
  }

  return (
    <main className="w-full max-w-4xl px-4 py-8 sm:p-8">
      <h1 className="font-headline mb-1 text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
        {m.aporte.title}
      </h1>
      <p className="mb-8 text-sm text-on-surface-variant">
        {m.aporte.subtitle}
      </p>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end"
      >
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
            errorId="aporte-amount-error"
            onChange={setAmount}
          />
          {amountError && (
            <p
              id="aporte-amount-error"
              role="alert"
              className="text-xs text-error"
            >
              {amountError}
            </p>
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

      {removedNames.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-on-surface-variant">
            {m.aporte.removedChipsLabel}
          </span>
          {[...removedNames.entries()].map(([id, name]) => (
            <button
              key={id}
              type="button"
              onClick={() => handleAddBack(id)}
              className="inline-flex items-center gap-1 rounded-full bg-surface-variant/50 px-3 py-1 font-medium text-on-surface-variant transition-opacity hover:opacity-80"
            >
              <span className="line-through">{name}</span>
              <span className="material-symbols-outlined text-[14px]">add</span>
            </button>
          ))}
        </div>
      )}

      {result && (
        <ResultsSection
          result={result}
          recomputing={recomputing}
          currency={currency}
          onRemove={handleRemoveSuggestion}
        />
      )}
    </main>
  )
}

function ResultsSection({
  result,
  recomputing,
  currency,
  onRemove,
}: {
  result: AporteSimulationResult
  recomputing: boolean
  currency: string
  onRemove: (investmentId: string, investmentName: string) => void
}) {
  if (result.reason === 'NO_TARGETS') {
    return (
      <section className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center">
        <p className="mb-4 text-sm text-on-surface-variant">
          {m.aporte.noTargets}
        </p>
        <Link
          to="/portfolio"
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary no-underline hover:opacity-80"
        >
          <span className="material-symbols-outlined text-[18px]">
            arrow_back
          </span>
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

  const suggestionsByType = result.suggestions.reduce<
    Record<string, ContributionSuggestion[]>
  >((acc, s) => {
    ;(acc[s.investmentTypeId] ??= []).push(s)
    return acc
  }, {})

  return (
    <section className={`space-y-3 ${recomputing ? 'opacity-60' : ''}`}>
      {result.typeProjections.map((proj) => {
        const items = suggestionsByType[proj.investmentTypeId]
        return (
          <div
            key={proj.investmentTypeId}
            className="rounded-2xl border border-outline-variant/30"
          >
            <TypeHeader proj={proj} />
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- suggestionsByType is Record<string,...> (no noUncheckedIndexedAccess), but it only has entries for types with a contribution suggestion, so items is genuinely undefined otherwise */}
            {!items && proj.targetTypePct > 0 && (
              <p className="px-4 py-3 text-xs text-on-surface-variant">
                {m.aporte.categoryAboveTarget}
              </p>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- same suggestionsByType Record<string,...> gap as above */}
            {items && (
              <>
                <div className="md:hidden">
                  {items.map((s) => (
                    <SuggestionCard
                      key={s.investmentId}
                      suggestion={s}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/15 text-left text-xs font-semibold text-on-surface-variant">
                        <th className="px-4 py-2">
                          {m.aporte.colInvestimento}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colValor}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colUnidades}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colPct}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colScore}
                        </th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => (
                        <SuggestionRow
                          key={s.investmentId}
                          suggestion={s}
                          onRemove={onRemove}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })}
      {result.unallocatedAmount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-variant/20 px-4 py-3">
          <span className="text-sm font-semibold text-on-surface">
            {m.aporte.naoAlocado}
          </span>
          <span className="tabular-nums text-on-surface">
            {formatCurrency(result.unallocatedAmount, currency)}
          </span>
        </div>
      )}
    </section>
  )
}

function TypeHeader({ proj: p }: { proj: TypeProjection }) {
  const hitTarget = p.projectedTypePct >= p.targetTypePct && p.targetTypePct > 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 bg-surface-variant/30 px-4 py-3">
      <span className="text-sm font-semibold text-on-surface">
        {p.investmentTypeName}
      </span>
      <span className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="tabular-nums">{p.currentTypePct.toFixed(1)}%</span>
        <span className="material-symbols-outlined text-[14px]">
          arrow_forward
        </span>
        <span
          className={`font-semibold tabular-nums ${hitTarget ? 'text-primary' : 'text-on-surface'}`}
        >
          {p.projectedTypePct.toFixed(1)}%
        </span>
        {p.targetTypePct > 0 && (
          <span className="text-outline">
            / meta {p.targetTypePct.toFixed(1)}%
          </span>
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

function formatUnits(units: number | null | undefined): string {
  if (units == null) return m.aporte.dash
  return Number.isInteger(units)
    ? String(units)
    : units.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function SuggestionCard({
  suggestion: s,
  onRemove,
}: {
  suggestion: ContributionSuggestion
  onRemove: (investmentId: string, investmentName: string) => void
}) {
  const showDual =
    s.suggestedCurrency.toUpperCase() !== s.contributionCurrency.toUpperCase()

  return (
    <div className="border-b border-outline-variant/10 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-on-surface">
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
        <button
          type="button"
          onClick={() => onRemove(s.investmentId, s.investmentName)}
          aria-label={m.aporte.removeSuggestion}
          title={m.aporte.removeSuggestion}
          className="-mr-1 shrink-0 rounded-full p-1 text-on-surface-variant transition-opacity hover:opacity-70"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
          {m.aporte.colValor}
        </span>
        <span className="text-lg font-semibold tabular-nums text-on-surface">
          {formatCurrency(s.suggestedAmount, s.suggestedCurrency)}
        </span>
        {showDual && (
          <span className="text-xs tabular-nums text-on-surface-variant">
            {formatCurrency(s.contributionAmount, s.contributionCurrency)}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colUnidades}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {formatUnits(s.units)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colPct}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {s.contributionPct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colScore}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {s.score}
          </p>
        </div>
      </div>
    </div>
  )
}

function SuggestionRow({
  suggestion: s,
  onRemove,
}: {
  suggestion: ContributionSuggestion
  onRemove: (investmentId: string, investmentName: string) => void
}) {
  const showDual =
    s.suggestedCurrency.toUpperCase() !== s.contributionCurrency.toUpperCase()

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
            <span>
              {formatCurrency(s.suggestedAmount, s.suggestedCurrency)}
            </span>
            <span className="text-xs text-on-surface-variant">
              {formatCurrency(s.contributionAmount, s.contributionCurrency)}
            </span>
          </span>
        ) : (
          formatCurrency(s.suggestedAmount, s.suggestedCurrency)
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
        {formatUnits(s.units)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface">
        {s.contributionPct.toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
        {s.score}
      </td>
      <td className="px-2 py-3 text-right">
        <button
          type="button"
          onClick={() => onRemove(s.investmentId, s.investmentName)}
          aria-label={m.aporte.removeSuggestion}
          title={m.aporte.removeSuggestion}
          className="rounded-full p-1 text-on-surface-variant transition-opacity hover:opacity-70"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </td>
    </tr>
  )
}
