import { z } from 'zod'

import type { UserAllocationTargetsJson } from '@/db/schema'

import { clampPct, num } from '@/lib/math'

export const uuid = z.string().uuid()
export const currencyCode = z.string().min(1).max(10)
export const pct = z.number().min(0).max(100)
export const idInput = z.object({ id: uuid })

export function parseTargetsJson(raw: unknown): UserAllocationTargetsJson {
  if (!raw || typeof raw !== 'object') return {}
  const out: UserAllocationTargetsJson = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = { targetPct: clampPct(v) }
      continue
    }
    if (v && typeof v === 'object' && 'targetPct' in v) {
      const t = v as { targetPct?: unknown; minPct?: unknown; maxPct?: unknown }
      out[k] = {
        targetPct: clampPct(num(t.targetPct)),
        minPct: t.minPct == null ? null : clampPct(num(t.minPct)),
        maxPct: t.maxPct == null ? null : clampPct(num(t.maxPct)),
      }
    }
  }
  return out
}
