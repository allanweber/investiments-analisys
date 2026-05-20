import { Link, Navigate, createFileRoute, useNavigate } from '@tanstack/react-router'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'

import { DisplayCurrencySelector } from '#/components/portfolio/display-currency-selector'
import { allocColorForType, fmtMoney } from '#/components/portfolio/format'
import { useDisplayCurrency } from '#/hooks/use-display-currency'
import { authClient } from '#/lib/auth-client'
import {
  createInvestmentFn,
  deletePortfolioHoldingFn,
  listInvestmentTypesOptionsFn,
  listInvestmentsOverviewFn,
  listPortfolioHoldingsFn,
  refreshPortfolioQuotesFn,
  upsertPortfolioHoldingFn,
} from '#/lib/investment-server'
import { messages as m } from '#/messages'

export const Route = createFileRoute('/portfolio/holdings')({
  validateSearch: z.object({
    add: z.literal('1').optional(),
  }),
  component: HoldingsPage,
})

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

function isVariableIncomeInv(
  o: { fixedIncome: boolean; typeName: string },
): boolean {
  return !o.fixedIncome && !isRendaFixaTipo(o.typeName)
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

function findExistingHoldingForAdd(
  rows: HoldingRow[],
  investmentId: string,
  ticker: string,
): HoldingRow | undefined {
  if (investmentId) {
    const byInv = rows.find((r) => r.investmentId === investmentId)
    if (byInv) return byInv
  }
  const t = ticker.trim().toUpperCase()
  if (!t) return undefined
  return rows.find((r) => (r.ticker ?? '').trim().toUpperCase() === t)
}

type DonutSegment = {
  investmentTypeId: string
  label: string
  pct: number
  color: string
}

/** Donut slice from outer/inner radii and start/end angles (degrees, clockwise from top). */
function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg
  if (sweep <= 0) return ''
  if (sweep >= 360) endDeg = startDeg + 359.99

  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const pt = (r: number, deg: number) => ({
    x: cx + r * Math.cos(rad(deg)),
    y: cy + r * Math.sin(rad(deg)),
  })

  const o0 = pt(rOuter, startDeg)
  const o1 = pt(rOuter, endDeg)
  const i0 = pt(rInner, endDeg)
  const i1 = pt(rInner, startDeg)
  const large = sweep > 180 ? 1 : 0

  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i0.x} ${i0.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ')
}

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
  investmentTypeId: string
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
  quantityLabel = 'Quantidade',
  currencyDisabled = false,
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
  quantityLabel?: string
  currencyDisabled?: boolean
}) {
  return (
    <>
      <div className="sm:col-span-1">
        <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
          {quantityLabel}
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
          disabled={invOptions === null || currencyDisabled}
          className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
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

function DonutAllocation({ segments }: { segments: DonutSegment[] }) {
  const total = segments.reduce((a, s) => a + s.pct, 0) || 1
  const size = 208
  const cx = size / 2
  const cy = size / 2
  const rOuter = size / 2 - 2
  const rInner = rOuter * 0.58
  let angle = 0

  const slices = segments.map((s) => {
    const sweep = (s.pct / total) * 360
    const start = angle
    const end = angle + sweep
    angle = end
    return {
      ...s,
      d: donutSlicePath(cx, cy, rOuter, rInner, start, end),
    }
  })

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10">
      <h3 className="font-headline text-base font-extrabold text-on-surface">Alocação atual</h3>
      <div className="relative mx-auto mt-6 flex h-52 w-52 max-w-full items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          role="img"
          aria-label={`Alocação por tipo: ${segments.map((s) => `${s.label} ${s.pct.toFixed(0)}%`).join(', ')}`}
        >
          {slices.map((s) =>
            s.d ? (
              <path
                key={s.investmentTypeId}
                d={s.d}
                fill={s.color}
                className="transition-opacity hover:opacity-90"
              />
            ) : null,
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[9rem] text-center">
            <p className="font-headline text-2xl font-extrabold leading-tight text-on-surface">100%</p>
            <p className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-widest text-outline">
              por tipo
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-6 space-y-1">
        {segments.map((s) => (
          <li
            key={s.investmentTypeId}
            className="flex items-center justify-between rounded-xl px-2 py-2 text-sm transition-colors hover:bg-surface-container-low"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-outline-variant/20"
                style={{ background: s.color }}
              />
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
  const { displayCurrency, setDisplayCurrency, displayCurrencyOptions } = useDisplayCurrency()
  const [data, setData] = useState<Awaited<ReturnType<typeof listPortfolioHoldingsFn>> | null>(null)
  const [displaySwitchLoading, setDisplaySwitchLoading] = useState(false)
  const [holdingModal, setHoldingModal] = useState<
    | { kind: 'closed' }
    | { kind: 'chooseAssetClass' }
    | { kind: 'fixedIncomeComingSoon' }
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
  const [typeOptions, setTypeOptions] = useState<
    Array<{ id: string; name: string; fixedIncome: boolean }> | null
  >(null)
  const [saveHoldingError, setSaveHoldingError] = useState<string | null>(null)
  const [form, setForm] = useState({
    investmentId: '',
    investmentTypeId: '',
    ticker: '',
    quantity: 0,
    avgCost: 0,
    broker: '',
    currency: 'BRL',
    lastOpDate: '',
  })
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCurrency, setFilterCurrency] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'valor' | 'nome'>('valor')
  const [page, setPage] = useState(1)
  const [quantityError, setQuantityError] = useState(false)
  /** Se true, não sobrescreve o select "Investimento" ao mudar o ticker. */
  const [investmentPickManual, setInvestmentPickManual] = useState(false)
  const [deletingInvestmentId, setDeletingInvestmentId] = useState<string | null>(null)
  const [holdingPendingDelete, setHoldingPendingDelete] = useState<HoldingRow | null>(null)
  const loadingInvs = useRef(false)
  const loadingTypes = useRef(false)
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

  async function ensureTypeOptions() {
    if (loadingTypes.current) return
    loadingTypes.current = true
    try {
      const list = await listInvestmentTypesOptionsFn()
      setTypeOptions(
        list.map((t) => ({
          id: t.id,
          name: t.name,
          fixedIncome: Boolean(t.fixedIncome),
        })),
      )
    } finally {
      loadingTypes.current = false
    }
  }

  const variableInvOptions = useMemo(
    () => (invOptions ?? []).filter(isVariableIncomeInv),
    [invOptions],
  )

  const variableTypeOptions = useMemo(
    () => (typeOptions ?? []).filter((t) => !t.fixedIncome && !isRendaFixaTipo(t.name)),
    [typeOptions],
  )

  function openVariableAddModal() {
    setAvgCostFocused(false)
    setAvgCostDraft('')
    setQuantityError(false)
    setInvestmentPickManual(false)
    setSaveHoldingError(null)
    setForm({
      investmentId: '',
      investmentTypeId: '',
      ticker: '',
      quantity: 0,
      avgCost: 0,
      broker: '',
      currency: displayCurrency,
      lastOpDate: '',
    })
    setHoldingModal({ kind: 'add' })
    void ensureInvOptions()
    void ensureTypeOptions()
  }

  useEffect(() => {
    if (search.add !== '1') {
      handledAddSearchRef.current = false
      return
    }
    if (handledAddSearchRef.current) return
    handledAddSearchRef.current = true

    setInvestmentPickManual(false)
    setSaveHoldingError(null)
    setForm({
      investmentId: '',
      investmentTypeId: '',
      ticker: '',
      quantity: 0,
      avgCost: 0,
      broker: '',
      currency: displayCurrency,
      lastOpDate: '',
    })
    setHoldingModal({ kind: 'chooseAssetClass' })

    // Clear the search flag so refresh/back doesn't keep reopening the modal.
    window.setTimeout(() => {
      void navigate({ to: '/portfolio/holdings', search: {}, replace: true })
    }, 0)
  }, [search.add, navigate, displayCurrency])

  useEffect(() => {
    if (holdingModal.kind !== 'closed') return
    setAvgCostFocused(false)
    setAvgCostDraft('')
    setQuantityError(false)
    setInvestmentPickManual(false)
    setSaveHoldingError(null)
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

  async function refreshHoldings() {
    const refreshed = await listPortfolioHoldingsFn({ data: { displayCurrency } })
    setData(refreshed)
  }

  useEffect(() => {
    if (!session?.user) return
    let cancelled = false
    setDisplaySwitchLoading(false)
    const t = window.setTimeout(() => {
      if (!cancelled) setDisplaySwitchLoading(true)
    }, 500)

    void listPortfolioHoldingsFn({ data: { displayCurrency } })
      .then((r) => {
        if (cancelled) return
        setData(r)
      })
      .finally(() => {
        window.clearTimeout(t)
        if (!cancelled) setDisplaySwitchLoading(false)
      })

    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [session?.user, displayCurrency])

  useEffect(() => {
    if (holdingModal.kind !== 'add' || investmentPickManual) return
    const id = findInvestmentIdForTicker(form.ticker, variableInvOptions)
    setForm((f) => {
      const next = id ?? ''
      if (f.investmentId === next && (next !== '' || f.investmentTypeId === '')) return f
      return {
        ...f,
        investmentId: next,
        investmentTypeId: next ? '' : f.investmentTypeId,
      }
    })
  }, [holdingModal.kind, investmentPickManual, variableInvOptions, form.ticker])

  useEffect(() => {
    if (holdingModal.kind !== 'add') return
    const rows = data?.rows ?? []
    const existing = findExistingHoldingForAdd(rows, form.investmentId, form.ticker)
    if (!existing) return
    setForm((f) =>
      f.currency === existing.currency ? f : { ...f, currency: existing.currency },
    )
  }, [holdingModal.kind, form.investmentId, form.ticker, data?.rows])

  const tickerInvestHint = useMemo(() => {
    if (holdingModal.kind !== 'add' || !form.ticker.trim()) return null
    if (invOptions === null) return { type: 'loading' as const }
    const suggested = findInvestmentIdForTicker(form.ticker, variableInvOptions)
    if (suggested && form.investmentId === suggested) {
      const name = variableInvOptions.find((o) => o.id === suggested)?.name ?? ''
      return { type: 'matched' as const, name }
    }
    if (!form.investmentId) return { type: 'no-match' as const }
    return null
  }, [holdingModal.kind, form.ticker, form.investmentId, invOptions, variableInvOptions])

  const canSaveAddHolding = useMemo(() => {
    if (holdingModal.kind !== 'add') return false
    if (invOptions === null) return false
    if (form.investmentId) return true
    return Boolean(form.ticker.trim() && form.investmentTypeId)
  }, [holdingModal.kind, invOptions, form.investmentId, form.ticker, form.investmentTypeId])

  const pageSize = 12

  function openAddHoldingModal() {
    setSaveHoldingError(null)
    setHoldingModal({ kind: 'chooseAssetClass' })
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
      investmentTypeId: '',
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

  const donutSegments = useMemo((): DonutSegment[] => {
    const rows = data?.rows ?? []
    const total = rows.reduce((a, r) => a + (r.marketValue ?? 0), 0)
    if (total <= 0) return []
    const by = new Map<
      string,
      { investmentTypeId: string; label: string; mv: number }
    >()
    for (const r of rows) {
      const prev = by.get(r.investmentTypeId) ?? {
        investmentTypeId: r.investmentTypeId,
        label: r.investmentTypeName,
        mv: 0,
      }
      prev.mv += r.marketValue ?? 0
      by.set(r.investmentTypeId, prev)
    }
    return [...by.values()]
      .sort((a, b) => b.mv - a.mv)
      .map((entry) => ({
        investmentTypeId: entry.investmentTypeId,
        label: entry.label,
        pct: (entry.mv / total) * 100,
        color: allocColorForType(entry.investmentTypeId, entry.label),
      }))
  }, [data?.rows])

  const typeFilterOptions = useMemo(() => {
    const names = [...new Set((data?.rows ?? []).map((r) => r.investmentTypeName))]
    return names.sort((a, b) => a.localeCompare(b))
  }, [data?.rows])

  const currencyFilterOptions = useMemo(() => {
    const codes = [...new Set((data?.rows ?? []).map((r) => r.currency).filter(Boolean))]
    return codes.sort((a, b) => a.localeCompare(b))
  }, [data?.rows])

  const processedRows = useMemo(() => {
    let rows = [...(data?.rows ?? [])]
    if (filterType !== 'all') rows = rows.filter((r) => r.investmentTypeName === filterType)
    if (filterCurrency !== 'all') rows = rows.filter((r) => r.currency === filterCurrency)
    rows.sort((a, b) =>
      sortBy === 'valor'
        ? (b.marketValue ?? 0) - (a.marketValue ?? 0)
        : (a.ticker ?? a.investmentName).localeCompare(b.ticker ?? b.investmentName, 'pt-BR'),
    )
    return rows
  }, [data?.rows, filterType, filterCurrency, sortBy])

  const pageCount = Math.max(1, Math.ceil(processedRows.length / pageSize))
  const pageRows = processedRows.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(processedRows.length / pageSize))
    setPage((p) => Math.min(p, maxPage))
  }, [processedRows.length, pageSize])

  useEffect(() => {
    setPage(1)
  }, [filterType, filterCurrency, sortBy, displayCurrency, data?.rows])

  async function saveHolding() {
    if (form.quantity <= 0) {
      setQuantityError(true)
      return
    }
    setQuantityError(false)
    setSaveHoldingError(null)

    let investmentId = form.investmentId
    if (!investmentId) {
      const ticker = form.ticker.trim()
      if (!ticker) return
      if (!form.investmentTypeId) {
        setSaveHoldingError(m.portfolio.addVariableSelectTypeError)
        return
      }
      const created = await createInvestmentFn({
        data: { name: ticker, investmentTypeId: form.investmentTypeId },
      })
      if (!created) {
        setSaveHoldingError(m.portfolio.addVariableCreateInvestmentError)
        return
      }
      investmentId = created.id
    }

    const existing =
      holdingModal.kind === 'add'
        ? findExistingHoldingForAdd(data?.rows ?? [], investmentId, form.ticker)
        : undefined

    let quantity = Number(form.quantity)
    let avgCost = round2(form.avgCost)
    let currency = form.currency
    let broker = form.broker.trim() ? form.broker.trim() : null
    let ticker = form.ticker.trim() ? form.ticker.trim() : null

    if (existing) {
      const addQ = quantity
      const unit = avgCost
      if (!(unit > 0)) {
        setSaveHoldingError(m.portfolio.addMergeUnitPriceError)
        return
      }
      const oldQ = existing.quantity
      const oldAvg = existing.avgCost
      quantity = oldQ + addQ
      avgCost = round2((oldQ * oldAvg + addQ * unit) / quantity)
      currency = existing.currency
      if (!broker) broker = existing.broker?.trim() ? existing.broker.trim() : null
      if (!ticker) ticker = existing.ticker?.trim() ? existing.ticker.trim() : null
    }

    const lastOpIso =
      form.lastOpDate.trim() === ''
        ? null
        : new Date(`${form.lastOpDate}T12:00:00`).toISOString()
    await upsertPortfolioHoldingFn({
      data: {
        investmentId,
        ticker,
        quantity,
        avgCost,
        broker,
        currency,
        lastOperationAt: lastOpIso,
      },
    })
    setHoldingModal({ kind: 'closed' })
    setForm({
      investmentId: '',
      investmentTypeId: '',
      ticker: '',
      quantity: 0,
      avgCost: 0,
      broker: '',
      currency: displayCurrency,
      lastOpDate: '',
    })
    await refreshHoldings()
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
    await refreshHoldings()
  }

  async function executeDeleteHolding(r: HoldingRow) {
    setDeletingInvestmentId(r.investmentId)
    try {
      await deletePortfolioHoldingFn({ data: { id: r.investmentId } })
      await refreshHoldings()
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
  const holdingsInitialLoading = data === null

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
                // Force-refresh quotes from providers, then reload from DB.
                // (The worker may not be running in production, or providers may have transient errors.)
                try {
                  await refreshPortfolioQuotesFn({ data: { displayCurrency } })
                } catch {
                  // Even if provider refresh fails, retry reading cached quotes.
                }
                const refreshed = await listPortfolioHoldingsFn({ data: { displayCurrency } })
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
              {m.portfolio.holdingsRecordingNote}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <DisplayCurrencySelector
                value={displayCurrency}
                options={displayCurrencyOptions}
                onChange={setDisplayCurrency}
              />
              {displaySwitchLoading && !holdingsInitialLoading && (
                <span
                  className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
                  aria-label="Carregando moeda"
                />
              )}
            </div>
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
                  {fmtMoney(totals.marketValue, displayCurrency)}
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
                        currency: 'BRL',
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
              <DonutAllocation segments={donutSegments} />
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
                  <span className="text-outline">Moeda</span>
                  <select
                    value={filterCurrency}
                    onChange={(e) => setFilterCurrency(e.target.value)}
                    className="max-w-[6rem] border-0 bg-transparent text-xs font-bold text-on-surface outline-none"
                  >
                    <option value="all">Todas</option>
                    {currencyFilterOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
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
                        <span className="text-outline">{m.portfolio.holdingsNativeValue}</span>
                        <span className="font-bold text-on-surface">
                          {r.marketValueNative == null ? '—' : fmtMoney(r.marketValueNative, r.currency)}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-outline">{m.portfolio.holdingsDisplayValue(displayCurrency)}</span>
                        <span className="font-bold text-on-surface">
                          {r.fxUnavailable || r.marketValueDisplay == null
                            ? '—'
                            : fmtMoney(r.marketValueDisplay, displayCurrency)}
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
                    <th className="py-2 text-right">{m.portfolio.holdingsNativeValue}</th>
                    <th className="py-2 text-right">{m.portfolio.holdingsDisplayValue(displayCurrency)}</th>
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
                          {r.marketValueNative == null ? '—' : fmtMoney(r.marketValueNative, r.currency)}
                        </td>
                        <td className="py-3 text-right font-semibold text-on-surface">
                          {r.fxUnavailable || r.marketValueDisplay == null
                            ? '—'
                            : fmtMoney(r.marketValueDisplay, displayCurrency)}
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
                          {r.lastPrice == null ? '—' : fmtMoney(r.lastPrice, r.currency)}
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

      {holdingModal.kind === 'chooseAssetClass' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
          data-holding-modal="choose-asset-class"
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
                  {m.portfolio.addPositionTitle}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-outline">
                  {m.portfolio.chooseAssetClassSubtitle}
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

            <div className="grid grid-cols-1 gap-4">
              <button
                type="button"
                className="flex w-full items-start gap-4 rounded-2xl bg-surface-container-low p-5 text-left shadow-md ring-1 ring-outline-variant/10 transition-colors hover:bg-surface-container-high"
                onClick={() => openVariableAddModal()}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim">
                  <span className="material-symbols-outlined text-2xl">candlestick_chart</span>
                </span>
                <span className="min-w-0">
                  <span className="font-headline block text-base font-extrabold text-on-surface">
                    {m.portfolio.chooseVariableIncome}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                    {m.portfolio.chooseVariableIncomeHint}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="flex w-full items-start gap-4 rounded-2xl bg-surface-container-low p-5 text-left shadow-md ring-1 ring-outline-variant/10 transition-colors hover:bg-surface-container-high"
                onClick={() => setHoldingModal({ kind: 'fixedIncomeComingSoon' })}
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/25 text-primary-container">
                  <span className="material-symbols-outlined text-2xl">savings</span>
                </span>
                <span className="min-w-0">
                  <span className="font-headline block text-base font-extrabold text-on-surface">
                    {m.portfolio.chooseFixedIncome}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-on-surface-variant">
                    {m.portfolio.chooseFixedIncomeHint}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {holdingModal.kind === 'fixedIncomeComingSoon' && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
          data-holding-modal="fixed-income-coming-soon"
        >
          <div className="w-full max-w-md rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h3 className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
                {m.portfolio.fixedIncomeComingSoonTitle}
              </h3>
              <button
                type="button"
                className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
                onClick={() => setHoldingModal({ kind: 'closed' })}
                aria-label="Fechar"
              >
                <span className="material-symbols-outlined text-2xl leading-none">close</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-on-surface-variant">
              {m.portfolio.fixedIncomeComingSoonBody}
            </p>
            <button
              type="button"
              className="mt-8 inline-flex w-full items-center justify-center rounded-full bg-primary-container px-8 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
              onClick={() => setHoldingModal({ kind: 'closed' })}
            >
              {m.portfolio.fixedIncomeComingSoonOk}
            </button>
          </div>
        </div>
      )}

      {(holdingModal.kind === 'add' || holdingModal.kind === 'edit') &&
        (() => {
          const isEdit = holdingModal.kind === 'edit'
          const selectedOpt = invOptions?.find((o) => o.id === form.investmentId)
          const existingHoldingForAdd =
            !isEdit && data?.rows
              ? findExistingHoldingForAdd(data.rows, form.investmentId, form.ticker)
              : undefined
          const holdingSameInv = existingHoldingForAdd
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
          const mergingAdd = !isEdit && Boolean(holdingSameInv)
          const avgCostFieldLabel = mergingAdd
            ? holdingIsFixedIncome
              ? 'Valor desta aplicação'
              : m.portfolio.addMergeUnitPriceLabel
            : holdingIsFixedIncome
              ? 'Valor atual'
              : 'Preço médio'
          const quantityFieldLabel = mergingAdd
            ? m.portfolio.addMergeQuantityLabel
            : 'Quantidade'
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
                  {m.portfolio.holdingsRecordingNote}
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
              <p>{m.portfolio.addVariableBanner}</p>
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
                    setForm({
                      ...form,
                      investmentId: e.target.value,
                      investmentTypeId: e.target.value ? '' : form.investmentTypeId,
                    })
                  }}
                  disabled={invOptions === null || isEdit}
                  className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
                >
                  <option value="">{invOptions === null ? 'Carregando…' : 'Selecione…'}</option>
                  {(isEdit ? (invOptions ?? []) : variableInvOptions).map((o) => (
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
              {mergingAdd && (
                <div className="flex gap-2 rounded-xl border border-primary-container/35 bg-primary-container/12 px-3 py-2 text-xs leading-relaxed text-on-surface sm:col-span-2">
                  <span className="material-symbols-outlined shrink-0 text-base text-primary-container">
                    merge
                  </span>
                  <p>{m.portfolio.addMergeHint}</p>
                </div>
              )}
              {!isEdit && tickerInvestHint?.type === 'no-match' && (
                <div className="flex flex-col gap-4 sm:col-span-2">
                  <div className="flex gap-2 rounded-xl border border-secondary-fixed/35 bg-secondary-fixed/12 px-3 py-2 text-xs leading-relaxed text-on-surface">
                    <span className="material-symbols-outlined shrink-0 text-base text-secondary-fixed">
                      add_circle
                    </span>
                    <p>{m.portfolio.addVariableWillCreate(form.ticker.trim())}</p>
                  </div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                    {m.portfolio.addVariableTypeLabel}
                    <select
                      value={form.investmentTypeId}
                      onChange={(e) =>
                        setForm({ ...form, investmentTypeId: e.target.value })
                      }
                      disabled={typeOptions === null}
                      className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
                    >
                      <option value="">
                        {typeOptions === null
                          ? 'Carregando…'
                          : m.portfolio.addVariableTypePlaceholder}
                      </option>
                      {variableTypeOptions.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
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
                quantityLabel={quantityFieldLabel}
                currencyDisabled={mergingAdd}
              />
            </div>

            {saveHoldingError && (
              <p className="mt-4 text-sm font-medium text-error" role="alert">
                {saveHoldingError}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-8 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
                onClick={() =>
                  setHoldingModal(isEdit ? { kind: 'closed' } : { kind: 'chooseAssetClass' })
                }
              >
                {isEdit ? 'Cancelar' : 'Voltar'}
              </button>
              <button
                type="button"
                disabled={isEdit ? invOptions === null || !form.investmentId : !canSaveAddHolding}
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

