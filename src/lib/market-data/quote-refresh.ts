import { inArray, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { marketQuote } from '../../db/schema'
import { getQuoteProvider } from './index'
import type { MarketQuote, MarketQuoteInput, QuoteFetchResult, QuoteProviderId } from './types'

async function getDb() {
  // Prefer `#/db` when available (SSR/server graph); fall back for the worker entry.
  try {
    return (await import('#/db')).db
  } catch {
    const url = (process.env.DATABASE_URL ?? '').trim()
    if (!url) throw new Error('DATABASE_URL is required (non-empty).')
    const pool = new Pool({ connectionString: url })
    return drizzle(pool)
  }
}

function normalizeHoldingCurrency(c: string | null | undefined): string | null {
  const t = (c ?? '').trim().toUpperCase()
  return t.length ? t : null
}

/**
 * If the same symbol appears with mixed `holdingCurrency` values, **any** `BRL`
 * row routes that symbol to brapi-first for this refresh.
 */
function symbolPreferBrapiFirst(inputs: readonly MarketQuoteInput[], normalizedSymbol: string): boolean {
  for (const inp of inputs) {
    if (inp.symbol.trim() !== normalizedSymbol) continue
    if (normalizeHoldingCurrency(inp.holdingCurrency) === 'BRL') return true
  }
  return false
}

function isMarketDataLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true
  return false
}

function logQuoteRefreshEvent(event: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    scope: 'quoteRefresh',
    ...event,
  }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function requireBrapiToken() {
  const token = (process.env.BRAPI_TOKEN ?? '').trim()
  if (!token) throw new Error('Missing BRAPI_TOKEN (required)')
}

export type QuoteRefreshReason = 'worker' | 'immediate'

