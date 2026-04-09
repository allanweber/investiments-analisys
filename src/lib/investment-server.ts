import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
  getDefaultQuestionsForTypeName,
  hasDefaultQuestionPackForTypeName,
  normalizeQuestionPrompt,
} from '#/db/default-question-bank'
import {
  compareInvestmentsByRank,
  computeScoreFromActiveQuestions,
} from '#/lib/investment-scoring'
import {
  investment,
  investmentAnswer,
  investmentType,
  question,
} from '#/db/schema'

/** Avoid top-level `#/db` / `auth` imports so client chunks do not bundle `pg`. */
async function getDb() {
  return (await import('#/db')).db
}

async function requireUserId(): Promise<string> {
  const request = getRequest()
  const { getAuth } = await import('#/lib/auth')
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  const id = session?.user?.id
  if (!id) throw new Error('UNAUTHORIZED')
  return id
}

const uuid = z.string().uuid()

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
        sortOrder: nextOrder,
      })
      .returning()
    return row
  })

const updateTypeInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  sortOrder: z.number().int(),
})

export const updateInvestmentTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateTypeInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [updated] = await db
      .update(investmentType)
      .set({ name: data.name.trim(), sortOrder: data.sortOrder })
      .where(and(eq(investmentType.id, data.id), eq(investmentType.userId, userId)))
      .returning()
    return updated ?? null
  })

const idInput = z.object({ id: uuid })

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

const listQuestionsInput = z.object({ typeId: uuid })

export const listQuestionsForTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => listQuestionsInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const typeRow = await db
      .select({ id: investmentType.id, name: investmentType.name })
      .from(investmentType)
      .where(
        and(eq(investmentType.id, data.typeId), eq(investmentType.userId, userId)),
      )
      .limit(1)

    if (typeRow.length === 0) return { type: null, questions: [] as const }

    const questions = await db
      .select()
      .from(question)
      .where(
        and(eq(question.investmentTypeId, data.typeId), eq(question.userId, userId)),
      )
      .orderBy(asc(question.sortOrder), asc(question.createdAt))

    return { type: typeRow[0], questions }
  })

const createQuestionInput = z.object({
  investmentTypeId: uuid,
  prompt: z.string().min(1).max(2000),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})

export const createQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createQuestionInput.parse(data))
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

    const [maxRow] = await db
      .select({
        m: sql<number>`COALESCE(MAX(${question.sortOrder}), -1)`,
      })
      .from(question)
      .where(eq(question.investmentTypeId, data.investmentTypeId))

    const order = data.sortOrder ?? Number(maxRow?.m ?? -1) + 1

    const [row] = await db
      .insert(question)
      .values({
        userId,
        investmentTypeId: data.investmentTypeId,
        prompt: data.prompt.trim(),
        sortOrder: order,
        active: data.active ?? true,
      })
      .returning()
    return row
  })

const updateQuestionInput = z.object({
  id: uuid,
  prompt: z.string().min(1).max(2000),
  sortOrder: z.number().int(),
  active: z.boolean(),
})

export const updateQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateQuestionInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [row] = await db
      .update(question)
      .set({
        prompt: data.prompt.trim(),
        sortOrder: data.sortOrder,
        active: data.active,
      })
      .where(and(eq(question.id, data.id), eq(question.userId, userId)))
      .returning()
    return row ?? null
  })

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [aRow] = await db
      .select({ n: count() })
      .from(investmentAnswer)
      .where(eq(investmentAnswer.questionId, data.id))

    if (aRow && Number(aRow.n) > 0) {
      return { ok: false as const, code: 'HAS_ANSWERS' as const }
    }

    await db
      .delete(question)
      .where(and(eq(question.id, data.id), eq(question.userId, userId)))
    return { ok: true as const }
  })

export type InvestmentOverviewRow = {
  id: string
  name: string
  investmentTypeId: string
  typeName: string
  typeSortOrder: number
  score: number
  activeQuestionCount: number
  answeredActiveCount: number
}

