import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '@/db/schema'
import { companyFundamental } from '@/db/schema'

import { getMarketDataDb, makeLogger } from './db'
import { fetchStatusInvestFundamentals } from './providers/statusinvest'
import type { FundamentalYear } from './providers/statusinvest'
import { fetchYahooFundamentals } from './providers/yfinance'

type Db = NodePgDatabase<typeof schema>

const log = makeLogger('fundamentalsRefresh')

function fundamentalsTtlMs(): number {
  const raw = (process.env.FUNDAMENTALS_REFRESH_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 24 * 7
  const hours = Number.isFinite(h) && h > 0 ? h : 24 * 7
  return hours * 60 * 60_000
}

async function isCacheStale(db: Db, ticker: string): Promise<boolean> {
  const rows = await db
    .select({ fetchedAt: companyFundamental.fetchedAt })
    .from(companyFundamental)
    .where(eq(companyFundamental.ticker, ticker))
    .limit(1)
  if (rows.length === 0) return true
  const fetchedAt = rows[0]?.fetchedAt
  if (!(fetchedAt instanceof Date)) return true
  return Date.now() - fetchedAt.getTime() > fundamentalsTtlMs()
}

async function upsertYears(db: Db, ticker: string, provider: string, years: FundamentalYear[]): Promise<void> {
  const now = new Date()
  for (const y of years) {
    for (const [metricLabel, value] of Object.entries(y.metrics)) {
      await db
        .insert(companyFundamental)
        .values({
          ticker,
          fiscalYear: y.fiscalYear,
          metricLabel,
          provider,
          value: value == null ? null : String(value),
          fetchedAt: now,
        })
        .onConflictDoUpdate({
          target: [companyFundamental.ticker, companyFundamental.fiscalYear, companyFundamental.metricLabel],
          set: {
            provider,
            value: value == null ? null : String(value),
            fetchedAt: now,
          },
        })
    }
  }
}

export type FundamentalsRefreshResult = {
  refreshed: boolean
  skipped: boolean
  yearsFetched: number
  error?: string
}

/**
 * Refreshes the `company_fundamental` cache for one ticker when stale. Tries StatusInvest
 * first (has the full historical series for B3 tickers); falls back to Yahoo Finance
 * (`fundamentalsTimeSeries`, ~4-5 years) only when StatusInvest can't resolve the ticker at all.
 * See ADR-0001 — never sent to an LLM.
 */
export async function refreshFundamentalsIfStale(
  ticker: string,
  options?: { force?: boolean; db?: Db },
): Promise<FundamentalsRefreshResult> {
  const normalizedTicker = ticker.trim().toUpperCase()
  if (!normalizedTicker) return { refreshed: false, skipped: true, yearsFetched: 0 }

  const db = options?.db ?? (await getMarketDataDb())

  if (!options?.force && !(await isCacheStale(db, normalizedTicker))) {
    log({ level: 'info', msg: 'fundamentals -> skip (cache fresh)', ticker: normalizedTicker })
    return { refreshed: false, skipped: true, yearsFetched: 0 }
  }

  try {
    let years = await fetchStatusInvestFundamentals(normalizedTicker)
    let provider = 'statusinvest'
    if (years.length === 0) {
      years = await fetchYahooFundamentals(normalizedTicker)
      provider = 'yfinance'
    }
    if (years.length === 0) {
      log({ level: 'warn', msg: 'fundamentals -> no_data', ticker: normalizedTicker })
      return { refreshed: false, skipped: false, yearsFetched: 0 }
    }
    await upsertYears(db, normalizedTicker, provider, years)
    log({ level: 'info', msg: 'fundamentals -> refreshed', ticker: normalizedTicker, provider, years: years.length })
    return { refreshed: true, skipped: false, yearsFetched: years.length }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Fundamentals refresh error'
    log({ level: 'error', msg: 'fundamentals -> error', ticker: normalizedTicker, error: msg })
    return { refreshed: false, skipped: false, yearsFetched: 0, error: msg }
  }
}

/** Reads the cached fundamentals series for a ticker, refreshing first if stale/empty. */
export async function ensureFundamentalsForTicker(
  ticker: string,
  db?: Db,
): Promise<FundamentalYear[]> {
  const normalizedTicker = ticker.trim().toUpperCase()
  const database = db ?? (await getMarketDataDb())

  await refreshFundamentalsIfStale(normalizedTicker, { db: database })

  const rows = await database
    .select()
    .from(companyFundamental)
    .where(eq(companyFundamental.ticker, normalizedTicker))

  const byYear = new Map<number, Record<string, number | null>>()
  for (const r of rows) {
    const metrics = byYear.get(r.fiscalYear) ?? {}
    metrics[r.metricLabel] = r.value == null ? null : Number(r.value)
    byYear.set(r.fiscalYear, metrics)
  }

  return [...byYear.entries()]
    .map(([fiscalYear, metrics]) => ({ fiscalYear, metrics }))
    .sort((a, b) => a.fiscalYear - b.fiscalYear)
}

export type { FundamentalYear }
