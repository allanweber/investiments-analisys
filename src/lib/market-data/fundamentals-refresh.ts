import { eq } from 'drizzle-orm'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schema from '@/db/schema'
import { companyFundamental } from '@/db/schema'

import { getMarketDataDb, makeLogger } from './db'
import {
  DERIVED_NET_DEBT_EBITDA_LABEL,
  DERIVED_NET_DEBT_LABEL,
  fetchStatusInvestFiiCurrentIndicators,
  fetchStatusInvestFundamentals,
} from './providers/statusinvest'
import type { FundamentalYear } from './providers/statusinvest'
import { fetchYahooFundamentals } from './providers/yfinance'
import { isProxyCreditsExhaustedError } from './scrape-proxy'

/**
 * Metric labels `fetchYahooFundamentals` can actually supply — a fixed handful of fields (see
 * its own doc comment), not StatusInvest's full line-item coverage. Only these are eligible for
 * the per-metric fallback merge below; StatusInvest resolving the ticker but never carrying a
 * ROE/net-debt/etc. row for it (holdings and some sectors don't get every ratio) is common and
 * distinct from StatusInvest not resolving the ticker at all.
 */
const YAHOO_FALLBACK_METRIC_LABELS = [
  'Receita Líquida',
  'Lucro Líquido',
  'EBITDA',
  DERIVED_NET_DEBT_LABEL,
  'ROE',
  DERIVED_NET_DEBT_EBITDA_LABEL,
] as const

/** Labels with no non-null value in any year — candidates for the Yahoo fallback merge. */
function missingMetricLabels(years: readonly FundamentalYear[]): string[] {
  return YAHOO_FALLBACK_METRIC_LABELS.filter(
    (label) => !years.some((y) => y.metrics[label] != null),
  )
}

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

/**
 * Fills in `missingLabels` (StatusInvest never carried a value for these, in any year) from
 * Yahoo's `fetchYahooFundamentals`, writing only those specific (ticker, fiscalYear, metricLabel)
 * rows with provider `'yfinance'` — every other StatusInvest-sourced row is left untouched. Runs
 * after the StatusInvest upsert so a Yahoo value wins over a StatusInvest row that exists but is
 * null for that label/year (rather than racing it). Best-effort: Yahoo failing or having nothing
 * for these labels either just leaves the "não encontrado" outcome as-is — it doesn't fail the
 * refresh, which already committed the StatusInvest data.
 */
