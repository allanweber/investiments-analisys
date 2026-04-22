import { Link, Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { authClient } from '#/lib/auth-client'
import {
  deletePortfolioHoldingFn,
  listInvestmentsOverviewFn,
  listPortfolioCurrenciesFn,
  listPortfolioHoldingsFn,
  upsertPortfolioHoldingFn,
} from '#/lib/investment-server'
import { messages as m } from '#/messages'

export const Route = createFileRoute('/portfolio/holdings')({
  validateSearch: z.object({
    add: z.literal('1').optional(),
  }),
  component: HoldingsPage,
})

function fmtMoney(v: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency}`
  }
}

function localeForCurrency(currency: string): string {
  if (currency === 'BRL') return 'pt-BR'
  if (currency === 'EUR') return 'de-DE'
  return 'en-US'
}

type MoneyPartsMeta = {
  locale: string
  decimal: string
  group: string
  currencySymbol: string
}

function moneyMeta(currency: string): MoneyPartsMeta {
  const locale = localeForCurrency(currency)
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).formatToParts(1234567.89)
    return {
      locale,
      decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
      group: parts.find((p) => p.type === 'group')?.value ?? ',',
      currencySymbol: (parts.find((p) => p.type === 'currency')?.value ?? '').trim(),
    }
  } catch {
    return { locale: 'en-US', decimal: '.', group: ',', currencySymbol: '' }
  }
}

function round2(n: number): number {
  const x = Number.isFinite(n) ? n : 0
  return Math.round(Math.max(0, x) * 100) / 100
}

/** Formata valor com símbolo da moeda e exatamente 2 casas decimais (locale da moeda). */
function formatCurrencyFixed2(n: number, currency: string): string {
  const locale = localeForCurrency(currency)
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(round2(n))
  } catch {
    return `${round2(n).toFixed(2)} ${currency}`
  }
}

/**
 * Sanitiza texto digitado: sem negativos, separador decimal da moeda, até 2 casas decimais.
 */
function sanitizeAvgCostTyping(raw: string, meta: MoneyPartsMeta): string {
  let s = raw.replace(/\u00a0/g, ' ')
  if (meta.currencySymbol) {
    const esc = meta.currencySymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(esc, 'g'), '')
  }
  s = s.replace(/\s/g, '').replaceAll(meta.group, '').replace(/-/g, '')

  const d = meta.decimal
  const filtered = [...s].filter((ch) => (ch >= '0' && ch <= '9') || ch === d).join('')
  const first = filtered.indexOf(d)
  if (first === -1) {
    if (filtered.length > 14) return filtered.slice(0, 14)
    return filtered
  }
  const intPart = filtered.slice(0, first).replace(/\D/g, '').slice(0, 12)
  const fracPart = filtered
    .slice(first + 1)
    .replace(/\D/g, '')
    .slice(0, 2)
  return `${intPart}${d}${fracPart}`
}

function parseAvgCostDraft(draft: string, meta: MoneyPartsMeta): number {
  const d = meta.decimal
  const s = draft.trim()
  if (!s) return 0
  const di = s.indexOf(d)
  if (di === -1) {
    const intPart = s.replace(/\D/g, '').slice(0, 12)
    const whole = intPart === '' ? 0 : parseInt(intPart, 10)
    return round2(whole)
  }
  const intPart = s.slice(0, di).replace(/\D/g, '').slice(0, 12)
  const frac = s.slice(di + d.length).replace(/\D/g, '').slice(0, 2)
  const whole = intPart === '' ? 0 : parseInt(intPart, 10)
  const fracVal = frac.length ? parseInt(frac, 10) / 10 ** frac.length : 0
  return round2(whole + fracVal)
}

/** Moedas permitidas ao criar/editar posição (independe das moedas já usadas na carteira). */
const HOLDING_CURRENCY_OPTIONS = ['BRL', 'USD', 'EUR'] as const

/**
 * Associa ticker digitado a um investimento cadastrado (nome = ticker ou contém o ticker).
 * Retorna null se não houver candidato claro.
 */
function isRendaFixaTipo(name: string | null | undefined): boolean {
  return (name ?? '').trim() === 'Renda fixa'
}

function findInvestmentIdForTicker(
  ticker: string,
  rows: { id: string; name: string }[],
): string | null {
  const raw = ticker.trim()
  if (!raw || rows.length === 0) return null
  const u = raw.toUpperCase()
  const norm = (s: string) => s.trim().toUpperCase()

  const exact = rows.find((r) => norm(r.name) === u)
  if (exact) return exact.id

  const starts = rows.filter((r) => norm(r.name).startsWith(u))
  if (starts.length >= 1) {
    starts.sort((a, b) => a.name.length - b.name.length)
    return starts[0]!.id
  }

  const contains = rows.filter((r) => norm(r.name).includes(u))
  if (contains.length === 0) return null
  contains.sort((a, b) => a.name.length - b.name.length)
  return contains[0]!.id
}

type HoldingRow = Awaited<ReturnType<typeof listPortfolioHoldingsFn>>['rows'][number]

const DONUT_COLORS = [
  'var(--color-primary-container)',
  'var(--color-tertiary-fixed-dim)',
  'var(--color-secondary-container)',
  'var(--color-outline-variant)',
]

function toDateInputValue(v: unknown): string {
  if (v == null) return ''
  const d = v instanceof Date ? v : new Date(String(v))
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

function fmtQuantity(q: number): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(q)
}

/** Quantidade adicional (aceita vírgula decimal). */
function parseAdditionalQty(raw: string): number {
  const s = raw.replace(/\s/g, '').replace(',', '.')
  if (!s) return 0
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

type PortfolioHoldingForm = {
  investmentId: string
  ticker: string
  quantity: number
  avgCost: number
  broker: string
  currency: string
  lastOpDate: string
}

function SharedHoldingFormFields({
  form,
  setForm,
  invOptions,
  quantityError,
  setQuantityError,
  avgCostFocused,
  setAvgCostFocused,
  avgCostDraft,
  setAvgCostDraft,
  avgCostPointerDownBeforeFocusRef,
  avgCostSuppressNextMouseUpRef,
  avgCostLabel,
}: {
  form: PortfolioHoldingForm
  setForm: Dispatch<SetStateAction<PortfolioHoldingForm>>
  invOptions: Array<{ id: string; name: string }> | null
  quantityError: boolean
  setQuantityError: (v: boolean) => void
  avgCostFocused: boolean
  setAvgCostFocused: (v: boolean) => void
  avgCostDraft: string
  setAvgCostDraft: (v: string) => void
  avgCostPointerDownBeforeFocusRef: MutableRefObject<boolean>
  avgCostSuppressNextMouseUpRef: MutableRefObject<boolean>
  avgCostLabel: string
}) {
  return (
    <>
      <div className="sm:col-span-1">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
          Quantidade
        </label>
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={quantityError}
          value={form.quantity === 0 ? '' : String(form.quantity)}
          onChange={(e) => {
            if (invOptions === null) return
            setQuantityError(false)
            const raw = e.target.value.replace(/\D/g, '').slice(0, 12)
            if (raw === '') {
              setForm({ ...form, quantity: 0 })
              return
            }
            const n = parseInt(raw, 10)
            setForm({
              ...form,
              quantity: Number.isFinite(n) && n >= 0 ? n : 0,
            })
          }}
          disabled={invOptions === null}
          className={`mt-2 w-full border-0 border-b-2 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 ${
            quantityError ? 'border-error focus:border-error' : 'border-outline-variant/50'
          }`}
        />
        {quantityError && (
          <p className="mt-2 text-xs font-semibold text-error">A quantidade deve ser maior que zero.</p>
        )}
      </div>

      <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
        {avgCostLabel}
        <input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={
            avgCostFocused ? avgCostDraft : formatCurrencyFixed2(form.avgCost, form.currency)
          }
          onMouseDown={(e) => {
            if (e.currentTarget !== document.activeElement) {
              avgCostPointerDownBeforeFocusRef.current = true
            }
          }}
          onFocus={(e) => {
            const el = e.currentTarget
            if (invOptions === null) {
              avgCostPointerDownBeforeFocusRef.current = false
              return
            }
            const meta = moneyMeta(form.currency)
            setAvgCostFocused(true)
            setAvgCostDraft(
              sanitizeAvgCostTyping(formatCurrencyFixed2(form.avgCost, form.currency), meta),
            )
            if (avgCostPointerDownBeforeFocusRef.current) {
              avgCostSuppressNextMouseUpRef.current = true
              avgCostPointerDownBeforeFocusRef.current = false
            }
            setTimeout(() => {
              el.select()
            }, 0)
          }}
          onMouseUp={(e) => {
            if (avgCostSuppressNextMouseUpRef.current) {
              e.preventDefault()
              avgCostSuppressNextMouseUpRef.current = false
            }
          }}
          onChange={(e) => {
            if (invOptions === null) return
            const meta = moneyMeta(form.currency)
            const next = sanitizeAvgCostTyping(e.target.value, meta)
            setAvgCostDraft(next)
            setForm((f) => ({ ...f, avgCost: parseAvgCostDraft(next, meta) }))
          }}
          onBlur={() => {
            const meta = moneyMeta(form.currency)
            const n = round2(parseAvgCostDraft(avgCostDraft, meta))
            setForm((f) => ({ ...f, avgCost: n }))
            setAvgCostFocused(false)
            setAvgCostDraft('')
          }}
          disabled={invOptions === null}
          className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-1">
        Corretora (opcional)
        <input
          value={form.broker}
          onChange={(e) => setForm({ ...form, broker: e.target.value })}
          disabled={invOptions === null}
          className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
          placeholder="Ex: XP Investimentos"
        />
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-1">
        Moeda
        <select
          value={form.currency}
          onChange={(e) => {
            setAvgCostFocused(false)
            setAvgCostDraft('')
            setForm((f) => ({
              ...f,
              currency: e.target.value,
              avgCost: round2(f.avgCost),
            }))
          }}
          disabled={invOptions === null}
          className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
        >
          {HOLDING_CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-2">
        Data da última operação (opcional)
        <input
          type="date"
          value={form.lastOpDate}
          onChange={(e) => setForm({ ...form, lastOpDate: e.target.value })}
          disabled={invOptions === null}
          className="mt-2 w-full max-w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 sm:max-w-xs"
        />
      </label>
    </>
  )
}

function DonutAllocation({
  segments,
  centerPct,
  centerLabel,
}: {
  segments: { label: string; pct: number; color: string }[]
  centerPct: string
  centerLabel: string
}) {
  const total = segments.reduce((a, s) => a + s.pct, 0) || 1
  let start = 0
  const parts = segments.map((s) => {
    const p = (s.pct / total) * 100
    const from = start
    start += p
    return `${s.color} ${from}% ${start}%`
  })
  const grad = `conic-gradient(${parts.join(', ')})`
  return (
    <div className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10">
      <h3 className="font-headline text-base font-extrabold text-on-surface">Alocação atual</h3>
      <div className="relative mx-auto mt-6 flex h-52 w-52 max-w-full items-center justify-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: grad,
            mask: 'radial-gradient(farthest-side, transparent 58%, black 60%)',
            WebkitMask: 'radial-gradient(farthest-side, transparent 58%, black 60%)',
          }}
        />
        <div className="relative z-[1] max-w-[9rem] text-center">
          <p className="font-headline text-2xl font-extrabold leading-tight text-on-surface">{centerPct}</p>
          <p
            className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-widest text-outline"
            title={centerLabel}
            style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {centerLabel}
          </p>
        </div>
      </div>
      <ul className="mt-6 space-y-1">
        {segments.map((s) => (
          <li
            key={s.label}
            className="flex items-center justify-between rounded-xl px-2 py-2 text-sm transition-colors hover:bg-surface-container-low"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate font-medium text-on-surface">{s.label}</span>
            </span>
            <span className="shrink-0 pl-2 font-bold text-on-surface">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function HoldingsPage() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()
  const [currencies, setCurrencies] = useState<string[] | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)
  const [data, setData] = useState<Awaited<ReturnType<typeof listPortfolioHoldingsFn>> | null>(null)
  const [currencySwitchLoading, setCurrencySwitchLoading] = useState(false)
  const [holdingModal, setHoldingModal] = useState<
    | { kind: 'closed' }
    | { kind: 'add' }
    | { kind: 'edit'; row: HoldingRow }
    | { kind: 'addToPosition'; row: HoldingRow }
  >({ kind: 'closed' })
  /** Compra adicional sobre posição existente (recalcula preço médio). */
  const [addToPos, setAddToPos] = useState({
    additionalQty: '',
    unitPrice: 0,
    lastOpDate: '',
  })
  const [addToPosError, setAddToPosError] = useState<string | null>(null)
  const [addUnitFocused, setAddUnitFocused] = useState(false)
  const [addUnitDraft, setAddUnitDraft] = useState('')
  /** Evita que o primeiro mouseup após o foco desfaça a seleção de todo o valor (só se o foco veio de clique). */
  const addUnitSuppressNextMouseUpRef = useRef(false)
  const addUnitPointerDownBeforeFocusRef = useRef(false)
  const [invOptions, setInvOptions] = useState<
    Array<{ id: string; name: string; fixedIncome: boolean; typeName: string }> | null
  >(null)
  const [form, setForm] = useState({
    investmentId: '',
    ticker: '',
    quantity: 0,
    avgCost: 0,
    broker: '',
    currency: 'BRL',
    lastOpDate: '',
  })
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'valor' | 'nome'>('valor')
  const [page, setPage] = useState(1)
  const [quantityError, setQuantityError] = useState(false)
  /** Se true, não sobrescreve o select "Investimento" ao mudar o ticker. */
  const [investmentPickManual, setInvestmentPickManual] = useState(false)
  const [deletingInvestmentId, setDeletingInvestmentId] = useState<string | null>(null)
  const [holdingPendingDelete, setHoldingPendingDelete] = useState<HoldingRow | null>(null)
  const loadingInvs = useRef(false)
  const handledAddSearchRef = useRef(false)
  const addModalTickerInputRef = useRef<HTMLInputElement>(null)
  const addToPositionQtyInputRef = useRef<HTMLInputElement>(null)
  const [avgCostFocused, setAvgCostFocused] = useState(false)
  const [avgCostDraft, setAvgCostDraft] = useState('')
  const avgCostSuppressNextMouseUpRef = useRef(false)
  const avgCostPointerDownBeforeFocusRef = useRef(false)
  async function ensureInvOptions() {
    if (loadingInvs.current) return
    loadingInvs.current = true
    try {
      const list = await listInvestmentsOverviewFn()
      setInvOptions(
        list.map((x) => ({
          id: x.id,
          name: x.name,
          fixedIncome: Boolean(x.fixedIncome),
          typeName: x.typeName,
        })),
      )
    } finally {
      loadingInvs.current = false
    }
  }

  useEffect(() => {
    if (search.add !== '1') {
      handledAddSearchRef.current = false
      return
    }
    if (handledAddSearchRef.current) return
    handledAddSearchRef.current = true

    setInvestmentPickManual(false)
    setForm((f) => ({ ...f, currency: currency ?? f.currency }))
    setHoldingModal({ kind: 'add' })
    void ensureInvOptions()

    // Clear the search flag so refresh/back doesn't keep reopening the modal.
    window.setTimeout(() => {
      void navigate({ to: '/portfolio/holdings', search: {}, replace: true })
    }, 0)
  }, [search.add, navigate])

  useEffect(() => {
    if (holdingModal.kind === 'closed') return
    setForm((f) => ({ ...f, currency: currency ?? f.currency }))
  }, [currency, holdingModal.kind])

  useEffect(() => {
    if (holdingModal.kind !== 'closed') return
    setAvgCostFocused(false)
    setAvgCostDraft('')
    setQuantityError(false)
    setInvestmentPickManual(false)
    setAddToPosError(null)
    setAddToPos({ additionalQty: '', unitPrice: 0, lastOpDate: '' })
    setAddUnitFocused(false)
    setAddUnitDraft('')
  }, [holdingModal.kind])

  useEffect(() => {
    if (holdingModal.kind !== 'add') return
    if (invOptions === null) return
    const id = window.setTimeout(() => {
      addModalTickerInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [holdingModal.kind, invOptions])

  useEffect(() => {
    if (holdingModal.kind !== 'addToPosition') return
    const id = window.setTimeout(() => {
      addToPositionQtyInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [holdingModal.kind])

  useEffect(() => {
    if (!session?.user) return
    listPortfolioCurrenciesFn()
      .then((cs) => {
        setCurrencies(cs)
        setCurrency(cs[0] ?? null)
      })
      .catch(() => {
        setCurrencies([])
        setCurrency(null)
      })
  }, [session?.user])

  async function refreshCurrenciesAndHoldings(preferredCurrency?: string | null) {
    let cs: string[] = []
    try {
      cs = await listPortfolioCurrenciesFn()
    } catch {
      cs = []
    }

    setCurrencies(cs)

    const nextCurrency =
      preferredCurrency && cs.includes(preferredCurrency)
        ? preferredCurrency
        : currency && cs.includes(currency)
          ? currency
          : cs[0] ?? null

    setCurrency(nextCurrency)

    if (!nextCurrency) {
      setData({ rows: [], quotesStale: false })
      return
    }

    const refreshed = await listPortfolioHoldingsFn({ data: { currency: nextCurrency } })
    setData(refreshed)
  }

  useEffect(() => {
    if (!session?.user) return
    if (!currencies) return
    let cancelled = false
    setCurrencySwitchLoading(false)
    const t = window.setTimeout(() => {
      if (!cancelled) setCurrencySwitchLoading(true)
    }, 500)

    void listPortfolioHoldingsFn({ data: { currency } })
      .then((r) => {
        if (cancelled) return
        setData(r)
      })
      .finally(() => {
        window.clearTimeout(t)
        if (!cancelled) setCurrencySwitchLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [session?.user, currencies, currency])

  useEffect(() => {
    setForm((f) => {
      if ((HOLDING_CURRENCY_OPTIONS as readonly string[]).includes(f.currency)) return f
      return { ...f, currency: currency ?? 'BRL' }
    })
  }, [currencies, currency])

  useEffect(() => {
    if (holdingModal.kind !== 'add' || investmentPickManual) return
    const id = findInvestmentIdForTicker(form.ticker, invOptions ?? [])
    setForm((f) => {
      const next = id ?? ''
      if (f.investmentId === next) return f
      return { ...f, investmentId: next }
    })
  }, [holdingModal.kind, investmentPickManual, invOptions, form.ticker])

  const tickerInvestHint = useMemo(() => {
    if (holdingModal.kind !== 'add' || !form.ticker.trim()) return null
    if (invOptions === null) return { type: 'loading' as const }
    const suggested = findInvestmentIdForTicker(form.ticker, invOptions)
    if (suggested && form.investmentId === suggested) {
      const name = invOptions.find((o) => o.id === suggested)?.name ?? ''
      return { type: 'matched' as const, name }
    }
    if (!form.investmentId) return { type: 'no-match' as const }
    return null
  }, [holdingModal.kind, form.ticker, form.investmentId, invOptions])

  const pageSize = 12

  function openAddHoldingModal() {
    setAvgCostFocused(false)
    setAvgCostDraft('')
    setQuantityError(false)
    setInvestmentPickManual(false)
    setForm({
      investmentId: '',
      ticker: '',
      quantity: 0,
      avgCost: 0,
      broker: '',
      currency: currency ?? 'BRL',
      lastOpDate: '',
    })
    setHoldingModal({ kind: 'add' })
    void ensureInvOptions()
  }

  function openAddToPositionFromRow(r: HoldingRow) {
    setAddToPosError(null)
    setAddToPos({
      additionalQty: '',
      unitPrice: 0,
      lastOpDate: toDateInputValue(r.lastOperationAt),
    })
    setAddUnitFocused(false)
    setAddUnitDraft('')
    setHoldingModal({ kind: 'addToPosition', row: r })
  }

  function openEditHoldingFromRow(r: HoldingRow) {
    setAvgCostFocused(false)
    setAvgCostDraft('')
    setQuantityError(false)
    setInvestmentPickManual(true)
    setForm({
      investmentId: r.investmentId,
      ticker: r.ticker?.trim() ?? '',
      quantity: r.quantity,
      avgCost: round2(r.avgCost),
      broker: r.broker?.trim() ?? '',
      currency: r.currency,
      lastOpDate: toDateInputValue(r.lastOperationAt),
    })
    setHoldingModal({ kind: 'edit', row: r })
    void ensureInvOptions()
  }

  const totals = useMemo(() => {
    const rows = data?.rows ?? []
    const mv = rows.reduce((acc, r) => acc + (r.marketValue ?? 0), 0)
    const fetched = rows
      .map((r) => (r.quoteFetchedAt ? new Date(r.quoteFetchedAt).getTime() : 0))
      .filter((t) => t > 0)
    const lastUpdatedAt = fetched.length === 0 ? null : new Date(Math.max(...fetched))
    return { marketValue: mv, lastUpdatedAt }
  }, [data?.rows])

  const typeBreakdown = useMemo(() => {
    const rows = data?.rows ?? []
    const map = new Map<string, { name: string; mv: number; pl: number }>()
    for (const r of rows) {
      const key = r.investmentTypeName
      const mv = r.marketValue ?? 0
      const pl = r.unrealizedPl ?? 0
      const prev = map.get(key) ?? { name: key, mv: 0, pl: 0 }
      prev.mv += mv
      prev.pl += pl
      map.set(key, prev)
    }
    return [...map.values()].sort((a, b) => b.mv - a.mv)
  }, [data?.rows])

  const donutSegments = useMemo(() => {
    const rows = data?.rows ?? []
    const total = rows.reduce((a, r) => a + (r.marketValue ?? 0), 0)
    if (total <= 0) return [] as { label: string; pct: number; color: string }[]
    const by = new Map<string, number>()
    for (const r of rows) {
      const k = r.investmentTypeName
      by.set(k, (by.get(k) ?? 0) + (r.marketValue ?? 0))
    }
    const arr = [...by.entries()].sort((a, b) => b[1] - a[1])
    return arr.map(([label, mv], i) => ({
      label,
      pct: (mv / total) * 100,
      color: DONUT_COLORS[i % DONUT_COLORS.length] ?? 'var(--color-outline-variant)',
    }))
  }, [data?.rows])

  const typeFilterOptions = useMemo(() => {
    const names = [...new Set((data?.rows ?? []).map((r) => r.investmentTypeName))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [data?.rows])

  const processedRows = useMemo(() => {
    let rows = [...(data?.rows ?? [])]
    if (filterType !== 'all') rows = rows.filter((r) => r.investmentTypeName === filterType)
    rows.sort((a, b) =>
      sortBy === 'valor'
        ? (b.marketValue ?? 0) - (a.marketValue ?? 0)
        : (a.ticker ?? a.investmentName).localeCompare(b.ticker ?? b.investmentName, 'pt-BR'),
    )
    return rows
  }, [data?.rows, filterType, sortBy])

  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize))
  const pageRows = processedRows.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(processedRows.length / pageSize))
    setPage((p) => Math.min(p, maxPage))
  }, [processedRows.length, pageSize])

  useEffect(() => {
    setPage(1)
  }, [filterType, sortBy, currency, data?.rows])

  async function saveHolding() {
    if (form.quantity <= 0) {
      setQuantityError(true)
      return
    }
    setQuantityError(false)
    const lastOpIso =
      form.lastOpDate.trim() === ''
        ? null
        : new Date(`${form.lastOpDate}T12:00:00`).toISOString()
    await upsertPortfolioHoldingFn({
      data: {
        investmentId: form.investmentId,
        ticker: form.ticker.trim() ? form.ticker.trim() : null,
        quantity: Number(form.quantity),
        avgCost: round2(form.avgCost),
        broker: form.broker.trim() ? form.broker.trim() : null,
        currency: form.currency,
        lastOperationAt: lastOpIso,
      },
    })
    setHoldingModal({ kind: 'closed' })
    setForm({
      investmentId: '',
      ticker: '',
      quantity: 0,
      avgCost: 0,
      broker: '',
      currency: currency ?? 'BRL',
      lastOpDate: '',
    })
    // If user added a position in a different currency, switch and refresh immediately.
    await refreshCurrenciesAndHoldings(form.currency)
  }

  async function saveAddToPosition() {
    if (holdingModal.kind !== 'addToPosition') return
    const r = holdingModal.row
    const addQ = parseAdditionalQty(addToPos.additionalQty)
    if (!(addQ > 0)) {
      setAddToPosError('A quantidade deve ser maior que zero.')
      return
    }
    const meta = moneyMeta(r.currency)
    const unitRaw = addUnitFocused
      ? sanitizeAvgCostTyping(addUnitDraft, meta)
      : sanitizeAvgCostTyping(formatCurrencyFixed2(addToPos.unitPrice, r.currency), meta)
    const unit = round2(parseAvgCostDraft(unitRaw, meta))
    if (!(unit > 0)) {
      setAddToPosError('Informe o preço unitário desta compra.')
      return
    }
    setAddToPosError(null)
    const oldQ = r.quantity
    const oldAvg = r.avgCost
    const newQ = oldQ + addQ
    const newAvg = (oldQ * oldAvg + addQ * unit) / newQ
    const lastOpIso =
      addToPos.lastOpDate.trim() === ''
        ? null
        : new Date(`${addToPos.lastOpDate}T12:00:00`).toISOString()
    await upsertPortfolioHoldingFn({
      data: {
        investmentId: r.investmentId,
        ticker: r.ticker?.trim() ? r.ticker.trim() : null,
        quantity: newQ,
        avgCost: round2(newAvg),
        broker: r.broker?.trim() ? r.broker.trim() : null,
        currency: r.currency,
        lastOperationAt: lastOpIso,
      },
    })
    setHoldingModal({ kind: 'closed' })
    setAddToPos({ additionalQty: '', unitPrice: 0, lastOpDate: '' })
    setAddUnitFocused(false)
    setAddUnitDraft('')
    await refreshCurrenciesAndHoldings(r.currency)
  }

  async function executeDeleteHolding(r: HoldingRow) {
    setDeletingInvestmentId(r.investmentId)
    try {
      await deletePortfolioHoldingFn({ data: { id: r.investmentId } })
      await refreshCurrenciesAndHoldings(currency)
      setHoldingPendingDelete(null)
      if (
        (holdingModal.kind === 'addToPosition' || holdingModal.kind === 'edit') &&
        holdingModal.row.investmentId === r.investmentId
      ) {
        setHoldingModal({ kind: 'closed' })
      }
    } finally {
      setDeletingInvestmentId(null)
    }
  }

  useEffect(() => {
    if (!holdingPendingDelete) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoldingPendingDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [holdingPendingDelete])

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

  if (!session?.user) return <Navigate to="/login" />

  /** Moedas ou holdings ainda não chegaram — não confundir com carteira vazia. */
  const holdingsInitialLoading = currencies === null || data === null

  return (
    <main className="w-full max-w-7xl px-4 py-8 sm:p-8 lg:p-12">
      {data?.quotesStale && (
        <section className="mb-8 rounded-2xl border border-error/20 border-l-4 border-l-error bg-error-container/35 p-5 pl-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined mt-0.5 text-2xl text-error">warning</span>
              <div>
                <p className="font-headline text-sm font-bold text-error">
                  Cotações desatualizadas
                </p>
                <p className="mt-1 text-sm text-on-surface-variant">
                  Detectamos instabilidade na conexão com os provedores de mercado.
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex shrink-0 items-center justify-center rounded-full bg-error-container px-5 py-2.5 text-xs font-bold text-on-error-container shadow-sm hover:opacity-95"
              onClick={async () => {
                const refreshed = await listPortfolioHoldingsFn({ data: { currency } })
                setData(refreshed)
              }}
            >
              TENTAR RECONECTAR
            </button>
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
              Posições
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              Gestão detalhada de ativos e participações.
            </p>
            {currencies && currencies.length > 0 && (
              <div className="mt-4 inline-flex items-center gap-2">
                <div className="inline-flex rounded-full bg-surface-container-low p-1 shadow-inner">
                {currencies.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`rounded-full px-5 py-2 text-xs font-bold transition-all ${
                      c === currency
                        ? 'bg-primary-container text-on-primary shadow-md'
                        : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    {c}
                  </button>
                ))}
                </div>
                {currencySwitchLoading && !holdingsInitialLoading && (
                  <span
                    className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
                    aria-label="Carregando moeda"
                  />
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-primary-container px-6 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
            onClick={() => openAddHoldingModal()}
          >
            <span className="material-symbols-outlined text-[20px] leading-none">add</span>
            Adicionar posição
          </button>
        </div>
      </section>

      {holdingsInitialLoading ? (
        <section
          role="status"
          aria-live="polite"
          className="flex min-h-[42vh] flex-col items-center justify-center gap-4 rounded-3xl bg-surface-container-low/40 px-6 py-16 ring-1 ring-outline-variant/10"
        >
          <span className="sr-only">{m.common.loading}</span>
          <div
            className="h-10 w-10 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
            aria-hidden
          />
          <p className="text-sm font-medium text-on-surface-variant">Carregando sua carteira…</p>
        </section>
      ) : data.rows.length === 0 ? (
        <>
          <section className="mx-auto max-w-3xl rounded-3xl bg-surface p-10 text-center shadow-lg ring-1 ring-outline-variant/10 md:p-14">
            <div className="relative mx-auto mb-8 flex max-w-sm justify-center">
              <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-secondary-fixed/25 to-transparent blur-2xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-surface shadow-md ring-1 ring-outline-variant/15">
                <span className="material-symbols-outlined text-5xl text-secondary-container">account_balance_wallet</span>
              </div>
            </div>
            <h2 className="font-headline mb-3 text-2xl font-extrabold text-on-surface md:text-3xl">
              Sua lista de posições está vazia.
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-on-surface-variant">
              Comece a monitorar seu patrimônio adicionando seus primeiros ativos de renda fixa, variável ou
              investimentos alternativos.
            </p>
            <button
              type="button"
              className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary-container px-8 py-3.5 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95 md:w-auto"
              onClick={() => openAddHoldingModal()}
            >
              <span className="material-symbols-outlined text-[20px] leading-none">add</span>
              Adicionar primeira posição
            </button>
          </section>
          <section className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                icon: 'candlestick_chart',
                bg: 'bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim',
                title: 'Importação automática',
                body: 'Conecte suas contas de corretoras para sincronizar posições em tempo real.',
              },
              {
                icon: 'shield',
                bg: 'bg-secondary-fixed/30 text-on-secondary-fixed',
                title: 'Segurança de dados',
                body: 'Seus ativos são criptografados com padrões bancários de alta segurança.',
              },
              {
                icon: 'pie_chart',
                bg: 'bg-secondary-fixed/20 text-primary-container',
                title: 'Visão por tipos',
                body: 'Visualize sua alocação por classes de ativos assim que adicionar posições.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-outline-variant/10"
              >
                <div
                  className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}
                >
                  <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
                </div>
                <p className="font-headline text-sm font-extrabold text-on-surface">{card.title}</p>
                <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{card.body}</p>
              </div>
            ))}
          </section>
        </>
      ) : (
        <div
          className={
            donutSegments.length > 0
              ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,360px)] lg:items-start lg:gap-10'
              : 'w-full'
          }
        >
          <div className="min-w-0 w-full">
            <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-label text-[10px] font-bold uppercase tracking-widest text-outline">
                    Patrimônio total
                  </p>
                  {data?.quotesStale && (
                    <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-outline">
                      Defasado
                    </span>
                  )}
                </div>
                <p className="mt-2 font-headline text-4xl font-extrabold text-on-surface sm:text-5xl">
                  {fmtMoney(totals.marketValue, currency ?? 'BRL')}
                </p>
                {totals.lastUpdatedAt && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-outline">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    Última atualização: {totals.lastUpdatedAt.toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </section>

          {typeBreakdown.length > 0 && (
            <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {typeBreakdown.slice(0, 3).map((t) => {
                const pctType = t.mv > 0 ? (t.pl / t.mv) * 100 : 0
                const up = t.pl >= 0
                return (
                  <div
                    key={t.name}
                    className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-outline-variant/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="material-symbols-outlined text-outline">show_chart</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                          data?.quotesStale
                            ? 'bg-error-container/55 text-error'
                            : 'bg-tertiary-fixed-dim/25 text-on-tertiary-container'
                        }`}
                      >
                        {data?.quotesStale ? 'Atrasado' : 'OK'}
                      </span>
                    </div>
                    <p className="mt-3 text-xs font-bold uppercase tracking-wide text-outline">{t.name}</p>
                    <p className="mt-1 font-headline text-xl font-extrabold text-on-surface">
                      {new Intl.NumberFormat('pt-BR', {
                        style: 'currency',
                        currency: currency ?? 'BRL',
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(t.mv)}
                    </p>
                    <p className={`mt-2 text-sm font-bold ${up ? 'text-tertiary-fixed-dim' : 'text-error'}`}>
                      {up ? '+' : ''}
                      {pctType.toFixed(1)}%
                    </p>
                  </div>
                )
              })}
            </section>
          )}
          </div>

          {donutSegments.length > 0 && (
            <aside className="mt-10 lg:mt-0">
              <DonutAllocation
                segments={donutSegments}
                centerPct={`${(donutSegments[0]?.pct ?? 0).toFixed(0)}%`}
                centerLabel={donutSegments[0]?.label ?? ''}
              />
            </aside>
          )}

          <section className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10 md:p-8 lg:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-headline text-base font-extrabold text-on-surface">Principais Ativos</h2>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
                  <span className="text-outline">Classe</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="max-w-[10rem] border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="all">Todas</option>
                    {typeFilterOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-2 text-xs font-semibold text-on-surface">
                  <span className="text-outline">Ordenar</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'valor' | 'nome')}
                    className="border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="valor">Valor</option>
                    <option value="nome">Nome</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 space-y-3 md:hidden">
              {pageRows.map((r) => {
                const statusLabel =
                  r.quoteStatus === 'BOOK_VALUE'
                    ? 'Fixa'
                    : r.quoteStatus === 'OK'
                      ? data?.quotesStale
                        ? 'ATRASADO'
                        : 'OK'
                      : r.quoteStatus === 'MISSING_QUOTE'
                        ? 'AUSENTE'
                        : 'INCOMPLETO'
                const statusClass =
                  r.quoteStatus === 'BOOK_VALUE'
                    ? 'text-tertiary-fixed-dim'
                    : statusLabel === 'OK'
                      ? 'text-tertiary-fixed-dim'
                      : statusLabel === 'AUSENTE'
                        ? 'text-outline'
                        : 'text-error'
                const varPct =
                  r.lastPrice != null && r.avgCost > 0
                    ? `${(((r.lastPrice - r.avgCost) / r.avgCost) * 100).toFixed(1)}%`
                    : '—'
                const varDir =
                  r.lastPrice != null && r.avgCost > 0
                    ? (r.lastPrice - r.avgCost) / r.avgCost >= 0
                      ? ('up' as const)
                      : ('down' as const)
                    : null
                return (
                  <div
                    key={r.investmentId}
                    className="flex overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low/80 shadow-sm"
                  >
                    <div
                      className="min-w-0 flex-1 cursor-pointer p-4 text-left outline-none transition-colors hover:bg-surface-container-high/30 focus-visible:ring-2 focus-visible:ring-primary"
                      role="button"
                      tabIndex={0}
                      onClick={() => openEditHoldingFromRow(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openEditHoldingFromRow(r)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-headline text-base font-extrabold text-on-surface">
                            {r.ticker ?? r.investmentName}
                          </p>
                          <p className="text-xs text-outline">{r.investmentTypeName}</p>
                        </div>
                        <span className={`text-xs font-bold uppercase ${statusClass}`}>{statusLabel}</span>
                      </div>
                      <div className="mt-3 flex justify-between text-sm">
                        <span className="text-outline">Quantidade</span>
                        <span className="font-semibold tabular-nums text-on-surface">{fmtQuantity(r.quantity)}</span>
                      </div>
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-outline">Variação</span>
                        <span
                          className={`font-semibold ${
                            r.lastPrice != null && r.avgCost > 0 && (r.lastPrice - r.avgCost) / r.avgCost >= 0
                              ? 'text-tertiary-fixed-dim'
                              : r.lastPrice != null && r.avgCost > 0
                                ? 'text-error'
                                : 'text-on-surface'
                          }`}
                        >
                          <span className="inline-flex items-center gap-0.5">
                            {varDir ? (
                              <span className="material-symbols-outlined text-[10px] leading-none">
                                {varDir === 'up' ? 'north_east' : 'south_east'}
                              </span>
                            ) : null}
                            <span>{varPct}</span>
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-outline">Posição</span>
                        <span className="font-bold text-on-surface">
                          {r.marketValue == null ? '—' : fmtMoney(r.marketValue, currency ?? 'BRL')}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col justify-center gap-1 border-l border-outline-variant/15 py-2 pr-2 pl-1">
                      <button
                        type="button"
                        className="px-2 py-2 text-center text-xs font-bold text-primary hover:bg-primary/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          openAddToPositionFromRow(r)
                        }}
                      >
                        Adicionar cotas
                      </button>
                      <button
                        type="button"
                        disabled={deletingInvestmentId === r.investmentId}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-error hover:bg-error-container/45 disabled:opacity-45"
                        aria-label={`Excluir posição ${r.ticker ?? r.investmentName}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setHoldingPendingDelete(r)
                        }}
                      >
                        <span className="material-symbols-outlined text-[22px]">delete</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-5 hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="text-[10px] font-bold uppercase tracking-widest text-outline">
                  <tr>
                    <th className="py-2 text-left">Ativo</th>
                    <th className="py-2 text-right">Quantidade</th>
                    <th className="py-2 text-right">Posição</th>
                    <th className="py-2 text-right">Variação</th>
                    <th className="py-2 text-right">Preço atual</th>
                    <th className="py-2 text-right">Status</th>
                    <th className="min-w-[7rem] py-2 text-right">
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pageRows.map((r) => {
                      const statusLabel =
                        r.quoteStatus === 'BOOK_VALUE'
                          ? 'Fixa'
                          : r.quoteStatus === 'OK'
                            ? data?.quotesStale
                              ? 'ATRASADO'
                              : 'OK'
                            : r.quoteStatus === 'MISSING_QUOTE'
                              ? 'AUSENTE'
                              : 'INCOMPLETO'
                      const statusPillClass =
                        r.quoteStatus === 'BOOK_VALUE'
                          ? 'bg-tertiary-fixed-dim/25 text-on-tertiary-container'
                          : statusLabel === 'OK'
                            ? 'bg-tertiary-fixed-dim/25 text-on-tertiary-container'
                            : 'bg-error-container/55 text-error'
                      return (
                      <tr
                        key={r.investmentId}
                        className="cursor-pointer transition-colors hover:bg-surface-container-high/25"
                        tabIndex={0}
                        onClick={() => openEditHoldingFromRow(r)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            openEditHoldingFromRow(r)
                          }
                        }}
                      >
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {r.quoteLogoUrl ? (
                              <img
                                src={r.quoteLogoUrl}
                                alt=""
                                className="h-5 w-5 shrink-0 rounded-full border border-outline-variant/20 bg-surface object-contain"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  // Hide broken logos silently.
                                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <span
                                className="h-5 w-5 shrink-0 rounded-full border border-outline-variant/20 bg-surface-container-low"
                                aria-hidden
                              />
                            )}
                            <div className="min-w-0">
                              <div className="truncate font-medium text-on-surface">
                                {r.ticker ?? r.investmentName}
                              </div>
                              <div className="text-xs text-outline">{r.investmentTypeName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 text-right tabular-nums text-on-surface">{fmtQuantity(r.quantity)}</td>
                        <td className="py-3 text-right font-semibold text-on-surface">
                          {r.marketValue == null ? '—' : fmtMoney(r.marketValue, currency ?? 'BRL')}
                        </td>
                        <td
                          className={`py-3 text-right font-semibold ${
                            r.lastPrice != null && r.avgCost > 0 && (r.lastPrice - r.avgCost) / r.avgCost >= 0
                              ? 'text-tertiary-fixed-dim'
                              : r.lastPrice != null && r.avgCost > 0
                                ? 'text-error'
                                : 'text-on-surface'
                          }`}
                        >
                          <span className="inline-flex items-center justify-end gap-1">
                            {r.lastPrice != null && r.avgCost > 0 ? (
                              <span className="material-symbols-outlined text-[13px] leading-none">
                                {(r.lastPrice - r.avgCost) / r.avgCost >= 0 ? 'north_east' : 'south_east'}
                              </span>
                            ) : null}
                            <span>
                              {r.lastPrice != null && r.avgCost > 0
                                ? `${(((r.lastPrice - r.avgCost) / r.avgCost) * 100).toFixed(1)}%`
                                : '—'}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 text-right text-on-surface">
                          {r.lastPrice == null ? '—' : fmtMoney(r.lastPrice, currency ?? 'BRL')}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${statusPillClass}`}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="rounded-full px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                              onClick={() => openAddToPositionFromRow(r)}
                            >
                              Adicionar cotas
                            </button>
                            <button
                              type="button"
                              disabled={deletingInvestmentId === r.investmentId}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-error hover:bg-error-container/50 disabled:opacity-45"
                              aria-label={`Excluir posição ${r.ticker ?? r.investmentName}`}
                              onClick={() => setHoldingPendingDelete(r)}
                            >
                              <span className="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex flex-col gap-3 border-t border-outline-variant/10 pt-4 text-xs text-outline sm:flex-row sm:items-center sm:justify-between">
              <p>
                Mostrando {pageRows.length} de {processedRows.length}{' '}
                {processedRows.length === 1 ? 'ativo' : 'ativos'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface disabled:opacity-40"
                  aria-label="Página anterior"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <span className="min-w-[2rem] text-center font-bold text-on-surface">{page}</span>
                <span className="text-outline">/</span>
                <span className="min-w-[2rem] text-center font-bold text-on-surface">{pageCount}</span>
                <button
                  type="button"
                  disabled={page >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/30 text-on-surface disabled:opacity-40"
                  aria-label="Próxima página"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          </section>

          <section className="mt-10 rounded-2xl border border-outline-variant/15 bg-surface-container-high px-6 py-6 shadow-md ring-1 ring-outline-variant/10 lg:col-span-2">
            <p className="font-headline text-lg font-extrabold text-on-surface">Desvio de estratégia detectado</p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
              Sua carteira divergiu do plano de alocação. Revise os alvos por tipo na Carteira para realinhar
              risco e retorno.
            </p>
            <Link
              to="/portfolio"
              className="mt-5 inline-flex items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low px-5 py-2 text-xs font-bold text-on-surface no-underline transition-colors hover:border-outline-variant/50 hover:bg-surface-container-highest"
            >
              Ver detalhes
            </Link>
          </section>
        </div>
      )}

      {(holdingModal.kind === 'add' || holdingModal.kind === 'edit') &&
        (() => {
          const isEdit = holdingModal.kind === 'edit'
          const selectedOpt = invOptions?.find((o) => o.id === form.investmentId)
          const holdingSameInv = data?.rows?.find((r) => r.investmentId === form.investmentId)
          const holdingIsFixedIncome = isEdit
            ? Boolean(
                holdingModal.row.fixedIncome ||
                  isRendaFixaTipo(holdingModal.row.investmentTypeName),
              )
            : Boolean(
                selectedOpt?.fixedIncome ||
                  isRendaFixaTipo(selectedOpt?.typeName) ||
                  holdingSameInv?.fixedIncome ||
                  isRendaFixaTipo(holdingSameInv?.investmentTypeName),
              )
          const avgCostFieldLabel = holdingIsFixedIncome ? 'Valor atual' : 'Preço médio'
          return (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
          data-holding-modal={isEdit ? 'edit' : 'add'}
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
                  {isEdit ? 'Editar posição' : 'Adicionar posição'}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-outline">
                  Sem conversão cambial automática; preço médio e posição ficam na moeda do ativo.
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
                onClick={() => setHoldingModal({ kind: 'closed' })}
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-2xl leading-none">close</span>
              </button>
            </div>

            {!isEdit && (
            <div className="mb-6 flex gap-3 rounded-2xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/12 px-4 py-3 text-xs leading-relaxed text-on-surface">
              <span className="material-symbols-outlined shrink-0 text-lg text-tertiary-fixed-dim">info</span>
              <p>
                Escolha o investimento na lista e confira o ticker. A quantidade deve refletir cotas ou ações
                em carteira — você pode ajustar depois.
              </p>
            </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                Ticker
                <input
                  ref={addModalTickerInputRef}
                  value={form.ticker}
                  onChange={(e) => {
                    if (!isEdit) setInvestmentPickManual(false)
                    setForm({ ...form, ticker: e.target.value.toUpperCase() })
                  }}
                  disabled={invOptions === null}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
                />
              </label>

              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                Investimento
                <select
                  value={form.investmentId}
                  onChange={(e) => {
                    setInvestmentPickManual(true)
                    setForm({ ...form, investmentId: e.target.value })
                  }}
                  disabled={invOptions === null || isEdit}
                  className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
                >
                  <option value="">{invOptions === null ? 'Carregando…' : 'Selecione…'}</option>
                  {(invOptions ?? []).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>

              {tickerInvestHint?.type === 'loading' && (
                <p className="text-xs text-outline sm:col-span-2">Carregando investimentos…</p>
              )}
              {tickerInvestHint?.type === 'matched' && (
                <div className="flex gap-2 rounded-xl border border-tertiary-fixed-dim/35 bg-tertiary-fixed-dim/10 px-3 py-2 text-xs text-on-surface sm:col-span-2">
                  <span className="material-symbols-outlined shrink-0 text-base text-tertiary-fixed-dim">
                    link
                  </span>
                  <p>
                    Investimento vinculado:{' '}
                    <span className="font-bold text-on-surface">{tickerInvestHint.name}</span>
                  </p>
                </div>
              )}
              {tickerInvestHint?.type === 'no-match' && (
                <div className="flex gap-2 rounded-xl border border-secondary-fixed/35 bg-secondary-fixed/12 px-3 py-2 text-xs leading-relaxed text-on-surface sm:col-span-2">
                  <span className="material-symbols-outlined shrink-0 text-base text-secondary-fixed">
                    add_circle
                  </span>
                  <p>
                    Não há investimento cadastrado com nome parecido a «{form.ticker.trim()}». A posição só
                    pode ser salva após você{' '}
                    <Link to="/investimentos" className="font-bold text-primary underline underline-offset-2">
                      criar o investimento
                    </Link>{' '}
                    (use o mesmo nome ou inclua o ticker no nome). Nada será criado automaticamente ao salvar
                    esta tela.
                  </p>
                </div>
              )}

              <SharedHoldingFormFields
                form={form}
                setForm={setForm}
                invOptions={invOptions}
                quantityError={quantityError}
                setQuantityError={setQuantityError}
                avgCostFocused={avgCostFocused}
                setAvgCostFocused={setAvgCostFocused}
                avgCostDraft={avgCostDraft}
                setAvgCostDraft={setAvgCostDraft}
                avgCostPointerDownBeforeFocusRef={avgCostPointerDownBeforeFocusRef}
                avgCostSuppressNextMouseUpRef={avgCostSuppressNextMouseUpRef}
                avgCostLabel={avgCostFieldLabel}
              />
            </div>

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-8 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={() => setHoldingModal({ kind: 'closed' })}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={invOptions === null || !form.investmentId}
                className="inline-flex items-center justify-center rounded-full bg-primary-container px-8 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95 disabled:opacity-45"
                onClick={() => void saveHolding()}
              >
                {isEdit ? 'Salvar alterações' : 'Adicionar posição'}
              </button>
            </div>
          </div>
        </div>
          )
        })()}

      {holdingModal.kind === 'addToPosition' && (() => {
        const r = holdingModal.row
        const meta = moneyMeta(r.currency)
        const tickerLabel = r.ticker?.trim() || r.investmentName || '—'
        const initials = (r.ticker ?? r.investmentName ?? '?')
          .replace(/\s/g, '')
          .slice(0, 2)
          .toUpperCase()
        const unitLabelUpper =
          r.currency === 'BRL'
            ? 'PREÇO UNITÁRIO (R$)'
            : r.currency === 'USD'
              ? 'PREÇO UNITÁRIO (US$)'
              : r.currency === 'EUR'
                ? 'PREÇO UNITÁRIO (€)'
                : `PREÇO UNITÁRIO (${r.currency})`
        return (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-10"
            data-holding-modal="add-to-position"
          >
            <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="min-w-0 pr-2">
                  <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
                    Adicionar cotas
                  </h3>
                  <p className="mt-2 text-sm leading-snug text-on-surface-variant">
                    Registre a compra adicional do ativo{' '}
                    <span className="font-bold text-on-surface">{tickerLabel}</span> na sua carteira. O preço
                    médio será recalculado.
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
                  onClick={() => setHoldingModal({ kind: 'closed' })}
                  aria-label="Fechar"
                >
                  <span className="material-symbols-outlined text-2xl leading-none">close</span>
                </button>
              </div>

              <div className="mb-7 rounded-2xl bg-surface-container-low px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest/80 font-headline text-sm font-extrabold tracking-tight text-on-surface shadow-inner ring-1 ring-outline-variant/20">
                    {initials}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-headline text-lg font-extrabold leading-tight text-on-surface">
                      {tickerLabel}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-on-surface-variant">{r.investmentName}</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-6">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    Quantidade adicional
                  </span>
                  <div className="relative mt-2">
                    <input
                      ref={addToPositionQtyInputRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={addToPosError?.includes('quantidade') ?? false}
                      value={addToPos.additionalQty}
                      onChange={(e) => {
                        setAddToPosError(null)
                        const t = e.target.value.replace(/-/g, '')
                        setAddToPos((p) => ({ ...p, additionalQty: t }))
                      }}
                      className={`w-full border-0 border-b-2 bg-transparent py-2.5 pr-8 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary ${
                        addToPosError?.includes('quantidade')
                          ? 'border-error focus:border-error'
                          : 'border-outline-variant/50'
                      }`}
                    />
                    {addToPosError?.includes('quantidade') && (
                      <span
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-error"
                        aria-hidden
                      >
                        <span className="material-symbols-outlined text-xl">error</span>
                      </span>
                    )}
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    {unitLabelUpper}
                  </span>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={addToPosError?.includes('preço') ?? false}
                      value={
                        addUnitFocused
                          ? addUnitDraft
                          : formatCurrencyFixed2(addToPos.unitPrice, r.currency)
                      }
                      onMouseDown={(e) => {
                        if (e.currentTarget !== document.activeElement) {
                          addUnitPointerDownBeforeFocusRef.current = true
                        }
                      }}
                      onFocus={(e) => {
                        const el = e.currentTarget
                        setAddUnitFocused(true)
                        setAddUnitDraft(
                          sanitizeAvgCostTyping(
                            formatCurrencyFixed2(addToPos.unitPrice, r.currency),
                            meta,
                          ),
                        )
                        if (addUnitPointerDownBeforeFocusRef.current) {
                          addUnitSuppressNextMouseUpRef.current = true
                          addUnitPointerDownBeforeFocusRef.current = false
                        }
                        setTimeout(() => {
                          el.select()
                        }, 0)
                      }}
                      onMouseUp={(e) => {
                        if (addUnitSuppressNextMouseUpRef.current) {
                          e.preventDefault()
                          addUnitSuppressNextMouseUpRef.current = false
                        }
                      }}
                      onChange={(e) => {
                        const next = sanitizeAvgCostTyping(e.target.value, meta)
                        setAddUnitDraft(next)
                        setAddToPos((p) => ({ ...p, unitPrice: parseAvgCostDraft(next, meta) }))
                      }}
                      onBlur={() => {
                        const n = round2(parseAvgCostDraft(addUnitDraft, meta))
                        setAddToPos((p) => ({ ...p, unitPrice: n }))
                        setAddUnitFocused(false)
                        setAddUnitDraft('')
                      }}
                      className={`w-full border-0 border-b-2 bg-transparent py-2.5 pr-8 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary ${
                        addToPosError?.includes('preço')
                          ? 'border-error focus:border-error'
                          : 'border-outline-variant/50'
                      }`}
                    />
                    {addToPosError?.includes('preço') && (
                      <span
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-error"
                        aria-hidden
                      >
                        <span className="material-symbols-outlined text-xl">error</span>
                      </span>
                    )}
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    Data da última operação (opcional)
                  </span>
                  <div className="relative mt-2 flex items-center border-b-2 border-outline-variant/50 focus-within:border-primary">
                    <input
                      type="date"
                      value={addToPos.lastOpDate}
                      onChange={(e) => setAddToPos((p) => ({ ...p, lastOpDate: e.target.value }))}
                      className="w-full flex-1 cursor-pointer border-0 bg-transparent py-2.5 pr-10 text-sm font-semibold text-on-surface outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    <span
                      className="pointer-events-none absolute right-0 text-outline"
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                    </span>
                  </div>
                </label>
              </div>

              {addToPosError && (
                <p className="mt-5 text-xs font-semibold text-error" role="alert">
                  {addToPosError}
                </p>
              )}

              <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-container-high px-8 py-2.5 text-sm font-bold text-on-surface shadow-sm ring-1 ring-outline-variant/25 transition-colors hover:bg-surface-container-highest"
                  onClick={() => setHoldingModal({ kind: 'closed' })}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-container px-8 py-2.5 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
                  onClick={() => void saveAddToPosition()}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {holdingPendingDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-4 sm:items-center"
          role="presentation"
          onClick={() => setHoldingPendingDelete(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-holding-title"
            aria-describedby="delete-holding-desc"
            className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-outline-variant/15 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container/55">
              <span className="material-symbols-outlined text-2xl text-error">delete_forever</span>
            </div>
            <h2
              id="delete-holding-title"
              className="font-headline text-lg font-extrabold tracking-tight text-on-surface"
            >
              Excluir posição?
            </h2>
            <p id="delete-holding-desc" className="mt-3 text-sm leading-relaxed text-on-surface-variant">
              A posição em{' '}
              <span className="font-semibold text-on-surface">
                {holdingPendingDelete.ticker?.trim() || holdingPendingDelete.investmentName}
              </span>{' '}
              será removida da carteira nesta moeda. O investimento continua cadastrado em Investimentos.
            </p>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-6 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={() => setHoldingPendingDelete(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingInvestmentId === holdingPendingDelete.investmentId}
                className="inline-flex items-center justify-center rounded-full bg-error-container px-6 py-3 text-sm font-bold text-on-error-container transition-opacity hover:opacity-95 disabled:opacity-45"
                onClick={() => void executeDeleteHolding(holdingPendingDelete)}
              >
                {deletingInvestmentId === holdingPendingDelete.investmentId ? 'Excluindo…' : 'Excluir posição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

