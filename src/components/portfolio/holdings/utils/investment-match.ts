import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import type { HoldingRow } from '../types'

export function isVariableIncomeInv(o: { fixedIncome: boolean; typeName: string }): boolean {
  return !isFixedIncomeTipo(o.fixedIncome, o.typeName)
}

export function findInvestmentIdForTicker(
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

export function findExistingHoldingForAdd(
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
