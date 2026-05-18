export type QuoteSnapshot = {
  price: number | null
  currency: string | null
  fetchedAt: Date | null
  logoUrl: string | null
}

export type HoldingValuationInput = {
  ticker: string | null
  quantity: number
  avgCost: number
  currency: string
  fixedIncome: boolean
  investmentTypeName: string
}

export type HoldingQuoteStatus = 'BOOK_VALUE' | 'MISSING_TICKER' | 'MISSING_QUOTE' | 'OK'

export type HoldingValuation = {
  lastPrice: number | null
  marketValueNative: number | null
  unrealizedPlNative: number | null
  quoteFetchedAt: Date | null
  quoteCurrency: string | null
  quoteLogoUrl: string | null
  quoteStatus: HoldingQuoteStatus
}

export function isFixedIncomeTipo(fixedIncome: boolean, typeName: string | null | undefined): boolean {
  if (fixedIncome) return true
  return (typeName ?? '').trim().toLowerCase() === 'renda fixa'
}

export function valueHolding(
  holding: HoldingValuationInput,
  quote: QuoteSnapshot | null | undefined,
): HoldingValuation {
  if (isFixedIncomeTipo(holding.fixedIncome, holding.investmentTypeName)) {
    const book = holding.quantity * holding.avgCost
    return {
      lastPrice: null,
      marketValueNative: book,
      unrealizedPlNative: 0,
      quoteFetchedAt: null,
      quoteCurrency: null,
      quoteLogoUrl: null,
      quoteStatus: 'BOOK_VALUE',
    }
  }

  const sym = (holding.ticker ?? '').trim()
  if (!sym) {
    return {
      lastPrice: null,
      marketValueNative: null,
      unrealizedPlNative: null,
      quoteFetchedAt: null,
      quoteCurrency: null,
      quoteLogoUrl: null,
      quoteStatus: 'MISSING_TICKER',
    }
  }

  const lastPrice = quote?.price ?? null
  if (lastPrice == null) {
    return {
      lastPrice: null,
      marketValueNative: null,
      unrealizedPlNative: null,
      quoteFetchedAt: quote?.fetchedAt ?? null,
      quoteCurrency: quote?.currency ?? null,
      quoteLogoUrl: quote?.logoUrl ?? null,
      quoteStatus: 'MISSING_QUOTE',
    }
  }

  const mv = holding.quantity * lastPrice
  return {
    lastPrice,
    marketValueNative: mv,
    unrealizedPlNative: holding.quantity * (lastPrice - holding.avgCost),
    quoteFetchedAt: quote?.fetchedAt ?? null,
    quoteCurrency: quote?.currency ?? null,
    quoteLogoUrl: quote?.logoUrl ?? null,
    quoteStatus: 'OK',
  }
}
