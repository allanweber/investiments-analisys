import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import * as schema from '#/db/schema'
import { marketRate } from '#/db/schema'

import { fetchBcbRates } from './providers/bcb'
import type { BcbRates } from './providers/bcb'

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

function logBcbRefresh(event: Record<string, unknown>) {
  const payload = { ts: new Date().toISOString(), scope: 'bcbRefresh', ...event }
  const line = JSON.stringify(payload)
  const level = typeof event.level === 'string' ? event.level : 'info'
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

function bcbTtlMs(): number {
  const raw = (process.env.BCB_REFRESH_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 24
  const hours = Number.isFinite(h) && h > 0 ? h : 24
  return hours * 60 * 60_000
}

/** Hardcoded fallback constants (rf_09 table). Used when fetch fails or cache is empty. */
export const BCB_FALLBACK: BcbRates = {
  cdiAnnual: 0.105,
  selicAnnual: 0.105,
  ipcaMonthly: [],
  ipcaAccumulated12m: 0.0483,
  igpmMonthly: [],
  igpmAccumulated12m: 0.035,
  asOf: null,
}

export type BcbRefreshResult = {
  refreshed: boolean
  skipped: boolean
  error?: string
}

async function isCacheStale(db: Db): Promise<boolean> {
  const rows = await db.select().from(marketRate).limit(1)
  if (rows.length === 0) return true
  const fetchedAt = rows[0]?.fetchedAt
  if (!(fetchedAt instanceof Date)) return true
  return Date.now() - fetchedAt.getTime() > bcbTtlMs()
}

async function upsertRates(db: Db, rates: BcbRates): Promise<void> {
  const now = new Date()

  const upsert = async (series: string, annual: number | null, monthly: number[] | null, accumulated12m: number | null) => {
    await db
      .insert(marketRate)
      .values({
        series,
        provider: 'bcb',
        annual: annual != null ? String(annual) : null,
        monthly: monthly != null ? monthly : null,
        accumulated12m: accumulated12m != null ? String(accumulated12m) : null,
        asOf: rates.asOf,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: [marketRate.series],
        set: {
          provider: 'bcb',
          annual: annual != null ? String(annual) : null,
          monthly: monthly != null ? monthly : null,
          accumulated12m: accumulated12m != null ? String(accumulated12m) : null,
          asOf: rates.asOf,
          fetchedAt: now,
        },
      })
  }

  await upsert('cdi', rates.cdiAnnual, null, null)
  await upsert('selic', rates.selicAnnual, null, null)
  await upsert('ipca', rates.ipcaAccumulated12m, [...rates.ipcaMonthly], rates.ipcaAccumulated12m)
  await upsert('igpm', rates.igpmAccumulated12m, [...rates.igpmMonthly], rates.igpmAccumulated12m)
}

/** Refresh the `market_rate` cache from BCB SGS when stale. */
export async function refreshBcbRatesIfStale(options?: {
  force?: boolean
  db?: Db
}): Promise<BcbRefreshResult> {
  const db = options?.db ?? (await getDb())

  if (!options?.force && !(await isCacheStale(db))) {
    logBcbRefresh({ level: 'info', msg: 'bcb -> skip (cache fresh)' })
    return { refreshed: false, skipped: true }
  }

  try {
    const rates = await fetchBcbRates()
    await upsertRates(db, rates)
    logBcbRefresh({ level: 'info', msg: 'bcb -> refreshed', asOf: rates.asOf?.toISOString() })
    return { refreshed: true, skipped: false }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'BCB refresh error'
    logBcbRefresh({ level: 'error', msg: 'bcb -> error', error: msg })
    return { refreshed: false, skipped: false, error: msg }
  }
}

function parseNumeric(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Load current indexer rates for display. Refreshes when cache empty/stale; falls back to constants. */
export async function ensureBcbRatesForDisplay(db: Db): Promise<BcbRates> {
  const stale = await isCacheStale(db)
  if (stale) {
    await refreshBcbRatesIfStale({ force: true, db })
  }

  try {
    const rows = await db.select().from(marketRate)
    const byId = new Map(rows.map((r) => [r.series, r]))

    const cdiRow = byId.get('cdi')
    const selicRow = byId.get('selic')
    const ipcaRow = byId.get('ipca')
    const igpmRow = byId.get('igpm')

    const cdiAnnual = parseNumeric(cdiRow?.annual) ?? BCB_FALLBACK.cdiAnnual
    const selicAnnual = parseNumeric(selicRow?.annual) ?? BCB_FALLBACK.selicAnnual
    const ipcaAccumulated12m = parseNumeric(ipcaRow?.accumulated12m) ?? BCB_FALLBACK.ipcaAccumulated12m
    const igpmAccumulated12m = parseNumeric(igpmRow?.accumulated12m) ?? BCB_FALLBACK.igpmAccumulated12m

    const ipcaMonthly = Array.isArray(ipcaRow?.monthly) ? (ipcaRow.monthly as number[]) : []
    const igpmMonthly = Array.isArray(igpmRow?.monthly) ? (igpmRow.monthly as number[]) : []

    const asOf = ipcaRow?.asOf instanceof Date ? ipcaRow.asOf : null

    return { cdiAnnual, selicAnnual, ipcaMonthly, ipcaAccumulated12m, igpmMonthly, igpmAccumulated12m, asOf }
  } catch {
    return BCB_FALLBACK
  }
}
