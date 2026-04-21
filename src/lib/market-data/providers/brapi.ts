import { asNumber, fetchJson } from '../http'
import type {
  MarketQuote,
  MarketQuoteInput,
  QuoteFetchResult,
  QuoteProvider,
} from '../types'

function isMarketDataLogEnabled(): boolean {
  const v = (process.env.MARKET_DATA_LOG ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

function logMarketDataProviderEvent(event: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    scope: 'marketData',
    provider: 'brapi',
    ...event,
  }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function pickFirstResult(payload: any): any | null {
  if (!payload || typeof payload !== 'object') return null
  const results = payload.results
  if (Array.isArray(results) && results.length > 0) return results[0]
  const r = payload.result
  if (Array.isArray(r) && r.length > 0) return r[0]
  return null
}

/** brapi.dev often expects the base ticker without Yahoo's `.SA` suffix. */
function brapiUrlSymbol(canonical: string): string {
  const s = canonical.trim()
  if (s.toUpperCase().endsWith('.SA')) return s.slice(0, -3)
  return s
}

function parseBrapiQuote(symbol: string, payload: unknown): MarketQuote | null {
  const first = pickFirstResult(payload as any)
  if (!first) return null
  const price =
    asNumber(first.regularMarketPrice) ?? asNumber(first.price) ?? asNumber(first.lastPrice)
  const currency = typeof first.currency === 'string' ? first.currency : null
  const logoUrl = typeof first.logourl === 'string' ? first.logourl : null
  const asOfRaw =
    first.regularMarketTime ?? first.regularMarketTimestamp ?? first.updatedAt
  const asOf =
    typeof asOfRaw === 'number'
      ? new Date(asOfRaw * 1000)
      : typeof asOfRaw === 'string'
        ? new Date(asOfRaw)
        : null

  return {
    provider: 'brapi',
    symbol,
    market: null,
    currency,
    logoUrl,
    price,
    asOf: asOf && !Number.isNaN(asOf.getTime()) ? asOf : null,
  }
}

async function fetchOne(canonicalSymbol: string): Promise<QuoteFetchResult> {
  const token = process.env.BRAPI_TOKEN
  if (!token || !token.trim()) {
    return {
      ok: false,
      code: 'PROVIDER_ERROR',
      message: 'Missing BRAPI_TOKEN (required)',
    }
  }
  const qs = `?token=${encodeURIComponent(token)}`
  const urlSymbol = brapiUrlSymbol(canonicalSymbol)
  const url = `https://brapi.dev/api/quote/${encodeURIComponent(urlSymbol)}${qs}`
  const safeUrl = `https://brapi.dev/api/quote/${encodeURIComponent(urlSymbol)}?token=[REDACTED]`
  try {
    if (isMarketDataLogEnabled()) {
      logMarketDataProviderEvent({
        level: 'info',
        msg: 'brapi -> http_request',
        request: { url: safeUrl, symbol: canonicalSymbol, urlSymbol },
      })
    }
    const payload = await fetchJson(url, { timeoutMs: 12_000 })
    if (isMarketDataLogEnabled()) {
      logMarketDataProviderEvent({
        level: 'info',
        msg: 'brapi -> http_response',
        request: { url: safeUrl, symbol: canonicalSymbol, urlSymbol },
        response: payload,
      })
    }
    const quote = parseBrapiQuote(canonicalSymbol, payload)
    if (!quote || quote.price == null) {
      return { ok: false, code: 'NOT_FOUND', message: 'Quote not found' }
    }
    return { ok: true, quote }
  } catch (e: any) {
    // Errors must always be logged.
    logMarketDataProviderEvent({
      level: 'error',
      msg: 'brapi -> http_error',
      request: { url: safeUrl, symbol: canonicalSymbol, urlSymbol },
      error: {
        message: typeof e?.message === 'string' ? e.message : 'Provider error',
        stack: typeof e?.stack === 'string' ? e.stack : undefined,
      },
    })
    return {
      ok: false,
      code: 'PROVIDER_ERROR',
      message: typeof e?.message === 'string' ? e.message : 'Provider error',
    }
  }
}

export const brapiProvider: QuoteProvider = {
  id: 'brapi',
  async fetchQuotes(inputs: readonly MarketQuoteInput[]): Promise<QuoteFetchResult[]> {
    // brapi has strict rate-limits; do sequential fetches in Phase 1.
    const out: QuoteFetchResult[] = []
    for (const input of inputs) {
      out.push(await fetchOne(input.symbol.trim()))
    }
    return out
  },
}

