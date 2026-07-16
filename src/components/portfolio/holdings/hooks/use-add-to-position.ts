import { useEffect, useRef, useState } from 'react'

import { upsertPortfolioHoldingFn } from '@/lib/portfolio-server'
import {
  getRendaFixaDetailFn,
  upsertRendaFixaHoldingFn,
} from '@/lib/renda-fixa-server'
import type { Indexer, ProductType } from '@/lib/renda-fixa/products'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'

import { round2 } from '../utils/currency-input'
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
  additionalCapital: number
  setAdditionalCapital: (v: number) => void
  lastOpDate: string
  setLastOpDate: (v: string) => void
  error: string | null
  setError: (v: string | null) => void
  qtyInputRef: React.RefObject<HTMLInputElement | null>
  save: (row: HoldingRow) => Promise<void>
}

export function useAddToPosition({
  modal,
  refresh,
}: UseAddToPositionOptions): UseAddToPositionResult {
  const [additionalQty, setAdditionalQty] = useState('')
  const [unitPrice, setUnitPrice] = useState(0)
  const [additionalCapital, setAdditionalCapital] = useState(0)
  const [lastOpDate, setLastOpDate] = useState('')
  const [error, setError] = useState<string | null>(null)
  const qtyInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (modal.state.kind !== 'closed') return
    setAdditionalQty('')
    setUnitPrice(0)
    setAdditionalCapital(0)
    setLastOpDate('')
    setError(null)
  }, [modal.state.kind])

  useEffect(() => {
    if (modal.state.kind !== 'addToPosition') return
    setLastOpDate(toDateInputValue(modal.state.row.lastOperationAt))
    const id = window.setTimeout(() => {
      qtyInputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [modal.state.kind])

  async function save(row: HoldingRow) {
    if (isFixedIncomeTipo(Boolean(row.fixedIncome), row.investmentTypeName)) {
      const addCap = round2(additionalCapital)
      if (!(addCap > 0)) {
        setError('Informe o valor do investimento.')
        return
      }
      setError(null)

      const detail = await getRendaFixaDetailFn({
        data: { investmentId: row.investmentId },
      })
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getRendaFixaDetailFn's `row ?? null` return type collapses to non-null client-side (tsconfig lacks noUncheckedIndexedAccess, so TS treats the server's `row` as always-defined and drops `| null` from the union), but the server genuinely returns null on a 0-row match
      if (!detail) {
        setError('Não foi possível carregar os detalhes do investimento.')
        return
      }

      const newCapital = round2(Number(detail.detail.capital) + addCap)
      const purchaseDateIso = lastOpDate.trim()
        ? new Date(`${lastOpDate}T12:00:00`).toISOString()
        : detail.detail.purchaseDate instanceof Date
          ? detail.detail.purchaseDate.toISOString()
          : new Date(String(detail.detail.purchaseDate)).toISOString()

      // NOT_FOUND is a defense-in-depth branch (foreign investmentId) and unreachable here:
      // row comes from listRendaFixaHoldingsFn, which is already scoped to this user's holdings.
      await upsertRendaFixaHoldingFn({
        data: {
          investmentId: row.investmentId,
          productType: detail.detail.productType as ProductType,
          indexer: detail.detail.indexer as Indexer,
          capital: newCapital,
          annualRate: Number(detail.detail.annualRate),
          multiplier:
            detail.detail.multiplier != null
              ? Number(detail.detail.multiplier)
              : undefined,
          purchaseDate: purchaseDateIso,
          maturityDate: detail.detail.maturityDate
            ? detail.detail.maturityDate instanceof Date
              ? detail.detail.maturityDate.toISOString()
              : new Date(String(detail.detail.maturityDate)).toISOString()
            : null,
          broker: row.broker?.trim() ? row.broker.trim() : undefined,
        },
      })
      modal.close()
      await refresh()
      return
    }

    const addQ = parseAdditionalQty(additionalQty)
    if (!(addQ > 0)) {
      setError('A quantidade deve ser maior que zero.')
      return
    }
    const unit = round2(unitPrice)
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
        quantity: newQ,
        avgCost: round2(newAvg),
        broker: row.broker?.trim() ? row.broker.trim() : null,
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
    additionalCapital,
    setAdditionalCapital,
    lastOpDate,
    setLastOpDate,
    error,
    setError,
    qtyInputRef,
    save,
  }
}
