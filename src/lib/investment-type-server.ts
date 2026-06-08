import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentType, question } from '@/db/schema'
import { getDb, requireUserId } from '@/lib/db-server'
import { idInput, uuid } from '@/lib/server-utils'

export const listInvestmentTypesWithCounts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    const types = await db
      .select()
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))

    if (types.length === 0) return types.map((t) => ({ ...t, questionCount: 0 }))

    const typeIds = types.map((t) => t.id)
    const counts = await db
      .select({
        investmentTypeId: question.investmentTypeId,
        n: count().as('n'),
      })
      .from(question)
      .where(inArray(question.investmentTypeId, typeIds))
      .groupBy(question.investmentTypeId)

    const byType = new Map(counts.map((c) => [c.investmentTypeId, Number(c.n)]))
    return types.map((t) => ({
      ...t,
      questionCount: byType.get(t.id) ?? 0,
    }))
  },
)

const createTypeInput = z.object({
  name: z.string().min(1).max(200),
  sortOrder: z.number().int().optional(),
  fixedIncome: z.boolean().optional(),
})

export const createInvestmentTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createTypeInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [maxRow] = await db
      .select({
        m: sql<number>`COALESCE(MAX(${investmentType.sortOrder}), -1)`,
      })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
    const nextOrder = data.sortOrder ?? Number(maxRow?.m ?? -1) + 1

    const [row] = await db
      .insert(investmentType)
      .values({
        userId,
        name: data.name.trim(),
        fixedIncome: data.fixedIncome ?? false,
        sortOrder: nextOrder,
      })
      .returning()
    return row
  })

const updateTypeInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  sortOrder: z.number().int(),
  fixedIncome: z.boolean(),
})

export const updateInvestmentTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateTypeInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [updated] = await db
      .update(investmentType)
      .set({
        name: data.name.trim(),
        sortOrder: data.sortOrder,
        fixedIncome: data.fixedIncome,
      })
      .where(and(eq(investmentType.id, data.id), eq(investmentType.userId, userId)))
      .returning()
    return updated ?? null
  })

export const deleteInvestmentTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const [qRow] = await db
      .select({ n: count() })
      .from(question)
      .where(
        and(
          eq(question.investmentTypeId, data.id),
          eq(question.userId, userId),
        ),
      )

    const [iRow] = await db
      .select({ n: count() })
      .from(investment)
      .where(
        and(
          eq(investment.investmentTypeId, data.id),
          eq(investment.userId, userId),
        ),
      )

    const qn = qRow ? Number(qRow.n) : 0
    const inum = iRow ? Number(iRow.n) : 0
    if (qn > 0) return { ok: false as const, code: 'HAS_QUESTIONS' as const }
    if (inum > 0) return { ok: false as const, code: 'HAS_INVESTMENTS' as const }

    await db
      .delete(investmentType)
      .where(and(eq(investmentType.id, data.id), eq(investmentType.userId, userId)))
    return { ok: true as const }
  })

export const listInvestmentTypesOptionsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    return db
      .select({
        id: investmentType.id,
        name: investmentType.name,
        fixedIncome: investmentType.fixedIncome,
      })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))
  },
)
