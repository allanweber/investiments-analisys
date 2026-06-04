import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, investmentType, question } from '#/db/schema'
import {
  compareInvestmentsByRank,
  computeScoreFromActiveQuestions,
  type InvestmentOverviewRow,
  loadInvestmentOverviewRows,
} from '#/lib/investment-scoring'
import { getDb, requireUserId, uuid } from '#/lib/server-utils'

export const DASHBOARD_TOP_PER_TYPE = 3

// ── Scoring ───────────────────────────────────────────────────────────────────

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

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
