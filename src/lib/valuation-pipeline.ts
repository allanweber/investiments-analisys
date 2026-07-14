import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '@/db/schema'
import { convertMoney, isFxCacheStale } from '@/lib/fx'
import { normalizeHoldingCurrency, num, toMoney } from '@/lib/math'
import { ensureFxRatesForDisplay } from '@/lib/market-data/fx-refresh'
import { loadQuotesFromDb } from '@/lib/market-data/quote-cache'
import type { MarketQuoteInput } from '@/lib/market-data'
import { isFixedIncomeTipo, valueHolding } from '@/lib/portfolio-valuation'
import type { HoldingQuoteStatus } from '@/lib/portfolio-valuation'

type Db = NodePgDatabase<typeof schema>

export type ValuationHoldingInput = {
  ticker: string | null
  quantity: string
  avgCost: string
  /** Null when the investment's currency hasn't been resolved yet; treated as BRL. */
  currency: string | null
  fixedIncome: boolean
  investmentTypeName: string
}

export type ValuatedHolding = {
  quantity: number
  avgCost: number
  lastPrice: number | null
  marketValueNative: number | null
  unrealizedPlNative: number | null
  marketValueDisplay: number | null
  unrealizedPlDisplay: number | null
  fxRateUsed: number | null
  fxUnavailable: boolean
  quoteFetchedAt: Date | null
  quoteCurrency: string | null
  quoteLogoUrl: string | null
  quoteStatus: HoldingQuoteStatus
}

export type ValuationPipelineResult = {
  valuated: ValuatedHolding[]
  quotesStale: boolean
  fxAsOf: Date | null
  fxStale: boolean
  fxMissingPairs: string[]
}

export async function valuateHoldings(
  db: Db,
  holdings: ValuationHoldingInput[],
  displayCurrency: string,
): Promise<ValuationPipelineResult> {
  const inputs: MarketQuoteInput[] = holdings
    .filter((h) => !isFixedIncomeTipo(h.fixedIncome, h.investmentTypeName))
    .map((h) => ({
      symbol: (h.ticker ?? '').trim(),
      holdingCurrency: normalizeHoldingCurrency(h.currency),
    }))
    .filter((i) => i.symbol.length > 0)

  const { bySymbol, stale } = await loadQuotesFromDb({ inputs })

  const nativeCurrencies = [
    ...new Set(holdings.map((h) => h.currency).filter((c): c is string => Boolean(c))),
  ]
  const { matrix, newestFetchedAt, oldestFetchedAt, fxMissingPairs } =
    await ensureFxRatesForDisplay(db, nativeCurrencies, displayCurrency)
  const fxStale = isFxCacheStale(oldestFetchedAt)

  const valuated: ValuatedHolding[] = holdings.map((h) => {
    const sym = (h.ticker ?? '').trim()
    const cur = h.currency && h.currency.trim() ? h.currency : 'BRL'
    const qty = toMoney(num(h.quantity))
    const avg = toMoney(num(h.avgCost))

    const q = sym ? bySymbol.get(sym) : null
    const valued = valueHolding(
      {
        ticker: h.ticker,
        quantity: qty,
        avgCost: avg,
        currency: cur,
        fixedIncome: h.fixedIncome,
        investmentTypeName: h.investmentTypeName,
      },
      q,
    )

    const mv =
      valued.marketValueNative == null
        ? { value: null as number | null, rate: null as number | null }
        : convertMoney(valued.marketValueNative, cur, displayCurrency, matrix)
    const pl =
      valued.unrealizedPlNative == null
        ? { value: null as number | null, rate: null as number | null }
        : convertMoney(valued.unrealizedPlNative, cur, displayCurrency, matrix)

    return {
      quantity: qty,
      avgCost: avg,
      lastPrice: valued.lastPrice,
      marketValueNative: valued.marketValueNative,
      unrealizedPlNative: valued.unrealizedPlNative,
      marketValueDisplay: mv.value,
      unrealizedPlDisplay: pl.value,
      fxRateUsed: mv.rate,
      fxUnavailable: valued.marketValueNative != null && mv.value == null,
      quoteFetchedAt: valued.quoteFetchedAt,
      quoteCurrency: valued.quoteCurrency,
      quoteLogoUrl: valued.quoteLogoUrl,
      quoteStatus: valued.quoteStatus,
    }
  })

  return {
    valuated,
    quotesStale: stale,
    fxAsOf: newestFetchedAt,
    fxStale,
    fxMissingPairs,
  }
}
