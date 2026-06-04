import { useEffect, useMemo, useRef, useState } from 'react'

import {
  createInvestmentFn,
  deletePortfolioHoldingFn,
  listInvestmentTypesOptionsFn,
  listInvestmentsOverviewFn,
  upsertPortfolioHoldingFn,
} from '#/lib/investment-server'
import { messages as m } from '#/messages'

import type { HoldingRow, PortfolioHoldingForm } from '../types'
import { toDateInputValue } from '../utils/holdings-format'
import { findExistingHoldingForAdd, findInvestmentIdForTicker, isRendaFixaTipo, isVariableIncomeInv } from '../utils/investment-match'
import { round2 } from '../utils/currency-input'
import type { UseHoldingModalResult } from './use-holding-modal'

type UseHoldingFormOptions = {
  rows: HoldingRow[]
  modal: UseHoldingModalResult
  displayCurrency: string
  refresh: () => Promise<void>
}

export type UseHoldingFormResult = {
  form: PortfolioHoldingForm
  setForm: React.Dispatch<React.SetStateAction<PortfolioHoldingForm>>
  invOptions: Array<{ id: string; name: string; fixedIncome: boolean; typeName: string }> | null
  typeOptions: Array<{ id: string; name: string; fixedIncome: boolean }> | null
  variableInvOptions: Array<{ id: string; name: string; fixedIncome: boolean; typeName: string }>
  variableTypeOptions: Array<{ id: string; name: string; fixedIncome: boolean }>
  quantityError: boolean
  setQuantityError: (v: boolean) => void
  saveHoldingError: string | null
  setSaveHoldingError: (v: string | null) => void
  investmentPickManual: boolean
  setInvestmentPickManual: (v: boolean) => void
  tickerInvestHint: { type: 'loading' } | { type: 'matched'; name: string } | { type: 'no-match' } | null
  canSaveAddHolding: boolean
  addModalTickerInputRef: React.RefObject<HTMLInputElement | null>
  pendingDelete: HoldingRow | null
  deletingInvestmentId: string | null
  saveHolding: () => Promise<void>
  requestDelete: (row: HoldingRow) => void
  cancelDelete: () => void
  executeDelete: (row: HoldingRow) => Promise<void>
  openVariableAddModal: () => void
  openEditFromRow: (row: HoldingRow) => void
}

const EMPTY_FORM = (currency: string): PortfolioHoldingForm => ({
  investmentId: '',
  investmentTypeId: '',
  ticker: '',
  quantity: 0,
  avgCost: 0,
  broker: '',
  currency,
  lastOpDate: '',
})

