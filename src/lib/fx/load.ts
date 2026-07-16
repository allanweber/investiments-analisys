import { asc } from 'drizzle-orm'

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '@/db/schema'
import { fxRate } from '@/db/schema'

import { buildRateMatrix } from './convert'
import type { FxRateMatrix, FxRateRow } from './convert'

type Db = NodePgDatabase<typeof schema>

function num(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string') {
    const v = Number(n)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

export function fxRefreshTtlMsFromEnv(): number {
  const raw = (process.env.FX_REFRESH_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 24
  const hours = Number.isFinite(h) && h > 0 ? h : 24
  return hours * 60 * 60_000
}

export async function loadFxRatesFromDb(db: Db): Promise<{
  rows: FxRateRow[]
  matrix: FxRateMatrix
  newestFetchedAt: Date | null
  oldestFetchedAt: Date | null
}> {
  const cached = await db.select().from(fxRate).orderBy(asc(fxRate.fetchedAt))
  const rows: FxRateRow[] = cached.map((r) => ({
    baseCurrency: r.baseCurrency,
    quoteCurrency: r.quoteCurrency,
    rate: num(r.rate),
  }))
  const matrix = buildRateMatrix(rows)

  let newestFetchedAt: Date | null = null
  let oldestFetchedAt: Date | null = null
  for (const r of cached) {
    const at = r.fetchedAt instanceof Date ? r.fetchedAt : null
    if (!at) continue
    if (!newestFetchedAt || at > newestFetchedAt) newestFetchedAt = at
    if (!oldestFetchedAt || at < oldestFetchedAt) oldestFetchedAt = at
  }

  return { rows, matrix, newestFetchedAt, oldestFetchedAt }
}

export function isFxCacheStale(
  oldestFetchedAt: Date | null,
  maxAgeMs?: number,
): boolean {
  const ttl = maxAgeMs ?? fxRefreshTtlMsFromEnv()
  if (!oldestFetchedAt) return true
  return Date.now() - oldestFetchedAt.getTime() > ttl
}
