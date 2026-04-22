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
  marketQuote,
  portfolioHolding,
  question,
  userAllocationProfile,
} from '#/db/schema'
import type { UserAllocationTargetsJson } from '#/db/schema'
import { refreshMarketQuotesForInputs } from '#/lib/market-data/quote-refresh'
import type { MarketQuoteInput } from '#/lib/market-data'

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
const currencyCode = z.string().min(1).max(10)
const pct = z.number().min(0).max(100)

function normalizeHoldingCurrency(c: string | null | undefined): string | null {
  const t = (c ?? '').trim().toUpperCase()
  return t.length ? t : null
}

/** DB flag and/or legacy tipos só identificáveis pelo nome (pt-BR seed: «Renda fixa»). */
function isFixedIncomeTipo(fixedIncome: boolean, typeName: string | null | undefined): boolean {
  if (fixedIncome) return true
  return (typeName ?? '').trim().toLowerCase() === 'renda fixa'
}

function clampPct(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(100, v))
}

function parseTargetsJson(raw: unknown): UserAllocationTargetsJson {
  if (!raw || typeof raw !== 'object') return {}
  const out: UserAllocationTargetsJson = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[k] = { targetPct: clampPct(v) }
      continue
    }
    if (v && typeof v === 'object' && 'targetPct' in (v as object)) {
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

function num(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n)) return n
  if (typeof n === 'string') {
    const v = Number(n)
    return Number.isFinite(v) ? v : 0
  }
  return 0
}

function toMoney(n: number): number {
  // Keep as JS number for UI; DB stores numerics as strings.
  return Number.isFinite(n) ? n : 0
}

function marketQuoteTtlMsFromEnv(): number {
  const raw = (process.env.MARKET_QUOTE_TTL_HOURS ?? '').trim()
  const h = raw ? Number(raw) : 12
  const hours = Number.isFinite(h) && h > 0 ? h : 12
  return hours * 60 * 60_000
}

async function loadQuotesFromDb(params: {
  inputs: MarketQuoteInput[]
  maxAgeMs?: number
}): Promise<{
  bySymbol: Map<
    string,
    { price: number | null; currency: string | null; fetchedAt: Date | null; logoUrl: string | null }
  >
  stale: boolean
}> {
  const db = await getDb()
  const maxAgeMs = params.maxAgeMs ?? marketQuoteTtlMsFromEnv()
  const now = Date.now()

  const symbols = [...new Set(params.inputs.map((i) => i.symbol.trim()).filter(Boolean))]
  if (symbols.length === 0) return { bySymbol: new Map(), stale: false }

  const cached = await db
    .select()
    .from(marketQuote)
    .where(inArray(marketQuote.symbol, symbols))
    .orderBy(asc(marketQuote.fetchedAt))

  const cacheBySymbol = new Map<string, (typeof cached)[number]>()
  for (const row of cached) {
    const prev = cacheBySymbol.get(row.symbol)
    if (!prev) {
      cacheBySymbol.set(row.symbol, row)
      continue
    }
    const prevAt = prev.fetchedAt instanceof Date ? prev.fetchedAt.getTime() : 0
    const at = row.fetchedAt instanceof Date ? row.fetchedAt.getTime() : 0
    if (at >= prevAt) cacheBySymbol.set(row.symbol, row)
  }

  const freshEnough = (row: any) => {
    const at = row?.fetchedAt instanceof Date ? row.fetchedAt.getTime() : 0
    return at > 0 && now - at <= maxAgeMs
  }

  const anyStale = symbols.some((s) => {
    const row = cacheBySymbol.get(s)
    return !row || !freshEnough(row)
  })

  const bySymbol = new Map<
    string,
    { price: number | null; currency: string | null; fetchedAt: Date | null; logoUrl: string | null }
  >()
  for (const s of symbols) {
    const row = cacheBySymbol.get(s)
    bySymbol.set(s, {
      price: row?.price == null ? null : toMoney(num(row.price)),
      currency: row?.currency ?? null,
      fetchedAt: row?.fetchedAt ?? null,
      logoUrl: (row as any)?.logoUrl ?? null,
    })
  }
  return { bySymbol, stale: anyStale }
}

