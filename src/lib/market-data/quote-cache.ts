import { asc, inArray } from 'drizzle-orm'

import { marketQuote } from '#/db/schema'
import { num, toMoney } from '#/lib/math'

import { getMarketDataDb } from './db'
import type { MarketQuoteInput } from './types'

export function marketQuoteTtlMsFromEnv(): number {
  const raw = (process.env.MARKET_QUOTE_TTL_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 12
  const hours = Number.isFinite(h) && h > 0 ? h : 12
  return hours * 60 * 60_000
}

export async function loadQuotesFromDb(params: {
  inputs: MarketQuoteInput[]
  maxAgeMs?: number
}): Promise<{
  bySymbol: Map<
    string,
    { price: number | null; currency: string | null; fetchedAt: Date | null; logoUrl: string | null }
  >
  stale: boolean
}> {
  const db = await getMarketDataDb()
  const maxAgeMs = params.maxAgeMs ?? marketQuoteTtlMsFromEnv()
  const now = Date.now()

  const symbols = [...new Set(params.inputs.map((i) => i.symbol.trim()).filter(Boolean))]
  if (symbols.length === 0) return { bySymbol: new Map(), stale: false }

  const cached = await db
    .select()
    .from(marketQuote)
    .where(inArray(marketQuote.symbol, symbols))
    .orderBy(asc(marketQuote.fetchedAt))

  const cacheBySymbol = new Map<string, (typeof cached)[number]>()
  for (const row of cached) {
    const prev = cacheBySymbol.get(row.symbol)
    if (!prev) {
      cacheBySymbol.set(row.symbol, row)
      continue
    }
    const prevAt = prev.fetchedAt instanceof Date ? prev.fetchedAt.getTime() : 0
    const at = row.fetchedAt instanceof Date ? row.fetchedAt.getTime() : 0
    if (at >= prevAt) cacheBySymbol.set(row.symbol, row)
  }

  const freshEnough = (row: any) => {
    const at = row?.fetchedAt instanceof Date ? row.fetchedAt.getTime() : 0
    return at > 0 && now - at <= maxAgeMs
  }

  const anyStale = symbols.some((s) => {
    const row = cacheBySymbol.get(s)
    return !row || !freshEnough(row)
  })

  const bySymbol = new Map<
    string,
    { price: number | null; currency: string | null; fetchedAt: Date | null; logoUrl: string | null }
  >()
  for (const s of symbols) {
    const row = cacheBySymbol.get(s)
    bySymbol.set(s, {
      price: row?.price == null ? null : toMoney(num(row.price)),
      currency: row?.currency ?? null,
      fetchedAt: row?.fetchedAt ?? null,
      logoUrl: (row as any)?.logoUrl ?? null,
    })
  }
  return { bySymbol, stale: anyStale }
}
