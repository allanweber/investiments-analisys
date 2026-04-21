export type QuoteProviderId = 'brapi' | 'yfinance'

export type MarketQuoteInput = {
  /** Raw symbol/ticker as stored on the holding. */
  symbol: string
  /**
   * Holding denomination currency (e.g. from `portfolioHolding.currency`).
   * Used for routing: `BRL` → brapi first, then Yahoo fallback on failure.
   * If the same `symbol` appears with mixed currencies, **any** `BRL` row makes
   * that symbol brapi-primary for this refresh.
   */
  holdingCurrency?: string | null
  /**
   * Optional market/exchange hint (e.g. "B3", "NYSE"). Providers may ignore.
   * Stored on cache rows to help later provider swaps.
   */
  market?: string | null
}

export type MarketQuote = {
  provider: QuoteProviderId
  symbol: string
  market?: string | null
  currency?: string | null
  /** Optional company logo URL (provider-dependent). */
  logoUrl?: string | null
  price?: number | null
  asOf?: Date | null
}

export type QuoteFetchOk = { ok: true; quote: MarketQuote }
export type QuoteFetchErr = { ok: false; code: 'NOT_FOUND' | 'PROVIDER_ERROR'; message: string }
export type QuoteFetchResult = QuoteFetchOk | QuoteFetchErr

export interface QuoteProvider {
  id: QuoteProviderId
  /**
   * Fetch quotes for the given inputs. The provider should return one result per input,
   * preserving order, so callers can zip safely.
   */
  fetchQuotes: (inputs: readonly MarketQuoteInput[]) => Promise<QuoteFetchResult[]>
}

