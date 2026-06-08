import { calculateInvestment } from '@/lib/renda-fixa/products'
import type { Indexer, ProductType } from '@/lib/renda-fixa/products'
import type { BcbRates } from '@/lib/market-data/providers/bcb'

export type RendaFixaDetailInput = {
  productType: string
  indexer: string
  capital: string
  annualRate: string
  purchaseDate: Date
  multiplier: string | null
}

export type RendaFixaValuationRow = {
  grossAmount: string
  grossProfit: string
  iof: string
  ir: string
  netAmount: string
  netProfit: string
  netRate: string
  calendarDays: number
  liquidityBlocked: boolean
  carenciaDays: number | null
  liquidityReason: string | null
  indexerAnnual: string | null
  computedAt: Date
}

/**
 * Weekday-only business day approximation.
 * Brazil has national holidays that further reduce business days; a proper SELIC/CDI
 * calendar is not yet available in this codebase. The approximation is accurate enough
 * for display purposes and consistent with the 252-day convention used in calculateInvestment.
 */
export function approxBusinessDays(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  const totalDays = Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerDay))
  const weeks = Math.floor(totalDays / 7)
  const remainder = totalDays % 7
  const fromDay = from.getDay()
  let weekendDays = weeks * 2
  for (let i = 0; i < remainder; i++) {
    const d = (fromDay + i) % 7
    if (d === 0 || d === 6) weekendDays++
  }
  return Math.max(0, totalDays - weekendDays)
}

/** Pure function: given a detail row, BCB rates, and a reference date, returns the valuation row to persist. */
export function buildRendaFixaValuationRow(detail: RendaFixaDetailInput, rates: BcbRates, today: Date): RendaFixaValuationRow {
  const purchaseDate = new Date(detail.purchaseDate)
  const calendarDays = Math.max(0, Math.floor((today.getTime() - purchaseDate.getTime()) / 86_400_000))
  const businessDays = approxBusinessDays(purchaseDate, today)
  const capital = Number(detail.capital)
  const indexer = detail.indexer as Indexer

  const annualRate =
    indexer === 'cdi' ? rates.cdiAnnual
    : indexer === 'selic' ? rates.selicAnnual
    : indexer === 'selic-spread' ? rates.selicAnnual + Number(detail.annualRate)
    : Number(detail.annualRate)

  const monthlyRates =
    indexer === 'ipca' ? rates.ipcaMonthly
    : indexer === 'igpm' ? rates.igpmMonthly
    : undefined

  const indexRate =
    indexer === 'ipca' ? rates.ipcaAccumulated12m
    : indexer === 'igpm' ? rates.igpmAccumulated12m
    : undefined

  const indexerAnnual =
    indexer === 'cdi' ? rates.cdiAnnual
    : indexer === 'selic' ? rates.selicAnnual
    : indexer === 'selic-spread' ? rates.selicAnnual + Number(detail.annualRate)
    : indexer === 'ipca' ? rates.ipcaAccumulated12m
    : indexer === 'igpm' ? rates.igpmAccumulated12m
    : null

  const result = calculateInvestment({
    productType: detail.productType as ProductType,
    indexer,
    capital,
    annualRate,
    calendarDays,
    businessDays,
    multiplier: detail.multiplier != null && indexer !== 'selic-spread' ? Number(detail.multiplier) : undefined,
    monthlyRates,
    indexRate,
  })

  const carenciaDays = Number.isFinite(result.liquidity.carenciaDays) ? result.liquidity.carenciaDays : null

  return {
    grossAmount: String(result.grossAmount),
    grossProfit: String(result.grossProfit),
    iof: String(result.iof),
    ir: String(result.ir),
    netAmount: String(result.netAmount),
    netProfit: String(result.netProfit),
    netRate: String(result.netRate),
    calendarDays: result.calendarDays,
    liquidityBlocked: result.liquidity.blocked,
    carenciaDays,
    liquidityReason: result.liquidity.reason ?? null,
    indexerAnnual: indexerAnnual != null ? String(indexerAnnual) : null,
    computedAt: today,
  }
}
