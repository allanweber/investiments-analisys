import { yfinanceProvider } from './providers/yfinance'
import type { QuoteProvider, QuoteProviderId } from './types'

export * from './types'
export * from './providers/yfinance'

export function getQuoteProvider(_id: QuoteProviderId): QuoteProvider {
  return yfinanceProvider
}
