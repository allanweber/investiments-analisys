import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { userAllocationProfile } from '@/db/schema'
import type { UserAllocationTargetsJson } from '@/db/schema'

import { clampPct, num } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { uuid, pct, parseTargetsJson } from '@/lib/server-utils'

export const listAllocationTargetsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const userId = await requireUserId()
  const rowsList = await db
    .select({ targets: userAllocationProfile.targets })
    .from(userAllocationProfile)
    .where(eq(userAllocationProfile.userId, userId))
  if (rowsList.length === 0) {
    return []
  }
  const map = parseTargetsJson(rowsList[0].targets)
  return Object.entries(map).map(([investmentTypeId, ent]) => ({
    investmentTypeId,
    targetPct: clampPct(num(ent.targetPct)),
    minPct: ent.minPct == null ? null : clampPct(num(ent.minPct)),
    maxPct: ent.maxPct == null ? null : clampPct(num(ent.maxPct)),
  }))
})

const upsertTargetInput = z.object({
  investmentTypeId: uuid,
  targetPct: pct,
  minPct: pct.optional().nullable(),
  maxPct: pct.optional().nullable(),
})

export const upsertAllocationTargetFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => upsertTargetInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const profileRows = await db
      .select({ targets: userAllocationProfile.targets })
      .from(userAllocationProfile)
      .where(eq(userAllocationProfile.userId, userId))

    let next: UserAllocationTargetsJson =
      profileRows.length > 0 ? { ...parseTargetsJson(profileRows[0].targets) } : {}
    next[data.investmentTypeId] = {
      targetPct: clampPct(data.targetPct),
      minPct: data.minPct == null ? null : clampPct(data.minPct),
      maxPct: data.maxPct == null ? null : clampPct(data.maxPct),
    }

    await db
      .insert(userAllocationProfile)
      .values({ userId, targets: next })
      .onConflictDoUpdate({
        target: [userAllocationProfile.userId],
        set: { targets: next, updatedAt: sql`now()` },
      })
    return { ok: true as const }
  })

const bulkTargetsInput = z.object({
  targets: z
    .array(
      z.object({
        investmentTypeId: uuid,
        targetPct: pct,
      }),
    )
    .max(200),
})

export const saveAllocationTargetsBulkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => bulkTargetsInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const sum = data.targets.reduce((acc, t) => acc + clampPct(t.targetPct), 0)
    if (sum > 100) {
      throw new Error('INVALID_ALLOCATION_SUM')
    }

    const targets: UserAllocationTargetsJson = {}
    for (const t of data.targets) {
      targets[t.investmentTypeId] = { targetPct: clampPct(t.targetPct) }
    }

    await db
      .insert(userAllocationProfile)
      .values({ userId, targets })
      .onConflictDoUpdate({
        target: [userAllocationProfile.userId],
        set: { targets, updatedAt: sql`now()` },
      })

    return { ok: true as const }
  })
