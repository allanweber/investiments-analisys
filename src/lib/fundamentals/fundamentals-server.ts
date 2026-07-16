import { createServerFn } from '@tanstack/react-start'
import { and, eq, isNotNull } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, question } from '@/db/schema'
import type { QuestionMetricSpec } from '@/db/schema'
import {
  computeGrowthCheck,
  computeLevelCheck,
} from '@/lib/fundamentals/checks'
import type { MetricPoint } from '@/lib/fundamentals/checks'
import { getDb, requireUserId } from '@/lib/db-server'
import { ensureFundamentalsForTicker } from '@/lib/market-data/fundamentals-refresh'
import type { FundamentalYear } from '@/lib/market-data/providers/statusinvest'
import { uuid } from '@/lib/server-utils'

const runBatchInput = z.object({ investmentIds: z.array(uuid).min(1).max(10) })

export type ComputedSuggestion = {
  questionId: string
  suggestedYes: boolean | null
  reasoning: string
  checkedAt: string
}

export type RunComputedChecksResult =
  | { ok: true; suggestions: ComputedSuggestion[] }
  | {
      ok: false
      code: 'not_found' | 'no_questions' | 'no_ticker' | 'fetch_error'
    }

export type RunComputedChecksBatchItem = {
  investmentId: string
  result: RunComputedChecksResult
}

function normalizeLabel(v: string): string {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

/**
 * Fuzzy-matches an AI-extracted metric label (arbitrary free text) against whatever labels the
 * provider actually returned for this ticker — since we support any line item, not a fixed list,
 * exact string matches are rare; fall back to substring matching either direction.
 */
function findMetricLabel(
  availableLabels: readonly string[],
  wanted: string,
): string | null {
  const target = normalizeLabel(wanted)
  const exact = availableLabels.find((l) => normalizeLabel(l) === target)
  if (exact) return exact
  const substring = availableLabels.find((l) => {
    const norm = normalizeLabel(l)
    return norm.includes(target) || target.includes(norm)
  })
  return substring ?? null
}

function seriesFor(
  years: readonly FundamentalYear[],
  metricLabel: string,
): MetricPoint[] {
  return years.map((y) => ({
    fiscalYear: y.fiscalYear,
    value: y.metrics[metricLabel] ?? null,
  }))
}

function runMetric(
  spec: QuestionMetricSpec,
  years: readonly FundamentalYear[],
): { pass: boolean | null; detail: string } {
  const availableLabels = [
    ...new Set(years.flatMap((y) => Object.keys(y.metrics))),
  ]
  const matchedLabel = findMetricLabel(availableLabels, spec.metricLabel)
  if (!matchedLabel) {
    return {
      pass: null,
      detail: `Indicador "${spec.metricLabel}" não encontrado nos dados da empresa.`,
    }
  }

  const series = seriesFor(years, matchedLabel)
  return spec.mode === 'growth'
    ? computeGrowthCheck(
        series,
        spec.comparator,
        spec.threshold,
        spec.windowYears,
      )
    : computeLevelCheck(
        series,
        spec.comparator,
        spec.threshold,
        spec.windowYears,
      )
}

export const runComputedChecksForInvestmentsFn = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => runBatchInput.parse(data))
  .handler(async ({ data }): Promise<RunComputedChecksBatchItem[]> => {
    const db = await getDb()
    const userId = await requireUserId()

    const results = new Map<string, RunComputedChecksResult>()

    for (const investmentId of data.investmentIds) {
      const [inv] = await db
        .select({
          id: investment.id,
          name: investment.name,
          investmentTypeId: investment.investmentTypeId,
        })
        .from(investment)
        .where(
          and(eq(investment.id, investmentId), eq(investment.userId, userId)),
        )
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match (id/userId not found) makes it undefined at runtime
      if (!inv) {
        results.set(investmentId, { ok: false, code: 'not_found' })
        continue
      }

      const metricQuestions = await db
        .select({
          id: question.id,
          metricSpec: question.metricSpec,
        })
        .from(question)
        .where(
          and(
            eq(question.investmentTypeId, inv.investmentTypeId),
            eq(question.userId, userId),
            eq(question.active, true),
            eq(question.kind, 'metric'),
            isNotNull(question.metricSpec),
          ),
        )

      if (metricQuestions.length === 0) {
        results.set(investmentId, { ok: false, code: 'no_questions' })
        continue
      }

      const ticker = inv.name.trim()
      if (!ticker) {
        results.set(investmentId, { ok: false, code: 'no_ticker' })
        continue
      }

      let years: FundamentalYear[]
      try {
        years = await ensureFundamentalsForTicker(ticker)
      } catch (e) {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            scope: 'fundamentalsChecks',
            msg: 'ensureFundamentalsForTicker -> error',
            ticker,
            error: e instanceof Error ? e.message : String(e),
          }),
        )
        results.set(investmentId, { ok: false, code: 'fetch_error' })
        continue
      }

      const checkedAt = new Date()
      const suggestions: ComputedSuggestion[] = []

      for (const q of metricQuestions) {
        if (!q.metricSpec) continue
        const { pass, detail } = runMetric(q.metricSpec, years)

        await db
          .insert(investmentAnswer)
          .values({
            investmentId,
            questionId: q.id,
            valueYes: null,
            aiSuggestedYes: pass,
            aiReasoning: detail,
            aiCheckedAt: checkedAt,
          })
          .onConflictDoUpdate({
            target: [
              investmentAnswer.investmentId,
              investmentAnswer.questionId,
            ],
            set: {
              aiSuggestedYes: pass,
              aiReasoning: detail,
              aiCheckedAt: checkedAt,
              updatedAt: checkedAt,
            },
          })

        suggestions.push({
          questionId: q.id,
          suggestedYes: pass,
          reasoning: detail,
          checkedAt: checkedAt.toISOString(),
        })
      }

      results.set(investmentId, { ok: true, suggestions })
    }

    return data.investmentIds.map((investmentId) => ({
      investmentId,
      result: results.get(investmentId)!,
    }))
  })
