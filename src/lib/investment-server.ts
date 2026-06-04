import { createServerFn } from '@tanstack/react-start'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, investmentType } from '#/db/schema'
import { getDb, idInput, requireUserId, uuid } from '#/lib/server-utils'

const createInvInput = z.object({
  name: z.string().min(1).max(200),
  investmentTypeId: uuid,
})

export const createInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createInvInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({ id: investmentType.id })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    if (!t) return null

    const [row] = await db
      .insert(investment)
      .values({
        userId,
        name: data.name.trim(),
        investmentTypeId: data.investmentTypeId,
      })
      .returning()
    return row
  })

const createInvBulkInput = z.object({
  investmentTypeId: uuid,
  names: z.array(z.string().min(1).max(200)).min(1).max(100),
})

export const createInvestmentsBulkFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createInvBulkInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({ id: investmentType.id })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    if (!t) return { ok: false as const, code: 'BAD_TYPE' as const }

    const names = data.names.map((n) => n.trim()).filter(Boolean)
    if (names.length === 0) {
      return { ok: false as const, code: 'EMPTY' as const }
    }

    const inserted = await db.transaction(async (tx) =>
      tx
        .insert(investment)
        .values(
          names.map((name) => ({
            userId,
            name,
            investmentTypeId: data.investmentTypeId,
          })),
        )
        .returning({ id: investment.id }),
    )

    return { ok: true as const, count: inserted.length }
  })

const updateInvInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  investmentTypeId: uuid,
})

export const updateInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateInvInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [existing] = await db
      .select()
      .from(investment)
      .where(and(eq(investment.id, data.id), eq(investment.userId, userId)))
      .limit(1)
    if (!existing) return { ok: false as const, code: 'NOT_FOUND' as const }

    if (existing.investmentTypeId !== data.investmentTypeId) {
      const [aRow] = await db
        .select({ n: count() })
        .from(investmentAnswer)
        .where(eq(investmentAnswer.investmentId, data.id))
      if (aRow && Number(aRow.n) > 0) {
        return { ok: false as const, code: 'HAS_ANSWERS_TYPE_LOCKED' as const }
      }
    }

    const [t] = await db
      .select({ id: investmentType.id })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    if (!t) return { ok: false as const, code: 'BAD_TYPE' as const }

    const [row] = await db
      .update(investment)
      .set({
        name: data.name.trim(),
        investmentTypeId: data.investmentTypeId,
      })
      .where(and(eq(investment.id, data.id), eq(investment.userId, userId)))
      .returning()
    return { ok: true as const, row }
  })

export const deleteInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    await db
      .delete(investment)
      .where(and(eq(investment.id, data.id), eq(investment.userId, userId)))
    return { ok: true as const }
  })
