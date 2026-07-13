import { yfinanceProvider } from './providers/yfinance'

export const YAHOO_FX_PAIRS = [
  { base: 'USD', quote: 'BRL', symbol: 'USDBRL=X' },
  { base: 'EUR', quote: 'BRL', symbol: 'EURBRL=X' },
  { base: 'EUR', quote: 'USD', symbol: 'EURUSD=X' },
  { base: 'GBP', quote: 'BRL', symbol: 'GBPBRL=X' },
] as const

export type YahooFxFetchResult = {
  baseCurrency: string
  quoteCurrency: string
  yahooSymbol: string
  rate: number
  asOf: Date | null
}

export async function fetchYahooFxRates(): Promise<YahooFxFetchResult[]> {
  const inputs = YAHOO_FX_PAIRS.map((p) => ({ symbol: p.symbol, holdingCurrency: null }))
  const results = await yfinanceProvider.fetchQuotes(inputs)
  const out: YahooFxFetchResult[] = []

  for (let i = 0; i < YAHOO_FX_PAIRS.length; i++) {
    const pair = YAHOO_FX_PAIRS[i]!
    const res = results[i]
    if (!res?.ok || res.quote.price == null || res.quote.price <= 0) continue
    out.push({
      baseCurrency: pair.base,
      quoteCurrency: pair.quote,
      yahooSymbol: pair.symbol,
      rate: res.quote.price,
      asOf: res.quote.asOf ?? null,
    })
  }

  return out
}
