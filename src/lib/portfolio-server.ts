import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { investment, investmentType, portfolioHolding } from '#/db/schema'
import { refreshMarketQuotesForInputs } from '#/lib/market-data/quote-refresh'
import type { MarketQuoteInput } from '#/lib/market-data'
import { isFixedIncomeTipo } from '#/lib/portfolio-valuation'
import { valuateHoldings } from '#/lib/valuation-pipeline'

import { normalizeHoldingCurrency } from '#/lib/math'
import { getDb, requireUserId, uuid, currencyCode, idInput } from '#/lib/server-utils'

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

const refreshPortfolioQuotesInput = z.object({
  displayCurrency: currencyCode.optional(),
})

export const refreshPortfolioQuotesFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => refreshPortfolioQuotesInput.parse(data))
  .handler(async () => {
    const db = await getDb()
    const userId = await requireUserId()

    const holdings = await db
      .select({
        ticker: portfolioHolding.ticker,
        holdingCurrency: portfolioHolding.currency,
        fixedIncome: investmentType.fixedIncome,
        investmentTypeName: investmentType.name,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .where(and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)))

    const inputs: MarketQuoteInput[] = holdings
      .filter((h) => !isFixedIncomeTipo(h.fixedIncome, h.investmentTypeName))
      .map((h) => ({
        symbol: (h.ticker ?? '').trim(),
        holdingCurrency: normalizeHoldingCurrency(h.holdingCurrency),
      }))
      .filter((i) => i.symbol.length > 0)

    const { stale } = await refreshMarketQuotesForInputs({
      actorId: userId,
      reason: 'immediate',
      inputs,
    })

    return { ok: true as const, providerStale: stale, refreshedCount: inputs.length }
  })

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

    const [existingHolding] = await db
      .select({ currency: portfolioHolding.currency })
      .from(portfolioHolding)
      .where(
        and(
          eq(portfolioHolding.userId, userId),
          eq(portfolioHolding.investmentId, data.investmentId),
        ),
      )
      .limit(1)

    let holdingCurrency = data.currency.trim().toUpperCase()
    if (existingHolding) {
      holdingCurrency = existingHolding.currency.trim().toUpperCase()
    } else if (ticker && !isFixedIncomeTipo(inv.fixedIncome, inv.investmentTypeName)) {
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
    z.object({ displayCurrency: currencyCode }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const displayCurrency = normalizeHoldingCurrency(data.displayCurrency) ?? 'BRL'

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
      .where(and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)))
      .orderBy(asc(investmentType.sortOrder), asc(investment.name))

    const { valuated, quotesStale, fxAsOf, fxStale, fxMissingPairs } =
      await valuateHoldings(db, rows, displayCurrency)

    const enriched = rows.map((r, i) => ({
      ...r,
      ...valuated[i],
      marketValue: valuated[i].marketValueDisplay,
      unrealizedPl: valuated[i].unrealizedPlDisplay,
    }))

    return {
      rows: enriched,
      quotesStale,
      displayCurrency,
      fxAsOf,
      fxStale,
      fxMissingPairs,
    }
  })
