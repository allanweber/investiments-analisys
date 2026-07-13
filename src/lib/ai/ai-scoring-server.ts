import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, investmentType, question, userApiKey } from '@/db/schema'
import { classifyQuestionKind } from '@/lib/ai/classify-question-server'
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
      questions: Array<{ id: string; prompt: string; kind: string | null }>
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
        .select({ id: question.id, prompt: question.prompt, kind: question.kind })
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
      for (const e of eligible) {
        const hasNonMetric = e.questions.some((q) => q.kind !== 'metric')
        results.set(e.investmentId, hasNonMetric ? { ok: false, code: 'missing_api_key' } : { ok: true, suggestions: [] })
      }
      return toBatchItems()
    }

    const apiKey = await decryptSecret(keyRow.encryptedKey)

    // Silently classify any question the user has never had scored before (kind is null) —
    // never surfaced to the user, see schema.ts's `question.kind` doc comment.
    const unclassified = new Map<string, string>()
    for (const e of eligible) {
      for (const q of e.questions) {
        if (q.kind === null) unclassified.set(q.id, q.prompt)
      }
    }
    for (const [questionId, prompt] of unclassified) {
      const classification = await classifyQuestionKind({ apiKey, prompt })
      if (!classification) continue
      await db
        .update(question)
        .set({ kind: classification.kind, metricSpec: classification.metricSpec })
        .where(eq(question.id, questionId))
      for (const e of eligible) {
        const match = e.questions.find((item) => item.id === questionId)
        if (match) match.kind = classification.kind
      }
    }

    // Metric-kind questions are answered deterministically elsewhere (fundamentals-server.ts) —
    // never sent to the AI provider. Null-kind questions whose classification failed above are
    // treated as websearch (fail open rather than silently dropping the question).
    const aiEligible = eligible
      .map((e) => ({ ...e, questions: e.questions.filter((q) => q.kind !== 'metric') }))
      .filter((e) => {
        if (e.questions.length > 0) return true
        results.set(e.investmentId, { ok: true, suggestions: [] })
        return false
      })

    if (aiEligible.length === 0) return toBatchItems()

    const provider = getAiScoringProvider(PROVIDER)
    const eligibleIds = aiEligible.map((e) => e.investmentId)

    let batchResult
    try {
      batchResult = await provider.scoreInvestments({
        apiKey,
        investments: aiEligible.map((e) => ({
          investmentId: e.investmentId,
          investmentName: e.investmentName,
          fixedIncome: e.fixedIncome,
          questions: e.questions.map((q) => ({ id: q.id, prompt: q.prompt })),
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

    for (const e of aiEligible) {
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
