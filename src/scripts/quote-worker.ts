import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'

import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import { investment, investmentType, marketQuote, portfolioHolding } from '../db/schema'
import { refreshMarketQuotesForInputs } from '../lib/market-data/quote-refresh'

function loadEnvFiles() {
  // Prefer local overrides, then default env.
  const cwd = process.cwd()
  const candidates = ['.env.local', '.env']
  for (const name of candidates) {
    const p = path.join(cwd, name)
    if (!fs.existsSync(p)) continue
    dotenv.config({ path: p, override: false })
  }
}

loadEnvFiles()

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

function envNumber(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  if (!raw) return fallback
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

function envString(name: string): string | null {
  const raw = (process.env[name] ?? '').trim()
  return raw ? raw : null
}

function marketQuoteTtlMsFromEnv(): number {
  const raw = (process.env.MARKET_QUOTE_TTL_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 12
  const hours = Number.isFinite(h) && h > 0 ? h : 12
  return hours * 60 * 60_000
}

function normalizeHoldingCurrency(c: string | null | undefined): string | null {
  const t = (c ?? '').trim().toUpperCase()
  return t.length ? t : null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function logWorkerEvent(event: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    scope: 'quoteWorker',
    ...event,
  }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function errorToJson(e: unknown): Record<string, unknown> {
  if (!e || typeof e !== 'object') return { message: String(e) }
  const err = e as any
  const out: Record<string, unknown> = {
    message: typeof err.message === 'string' ? err.message : 'Error',
    name: typeof err.name === 'string' ? err.name : undefined,
    stack: typeof err.stack === 'string' ? err.stack : undefined,
  }
  const cause = err.cause
  if (cause) {
    out.cause = {
      message: typeof cause?.message === 'string' ? cause.message : String(cause),
      name: typeof cause?.name === 'string' ? cause.name : undefined,
      code: typeof cause?.code === 'string' ? cause.code : undefined,
      errno: typeof cause?.errno === 'number' ? cause.errno : undefined,
      syscall: typeof cause?.syscall === 'string' ? cause.syscall : undefined,
      address: typeof cause?.address === 'string' ? cause.address : undefined,
      port: typeof cause?.port === 'number' ? cause.port : undefined,
    }
  }
  return out
}

// Use the (int, int) advisory-lock overload to avoid bigint parameter issues
// across drivers/bindings.
const LOCK_KEY_1 = 8_392_144
const LOCK_KEY_2 = 221

async function tryAcquireLock(): Promise<boolean> {
  const rows = await db.execute(sql`select pg_try_advisory_lock(${LOCK_KEY_1}, ${LOCK_KEY_2}) as locked`)
  const locked = Boolean((rows as any)?.rows?.[0]?.locked)
  return locked
}

async function releaseLock(): Promise<void> {
  await db.execute(sql`select pg_advisory_unlock(${LOCK_KEY_1}, ${LOCK_KEY_2}) as unlocked`)
}

type SymbolEnt = { symbol: string; holdingCurrency: string | null }

async function loadDistinctSymbols(): Promise<SymbolEnt[]> {
  const rows = await db
    .select({
      symbol: portfolioHolding.ticker,
      holdingCurrency: portfolioHolding.currency,
      fixedIncome: investmentType.fixedIncome,
      typeName: investmentType.name,
    })
    .from(portfolioHolding)
    .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
    .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
    .where(
      and(
        isNotNull(portfolioHolding.ticker),
        sql`length(trim(${portfolioHolding.ticker})) > 0`,
        eq(investmentType.fixedIncome, false),
        sql`lower(trim(${investmentType.name})) != 'renda fixa'`,
      ),
    )

  const bySymbol = new Map<string, { holdingCurrency: string | null; preferBrl: boolean }>()
  for (const r of rows) {
    const sym = (r.symbol ?? '').trim()
    if (!sym) continue
    const cur = normalizeHoldingCurrency(r.holdingCurrency)
    const preferBrl = cur === 'BRL'
    const prev = bySymbol.get(sym)
    if (!prev) {
      bySymbol.set(sym, { holdingCurrency: cur, preferBrl })
      continue
    }
    if (preferBrl) {
      prev.holdingCurrency = 'BRL'
      prev.preferBrl = true
    } else if (!prev.holdingCurrency && cur) {
      prev.holdingCurrency = cur
    }
  }

  return [...bySymbol.entries()]
    .map(([symbol, v]) => ({ symbol, holdingCurrency: v.holdingCurrency }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol))
}

async function loadQuoteAges(symbols: readonly string[]): Promise<Map<string, Date | null>> {
  const out = new Map<string, Date | null>()
  if (symbols.length === 0) return out

  const rows = await db
    .select({ symbol: marketQuote.symbol, fetchedAt: marketQuote.fetchedAt })
    .from(marketQuote)
    .where(inArray(marketQuote.symbol, symbols))
  for (const r of rows) out.set(r.symbol, r.fetchedAt ?? null)
  return out
}

function computeStaleOrder(params: {
  nowMs: number
  ttlMs: number
  symbols: readonly SymbolEnt[]
  fetchedAtBySymbol: Map<string, Date | null>
}): SymbolEnt[] {
  const stale: Array<{ sym: SymbolEnt; fetchedAtMs: number }> = []
  for (const s of params.symbols) {
    const at = params.fetchedAtBySymbol.get(s.symbol) ?? null
    const atMs = at instanceof Date ? at.getTime() : 0
    const freshEnough = atMs > 0 && params.nowMs - atMs <= params.ttlMs
    if (freshEnough) continue
    stale.push({ sym: s, fetchedAtMs: atMs })
  }

  stale.sort((a, b) => {
    // NULL/0 first, then oldest first
    if (a.fetchedAtMs === 0 && b.fetchedAtMs !== 0) return -1
    if (a.fetchedAtMs !== 0 && b.fetchedAtMs === 0) return 1
    return a.fetchedAtMs - b.fetchedAtMs
  })

  return stale.map((x) => x.sym)
}

async function main() {
  const startedAt = Date.now()
  const ttlMs = marketQuoteTtlMsFromEnv()
  const staggerMs = envNumber('QUOTE_WORKER_STAGGER_MS', 1_000)
  const idleMs = envNumber('QUOTE_WORKER_IDLE_MS', 60_000)
  const healthPort = envNumber('QUOTE_WORKER_HEALTH_PORT', 0)

  let lastSweepAt: string | null = null
  let lastErrorAt: string | null = null
  let lastErrorMsg: string | null = null

  const rawDbUrl = process.env.DATABASE_URL
  const dbUrl = typeof rawDbUrl === 'string' ? rawDbUrl.trim() : ''
  logWorkerEvent({
    level: 'info',
    msg: 'env -> database_url',
    phase: 'startup',
    databaseUrl: {
      present: Boolean(dbUrl),
      length: dbUrl.length,
      startsWithQuote: dbUrl.startsWith('"') || dbUrl.startsWith("'"),
      endsWithQuote: dbUrl.endsWith('"') || dbUrl.endsWith("'"),
      preview: dbUrl ? `${dbUrl.slice(0, 24)}…` : null,
    },
  })

  if (!dbUrl) {
    throw new Error('DATABASE_URL is required (non-empty).')
  }

  try {
    await db.execute(sql`select 1 as ok`)
  } catch (e) {
    logWorkerEvent({
      level: 'error',
      msg: 'db -> connection_failed',
      phase: 'startup',
      error: errorToJson(e),
    })
    throw e
  }

  if (healthPort > 0) {
    const server = http.createServer((req, res) => {
      if (!req.url || req.method !== 'GET') {
        res.statusCode = 404
        res.end()
        return
      }
      if (req.url !== '/health') {
        res.statusCode = 404
        res.end()
        return
      }
      res.setHeader('content-type', 'application/json; charset=utf-8')
      res.end(
        JSON.stringify({
          ok: true,
          startedAt: new Date(startedAt).toISOString(),
          lastSweepAt,
          lastErrorAt,
          lastErrorMsg,
        }),
      )
    })
    server.listen(healthPort, '0.0.0.0', () => {
      logWorkerEvent({ level: 'info', msg: 'health -> listening', port: healthPort })
    })
  }

  const locked = await tryAcquireLock()
  if (!locked) {
    logWorkerEvent({
      level: 'warn',
      msg: 'lock -> not_acquired (another worker active)',
      phase: 'startup',
    })
    // Stay alive but idle; this keeps container “healthy” while preventing double workers.
    // (Dokploy scaling mistakes become non-fatal.)
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await sleep(60_000)
    }
  }

  process.on('SIGTERM', () => {
    void releaseLock().finally(() => process.exit(0))
  })
  process.on('SIGINT', () => {
    void releaseLock().finally(() => process.exit(0))
  })

  logWorkerEvent({
    level: 'info',
    msg: 'worker -> started',
    ttlHours: Number((ttlMs / 3_600_000).toFixed(2)),
    staggerMs,
    idleMs,
    healthPort: healthPort > 0 ? healthPort : null,
  })

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const sweepStart = Date.now()
    try {
      const symbols = await loadDistinctSymbols()
      const symbolList = symbols.map((s) => s.symbol)
      const fetchedAtBySymbol = await loadQuoteAges(symbolList)
      const staleOrder = computeStaleOrder({
        nowMs: Date.now(),
        ttlMs,
        symbols,
        fetchedAtBySymbol,
      })

      lastSweepAt = new Date().toISOString()

      if (staleOrder.length === 0) {
        logWorkerEvent({
          level: 'info',
          msg: 'sweep -> idle (no stale symbols)',
          phase: 'sweep_summary',
          totals: { symbols: symbols.length, stale: 0 },
          elapsedMs: Date.now() - sweepStart,
        })
        await sleep(idleMs)
        continue
      }

      const next = staleOrder[0]!
      const sym = next.symbol
      const refreshStart = Date.now()
      const { stale } = await refreshMarketQuotesForInputs({
        actorId: 'quote-worker',
        reason: 'worker',
        inputs: [{ symbol: sym, holdingCurrency: next.holdingCurrency }],
      })
      logWorkerEvent({
        level: stale ? 'warn' : 'info',
        msg: 'symbol -> refreshed',
        phase: 'symbol',
        symbol: sym,
        holdingCurrency: next.holdingCurrency,
        providerStale: stale,
        elapsedMs: Date.now() - refreshStart,
      })

      logWorkerEvent({
        level: 'info',
        msg: 'sweep -> progress',
        phase: 'sweep_summary',
        totals: { symbols: symbols.length, stale: staleOrder.length },
        refreshed: { symbol: sym },
        elapsedMs: Date.now() - sweepStart,
      })

      await sleep(staggerMs)
    } catch (e: any) {
      lastErrorAt = new Date().toISOString()
      lastErrorMsg = typeof e?.message === 'string' ? e.message : 'Worker error'
      logWorkerEvent({
        level: 'error',
        msg: 'sweep -> error',
        phase: 'error',
        error: errorToJson(e),
        elapsedMs: Date.now() - sweepStart,
      })
      await sleep(idleMs)
    }
  }
}

void main().catch((e: any) => {
  logWorkerEvent({
    level: 'error',
    msg: 'worker -> fatal',
    phase: 'fatal',
    error: errorToJson(e),
  })
  process.exit(1)
})

