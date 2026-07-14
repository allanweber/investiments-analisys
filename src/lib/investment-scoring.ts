import { asc, eq, inArray } from 'drizzle-orm'

import { investment, investmentAnswer, investmentType, question } from '@/db/schema'
import { getDb } from '@/lib/db-server'

export type ActiveQuestionScore = {
  score: number
  answeredActiveCount: number
  activeQuestionCount: number
}

/**
 * @param activeQuestionIds — IDs of active questions for the investment's type (order irrelevant)
 * @param answerByQuestionId — stored answers for this investment (`questionId` → Sim = true, Não = false); omit unanswered
 */
export function computeScoreFromActiveQuestions(
  activeQuestionIds: readonly string[],
  answerByQuestionId: ReadonlyMap<string, boolean>,
): ActiveQuestionScore {
  let score = 0
  let answeredActiveCount = 0
  for (const qId of activeQuestionIds) {
    const v = answerByQuestionId.get(qId)
    if (v === undefined) continue
    answeredActiveCount += 1
    score += v ? 1 : -1
  }
  return {
    score,
    answeredActiveCount,
    activeQuestionCount: activeQuestionIds.length,
  }
}

/** Ranking within a type: higher score first; tie-break by name (pt-BR locale). */
export function compareInvestmentsByRank(
  a: { score: number; name: string },
  b: { score: number; name: string },
): number {
  if (b.score !== a.score) return b.score - a.score
  return a.name.localeCompare(b.name, 'pt-BR')
}

export type InvestmentOverviewRow = {
  id: string
  name: string
  ticker: string | null
  currency: string | null
  investmentTypeId: string
  typeName: string
  typeSortOrder: number
  fixedIncome: boolean
  active: boolean
  score: number
  activeQuestionCount: number
  answeredActiveCount: number
  /** Most recent AI check across this investment's questions, if any has ever run. */
  lastAiCheckedAt: string | null
}

export async function loadInvestmentOverviewRows(userId: string): Promise<InvestmentOverviewRow[]> {
  const db = await getDb()
  const rows = await db
    .select({
      id: investment.id,
      name: investment.name,
      ticker: investment.ticker,
      currency: investment.currency,
      investmentTypeId: investment.investmentTypeId,
      typeName: investmentType.name,
      typeSortOrder: investmentType.sortOrder,
      fixedIncome: investmentType.fixedIncome,
      active: investment.active,
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
      aiCheckedAt: investmentAnswer.aiCheckedAt,
    })
    .from(investmentAnswer)
    .where(inArray(investmentAnswer.investmentId, invIds))

  const lastAiCheckedAtByInvestmentId = new Map<string, Date>()
  for (const a of answers) {
    if (!a.aiCheckedAt) continue
    const current = lastAiCheckedAtByInvestmentId.get(a.investmentId)
    if (!current || a.aiCheckedAt > current) {
      lastAiCheckedAtByInvestmentId.set(a.investmentId, a.aiCheckedAt)
    }
  }

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
      const v = ansMap.get(key)
      if (v != null) {
        answerForInv.set(q.id, v)
      }
    }
    const { score, answeredActiveCount, activeQuestionCount } =
      computeScoreFromActiveQuestions(
        activeQs.map((q) => q.id),
        answerForInv,
      )
    const lastAiCheckedAt = lastAiCheckedAtByInvestmentId.get(r.id)
    return {
      ...r,
      score,
      activeQuestionCount,
      answeredActiveCount,
      lastAiCheckedAt: lastAiCheckedAt ? lastAiCheckedAt.toISOString() : null,
    }
  })
}