export async function refreshMarketQuotesForInputs(params: {
  actorId: string
  reason: QuoteRefreshReason
  inputs: MarketQuoteInput[]
}): Promise<{
  bySymbol: Map<string, { quote: MarketQuote | null; fetchedAt: Date | null; ok: boolean }>
  stale: boolean
}> {
  const logEnabled = isMarketDataLogEnabled()
  const startedAt = Date.now()
  const db = await getDb()

  const symbols = [...new Set(params.inputs.map((i) => i.symbol.trim()).filter(Boolean))]
  const bySymbol = new Map<string, { quote: MarketQuote | null; fetchedAt: Date | null; ok: boolean }>()
  if (symbols.length === 0) return { bySymbol, stale: false }

  const brapi = getQuoteProvider('brapi')
  const yfinance = getQuoteProvider('yfinance')

  const brlPrimary = symbols.filter((s) => symbolPreferBrapiFirst(params.inputs, s))
  const nonBrl = symbols.filter((s) => !symbolPreferBrapiFirst(params.inputs, s))

  if (brlPrimary.length > 0) requireBrapiToken()

  let stale = false

  const brlInputs = brlPrimary.map((s) => ({ symbol: s, holdingCurrency: 'BRL' as const }))
  let brlResults: QuoteFetchResult[] = []
  const brapiStart = Date.now()
  if (logEnabled && brlPrimary.length > 0) {
    logQuoteRefreshEvent({
      level: 'info',
      msg: 'brapi -> triggered',
      provider: 'brapi',
      phase: 'triggered',
      actorId: params.actorId,
      reason: params.reason,
      request: { symbols: brlPrimary, n: brlPrimary.length, holdingCurrency: 'BRL' },
    })
  }
  try {
    brlResults = brlPrimary.length > 0 ? await brapi.fetchQuotes(brlInputs) : []
  } catch (e: any) {
    stale = true
    logQuoteRefreshEvent({
      level: 'error',
      msg: 'brapi -> error',
      provider: 'brapi',
      phase: 'error',
      actorId: params.actorId,
      reason: params.reason,
      elapsedMs: Date.now() - brapiStart,
      request: { symbols: brlPrimary, n: brlPrimary.length, holdingCurrency: 'BRL' },
      error: {
        message: typeof e?.message === 'string' ? e.message : 'Provider error',
        stack: typeof e?.stack === 'string' ? e?.stack : undefined,
      },
    })
    brlResults = brlPrimary.map(() => ({
      ok: false as const,
      code: 'PROVIDER_ERROR' as const,
      message: typeof e?.message === 'string' ? e.message : 'Provider error',
    }))
  }

  const brlBySymbol = new Map<string, QuoteFetchResult>()
  for (let i = 0; i < brlPrimary.length; i++) {
    brlBySymbol.set(brlPrimary[i]!, brlResults[i]!)
  }

  const symbolsForYahoo = new Set<string>(nonBrl)
  for (const s of brlPrimary) {
    const r = brlBySymbol.get(s)
    if (!r?.ok) symbolsForYahoo.add(s)
  }
  const yahooList = [...symbolsForYahoo]

  const yahooInputs = yahooList.map((s) => ({ symbol: s }))
  let yahooResults: QuoteFetchResult[] = []
  if (yahooList.length > 0) {
    const yStart = Date.now()
    if (logEnabled) {
      logQuoteRefreshEvent({
        level: 'info',
        msg: 'yfinance -> triggered',
        provider: 'yfinance',
        phase: 'triggered',
        actorId: params.actorId,
        reason: params.reason,
        request: { symbols: yahooList, n: yahooList.length },
      })
    }
    try {
      yahooResults = await yfinance.fetchQuotes(yahooInputs)
    } catch (e: any) {
      stale = true
      logQuoteRefreshEvent({
        level: 'error',
        msg: 'yfinance -> error',
        provider: 'yfinance',
        phase: 'error',
        actorId: params.actorId,
        reason: params.reason,
        elapsedMs: Date.now() - yStart,
        request: { symbols: yahooList, n: yahooList.length },
        error: {
          message: typeof e?.message === 'string' ? e.message : 'Provider error',
          stack: typeof e?.stack === 'string' ? e?.stack : undefined,
        },
      })
      yahooResults = yahooList.map(() => ({
        ok: false as const,
        code: 'PROVIDER_ERROR' as const,
        message: typeof e?.message === 'string' ? e.message : 'Provider error',
      }))
    }
  }

  const yahooBySymbol = new Map<string, QuoteFetchResult>()
  for (let i = 0; i < yahooList.length; i++) {
    yahooBySymbol.set(yahooList[i]!, yahooResults[i]!)
  }

  const toSave = new Map<string, MarketQuote>()

  for (const s of brlPrimary) {
    const br = brlBySymbol.get(s)!
    if (!br.ok && br.code === 'PROVIDER_ERROR') stale = true
    if (br.ok) toSave.set(s, br.quote)
  }

  for (const s of nonBrl) {
    const yr = yahooBySymbol.get(s)!
    if (!yr.ok && yr.code === 'PROVIDER_ERROR') stale = true
    if (yr.ok) toSave.set(s, yr.quote)
  }

  // Yahoo fallback for BRL-primary failures.
  for (const s of brlPrimary) {
    if (toSave.has(s)) continue
    const yr = yahooBySymbol.get(s)!
    if (!yr.ok && yr.code === 'PROVIDER_ERROR') stale = true
    if (yr.ok) toSave.set(s, yr.quote)
  }

  // Fetch missing logos for yfinance quotes immediately after quote,
  // but only when market_quote doesn't already have a cached logo for the symbol.
  const needLogo: string[] = []
  for (const [symbol, q] of toSave.entries()) {
    if (q.provider !== 'yfinance') continue
    if (q.logoUrl) continue
    needLogo.push(symbol)
  }
  if (needLogo.length > 0) {
    const cached = await db
      .select({ symbol: marketQuote.symbol, logoUrl: marketQuote.logoUrl })
      .from(marketQuote)
      .where(inArray(marketQuote.symbol, needLogo))
    const cachedLogoBySymbol = new Map<string, string | null>()
    for (const row of cached) cachedLogoBySymbol.set(row.symbol, row.logoUrl ?? null)

    const missing = needLogo.filter((s) => !cachedLogoBySymbol.get(s))
    if (missing.length > 0) {
      const { fetchYahooLogoUrls } = await import('./providers/yfinance')
      const logos = await fetchYahooLogoUrls(missing)
      for (const sym of missing) {
        const logoUrl = logos.get(sym) ?? null
        if (!logoUrl) continue
        const q = toSave.get(sym)
        if (!q) continue
        if (q.provider !== 'yfinance') continue
        toSave.set(sym, { ...q, logoUrl })
      }
    }
  }

  const saveSymbols = [...toSave.keys()]
  if (saveSymbols.length > 0) {
    for (const s of saveSymbols) {
      const q = toSave.get(s)!
      await db
        .insert(marketQuote)
        .values({
          provider: q.provider,
          symbol: q.symbol,
          market: q.market ?? null,
          currency: q.currency ?? null,
          logoUrl: q.logoUrl ?? null,
          price: q.price == null ? null : String(q.price),
          asOf: q.asOf ?? null,
          fetchedAt: sql`now()`,
        })
        .onConflictDoUpdate({
          target: marketQuote.symbol,
          set: {
            provider: q.provider,
            market: q.market ?? null,
            currency: q.currency ?? null,
            logoUrl: q.logoUrl ?? null,
            price: q.price == null ? null : String(q.price),
            asOf: q.asOf ?? null,
            fetchedAt: sql`now()`,
          },
        })
    }
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
    logQuoteRefreshEvent({
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

