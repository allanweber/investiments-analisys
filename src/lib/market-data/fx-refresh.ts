import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '#/db/schema'
import { fxRate } from '#/db/schema'
import { findMissingFxPairs, isFxCacheStale, loadFxRatesFromDb } from '#/lib/fx'

import { fetchYahooFxRates } from './fx-yahoo'

type Db = NodePgDatabase<typeof schema>

async function getDb() {
  try {
    return (await import('#/db')).db
  } catch {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { Pool } = await import('pg')
    const schema = await import('#/db/schema')
    const url = (process.env.DATABASE_URL ?? '').trim()
    if (!url) throw new Error('DATABASE_URL is required (non-empty).')
    const pool = new Pool({ connectionString: url })
    return drizzle(pool, { schema: schema })
  }
}

function logFxRefresh(event: Record<string, unknown>) {
  const payload = { ts: new Date().toISOString(), scope: 'fxRefresh', ...event }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export type FxRefreshResult = {
  refreshed: boolean
  skipped: boolean
  pairsUpserted: number
  error?: string
}

/** Refresh global `fx_rate` (worker loop + server bootstrap when cache empty/stale). */
export async function refreshFxRatesIfStale(options?: {
  /** Bypass TTL when cache is empty or conversion pairs are missing. */
  force?: boolean
  db?: Db
}): Promise<FxRefreshResult> {
  const db = options?.db ?? (await getDb())
  const { oldestFetchedAt, rows } = await loadFxRatesFromDb(db)

  if (
    !options?.force &&
    rows.length > 0 &&
    !isFxCacheStale(oldestFetchedAt)
  ) {
    logFxRefresh({ level: 'info', msg: 'fx -> skip (cache fresh)', pairs: rows.length })
    return { refreshed: false, skipped: true, pairsUpserted: 0 }
  }

  try {
    const fetched = await fetchYahooFxRates()
    if (fetched.length === 0) {
      logFxRefresh({ level: 'warn', msg: 'fx -> no_rates_from_yahoo' })
      return { refreshed: false, skipped: false, pairsUpserted: 0, error: 'NO_RATES' }
    }

    const now = new Date()
    for (const row of fetched) {
      await db
        .insert(fxRate)
        .values({
          baseCurrency: row.baseCurrency,
          quoteCurrency: row.quoteCurrency,
          provider: 'yfinance',
          yahooSymbol: row.yahooSymbol,
          rate: String(row.rate),
          asOf: row.asOf,
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [fxRate.baseCurrency, fxRate.quoteCurrency],
          set: {
            provider: 'yfinance',
            yahooSymbol: row.yahooSymbol,
            rate: String(row.rate),
            asOf: row.asOf,
            fetchedAt: now,
          },
        })
    }

    logFxRefresh({
      level: 'info',
      msg: 'fx -> refreshed',
      pairsUpserted: fetched.length,
    })
    return { refreshed: true, skipped: false, pairsUpserted: fetched.length }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'FX refresh error'
    logFxRefresh({ level: 'error', msg: 'fx -> error', error: msg })
    return { refreshed: false, skipped: false, pairsUpserted: 0, error: msg }
  }
}

/**
 * Load FX matrix for display; refresh from Yahoo when table is empty, TTL expired,
 * or required conversion pairs are missing (e.g. first deploy before worker runs).
 */
export async function ensureFxRatesForDisplay(
  db: Db,
  nativeCurrencies: readonly string[],
  displayCurrency: string,
) {
  let loaded = await loadFxRatesFromDb(db)
  let missing = findMissingFxPairs(nativeCurrencies, displayCurrency, loaded.matrix)
  const cacheEmpty = loaded.rows.length === 0
  const cacheStale = isFxCacheStale(loaded.oldestFetchedAt)
  const needsRefresh = cacheEmpty || cacheStale || missing.length > 0

  if (needsRefresh) {
    logFxRefresh({
      level: 'info',
      msg: 'fx -> ensure_refresh',
      cacheEmpty,
      cacheStale,
      missingPairs: missing,
    })
    await refreshFxRatesIfStale({ force: cacheEmpty || missing.length > 0, db })
    loaded = await loadFxRatesFromDb(db)
    missing = findMissingFxPairs(nativeCurrencies, displayCurrency, loaded.matrix)
    if (missing.length > 0) {
      logFxRefresh({ level: 'warn', msg: 'fx -> still_missing_after_refresh', missingPairs: missing })
    }
  }

  return { ...loaded, fxMissingPairs: missing }
}