/** Shared: investments with score / counts for ranking and dashboard. */
export async function loadInvestmentOverviewRows(
  userId: string,
): Promise<InvestmentOverviewRow[]> {
  const db = await getDb()
  const rows = await db
    .select({
      id: investment.id,
      name: investment.name,
      investmentTypeId: investment.investmentTypeId,
      typeName: investmentType.name,
      typeSortOrder: investmentType.sortOrder,
    })
    .from(investment)
    .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
    .where(eq(investment.userId, userId))
    .orderBy(asc(investmentType.sortOrder), asc(investment.name))

  if (rows.length === 0) return []

  const invIds = rows.map((r) => r.id)
  const answers = await db
    .select({
      investmentId: investmentAnswer.investmentId,
      questionId: investmentAnswer.questionId,
      valueYes: investmentAnswer.valueYes,
    })
    .from(investmentAnswer)
    .where(inArray(investmentAnswer.investmentId, invIds))

  const questions = await db
    .select()
    .from(question)
    .where(eq(question.userId, userId))

  const qByType = new Map<string, typeof questions>()
  for (const qrow of questions) {
    const list = qByType.get(qrow.investmentTypeId) ?? []
    list.push(qrow)
    qByType.set(qrow.investmentTypeId, list)
  }

  const ansKey = (i: string, q: string) => `${i}:${q}`
  const ansMap = new Map(
    answers.map((a) => [ansKey(a.investmentId, a.questionId), a.valueYes]),
  )

  return rows.map((r) => {
    const typeQs = qByType.get(r.investmentTypeId) ?? []
    const activeQs = typeQs.filter((q) => q.active)
    const answerForInv = new Map<string, boolean>()
    for (const q of activeQs) {
      const key = ansKey(r.id, q.id)
      if (ansMap.has(key)) {
        answerForInv.set(q.id, ansMap.get(key)!)
      }
    }
    const { score, answeredActiveCount, activeQuestionCount } =
      computeScoreFromActiveQuestions(
        activeQs.map((q) => q.id),
        answerForInv,
      )
    return {
      ...r,
      score,
      activeQuestionCount,
      answeredActiveCount,
    }
  })
}

/** Investimentos + métricas para lista / ranking */
export const listInvestmentsOverviewFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const userId = await requireUserId()
    const enriched = await loadInvestmentOverviewRows(userId)

    const byType = new Map<string, InvestmentOverviewRow[]>()
    for (const row of enriched) {
      const list = byType.get(row.investmentTypeId) ?? []
      list.push(row)
      byType.set(row.investmentTypeId, list)
    }

    const withRank: Array<InvestmentOverviewRow & { position: number }> = []
    for (const [, list] of byType) {
      const sorted = [...list].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        return a.name.localeCompare(b.name, 'pt-BR')
      })
      sorted.forEach((item, idx) => {
        withRank.push({ ...item, position: idx + 1 })
      })
    }

    return withRank
  },
)

export const DASHBOARD_TOP_PER_TYPE = 3

export const getDashboardHighlightsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    const types = await db
      .select({
        id: investmentType.id,
        name: investmentType.name,
        sortOrder: investmentType.sortOrder,
      })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))

    const enriched = await loadInvestmentOverviewRows(userId)
    const byTypeId = new Map<string, InvestmentOverviewRow[]>()
    for (const row of enriched) {
      const list = byTypeId.get(row.investmentTypeId) ?? []
      list.push(row)
      byTypeId.set(row.investmentTypeId, list)
    }

    return {
      groups: types.map((t) => {
        const list = byTypeId.get(t.id) ?? []
        const sorted = [...list].sort(compareInvestmentsByRank)
        const top = sorted.slice(0, DASHBOARD_TOP_PER_TYPE).map((r) => ({
          id: r.id,
          name: r.name,
          score: r.score,
        }))
        return {
          typeId: t.id,
          typeName: t.name,
          top,
        }
      }),
    }
  },
)

const restoreDefaultsInput = z.object({ typeId: uuid })

export const restoreDefaultQuestionsForTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => restoreDefaultsInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({
        id: investmentType.id,
        name: investmentType.name,
      })
      .from(investmentType)
      .where(
        and(eq(investmentType.id, data.typeId), eq(investmentType.userId, userId)),
      )
      .limit(1)

    if (!t) return { ok: false as const, code: 'NOT_FOUND' as const }

    if (!hasDefaultQuestionPackForTypeName(t.name)) {
      return { ok: false as const, code: 'NO_PACK' as const }
    }

    const bankPrompts = getDefaultQuestionsForTypeName(t.name)
    const existing = await db
      .select({ prompt: question.prompt })
      .from(question)
      .where(
        and(eq(question.investmentTypeId, data.typeId), eq(question.userId, userId)),
      )

    const seenNorm = new Set(
      existing.map((e) => normalizeQuestionPrompt(e.prompt)),
    )

    const [maxRow] = await db
      .select({
        m: sql<number>`COALESCE(MAX(${question.sortOrder}), -1)`,
      })
      .from(question)
      .where(eq(question.investmentTypeId, data.typeId))

    let nextOrder = Number(maxRow?.m ?? -1)
    let inserted = 0

    for (const prompt of bankPrompts) {
      const norm = normalizeQuestionPrompt(prompt)
      if (seenNorm.has(norm)) continue
      nextOrder += 1
      await db.insert(question).values({
        userId,
        investmentTypeId: data.typeId,
        prompt,
        sortOrder: nextOrder,
        active: true,
      })
      seenNorm.add(norm)
      inserted += 1
    }

    return { ok: true as const, inserted }
  })

export const listInvestmentTypesOptionsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    return db
      .select({ id: investmentType.id, name: investmentType.name })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))
  },
)

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

const scoringLoadInput = z.object({ investmentId: uuid })

export const loadInvestmentScoringFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => scoringLoadInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [inv] = await db
      .select({
        id: investment.id,
        name: investment.name,
        investmentTypeId: investment.investmentTypeId,
        typeName: investmentType.name,
      })
      .from(investment)
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .where(and(eq(investment.id, data.investmentId), eq(investment.userId, userId)))
      .limit(1)

    if (!inv) return null

    const activeQs = await db
      .select()
      .from(question)
      .where(
        and(
          eq(question.investmentTypeId, inv.investmentTypeId),
          eq(question.userId, userId),
          eq(question.active, true),
        ),
      )
      .orderBy(asc(question.sortOrder), asc(question.createdAt))

    const answers = await db
      .select()
      .from(investmentAnswer)
      .where(eq(investmentAnswer.investmentId, data.investmentId))

    const answerByQ = new Map(answers.map((a) => [a.questionId, a.valueYes]))

    const { score: total } = computeScoreFromActiveQuestions(
      activeQs.map((q) => q.id),
      answerByQ,
    )

    return {
      investment: inv,
      questions: activeQs,
      answerByQuestionId: Object.fromEntries(answerByQ),
      total,
    }
  })

const saveScoringInput = z.object({
  investmentId: uuid,
  /** Uma entrada por pergunta ativa: `null` = não respondida (apaga linha na BD). */
  answers: z.array(
    z.object({
      questionId: uuid,
      valueYes: z.boolean().nullable(),
    }),
  ),
})

export const saveInvestmentScoringFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => saveScoringInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [inv] = await db
      .select()
      .from(investment)
      .where(and(eq(investment.id, data.investmentId), eq(investment.userId, userId)))
      .limit(1)
    if (!inv) return { ok: false as const, code: 'NOT_FOUND' as const }

    const activeIds = await db
      .select({ id: question.id })
      .from(question)
      .where(
        and(
          eq(question.investmentTypeId, inv.investmentTypeId),
          eq(question.userId, userId),
          eq(question.active, true),
        ),
      )

    const allowed = new Set(activeIds.map((r) => r.id))
    if (data.answers.length !== allowed.size) {
      return { ok: false as const, code: 'INVALID_QUESTIONS' as const }
    }
    const seen = new Set<string>()
    for (const a of data.answers) {
      if (!allowed.has(a.questionId) || seen.has(a.questionId)) {
        return { ok: false as const, code: 'INVALID_QUESTIONS' as const }
      }
      seen.add(a.questionId)
    }

    for (const a of data.answers) {
      if (a.valueYes === null) {
        await db
          .delete(investmentAnswer)
          .where(
            and(
              eq(investmentAnswer.investmentId, data.investmentId),
              eq(investmentAnswer.questionId, a.questionId),
            ),
          )
        continue
      }
      await db
        .insert(investmentAnswer)
        .values({
          investmentId: data.investmentId,
          questionId: a.questionId,
          valueYes: a.valueYes,
        })
        .onConflictDoUpdate({
          target: [investmentAnswer.investmentId, investmentAnswer.questionId],
          set: {
            valueYes: a.valueYes,
            updatedAt: sql`now()`,
          },
        })
    }

    return { ok: true as const }
  })

export const getDashboardSummaryFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    const [tRow] = await db
      .select({ n: count() })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
    const [iRow] = await db
      .select({ n: count() })
      .from(investment)
      .where(eq(investment.userId, userId))
    const [aRow] = await db
      .select({ n: count() })
      .from(investmentAnswer)
      .innerJoin(investment, eq(investmentAnswer.investmentId, investment.id))
      .where(eq(investment.userId, userId))
    return {
      typeCount: Number(tRow?.n ?? 0),
      investmentCount: Number(iRow?.n ?? 0),
      answerCount: Number(aRow?.n ?? 0),
    }
  },
)