export function useHoldingForm({ rows, modal, displayCurrency, refresh }: UseHoldingFormOptions): UseHoldingFormResult {
  const [form, setForm] = useState<PortfolioHoldingForm>(EMPTY_FORM(displayCurrency))
  const [invOptions, setInvOptions] = useState<Array<{ id: string; name: string; fixedIncome: boolean; typeName: string }> | null>(null)
  const [typeOptions, setTypeOptions] = useState<Array<{ id: string; name: string; fixedIncome: boolean }> | null>(null)
  const [saveHoldingError, setSaveHoldingError] = useState<string | null>(null)
  const [quantityError, setQuantityError] = useState(false)
  const [investmentPickManual, setInvestmentPickManual] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<HoldingRow | null>(null)
  const [deletingInvestmentId, setDeletingInvestmentId] = useState<string | null>(null)
  const loadingInvs = useRef(false)
  const loadingTypes = useRef(false)
  const addModalTickerInputRef = useRef<HTMLInputElement>(null)

  async function ensureInvOptions() {
    if (loadingInvs.current) return
    loadingInvs.current = true
    try {
      const list = await listInvestmentsOverviewFn()
      setInvOptions(list.map((x) => ({
        id: x.id,
        name: x.name,
        fixedIncome: Boolean(x.fixedIncome),
        typeName: x.typeName,
      })))
    } finally {
      loadingInvs.current = false
    }
  }

  async function ensureTypeOptions() {
    if (loadingTypes.current) return
    loadingTypes.current = true
    try {
      const list = await listInvestmentTypesOptionsFn()
      setTypeOptions(list.map((t) => ({
        id: t.id,
        name: t.name,
        fixedIncome: Boolean(t.fixedIncome),
      })))
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

  // Reset form state when modal closes
  useEffect(() => {
    if (modal.state.kind !== 'closed') return
    setQuantityError(false)
    setInvestmentPickManual(false)
    setSaveHoldingError(null)
  }, [modal.state.kind])

  // Auto-focus ticker input once inv options load in add modal
  useEffect(() => {
    if (modal.state.kind !== 'add') return
    if (invOptions === null) return
    const id = window.setTimeout(() => {
      addModalTickerInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [modal.state.kind, invOptions])

  // Auto-match ticker to investmentId in add modal
  useEffect(() => {
    if (modal.state.kind !== 'add' || investmentPickManual) return
    const id = findInvestmentIdForTicker(form.ticker, variableInvOptions)
    setForm((f) => {
      const next = id ?? ''
      if (f.investmentId === next && (next !== '' || f.investmentTypeId === '')) return f
      return { ...f, investmentId: next, investmentTypeId: next ? '' : f.investmentTypeId }
    })
  }, [modal.state.kind, investmentPickManual, variableInvOptions, form.ticker])

  // Sync currency with existing holding when adding
  useEffect(() => {
    if (modal.state.kind !== 'add') return
    const existing = findExistingHoldingForAdd(rows, form.investmentId, form.ticker)
    if (!existing) return
    setForm((f) => f.currency === existing.currency ? f : { ...f, currency: existing.currency })
  }, [modal.state.kind, form.investmentId, form.ticker, rows])

  // Escape key dismisses delete confirmation
  useEffect(() => {
    if (!pendingDelete) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPendingDelete(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDelete])

  const tickerInvestHint = useMemo(() => {
    if (modal.state.kind !== 'add' || !form.ticker.trim()) return null
    if (invOptions === null) return { type: 'loading' as const }
    const suggested = findInvestmentIdForTicker(form.ticker, variableInvOptions)
    if (suggested && form.investmentId === suggested) {
      const name = variableInvOptions.find((o) => o.id === suggested)?.name ?? ''
      return { type: 'matched' as const, name }
    }
    if (!form.investmentId) return { type: 'no-match' as const }
    return null
  }, [modal.state.kind, form.ticker, form.investmentId, invOptions, variableInvOptions])

  const canSaveAddHolding = useMemo(() => {
    if (modal.state.kind !== 'add') return false
    if (invOptions === null) return false
    if (form.investmentId) return true
    return Boolean(form.ticker.trim() && form.investmentTypeId)
  }, [modal.state.kind, invOptions, form.investmentId, form.ticker, form.investmentTypeId])

  function openVariableAddModal() {
    setQuantityError(false)
    setInvestmentPickManual(false)
    setSaveHoldingError(null)
    setForm(EMPTY_FORM(displayCurrency))
    modal.openAdd()
    void ensureInvOptions()
    void ensureTypeOptions()
  }

  function openEditFromRow(row: HoldingRow) {
    setQuantityError(false)
    setInvestmentPickManual(true)
    setForm({
      investmentId: row.investmentId,
      investmentTypeId: '',
      ticker: row.ticker?.trim() ?? '',
      quantity: row.quantity,
      avgCost: round2(row.avgCost),
      broker: row.broker?.trim() ?? '',
      currency: row.currency,
      lastOpDate: toDateInputValue(row.lastOperationAt),
    })
    modal.openEdit(row)
    void ensureInvOptions()
  }

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
      modal.state.kind === 'add'
        ? findExistingHoldingForAdd(rows, investmentId, form.ticker)
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
      data: { investmentId, ticker, quantity, avgCost, broker, currency, lastOperationAt: lastOpIso },
    })
    modal.close()
    setForm(EMPTY_FORM(displayCurrency))
    await refresh()
  }

  function requestDelete(row: HoldingRow) {
    setPendingDelete(row)
  }

  function cancelDelete() {
    setPendingDelete(null)
  }

  async function executeDelete(row: HoldingRow) {
    setDeletingInvestmentId(row.investmentId)
    try {
      await deletePortfolioHoldingFn({ data: { id: row.investmentId } })
      await refresh()
      setPendingDelete(null)
      const s = modal.state
      if (
        (s.kind === 'addToPosition' || s.kind === 'edit') &&
        s.row.investmentId === row.investmentId
      ) {
        modal.close()
      }
    } finally {
      setDeletingInvestmentId(null)
    }
  }

  return {
    form,
    setForm,
    invOptions,
    typeOptions,
    variableInvOptions,
    variableTypeOptions,
    quantityError,
    setQuantityError,
    saveHoldingError,
    setSaveHoldingError,
    investmentPickManual,
    setInvestmentPickManual,
    tickerInvestHint,
    canSaveAddHolding,
    addModalTickerInputRef,
    pendingDelete,
    deletingInvestmentId,
    saveHolding,
    requestDelete,
    cancelDelete,
    executeDelete,
    openVariableAddModal,
    openEditFromRow,
  }
}
