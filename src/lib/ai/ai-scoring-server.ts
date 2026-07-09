import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, investmentType, question, userApiKey } from '@/db/schema'
import { getAiScoringProvider } from '@/lib/ai/providers'
import { AiScoringError } from '@/lib/ai/types'
import type { AiScoringErrorCode } from '@/lib/ai/types'
import { logAiScoringError, logAiScoringUsage } from '@/lib/ai/usage-logging'
import { getDb, requireUserId } from '@/lib/db-server'
import { decryptSecret } from '@/lib/settings-encryption'
import { uuid } from '@/lib/server-utils'

const PROVIDER = 'claude' as const

const runBatchInput = z.object({ investmentIds: z.array(uuid).min(1).max(10) })

export type AiSuggestion = {
  questionId: string
  suggestedYes: boolean | null
  reasoning: string
  checkedAt: string
}

export type RunAiScoringResult =
  | { ok: true; suggestions: AiSuggestion[] }
  | { ok: false; code: AiScoringErrorCode | 'not_found' | 'no_questions' | 'missing_api_key' }

export type RunAiScoringBatchItem = {
  investmentId: string
  result: RunAiScoringResult
}

export const runAiScoringForInvestmentsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => runBatchInput.parse(data))
  .handler(async ({ data }): Promise<RunAiScoringBatchItem[]> => {
    const db = await getDb()
    const userId = await requireUserId()

    const results = new Map<string, RunAiScoringResult>()
    const eligible: Array<{
      investmentId: string
      investmentName: string
      fixedIncome: boolean
      questions: Array<{ id: string; prompt: string }>
    }> = []

    for (const investmentId of data.investmentIds) {
      const [inv] = await db
        .select({
          id: investment.id,
          name: investment.name,
          investmentTypeId: investment.investmentTypeId,
          fixedIncome: investmentType.fixedIncome,
        })
        .from(investment)
        .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
        .where(and(eq(investment.id, investmentId), eq(investment.userId, userId)))
        .limit(1)
      if (!inv) {
        results.set(investmentId, { ok: false, code: 'not_found' })
        continue
      }

      const activeQuestions = await db
        .select({ id: question.id, prompt: question.prompt })
        .from(question)
        .where(
          and(
            eq(question.investmentTypeId, inv.investmentTypeId),
            eq(question.userId, userId),
            eq(question.active, true),
          ),
        )
        .orderBy(asc(question.sortOrder), asc(question.createdAt))
      if (activeQuestions.length === 0) {
        results.set(investmentId, { ok: false, code: 'no_questions' })
        continue
      }

      eligible.push({
        investmentId,
        investmentName: inv.name,
        fixedIncome: inv.fixedIncome,
        questions: activeQuestions,
      })
    }

    const toBatchItems = (): RunAiScoringBatchItem[] =>
      data.investmentIds.map((investmentId) => ({
        investmentId,
        result: results.get(investmentId)!,
      }))

    if (eligible.length === 0) return toBatchItems()

    const [keyRow] = await db
      .select({ encryptedKey: userApiKey.encryptedKey })
      .from(userApiKey)
      .where(and(eq(userApiKey.userId, userId), eq(userApiKey.provider, PROVIDER)))
      .limit(1)
    if (!keyRow) {
      for (const e of eligible) results.set(e.investmentId, { ok: false, code: 'missing_api_key' })
      return toBatchItems()
    }

    const apiKey = await decryptSecret(keyRow.encryptedKey)
    const provider = getAiScoringProvider(PROVIDER)
    const eligibleIds = eligible.map((e) => e.investmentId)

    let batchResult
    try {
      batchResult = await provider.scoreInvestments({
        apiKey,
        investments: eligible.map((e) => ({
          investmentId: e.investmentId,
          investmentName: e.investmentName,
          fixedIncome: e.fixedIncome,
          questions: e.questions,
        })),
      })
    } catch (e) {
      const err =
        e instanceof AiScoringError ? e : new AiScoringError('unknown_error', String(e))
      logAiScoringError({
        provider: PROVIDER,
        model: 'unknown',
        investmentIds: eligibleIds,
        code: err.code,
        message: err.message,
      })
      for (const investmentId of eligibleIds) results.set(investmentId, { ok: false, code: err.code })
      return toBatchItems()
    }

    logAiScoringUsage({
      provider: PROVIDER,
      model: batchResult.model,
      investmentIds: eligibleIds,
      usage: batchResult.usage,
    })

    const checkedAt = new Date()
    const answersByInvestmentId = new Map(
      batchResult.perInvestment.map((p) => [p.investmentId, p.answers]),
    )

    for (const e of eligible) {
      const answers = answersByInvestmentId.get(e.investmentId) ?? []
      const suggestions: AiSuggestion[] = []

      for (const answer of answers) {
        const suggestedYes = answer.answer === 'unknown' ? null : answer.answer === 'yes'
        await db
          .insert(investmentAnswer)
          .values({
            investmentId: e.investmentId,
            questionId: answer.questionId,
            valueYes: null,
            aiSuggestedYes: suggestedYes,
            aiReasoning: answer.reasoning,
            aiCheckedAt: checkedAt,
          })
          .onConflictDoUpdate({
            target: [investmentAnswer.investmentId, investmentAnswer.questionId],
            set: {
              aiSuggestedYes: suggestedYes,
              aiReasoning: answer.reasoning,
              aiCheckedAt: checkedAt,
              updatedAt: checkedAt,
            },
          })
        suggestions.push({
          questionId: answer.questionId,
          suggestedYes,
          reasoning: answer.reasoning,
          checkedAt: checkedAt.toISOString(),
        })
      }

      results.set(e.investmentId, { ok: true, suggestions })
    }

    return toBatchItems()
  })
