import { createServerFn } from '@tanstack/react-start'
import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentAnswer, investmentType } from '@/db/schema'
import { getDb, requireUserId } from '@/lib/db-server'
import { refreshMarketQuotesForInputs } from '@/lib/market-data/quote-refresh'
import { normalizeHoldingCurrency } from '@/lib/math'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { idInput, uuid } from '@/lib/server-utils'

/** B3-style tickers (end in a digit, no exchange suffix) resolve via brapi; others via yfinance. */
function looksLikeB3Ticker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase()
  return !t.includes('.') && /\d$/.test(t)
}

async function fetchTickerQuoteCurrency(
  userId: string,
  ticker: string,
  holdingCurrency: string | null,
): Promise<{ resolved: boolean; currency: string | null; stale: boolean }> {
  const { bySymbol, stale } = await refreshMarketQuotesForInputs({
    actorId: userId,
    reason: 'immediate',
    inputs: [{ symbol: ticker, holdingCurrency }],
  })
  const quote = bySymbol.get(ticker)?.quote
  if (!quote || quote.price == null || Number(quote.price) <= 0) {
    return { resolved: false, currency: null, stale }
  }
  return {
    resolved: true,
    currency: normalizeHoldingCurrency(quote.currency ?? null),
    stale: false,
  }
}

/**
 * Resolves a ticker to its quote currency. B3 tickers (e.g. PETR4) route to brapi via a BRL hint;
 * everything else routes to yfinance. Retries on transient provider failures (`stale` — e.g. brapi's
 * cold-request timeout/abort) before giving up, then falls back to the other provider so a
 * mis-guessed exchange still resolves. A `price` of null/0 counts as unresolved (VWRL 0-price case).
 */
async function resolveTickerCurrency(
  userId: string,
  ticker: string,
): Promise<{ resolved: boolean; currency: string | null }> {
  const primaryHint = looksLikeB3Ticker(ticker) ? 'BRL' : null
  try {
    // Try the primary provider, retrying on transient (stale) failures — not on a genuine miss.
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetchTickerQuoteCurrency(userId, ticker, primaryHint)
      if (r.resolved) return r
      if (!r.stale) break
    }
    // Fallback to the other provider (BRL ⇄ non-BRL routing) once.
    const fallback = await fetchTickerQuoteCurrency(
      userId,
      ticker,
      primaryHint === 'BRL' ? null : 'BRL',
    )
    return fallback
  } catch {
    return { resolved: false, currency: null }
  }
}

const createInvInput = z.object({
  name: z.string().min(1).max(200),
  ticker: z.string().trim().max(20).optional().nullable(),
  investmentTypeId: uuid,
  /** User-supplied override, used when quote-based currency resolution fails or disagrees. */
  currency: z.string().trim().max(10).optional().nullable(),
})

export const createInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createInvInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({
        id: investmentType.id,
        name: investmentType.name,
        fixedIncome: investmentType.fixedIncome,
      })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match (id/userId not found) makes it undefined at runtime
    if (!t) return { ok: false as const, code: 'BAD_TYPE' as const }

    const isFixed = isFixedIncomeTipo(t.fixedIncome, t.name)
    const ticker = data.ticker?.trim() ? data.ticker.trim() : null

    const manualCurrency = data.currency?.trim()
      ? normalizeHoldingCurrency(data.currency.trim())
      : null

    let currency: string | null = null
    if (isFixed) {
      // Renda fixa: ticker is optional free text, no Yahoo lookup; currency is BRL.
      currency = 'BRL'
    } else {
      if (!ticker)
        return { ok: false as const, code: 'MISSING_TICKER' as const }
      const { resolved, currency: resolvedCurrency } =
        await resolveTickerCurrency(userId, ticker)
      if (!resolved && !manualCurrency)
        return { ok: false as const, code: 'UNRESOLVED_TICKER' as const }
      // A manual override always wins — it's how the user unblocks tickers the quote
      // providers can't price (e.g. some European exchange listings) or corrects a wrong guess.
      currency = manualCurrency ?? resolvedCurrency
    }

    try {
      const [row] = await db
        .insert(investment)
        .values({
          userId,
          name: data.name.trim(),
          ticker,
          currency,
          investmentTypeId: data.investmentTypeId,
        })
        .returning()
      return { ok: true as const, row }
    } catch (e) {
      if (isUniqueViolation(e))
        return { ok: false as const, code: 'DUPLICATE_TICKER' as const }
      throw e
    }
  })

/** Postgres unique_violation (23505) — thrown when (userId, ticker) collides. */
function isUniqueViolation(e: unknown): boolean {
  if (typeof e !== 'object' || e == null) return false
  if ('code' in e && (e as { code?: string }).code === '23505') return true
  const cause = (e as { cause?: unknown }).cause
  return (
    typeof cause === 'object' &&
    cause != null &&
    'code' in cause &&
    (cause as { code?: string }).code === '23505'
  )
}

const updateInvInput = z.object({
  id: uuid,
  name: z.string().min(1).max(200),
  ticker: z.string().trim().max(20).optional().nullable(),
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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match (id/userId not found) makes it undefined at runtime
    if (!existing) return { ok: false as const, code: 'NOT_FOUND' as const }

    if (existing.investmentTypeId !== data.investmentTypeId) {
      const [aRow] = await db
        .select({ n: count() })
        .from(investmentAnswer)
        .where(eq(investmentAnswer.investmentId, data.id))
      // COUNT(*) with no GROUP BY always returns exactly one row
      if (Number(aRow.n) > 0) {
        return { ok: false as const, code: 'HAS_ANSWERS_TYPE_LOCKED' as const }
      }
    }

    const [t] = await db
      .select({
        id: investmentType.id,
        name: investmentType.name,
        fixedIncome: investmentType.fixedIncome,
      })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match (id/userId not found) makes it undefined at runtime
    if (!t) return { ok: false as const, code: 'BAD_TYPE' as const }

    const isFixed = isFixedIncomeTipo(t.fixedIncome, t.name)
    const ticker = data.ticker?.trim() ? data.ticker.trim() : null

    // Only re-run the Yahoo lookup when a non-fixed-income ticker actually changed.
    let currency: string | null = existing.currency
    if (isFixed) {
      currency = 'BRL'
    } else {
      if (!ticker)
        return { ok: false as const, code: 'MISSING_TICKER' as const }
      if (ticker !== existing.ticker || existing.currency == null) {
        const { resolved, currency: resolvedCurrency } =
          await resolveTickerCurrency(userId, ticker)
        if (!resolved)
          return { ok: false as const, code: 'UNRESOLVED_TICKER' as const }
        currency = resolvedCurrency
      }
    }

    try {
      const [row] = await db
        .update(investment)
        .set({
          name: data.name.trim(),
          ticker,
          currency,
          investmentTypeId: data.investmentTypeId,
        })
        .where(and(eq(investment.id, data.id), eq(investment.userId, userId)))
        .returning()
      return { ok: true as const, row }
    } catch (e) {
      if (isUniqueViolation(e))
        return { ok: false as const, code: 'DUPLICATE_TICKER' as const }
      throw e
    }
  })

const setActiveInput = z.object({ id: uuid, active: z.boolean() })

export const setInvestmentActiveFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => setActiveInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [row] = await db
      .update(investment)
      .set({ active: data.active })
      .where(and(eq(investment.id, data.id), eq(investment.userId, userId)))
      .returning()
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess; UPDATE ... RETURNING with a WHERE clause returns 0 rows if id/userId don't match, so row can be undefined at runtime
    if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
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
