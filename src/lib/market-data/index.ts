import { brapiProvider } from './providers/brapi'
import { yfinanceProvider } from './providers/yfinance'
import type { QuoteProvider, QuoteProviderId } from './types'

export * from './types'
export * from './providers/brapi'
export * from './providers/yfinance'

export function getQuoteProvider(id: QuoteProviderId): QuoteProvider {
  switch (id) {
    case 'brapi':
      return brapiProvider
    case 'yfinance':
      return yfinanceProvider
  }
}