async function mergeYahooFallbackMetrics(
  db: Db,
  ticker: string,
  statusInvestYears: readonly FundamentalYear[],
  missingLabels: readonly string[],
): Promise<void> {
  let yahooYears: FundamentalYear[] = []
  try {
    yahooYears = await fetchYahooFundamentals(ticker)
  } catch (e: unknown) {
    log({
      level: 'warn',
      msg: 'fundamentals -> yahoo_fallback_failed',
      ticker,
      error: e instanceof Error ? e.message : 'Yahoo fetch error',
    })
    return
  }
  if (yahooYears.length === 0) return

  const yahooByYear = new Map(yahooYears.map((y) => [y.fiscalYear, y.metrics]))
  const fallbackYears: FundamentalYear[] = []
  for (const y of statusInvestYears) {
    const yahooMetrics = yahooByYear.get(y.fiscalYear)
    if (!yahooMetrics) continue
    const metrics: Record<string, number | null> = {}
    for (const label of missingLabels) {
      const value = yahooMetrics[label]
      if (value != null) metrics[label] = value
    }
    if (Object.keys(metrics).length > 0) fallbackYears.push({ fiscalYear: y.fiscalYear, metrics })
  }
  if (fallbackYears.length === 0) return

  try {
    await upsertYears(db, ticker, 'yfinance', fallbackYears)
    log({
      level: 'info',
      msg: 'fundamentals -> yahoo_fallback_merged',
      ticker,
      labels: fallbackYears.flatMap((y) => Object.keys(y.metrics)),
    })
  } catch (e: unknown) {
    log({
      level: 'error',
      msg: 'fundamentals -> yahoo_fallback_merge_error',
      ticker,
      error: e instanceof Error ? e.message : 'Fundamentals cache write error',
    })
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
 * first (has the full historical series for B3 tickers); falls back wholesale to Yahoo Finance
 * (`fundamentalsTimeSeries`, ~4-5 years) when StatusInvest can't resolve the ticker at all, and
 * falls back per-metric to Yahoo when StatusInvest resolves the ticker but never carries one of
 * `YAHOO_FALLBACK_METRIC_LABELS` for it (e.g. no ROE row for a holding company). See ADR-0001 —
 * never sent to an LLM.
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

  let years: FundamentalYear[] = []
  let provider = 'statusinvest'
  let lastError: string | undefined

  try {
    years = await fetchStatusInvestFundamentals(normalizedTicker)
  } catch (e: unknown) {
    lastError = e instanceof Error ? e.message : 'StatusInvest fetch error'
    if (isProxyCreditsExhaustedError(e)) {
      log({
        level: 'error',
        msg: 'fundamentals -> statusinvest_proxy_credits_exhausted',
        ticker: normalizedTicker,
        error: lastError,
      })
    } else {
      log({ level: 'warn', msg: 'fundamentals -> statusinvest_failed', ticker: normalizedTicker, error: lastError })
    }
  }

  // StatusInvest resolved the ticker (unlike the years.length===0 branch below, which means it
  // didn't) — remember that so the per-metric merge further down only runs on top of real
  // StatusInvest data, not on top of the wholesale Yahoo fallback (which already used Yahoo for
  // everything, so there is nothing left to merge in).
  const statusInvestResolved = years.length > 0

  if (years.length === 0) {
    try {
      years = await fetchYahooFundamentals(normalizedTicker)
      provider = 'yfinance'
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : 'Yahoo fetch error'
      log({ level: 'warn', msg: 'fundamentals -> yahoo_failed', ticker: normalizedTicker, error: lastError })
    }
  }

  // Neither StatusInvest's ações statements nor Yahoo's time series resolved anything for this
  // ticker as a stock — it may be a FII instead. StatusInvest exposes FII indicators (P/VP, ...)
  // as a current-value page, not a multi-year JSON grid, so this is a separate fetch, not another
  // branch of the ações path above. Only tried when ações never resolved the ticker at all, so an
  // ordinary stock refresh never pays for this extra request.
  let fiiIndicators: FundamentalYear[] = []
  if (!statusInvestResolved) {
    try {
      fiiIndicators = await fetchStatusInvestFiiCurrentIndicators(normalizedTicker)
    } catch (e: unknown) {
      log({
        level: 'warn',
        msg: 'fundamentals -> statusinvest_fii_failed',
        ticker: normalizedTicker,
        error: e instanceof Error ? e.message : 'StatusInvest FII fetch error',
      })
    }
  }

  if (years.length === 0 && fiiIndicators.length === 0) {
    log({ level: 'warn', msg: 'fundamentals -> no_data', ticker: normalizedTicker, error: lastError })
    return { refreshed: false, skipped: false, yearsFetched: 0, error: lastError }
  }

  if (years.length > 0) {
    try {
      await upsertYears(db, normalizedTicker, provider, years)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fundamentals cache write error'
      log({ level: 'error', msg: 'fundamentals -> error', ticker: normalizedTicker, error: msg })
      return { refreshed: false, skipped: false, yearsFetched: 0, error: msg }
    }
  }

  if (fiiIndicators.length > 0) {
    try {
      await upsertYears(db, normalizedTicker, 'statusinvest-fii', fiiIndicators)
    } catch (e: unknown) {
      log({
        level: 'error',
        msg: 'fundamentals -> statusinvest_fii_write_error',
        ticker: normalizedTicker,
        error: e instanceof Error ? e.message : 'Fundamentals cache write error',
      })
    }
  }

  if (statusInvestResolved) {
    const missing = missingMetricLabels(years)
    if (missing.length > 0) {
      await mergeYahooFallbackMetrics(db, normalizedTicker, years, missing)
    }
  }

  const yearsFetched = years.length + fiiIndicators.length
  log({ level: 'info', msg: 'fundamentals -> refreshed', ticker: normalizedTicker, provider, years: yearsFetched })
  return { refreshed: true, skipped: false, yearsFetched }
}

/**
 * Reads the cached fundamentals series for a ticker, refreshing first if stale/empty —
 * or unconditionally when `force` is set (e.g. an explicit "Verificar com IA" click, where
 * a silently-reused week-old cache reporting "não encontrado" is not an acceptable answer).
 */
export async function ensureFundamentalsForTicker(
  ticker: string,
  db?: Db,
  options?: { force?: boolean },
): Promise<FundamentalYear[]> {
  const normalizedTicker = ticker.trim().toUpperCase()
  const database = db ?? (await getMarketDataDb())

  await refreshFundamentalsIfStale(normalizedTicker, {
    db: database,
    force: options?.force,
  })

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