function computePct(part: number, total: number): number {
  if (total <= 0) return 0
  return (part / total) * 100
}

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
  fixedIncome: boolean
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
      fixedIncome: investmentType.fixedIncome,
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

// —— Phase 1: Portfolio / holdings / targets ——

export const listPortfolioCurrenciesFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    const rows = await db
      .select({ currency: portfolioHolding.currency })
      .from(portfolioHolding)
      .where(eq(portfolioHolding.userId, userId))
    const uniq = [...new Set(rows.map((r) => r.currency).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b),
    )
    return uniq
  },
)

const upsertHoldingInput = z.object({
  investmentId: uuid,
  ticker: z.string().trim().min(1).max(32).optional().nullable(),
  quantity: z.number().positive(),
  avgCost: z.number().nonnegative(),
  currency: currencyCode,
  broker: z.string().trim().max(200).optional().nullable(),
  lastOperationAt: z.string().datetime().optional().nullable(),
})

export const upsertPortfolioHoldingFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => upsertHoldingInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const [inv] = await db
      .select({
        id: investment.id,
        fixedIncome: investmentType.fixedIncome,
        investmentTypeName: investmentType.name,
      })
      .from(investment)
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .where(and(eq(investment.id, data.investmentId), eq(investment.userId, userId)))
      .limit(1)
    if (!inv) return { ok: false as const, code: 'NOT_FOUND' as const }

    const ticker = data.ticker?.trim() ? data.ticker.trim() : null

    // Renda fixa e similares: sem provedores de mercado.
    let holdingCurrency = data.currency.trim().toUpperCase()
    if (ticker && !isFixedIncomeTipo(inv.fixedIncome, inv.investmentTypeName)) {
      const normalizedUserCurrency = normalizeHoldingCurrency(holdingCurrency)
      try {
        const { bySymbol } = await refreshMarketQuotesForInputs({
          actorId: userId,
          reason: 'immediate',
          inputs: [{ symbol: ticker, holdingCurrency: normalizedUserCurrency }],
        })
        const inferred = normalizeHoldingCurrency(bySymbol.get(ticker)?.quote?.currency ?? null)
        if (inferred) holdingCurrency = inferred
      } catch {
        // If immediate refresh fails, still save the holding (worker will retry later).
      }
    }

    await db
      .insert(portfolioHolding)
      .values({
        userId,
        investmentId: data.investmentId,
        ticker,
        quantity: String(data.quantity),
        avgCost: String(data.avgCost),
        currency: holdingCurrency,
        broker: data.broker?.trim() ? data.broker.trim() : null,
        lastOperationAt: data.lastOperationAt ? new Date(data.lastOperationAt) : null,
      })
      .onConflictDoUpdate({
        target: [portfolioHolding.userId, portfolioHolding.investmentId],
        set: {
          ticker,
          quantity: String(data.quantity),
          avgCost: String(data.avgCost),
          currency: holdingCurrency,
          broker: data.broker?.trim() ? data.broker.trim() : null,
          lastOperationAt: data.lastOperationAt ? new Date(data.lastOperationAt) : null,
          updatedAt: sql`now()`,
        },
      })

    return { ok: true as const }
  })

export const deletePortfolioHoldingFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    await db
      .delete(portfolioHolding)
      .where(and(eq(portfolioHolding.userId, userId), eq(portfolioHolding.investmentId, data.id)))
    return { ok: true as const }
  })

