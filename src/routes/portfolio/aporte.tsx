import {
  Link,
  Navigate,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { DisplayCurrencySelector } from '@/components/portfolio/display-currency-selector'
import { CurrencyInput } from '@/components/portfolio/holdings/CurrencyInput'
import {
  AporteResults,
  formatCurrency,
} from '@/components/portfolio/aporte-results'
import { authClient } from '@/lib/auth-client'
import type {
  AporteSimulationResult,
  ContributionSuggestion,
} from '@/lib/aporte-server'
import { simulateAporteFn } from '@/lib/aporte-server'
import {
  aportarFn,
  getInvestmentLiveQuoteFn,
  saveAporteRunFn,
} from '@/lib/aporte-run-server'
import { SUPPORTED_FX_CURRENCIES } from '@/lib/fx'
import type { FxCurrency } from '@/lib/fx'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/portfolio/aporte')({
  component: AportePage,
})

function todayInputValue() {
  return new Date().toISOString().slice(0, 10)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function AportePage() {
  const { data: session, isPending } = authClient.useSession()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isAporteIndex =
    pathname === '/portfolio/aporte' || pathname === '/portfolio/aporte/'
  const [currency, setCurrency] = useState<FxCurrency>('BRL')
  const [amount, setAmount] = useState(0)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AporteSimulationResult | null>(null)
  const [computedAt, setComputedAt] = useState<string>('')
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set())
  const [removedNames, setRemovedNames] = useState<Map<string, string>>(
    new Map(),
  )
  const [recomputing, setRecomputing] = useState(false)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [aportarTarget, setAportarTarget] =
    useState<ContributionSuggestion | null>(null)
  const [saveOpen, setSaveOpen] = useState(false)

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
    setAppliedIds(new Set())
    setLoading(true)
    setResult(null)
    try {
      const res = await simulateAporteFn({ data: { amount, currency } })
      setResult(res)
      setComputedAt(new Date().toISOString())
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

  function handleAportarSuccess(investmentId: string) {
    setAppliedIds((prev) => new Set(prev).add(investmentId))
    setAportarTarget(null)
  }

  if (!isAporteIndex) {
    return <Outlet />
  }

  return (
    <main className="w-full max-w-4xl px-4 py-8 sm:p-8">
      <div className="mb-1 flex items-start justify-between gap-4">
        <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface md:text-4xl">
          {m.aporte.title}
        </h1>
        <Link
          to="/portfolio/aporte/historico"
          className="mt-1 inline-flex shrink-0 items-center gap-1.5 rounded-full border border-outline-variant/30 px-3.5 py-2 font-body text-sm font-semibold text-on-surface-variant no-underline transition-colors hover:bg-surface-container-high"
        >
          <span className="material-symbols-outlined text-lg leading-none">
            history
          </span>
          {m.aporte.historyLink}
        </Link>
      </div>
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

      {result?.reason === 'NO_TARGETS' && (
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
      )}

      {result?.reason === 'NO_ELIGIBLE_INVESTMENTS' && (
        <section className="rounded-2xl border border-outline-variant/30 bg-surface p-8 text-center">
          <p className="text-sm text-on-surface-variant">
            {m.aporte.noEligible}
          </p>
        </section>
      )}

      {result?.reason === 'OK' && (
        <>
          <div className="mb-3 flex items-center justify-end">
            <button
              type="button"
              onClick={() => setSaveOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant/30 px-4 py-2 font-body text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined text-lg leading-none">
                bookmark_add
              </span>
              {m.aporte.saveButton}
            </button>
          </div>
          <AporteResults
            suggestions={result.suggestions}
            typeProjections={result.typeProjections}
            unallocatedAmount={result.unallocatedAmount}
            currency={currency}
            appliedIds={appliedIds}
            recomputing={recomputing}
            onAportar={(s) => setAportarTarget(s)}
            onRemove={handleRemoveSuggestion}
          />
        </>
      )}

      {aportarTarget && (
        <AportarModal
          suggestion={aportarTarget}
          onClose={() => setAportarTarget(null)}
          onSuccess={handleAportarSuccess}
        />
      )}

      {saveOpen && result?.reason === 'OK' && (
        <SaveModal
          result={result}
          amount={amount}
          currency={currency}
          computedAt={computedAt || new Date().toISOString()}
          excludedIds={excludedIds}
          appliedIds={appliedIds}
          onClose={() => setSaveOpen(false)}
          onSaved={() => setSaveOpen(false)}
        />
      )}
    </main>
  )
}

function ModalShell({
  labelledBy,
  onClose,
  children,
}: {
  labelledBy: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-10"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function AportarModal({
  suggestion: s,
  onClose,
  onSuccess,
}: {
  suggestion: ContributionSuggestion
  onClose: () => void
  onSuccess: (investmentId: string) => void
}) {
  const [mode, setMode] = useState<'loading' | 'rv' | 'rf'>('loading')
  const [qty, setQty] = useState<number>(s.units ?? 0)
  const [unitPrice, setUnitPrice] = useState<number>(0)
  const [capital, setCapital] = useState<number>(round2(s.suggestedAmount))
  const [date, setDate] = useState<string>(todayInputValue())
  const [needsRf, setNeedsRf] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const isNewPosition = s.units == null && mode === 'rv'

  useEffect(() => {
    let cancelled = false
    void getInvestmentLiveQuoteFn({ data: { investmentId: s.investmentId } })
      .then((res) => {
        if (cancelled) return
        if (res.ok) {
          setMode('rv')
          setQty(s.units ?? 0)
          setUnitPrice(res.price ?? 0)
        } else if (res.code === 'FIXED_INCOME') {
          setMode('rf')
          setCapital(round2(s.suggestedAmount))
        } else {
          setMode('rv')
          setQty(s.units ?? 0)
          setUnitPrice(0)
        }
      })
      .catch(() => {
        if (!cancelled) setMode('rv')
      })
    return () => {
      cancelled = true
    }
  }, [s.investmentId, s.units, s.suggestedAmount])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const operationDate = new Date(`${date}T12:00:00`).toISOString()
    try {
      setBusy(true)
      let res: Awaited<ReturnType<typeof aportarFn>>
      if (mode === 'rf') {
        if (!(capital > 0)) {
          setErr(m.aporte.aportarPriceRequired)
          return
        }
        res = await aportarFn({
          data: { investmentId: s.investmentId, capital, operationDate },
        })
      } else {
        if (!(qty > 0)) {
          setErr(m.aporte.aportarQtyRequired)
          return
        }
        if (!(unitPrice > 0)) {
          setErr(m.aporte.aportarPriceRequired)
          return
        }
        res = await aportarFn({
          data: {
            investmentId: s.investmentId,
            units: qty,
            unitPrice,
            operationDate,
          },
        })
      }
      if (res.ok) {
        toast.success(m.aporte.aportarSuccess(s.investmentName))
        onSuccess(s.investmentId)
      } else if (res.code === 'NEEDS_RF_DETAILS') {
        setNeedsRf(true)
      } else {
        setErr(m.aporte.aportarError)
      }
    } catch {
      setErr(m.aporte.aportarError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell labelledBy="aportar-modal-title" onClose={onClose}>
      <h2
        id="aportar-modal-title"
        className="font-headline text-xl font-bold text-on-surface"
      >
        {m.aporte.aportarTitle} · {s.investmentName}
      </h2>
      <p className="mt-1 text-sm text-on-surface-variant">
        {m.aporte.aportarSubtitle}
      </p>

      {mode === 'loading' && (
        <div className="flex items-center gap-3 py-8 text-sm text-on-surface-variant">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
            aria-hidden
          />
          {m.aporte.aportarFetchingQuote}
        </div>
      )}

      {mode !== 'loading' && needsRf && (
        <div className="mt-5 space-y-4">
          <p className="rounded-xl bg-tertiary-container/40 px-4 py-3 text-sm text-on-surface">
            {m.aporte.aportarNeedsRfDetails}
          </p>
          <div className="flex gap-2">
            <Link
              to="/portfolio/holdings"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-4 py-2.5 font-body text-sm font-semibold text-on-primary no-underline"
            >
              <span className="material-symbols-outlined text-lg leading-none">
                account_balance_wallet
              </span>
              {m.aporte.aportarGoToCarteira}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-outline-variant/30 px-4 py-2.5 font-body text-sm font-semibold text-on-surface-variant"
            >
              {m.aporte.aportarCancel}
            </button>
          </div>
        </div>
      )}

      {mode !== 'loading' && !needsRf && (
        <form onSubmit={submit} className="mt-5 space-y-4">
          {mode === 'rv' ? (
            <>
              {isNewPosition && (
                <p className="rounded-xl bg-surface-variant/40 px-3 py-2 text-xs text-on-surface-variant">
                  {m.aporte.aportarNewPositionHint}
                </p>
              )}
              <label className="block">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-outline">
                  {m.aporte.aportarQtyLabel}
                </span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  value={qty || ''}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-3 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
                />
              </label>
              <CurrencyInput
                value={unitPrice}
                currency={s.suggestedCurrency}
                label={m.aporte.aportarUnitPriceLabel}
                onChange={setUnitPrice}
              />
              <p className="text-xs text-on-surface-variant">
                {m.aporte.colValor}:{' '}
                <span className="font-semibold tabular-nums text-on-surface">
                  {formatCurrency(round2(qty * unitPrice), s.suggestedCurrency)}
                </span>
              </p>
            </>
          ) : (
            <CurrencyInput
              value={capital}
              currency={s.contributionCurrency}
              label={m.aporte.aportarCapitalLabel}
              onChange={setCapital}
            />
          )}

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-outline">
              {m.aporte.aportarDateLabel}
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-3 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
            />
          </label>

          {err && (
            <p role="alert" className="text-xs text-error">
              {err}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-4 py-2.5 font-body text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {busy ? m.aporte.aportarSaving : m.aporte.aportarConfirm}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-outline-variant/30 px-4 py-2.5 font-body text-sm font-semibold text-on-surface-variant"
            >
              {m.aporte.aportarCancel}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  )
}

function SaveModal({
  result,
  amount,
  currency,
  computedAt,
  excludedIds,
  appliedIds,
  onClose,
  onSaved,
}: {
  result: Extract<AporteSimulationResult, { reason: 'OK' }>
  amount: number
  currency: string
  computedAt: string
  excludedIds: Set<string>
  appliedIds: Set<string>
  onClose: () => void
  onSaved: () => void
}) {
  const defaultName = `${new Date(computedAt).toLocaleDateString('pt-BR')} · ${formatCurrency(amount, currency)}`
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    try {
      setBusy(true)
      await saveAporteRunFn({
        data: {
          name: name.trim() || defaultName,
          amount,
          currency,
          simulatedAt: computedAt,
          snapshot: {
            input: {
              amount,
              currency,
              excludedInvestmentIds: [...excludedIds],
            },
            suggestions: result.suggestions,
            typeProjections: result.typeProjections,
            unallocatedAmount: result.unallocatedAmount,
            appliedInvestmentIds: [...appliedIds],
          },
        },
      })
      toast.success(m.aporte.saveSuccess)
      onSaved()
    } catch {
      setErr(m.aporte.saveError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell labelledBy="save-modal-title" onClose={onClose}>
      <h2
        id="save-modal-title"
        className="font-headline text-xl font-bold text-on-surface"
      >
        {m.aporte.saveTitle}
      </h2>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-outline">
            {m.aporte.saveNameLabel}
          </span>
          <input
            type="text"
            value={name}
            placeholder={defaultName}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-outline-variant/30 bg-surface-container-high px-3 py-2.5 text-sm font-semibold text-on-surface outline-none focus:border-primary"
          />
        </label>
        {err && (
          <p role="alert" className="text-xs text-error">
            {err}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-container px-4 py-2.5 font-body text-sm font-semibold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy ? m.aporte.saveSaving : m.aporte.saveConfirm}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline-variant/30 px-4 py-2.5 font-body text-sm font-semibold text-on-surface-variant"
          >
            {m.aporte.saveCancel}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}
