import { fxRate } from '#/db/schema'
import { isFxCacheStale, loadFxRatesFromDb } from '#/lib/fx'

import { fetchYahooFxRates } from './fx-yahoo'

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

/** Worker-only: refresh global `fx_rate` at most once per TTL. */
export async function refreshFxRatesIfStale(): Promise<FxRefreshResult> {
  const db = await getDb()
  const { oldestFetchedAt, rows } = await loadFxRatesFromDb(db)

  if (rows.length > 0 && !isFxCacheStale(oldestFetchedAt)) {
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
