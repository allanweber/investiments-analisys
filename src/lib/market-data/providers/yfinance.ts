import YahooFinance from 'yahoo-finance2'

import type {
  MarketQuote,
  MarketQuoteInput,
  QuoteFetchResult,
  QuoteProvider,
} from '../types'
import {
  DERIVED_NET_DEBT_EBITDA_LABEL,
  DERIVED_NET_DEBT_LABEL,
} from './statusinvest'
import type { FundamentalYear } from './statusinvest'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

/** Yahoo `quote()` practical batch size (library default is often ~100). */
const QUOTE_BATCH = 100

function isMarketDataLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function logMarketDataProviderEvent(event: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    scope: 'marketData',
    provider: 'yfinance',
    ...event,
  }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export async function fetchYahooLogoUrls(
  symbols: readonly string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>()
  for (const raw of symbols) {
    const symbol = raw.trim()
    if (!symbol) continue
    const req = { symbol, module: 'assetProfile' }
    try {
      if (isMarketDataLogEnabled()) {
        logMarketDataProviderEvent({
          level: 'info',
          msg: 'yfinance -> logo_request',
          request: req,
        })
      }
      const payload: any = await yahooFinance.quoteSummary(symbol, {
        modules: ['assetProfile'],
      })
      let logoUrl: string | null =
        typeof payload?.assetProfile?.logo_url === 'string'
          ? payload.assetProfile.logo_url
          : null

      // Fallback: build a logo URL from the company website using a favicon service.
      // (Yahoo often omits `logo_url` in assetProfile.)
      if (!logoUrl) {
        const website =
          typeof payload?.assetProfile?.website === 'string'
            ? payload.assetProfile.website
            : null
        if (website) {
          try {
            const host = new URL(website).hostname
            // Google's favicon service is widely available and doesn't require scraping.
            // We prefer sz=128 (good for UI usage); consumers can still display it smaller.
            if (host)
              logoUrl = `https://www.google.com/s2/favicons?sz=128&domain_url=${encodeURIComponent(
                `https://${host}`,
              )}`
          } catch {
            // ignore invalid website URLs
          }
        }
      }
      if (isMarketDataLogEnabled()) {
        logMarketDataProviderEvent({
          level: 'info',
          msg: 'yfinance -> logo_response',
          request: req,
          response: payload,
        })
      }
      out.set(symbol, logoUrl)
    } catch (e: any) {
      // Errors must always be logged.
      logMarketDataProviderEvent({
        level: 'error',
        msg: 'yfinance -> logo_error',
        request: req,
        error: {
          message:
            typeof e?.message === 'string' ? e.message : 'Provider error',
          stack: typeof e?.stack === 'string' ? e.stack : undefined,
        },
      })
      out.set(symbol, null)
    }
  }
  return out
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function parseYahooQuote(symbol: string, row: any): MarketQuote | null {
  if (!row || typeof row !== 'object') return null
  const price =
    asNumber(row.regularMarketPrice) ??
    asNumber(row.postMarketPrice) ??
    asNumber(row.preMarketPrice)
  const currency = typeof row.currency === 'string' ? row.currency : null
  const asOfRaw = row.regularMarketTime ?? row.regularMarketTimestamp
  const asOf =
    typeof asOfRaw === 'number'
      ? new Date(asOfRaw * 1000)
      : typeof asOfRaw === 'string'
        ? new Date(asOfRaw)
        : asOfRaw instanceof Date
          ? asOfRaw
          : null

  return {
    provider: 'yfinance',
    symbol,
    market:
      typeof row.fullExchangeName === 'string' ? row.fullExchangeName : null,
    currency,
    price,
    asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : null,
  }
}

function pickQuoteRow(
  obj: Record<string, any> | null | undefined,
  symbol: string,
): any | null {
  if (!obj || typeof obj !== 'object') return null
  if (obj[symbol]) return obj[symbol]
  const up = symbol.toUpperCase()
  const key = Object.keys(obj).find((k) => k.toUpperCase() === up)
  return key ? obj[key] : null
}

export const yfinanceProvider: QuoteProvider = {
  id: 'yfinance',
  async fetchQuotes(
    inputs: readonly MarketQuoteInput[],
  ): Promise<QuoteFetchResult[]> {
    if (inputs.length === 0) return []

    const out: QuoteFetchResult[] = []

    for (let start = 0; start < inputs.length; start += QUOTE_BATCH) {
      const slice = inputs.slice(start, start + QUOTE_BATCH)
      const unique = [
        ...new Set(slice.map((i) => i.symbol.trim()).filter(Boolean)),
      ]

      if (unique.length === 0) {
        for (const _ of slice) {
          out.push({ ok: false, code: 'NOT_FOUND', message: 'Missing symbol' })
        }
        continue
      }

      try {
        const req = { symbols: unique, options: { return: 'object' as const } }
        if (isMarketDataLogEnabled()) {
          logMarketDataProviderEvent({
            level: 'info',
            msg: 'yfinance -> request',
            request: req,
          })
        }
        const obj = (await yahooFinance.quote(unique, {
          return: 'object',
        })) as Record<string, any>
        if (isMarketDataLogEnabled()) {
          logMarketDataProviderEvent({
            level: 'info',
            msg: 'yfinance -> response',
            request: req,
            response: obj,
          })
        }

        for (const input of slice) {
          const sym = input.symbol.trim()
          if (!sym) {
            out.push({
              ok: false,
              code: 'NOT_FOUND',
              message: 'Missing symbol',
            })
            continue
          }
          const row = pickQuoteRow(obj, sym)
          const quote = parseYahooQuote(sym, row)
          if (!quote || quote.price == null) {
            out.push({
              ok: false,
              code: 'NOT_FOUND',
              message: 'Quote not found',
            })
          } else {
            out.push({ ok: true, quote })
          }
        }
      } catch (e: any) {
        // Errors must always be logged.
        logMarketDataProviderEvent({
          level: 'error',
          msg: 'yfinance -> error',
          request: { symbols: unique, options: { return: 'object' } },
          error: {
            message:
              typeof e?.message === 'string' ? e.message : 'Provider error',
            stack: typeof e?.stack === 'string' ? e.stack : undefined,
          },
        })
        const msg =
          typeof e?.message === 'string' ? e.message : 'Provider error'
        for (const _ of slice) {
          out.push({ ok: false, code: 'PROVIDER_ERROR', message: msg })
        }
      }
    }

    return out
  },
}

/**
 * B3 tickers always end in a digit (PETR4, VALE3, ITUB4, TAEE11, ...); US/other exchange
 * tickers on Yahoo never do (AAPL, MSFT, ...) — only B3 symbols need the `.SA` suffix.
 */
function yahooSymbolFor(ticker: string): string {
  const t = ticker.trim().toUpperCase()
  if (t.endsWith('.SA')) return t
  return /\d$/.test(t) ? `${t}.SA` : t
}

/**
 * Fallback fundamentals source (used only when StatusInvest can't resolve the ticker).
 * Yahoo's classic quoteSummary financial-statement modules are mostly empty since Nov 2024
 * (per yahoo-finance2's own warning) — `fundamentalsTimeSeries` is the maintained replacement,
 * but only covers the last ~4-5 fiscal years. Only exposes the handful of fields Yahoo's API
 * gives us (keyed with the same labels StatusInvest uses, so a question's metricLabel matches
 * either provider) — nowhere near StatusInvest's full line-item coverage.
 */
export async function fetchYahooFundamentals(
  ticker: string,
): Promise<FundamentalYear[]> {
  const symbol = yahooSymbolFor(ticker)
  const period1 = '2015-01-01'

  let financials: any[] = []
  let balanceSheet: any[] = []
  try {
    ;[financials, balanceSheet] = await Promise.all([
      yahooFinance.fundamentalsTimeSeries(symbol, {
        period1,
        type: 'annual',
        module: 'financials',
      }),
      yahooFinance.fundamentalsTimeSeries(symbol, {
        period1,
        type: 'annual',
        module: 'balance-sheet',
      }),
    ])
  } catch (e: any) {
    logMarketDataProviderEvent({
      level: 'error',
      msg: 'yfinance -> fundamentals_error',
      request: { symbol },
      error: {
        message: typeof e?.message === 'string' ? e.message : 'Provider error',
      },
    })
    return []
  }

  const byYear = (rows: any[]) => {
    const out = new Map<number, any>()
    for (const row of rows) {
      const date = row?.date instanceof Date ? row.date : new Date(row?.date)
      if (Number.isNaN(date.getTime())) continue
      out.set(date.getUTCFullYear(), row)
    }
    return out
  }

  const financialsByYear = byYear(financials)
  const balanceSheetByYear = byYear(balanceSheet)
  const years = [
    ...new Set([...financialsByYear.keys(), ...balanceSheetByYear.keys()]),
  ].sort()

  return years.map((fiscalYear) => {
    const f = financialsByYear.get(fiscalYear)
    const b = balanceSheetByYear.get(fiscalYear)
    const netIncome = asNumber(f?.netIncome)
    const equity = asNumber(b?.stockholdersEquity)
    const netDebt = asNumber(b?.netDebt)
    const ebitda = asNumber(f?.EBITDA)
    return {
      fiscalYear,
      metrics: {
        'Receita Líquida': asNumber(f?.totalRevenue),
        'Lucro Líquido': netIncome,
        EBITDA: ebitda,
        [DERIVED_NET_DEBT_LABEL]: netDebt,
        ROE: netIncome != null && equity ? (netIncome / equity) * 100 : null,
        [DERIVED_NET_DEBT_EBITDA_LABEL]:
          netDebt != null && ebitda ? netDebt / ebitda : null,
      },
    }
  })
}
