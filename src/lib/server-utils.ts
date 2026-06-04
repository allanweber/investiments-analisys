import { getRequest } from '@tanstack/react-start/server'
import { asc, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { marketQuote } from '#/db/schema'
import type { UserAllocationTargetsJson } from '#/db/schema'
import type { MarketQuoteInput } from '#/lib/market-data'
import { convertMoney, type FxRateMatrix } from '#/lib/fx'

export async function getDb() {
  return (await import('#/db')).db
}

export async function requireUserId(): Promise<string> {
  const request = getRequest()
  const { getAuth } = await import('#/lib/auth')
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  const id = session?.user?.id
  if (!id) throw new Error('UNAUTHORIZED')
  return id
}

export const uuid = z.string().uuid()
export const currencyCode = z.string().min(1).max(10)
export const pct = z.number().min(0).max(100)
export const idInput = z.object({ id: uuid })

export function normalizeHoldingCurrency(c: string | null | undefined): string | null {
  const t = (c ?? '').trim().toUpperCase()
  return t.length ? t : null
}

export function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

export function parseTargetsJson(raw: unknown): UserAllocationTargetsJson {
  if (!raw || typeof raw !== 'object') return {}
  const out: UserAllocationTargetsJson = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = { targetPct: clampPct(v) }
      continue
    }
    if (v && typeof v === 'object' && 'targetPct' in (v as object)) {
      const t = v as { targetPct?: unknown; minPct?: unknown; maxPct?: unknown }
      out[k] = {
        targetPct: clampPct(num(t.targetPct)),
        minPct: t.minPct == null ? null : clampPct(num(t.minPct)),
        maxPct: t.maxPct == null ? null : clampPct(num(t.maxPct)),
      }
    }
  }
  return out
}

export function num(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string') {
    const v = Number(n)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

export function toMoney(n: number): number {
  return Number.isFinite(n) ? n : 0
}

export function computePct(part: number, total: number): number {
  if (total <= 0) return 0
  return (part / total) * 100
}

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
  const db = await getDb()
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

export function applyFxToNativeAmounts(params: {
  marketValueNative: number | null
  unrealizedPlNative: number | null
  nativeCurrency: string
  displayCurrency: string
  matrix: FxRateMatrix
}): {
  marketValueDisplay: number | null
  unrealizedPlDisplay: number | null
  fxRateUsed: number | null
  fxUnavailable: boolean
} {
  const { marketValueNative, unrealizedPlNative, nativeCurrency, displayCurrency, matrix } = params
  const mv =
    marketValueNative == null
      ? { value: null as number | null, rate: null as number | null }
      : convertMoney(marketValueNative, nativeCurrency, displayCurrency, matrix)
  const pl =
    unrealizedPlNative == null
      ? { value: null as number | null, rate: null as number | null }
      : convertMoney(unrealizedPlNative, nativeCurrency, displayCurrency, matrix)
  return {
    marketValueDisplay: mv.value,
    unrealizedPlDisplay: pl.value,
    fxRateUsed: mv.rate,
    fxUnavailable: marketValueNative != null && mv.value == null,
  }
}
