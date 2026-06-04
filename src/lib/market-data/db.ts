import type { NodePgDatabase } from 'drizzle-orm/node-postgres'

import type * as schemaTypes from '@/db/schema'

export type MarketDb = NodePgDatabase<typeof schemaTypes>

export async function getMarketDataDb(): Promise<MarketDb> {
  try {
    return (await import('@/db')).db
  } catch {
    const { drizzle } = await import('drizzle-orm/node-postgres')
    const { Pool } = await import('pg')
    const dbSchema = await import('@/db/schema')
    const url = (process.env.DATABASE_URL ?? '').trim()
    if (!url) throw new Error('DATABASE_URL is required (non-empty).')
    const pool = new Pool({ connectionString: url })
    return drizzle(pool, { schema: dbSchema })
  }
}

export function makeLogger(scope: string): (event: Record<string, unknown>) => void {
  return function (event) {
    const payload = { ts: new Date().toISOString(), scope, ...event }
    const line = JSON.stringify(payload)
    const level = typeof event.level === 'string' ? event.level : 'info'
    if (level === 'error') console.error(line)
    else if (level === 'warn') console.warn(line)
    else console.info(line)
  }
}
