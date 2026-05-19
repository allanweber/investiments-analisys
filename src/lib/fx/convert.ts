import { SUPPORTED_FX_CURRENCIES } from './constants'

export type FxRateRow = {
  baseCurrency: string
  quoteCurrency: string
  rate: number
}

/** Directed rates: `from->to` = multiply amount in `from` to get `to`. */
export type FxRateMatrix = Map<string, number>

function pairKey(from: string, to: string): string {
  return `${from.toUpperCase()}->${to.toUpperCase()}`
}

export function buildRateMatrix(rows: readonly FxRateRow[]): FxRateMatrix {
  const m = new Map<string, number>()
  for (const row of rows) {
    const from = row.baseCurrency.trim().toUpperCase()
    const to = row.quoteCurrency.trim().toUpperCase()
    if (!from || !to || !Number.isFinite(row.rate) || row.rate <= 0) continue
    m.set(pairKey(from, to), row.rate)
    m.set(pairKey(to, from), 1 / row.rate)
  }
  for (const c of SUPPORTED_FX_CURRENCIES) {
    m.set(pairKey(c, c), 1)
  }
  return m
}

export function getFxRate(matrix: FxRateMatrix, from: string, to: string): number | null {
  const f = from.trim().toUpperCase()
  const t = to.trim().toUpperCase()
  if (f === t) return 1

  const direct = matrix.get(pairKey(f, t))
  if (direct != null && direct > 0) return direct

  const via = 'BRL'
  if (f !== via && t !== via) {
    const fToVia = matrix.get(pairKey(f, via))
    const tToVia = matrix.get(pairKey(t, via))
    if (fToVia != null && tToVia != null && fToVia > 0 && tToVia > 0) {
      return fToVia / tToVia
    }
  }

  const viaUsd = 'USD'
  if (f !== viaUsd && t !== viaUsd) {
    const fToUsd = matrix.get(pairKey(f, viaUsd))
    const tToUsd = matrix.get(pairKey(t, viaUsd))
    if (fToUsd != null && tToUsd != null && fToUsd > 0 && tToUsd > 0) {
      return fToUsd / tToUsd
    }
  }

  return null
}

export function convertMoney(
  amount: number,
  from: string,
  to: string,
  matrix: FxRateMatrix,
): { value: number | null; rate: number | null } {
  if (!Number.isFinite(amount)) return { value: null, rate: null }
  const rate = getFxRate(matrix, from, to)
  if (rate == null) return { value: null, rate: null }
  return { value: amount * rate, rate }
}

export function findMissingFxPairs(
  currencies: readonly string[],
  displayCurrency: string,
  matrix: FxRateMatrix,
): string[] {
  const display = displayCurrency.trim().toUpperCase()
  const missing = new Set<string>()
  for (const c of currencies) {
    const native = c.trim().toUpperCase()
    if (!native || native === display) continue
    if (getFxRate(matrix, native, display) == null) {
      missing.add(`${native}->${display}`)
    }
  }
  return [...missing].sort()
}
