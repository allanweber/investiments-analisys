/**
 * Abstraction over "scraping proxy" services (ScrapeOps, ScraperAPI, ...) used to route
 * outbound scraping requests (currently just StatusInvest) around Cloudflare's IP-reputation
 * blocking of datacenter/VPS IPs. Add a new provider by implementing `ScrapeProxyProvider` and
 * registering it in `PROVIDERS` — no caller code needs to change.
 */

export type ScrapeProxyProvider = {
  id: string
  /** Rewrites a target URL into one that routes through this proxy provider. */
  wrapUrl: (targetUrl: string, apiKey: string) => string
  /** Whether a failed proxy response (status + body) indicates the account is out of credits/quota. */
  isCreditsExhausted: (status: number, body: string) => boolean
}

const scrapeOpsProvider: ScrapeProxyProvider = {
  id: 'scrapeops',
  wrapUrl(targetUrl, apiKey) {
    return `https://proxy.scrapeops.io/v1/?api_key=${encodeURIComponent(apiKey)}&url=${encodeURIComponent(targetUrl)}`
  },
  isCreditsExhausted(status, body) {
    if (status === 402 || status === 429) return true
    const lower = body.toLowerCase()
    return (
      lower.includes('credit') ||
      lower.includes('quota') ||
      lower.includes('exceeded your plan') ||
      lower.includes('insufficient')
    )
  },
}

const PROVIDERS: Record<string, ScrapeProxyProvider> = {
  scrapeops: scrapeOpsProvider,
}

type ScrapeProxyConfig = { provider: ScrapeProxyProvider; apiKey: string }

/** Reads `SCRAPE_PROXY_API_KEY`/`SCRAPE_PROXY_PROVIDER` (default `scrapeops`); `null` if unconfigured. */
export function getScrapeProxyConfig(): ScrapeProxyConfig | null {
  const apiKey = (process.env.SCRAPE_PROXY_API_KEY ?? '').trim()
  if (!apiKey) return null
  const providerId = (process.env.SCRAPE_PROXY_PROVIDER ?? 'scrapeops')
    .trim()
    .toLowerCase()
  const provider = PROVIDERS[providerId]
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- PROVIDERS is Record<string,...> (no noUncheckedIndexedAccess), but providerId comes from an operator-set env var and can be any string, so provider is genuinely undefined at runtime for an unrecognized value
  if (!provider) return null
  return { provider, apiKey }
}

/** Wraps `targetUrl` through the configured proxy provider; returns it unchanged if unconfigured. */
export function wrapUrlWithProxy(targetUrl: string): string {
  const config = getScrapeProxyConfig()
  if (!config) return targetUrl
  return config.provider.wrapUrl(targetUrl, config.apiKey)
}

const HTTP_ERROR_RE = /^HTTP_(\d+): ([\s\S]*)$/

/** True if `e` (thrown by `fetchJson`) looks like the active proxy provider reporting exhausted credits/quota. */
export function isProxyCreditsExhaustedError(e: unknown): boolean {
  const config = getScrapeProxyConfig()
  if (!config) return false
  const message = e instanceof Error ? e.message : String(e)
  const match = HTTP_ERROR_RE.exec(message)
  if (!match) return false
  const status = Number(match[1])
  // both capture groups are mandatory (not optionally-quantified), so a successful match always populates them
  const body = match[2]
  return config.provider.isCreditsExhausted(status, body)
}
