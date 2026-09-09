import { inArray, sql } from 'drizzle-orm'

import { marketQuote } from '../../db/schema'
import { getMarketDataDb, makeLogger } from './db'
import { getQuoteProvider } from './index'
import type { MarketQuote, MarketQuoteInput, QuoteFetchResult } from './types'

const log = makeLogger('quoteRefresh')

function isMarketDataLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  return false
}

export type QuoteRefreshReason = 'worker' | 'immediate'

export async function refreshMarketQuotesForInputs(params: {
  actorId: string
  reason: QuoteRefreshReason
  inputs: MarketQuoteInput[]
}): Promise<{
  bySymbol: Map<
    string,
    { quote: MarketQuote | null; fetchedAt: Date | null; ok: boolean }
  >
  stale: boolean
}> {
  const logEnabled = isMarketDataLogEnabled()
  const startedAt = Date.now()
  const db = await getMarketDataDb()

  const symbols = [
    ...new Set(params.inputs.map((i) => i.symbol.trim()).filter(Boolean)),
  ]
  const bySymbol = new Map<
    string,
    { quote: MarketQuote | null; fetchedAt: Date | null; ok: boolean }
  >()
  if (symbols.length === 0) return { bySymbol, stale: false }

  const yfinance = getQuoteProvider('yfinance')

  let stale = false

  const yahooInputs = symbols.map((s) => ({ symbol: s }))
  let yahooResults: QuoteFetchResult[] = []
  const yStart = Date.now()
  if (logEnabled) {
    log({
      level: 'info',
      msg: 'yfinance -> triggered',
      provider: 'yfinance',
      phase: 'triggered',
      actorId: params.actorId,
      reason: params.reason,
      request: { symbols, n: symbols.length },
    })
  }
  try {
    yahooResults = await yfinance.fetchQuotes(yahooInputs)
  } catch (e: any) {
    stale = true
    log({
      level: 'error',
      msg: 'yfinance -> error',
      provider: 'yfinance',
      phase: 'error',
      actorId: params.actorId,
      reason: params.reason,
      elapsedMs: Date.now() - yStart,
      request: { symbols, n: symbols.length },
      error: {
        message: typeof e?.message === 'string' ? e.message : 'Provider error',
        stack: typeof e?.stack === 'string' ? e?.stack : undefined,
      },
    })
    yahooResults = symbols.map(() => ({
      ok: false as const,
      code: 'PROVIDER_ERROR' as const,
      message: typeof e?.message === 'string' ? e.message : 'Provider error',
    }))
  }

  const yahooBySymbol = new Map<string, QuoteFetchResult>()
  for (let i = 0; i < symbols.length; i++) {
    yahooBySymbol.set(symbols[i], yahooResults[i])
  }

  const toSave = new Map<string, MarketQuote>()

  for (const s of symbols) {
    const yr = yahooBySymbol.get(s)!
    if (!yr.ok && yr.code === 'PROVIDER_ERROR') stale = true
    if (yr.ok) toSave.set(s, yr.quote)
  }

  // Fetch missing logos for yfinance quotes immediately after quote,
  // but only when market_quote doesn't already have a cached logo for the symbol.
  const needLogo: string[] = []
  for (const [symbol, q] of toSave.entries()) {
    if (q.logoUrl) continue
    needLogo.push(symbol)
  }
  if (needLogo.length > 0) {
    const cached = await db
      .select({ symbol: marketQuote.symbol, logoUrl: marketQuote.logoUrl })
      .from(marketQuote)
      .where(inArray(marketQuote.symbol, needLogo))
    const cachedLogoBySymbol = new Map<string, string | null>()
    for (const row of cached)
      cachedLogoBySymbol.set(row.symbol, row.logoUrl ?? null)

    const missing = needLogo.filter((s) => !cachedLogoBySymbol.get(s))
    if (missing.length > 0) {
      const { fetchYahooLogoUrls } = await import('./providers/yfinance')
      const logos = await fetchYahooLogoUrls(missing)
      for (const sym of missing) {
        const logoUrl = logos.get(sym) ?? null
        if (!logoUrl) continue
        const q = toSave.get(sym)
        if (!q) continue
        toSave.set(sym, { ...q, logoUrl })
      }
    }
  }

  const saveSymbols = [...toSave.keys()]
  if (saveSymbols.length > 0) {
    await db
      .insert(marketQuote)
      .values(
        saveSymbols.map((s) => {
          const q = toSave.get(s)!
          return {
            provider: q.provider,
            symbol: q.symbol,
            market: q.market ?? null,
            currency: q.currency ?? null,
            logoUrl: q.logoUrl ?? null,
            price: q.price == null ? null : String(q.price),
            asOf: q.asOf ?? null,
            fetchedAt: sql`now()`,
          }
        }),
      )
      .onConflictDoUpdate({
        target: marketQuote.symbol,
        set: {
          provider: sql`excluded.provider`,
          market: sql`excluded.market`,
          currency: sql`excluded.currency`,
          logoUrl: sql`excluded.logo_url`,
          price: sql`excluded.price`,
          asOf: sql`excluded.as_of`,
          fetchedAt: sql`now()`,
        },
      })
  }

  const refreshed = await db
    .select()
    .from(marketQuote)
    .where(inArray(marketQuote.symbol, symbols))

  const refreshedBySymbol = new Map<string, (typeof refreshed)[number]>()
  for (const row of refreshed) refreshedBySymbol.set(row.symbol, row)

  for (const s of symbols) {
    const persisted = refreshedBySymbol.get(s)
    const saved = toSave.get(s) ?? null
    bySymbol.set(s, {
      quote: saved,
      fetchedAt: persisted?.fetchedAt ?? null,
      ok: Boolean(saved),
    })
  }

  if (logEnabled) {
    log({
      level: 'info',
      msg: 'refresh -> done',
      phase: 'done',
      actorId: params.actorId,
      reason: params.reason,
      request: { symbols, n: symbols.length },
      result: { saved: saveSymbols.length, stale },
      elapsedMs: Date.now() - startedAt,
    })
  }

  return { bySymbol, stale }
}
