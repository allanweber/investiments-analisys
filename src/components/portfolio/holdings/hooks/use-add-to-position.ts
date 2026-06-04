import { useEffect, useRef, useState } from 'react'

import { upsertPortfolioHoldingFn } from '#/lib/portfolio-server'

import { moneyMeta, parseAvgCostDraft, round2, sanitizeAvgCostTyping, formatCurrencyFixed2 } from '../utils/currency-input'
import { parseAdditionalQty, toDateInputValue } from '../utils/holdings-format'
import type { HoldingRow } from '../types'
import type { UseHoldingModalResult } from './use-holding-modal'

type UseAddToPositionOptions = {
  modal: UseHoldingModalResult
  refresh: () => Promise<void>
}

export type UseAddToPositionResult = {
  additionalQty: string
  setAdditionalQty: (v: string) => void
  unitPrice: number
  setUnitPrice: (v: number) => void
  lastOpDate: string
  setLastOpDate: (v: string) => void
  unitFocused: boolean
  unitDraft: string
  unitSuppressNextMouseUpRef: React.RefObject<boolean>
  unitPointerDownBeforeFocusRef: React.RefObject<boolean>
  error: string | null
  setError: (v: string | null) => void
  qtyInputRef: React.RefObject<HTMLInputElement | null>
  onUnitFocus: (e: React.FocusEvent<HTMLInputElement>, currency: string) => void
  onUnitMouseDown: (e: React.MouseEvent<HTMLInputElement>) => void
  onUnitMouseUp: (e: React.MouseEvent<HTMLInputElement>) => void
  onUnitChange: (e: React.ChangeEvent<HTMLInputElement>, currency: string) => void
  onUnitBlur: (currency: string) => void
  displayUnitValue: (currency: string) => string
  save: (row: HoldingRow) => Promise<void>
}

export function useAddToPosition({ modal, refresh }: UseAddToPositionOptions): UseAddToPositionResult {
  const [additionalQty, setAdditionalQty] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [lastOpDate, setLastOpDate] = useState('')
  const [unitFocused, setUnitFocused] = useState(false)
  const [unitDraft, setUnitDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const unitSuppressNextMouseUpRef = useRef(false)
  const unitPointerDownBeforeFocusRef = useRef(false)
  const qtyInputRef = useRef<HTMLInputElement>(null)

  // Reset when modal closes
  useEffect(() => {
    if (modal.state.kind !== 'closed') return
    setAdditionalQty('')
    setUnitPrice(0)
    setLastOpDate('')
    setUnitFocused(false)
    setUnitDraft('')
    setError(null)
  }, [modal.state.kind])

  // Pre-fill lastOpDate and focus qty input when addToPosition opens
  useEffect(() => {
    if (modal.state.kind !== 'addToPosition') return
    setLastOpDate(toDateInputValue(modal.state.row.lastOperationAt))
    const id = window.setTimeout(() => {
      qtyInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [modal.state.kind])

  function onUnitMouseDown(e: React.MouseEvent<HTMLInputElement>) {
    if (e.currentTarget !== document.activeElement) {
      unitPointerDownBeforeFocusRef.current = true
    }
  }

  function onUnitFocus(e: React.FocusEvent<HTMLInputElement>, currency: string) {
    const el = e.currentTarget
    const meta = moneyMeta(currency)
    setUnitFocused(true)
    setUnitDraft(sanitizeAvgCostTyping(formatCurrencyFixed2(unitPrice, currency), meta))
    if (unitPointerDownBeforeFocusRef.current) {
      unitSuppressNextMouseUpRef.current = true
      unitPointerDownBeforeFocusRef.current = false
    }
    setTimeout(() => { el.select() }, 0)
  }

  function onUnitMouseUp(e: React.MouseEvent<HTMLInputElement>) {
    if (unitSuppressNextMouseUpRef.current) {
      e.preventDefault()
      unitSuppressNextMouseUpRef.current = false
    }
  }

  function onUnitChange(e: React.ChangeEvent<HTMLInputElement>, currency: string) {
    const meta = moneyMeta(currency)
    const next = sanitizeAvgCostTyping(e.target.value, meta)
    setUnitDraft(next)
    setUnitPrice(parseAvgCostDraft(next, meta))
  }

  function onUnitBlur(currency: string) {
    const meta = moneyMeta(currency)
    setUnitPrice(round2(parseAvgCostDraft(unitDraft, meta)))
    setUnitFocused(false)
    setUnitDraft('')
  }

  function displayUnitValue(currency: string): string {
    return unitFocused ? unitDraft : formatCurrencyFixed2(unitPrice, currency)
  }

  async function save(row: HoldingRow) {
    const addQ = parseAdditionalQty(additionalQty)
    if (!(addQ > 0)) {
      setError('A quantidade deve ser maior que zero.')
      return
    }
    const meta = moneyMeta(row.currency)
    const unitRaw = unitFocused
      ? sanitizeAvgCostTyping(unitDraft, meta)
      : sanitizeAvgCostTyping(formatCurrencyFixed2(unitPrice, row.currency), meta)
    const unit = round2(parseAvgCostDraft(unitRaw, meta))
    if (!(unit > 0)) {
      setError('Informe o preço unitário desta compra.')
      return
    }
    setError(null)
    const oldQ = row.quantity
    const oldAvg = row.avgCost
    const newQ = oldQ + addQ
    const newAvg = (oldQ * oldAvg + addQ * unit) / newQ
    const lastOpIso =
      lastOpDate.trim() === ''
        ? null
        : new Date(`${lastOpDate}T12:00:00`).toISOString()
    await upsertPortfolioHoldingFn({
      data: {
        investmentId: row.investmentId,
        ticker: row.ticker?.trim() ? row.ticker.trim() : null,
        quantity: newQ,
        avgCost: round2(newAvg),
        broker: row.broker?.trim() ? row.broker.trim() : null,
        currency: row.currency,
        lastOperationAt: lastOpIso,
      },
    })
    modal.close()
    await refresh()
  }

  return {
    additionalQty,
    setAdditionalQty,
    unitPrice,
    setUnitPrice,
    lastOpDate,
    setLastOpDate,
    unitFocused,
    unitDraft,
    unitSuppressNextMouseUpRef,
    unitPointerDownBeforeFocusRef,
    error,
    setError,
    qtyInputRef,
    onUnitFocus,
    onUnitMouseDown,
    onUnitMouseUp,
    onUnitChange,
    onUnitBlur,
    displayUnitValue,
    save,
  }
}