export const listPortfolioHoldingsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ currency: currencyCode.optional().nullable() }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const whereCurrency = data.currency ? eq(portfolioHolding.currency, data.currency) : undefined

    const rows = await db
      .select({
        investmentId: portfolioHolding.investmentId,
        ticker: portfolioHolding.ticker,
        quantity: portfolioHolding.quantity,
        avgCost: portfolioHolding.avgCost,
        currency: portfolioHolding.currency,
        broker: portfolioHolding.broker,
        lastOperationAt: portfolioHolding.lastOperationAt,
        investmentName: investment.name,
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
        fixedIncome: investmentType.fixedIncome,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .where(
        and(
          eq(portfolioHolding.userId, userId),
          eq(investment.userId, userId),
          whereCurrency ?? sql`true`,
        ),
      )
      .orderBy(asc(investmentType.sortOrder), asc(investment.name))

    const tickers: MarketQuoteInput[] = rows
      .filter((r) => !isFixedIncomeTipo(r.fixedIncome, r.investmentTypeName))
      .map((r) => ({
        symbol: (r.ticker ?? '').trim(),
        holdingCurrency: r.currency ?? null,
      }))
      .filter((i) => i.symbol.length > 0)
    const { bySymbol, stale } = await loadQuotesFromDb({ inputs: tickers })

    const enriched = rows.map((r) => {
      const sym = (r.ticker ?? '').trim()
      const qty = toMoney(num(r.quantity))
      const avg = toMoney(num(r.avgCost))

      if (isFixedIncomeTipo(r.fixedIncome, r.investmentTypeName)) {
        const book = qty * avg
        return {
          ...r,
          quantity: qty,
          avgCost: avg,
          lastPrice: null as number | null,
          marketValue: book,
          unrealizedPl: 0,
          quoteFetchedAt: null as Date | null,
          quoteCurrency: null as string | null,
          quoteLogoUrl: null as string | null,
          quoteStatus: 'BOOK_VALUE' as const,
        }
      }

      const q = sym ? bySymbol.get(sym) : null
      const lastPrice = q?.price ?? null
      const marketValue = lastPrice == null ? null : qty * lastPrice
      const pl = lastPrice == null ? null : qty * (lastPrice - avg)
      return {
        ...r,
        quantity: qty,
        avgCost: avg,
        lastPrice,
        marketValue,
        unrealizedPl: pl,
        quoteFetchedAt: q?.fetchedAt ?? null,
        quoteCurrency: q?.currency ?? null,
        quoteLogoUrl: q?.logoUrl ?? null,
        quoteStatus:
          !r.ticker || !r.ticker.trim()
            ? ('MISSING_TICKER' as const)
            : lastPrice == null
              ? ('MISSING_QUOTE' as const)
              : ('OK' as const),
      }
    })

    return { rows: enriched, quotesStale: stale }
  })

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
    if (Math.abs(sum - 100) > 0.02) {
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

const portfolioOverviewInput = z.object({ currency: currencyCode.optional().nullable() })

export const loadPortfolioOverviewFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => portfolioOverviewInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const holdings = await db
      .select({
        currency: portfolioHolding.currency,
        ticker: portfolioHolding.ticker,
        quantity: portfolioHolding.quantity,
        avgCost: portfolioHolding.avgCost,
        investmentId: portfolioHolding.investmentId,
        investmentName: investment.name,
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
        fixedIncome: investmentType.fixedIncome,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .where(and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)))

    const currencies = [...new Set(holdings.map((h) => h.currency))].sort((a, b) =>
      a.localeCompare(b),
    )
    const selected =
      data.currency && currencies.includes(data.currency) ? data.currency : currencies[0] ?? null

    const scoped = selected ? holdings.filter((h) => h.currency === selected) : []

    const inputs: MarketQuoteInput[] = scoped
      .filter((r) => !isFixedIncomeTipo(r.fixedIncome, r.investmentTypeName))
      .map((r) => ({
        symbol: (r.ticker ?? '').trim(),
        holdingCurrency: r.currency ?? null,
      }))
      .filter((i) => i.symbol.length > 0)

    const { bySymbol, stale } = await loadQuotesFromDb({ inputs })

    const byType = new Map<
      string,
      {
        investmentTypeId: string
        investmentTypeName: string
        typeSortOrder: number
        marketValue: number
      }
    >()

    let total = 0
    let unrealizedPl = 0
    for (const r of scoped) {
      const qty = toMoney(num(r.quantity))
      const avg = toMoney(num(r.avgCost))

      if (isFixedIncomeTipo(r.fixedIncome, r.investmentTypeName)) {
        const mv = qty * avg
        total += mv
        const prev = byType.get(r.investmentTypeId)
        if (!prev) {
          byType.set(r.investmentTypeId, {
            investmentTypeId: r.investmentTypeId,
            investmentTypeName: r.investmentTypeName,
            typeSortOrder: r.typeSortOrder,
            marketValue: mv,
          })
        } else {
          prev.marketValue += mv
        }
        continue
      }

      const sym = (r.ticker ?? '').trim()
      const q = sym ? bySymbol.get(sym) : null
      const lastPrice = q?.price ?? null
      if (lastPrice == null) continue
      const mv = qty * lastPrice
      total += mv
      unrealizedPl += qty * (lastPrice - avg)
      const prev = byType.get(r.investmentTypeId)
      if (!prev) {
        byType.set(r.investmentTypeId, {
          investmentTypeId: r.investmentTypeId,
          investmentTypeName: r.investmentTypeName,
          typeSortOrder: r.typeSortOrder,
          marketValue: mv,
        })
      } else {
        prev.marketValue += mv
      }
    }

    const profileSelect = await db
      .select({ targets: userAllocationProfile.targets })
      .from(userAllocationProfile)
      .where(eq(userAllocationProfile.userId, userId))

    const targetsMap: UserAllocationTargetsJson =
      profileSelect.length > 0 ? parseTargetsJson(profileSelect[0].targets) : {}

    const targetsRows = await db
      .select({
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
      })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))

    const targets = targetsRows.map((t) => {
      const entry = targetsMap[t.investmentTypeId]
      const rawPct = entry === undefined ? 0 : entry.targetPct
      return {
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        typeSortOrder: t.typeSortOrder,
        targetPct: clampPct(num(rawPct)),
      }
    })

    const allocation = [...byType.values()]
      .sort((a, b) => a.typeSortOrder - b.typeSortOrder || a.investmentTypeName.localeCompare(b.investmentTypeName))
      .map((t) => ({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        marketValue: t.marketValue,
        currentPct: clampPct(computePct(t.marketValue, total)),
      }))

    const allocByTypeId = new Map(allocation.map((a) => [a.investmentTypeId, a]))
    const drift = targets
      .map((t) => {
        const current = allocByTypeId.get(t.investmentTypeId)?.currentPct ?? 0
        const delta = current - t.targetPct
        return {
          investmentTypeId: t.investmentTypeId,
          investmentTypeName: t.investmentTypeName,
          currentPct: current,
          targetPct: t.targetPct,
          delta,
          status:
            t.targetPct <= 0
              ? ('SEM_META' as const)
              : delta > 0.5
                ? ('ACIMA' as const)
                : delta < -0.5
                  ? ('ABAIXO' as const)
                  : ('EM_ALVO' as const),
        }
      })
      .sort((a, b) => {
        const sa = targets.find((t) => t.investmentTypeId === a.investmentTypeId)?.typeSortOrder ?? 0
        const sb = targets.find((t) => t.investmentTypeId === b.investmentTypeId)?.typeSortOrder ?? 0
        return sa - sb
      })

    const overviewRows = await loadInvestmentOverviewRows(userId)
    const byTypeId = new Map<string, InvestmentOverviewRow[]>()
    for (const r of overviewRows) {
      const list = byTypeId.get(r.investmentTypeId) ?? []
      list.push(r)
      byTypeId.set(r.investmentTypeId, list)
    }

    const suggestions = drift
      .filter((d) => d.targetPct > 0 && d.currentPct < d.targetPct)
      .map((d) => {
        const list = byTypeId.get(d.investmentTypeId) ?? []
        if (list.length === 0) return null
        const best = [...list].sort(compareInvestmentsByRank)[0]
        return {
          investmentTypeId: d.investmentTypeId,
          investmentTypeName: d.investmentTypeName,
          deltaPct: d.targetPct - d.currentPct,
          investmentId: best.id,
          investmentName: best.name,
          score: best.score,
        }
      })
      .filter(Boolean) as Array<{
      investmentTypeId: string
      investmentTypeName: string
      deltaPct: number
      investmentId: string
      investmentName: string
      score: number
    }>

    const targetTotal = targets.reduce((acc, t) => acc + t.targetPct, 0)
    const quoteFetchedAts = inputs
      .map((i) => bySymbol.get(i.symbol)?.fetchedAt?.getTime?.() ?? 0)
      .filter((t) => t > 0)
    const lastUpdatedAt =
      quoteFetchedAts.length === 0 ? null : new Date(Math.max(...quoteFetchedAts))

    return {
      currencies,
      currency: selected,
      quotesStale: stale,
      lastUpdatedAt,
      totals: {
        marketValue: total,
        targetTotalPct: clampPct(targetTotal),
        unrealizedPl,
      },
      allocation,
      targets,
      drift,
      suggestions,
    }
  })
