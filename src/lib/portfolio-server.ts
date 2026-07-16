import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
  investment,
  investmentType,
  portfolioHolding,
  rendaFixaValuation,
} from '@/db/schema'
import { refreshMarketQuotesForInputs } from '@/lib/market-data/quote-refresh'
import type { MarketQuoteInput } from '@/lib/market-data'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { valuateHoldings } from '@/lib/valuation-pipeline'

import { normalizeHoldingCurrency } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { uuid, currencyCode, idInput } from '@/lib/server-utils'

export const listPortfolioCurrenciesFn = createServerFn({
  method: 'GET',
}).handler(async () => {
  const db = await getDb()
  const userId = await requireUserId()
  const rows = await db
    .select({ currency: investment.currency })
    .from(portfolioHolding)
    .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
    .where(
      and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)),
    )
  const uniq = [
    ...new Set(
      rows.map((r) => r.currency).filter((c): c is string => Boolean(c)),
    ),
  ].sort((a, b) => a.localeCompare(b))
  return uniq
})

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
        ticker: investment.ticker,
        holdingCurrency: investment.currency,
        fixedIncome: investmentType.fixedIncome,
        investmentTypeName: investmentType.name,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(
        investmentType,
        eq(investment.investmentTypeId, investmentType.id),
      )
      .where(
        and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)),
      )

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

    return {
      ok: true as const,
      providerStale: stale,
      refreshedCount: inputs.length,
    }
  })

const upsertHoldingInput = z.object({
  investmentId: uuid,
  quantity: z.number().positive(),
  avgCost: z.number().nonnegative(),
  broker: z.string().trim().max(200).optional().nullable(),
  lastOperationAt: z.string().datetime().optional().nullable(),
})

export const upsertPortfolioHoldingFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => upsertHoldingInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const [inv] = await db
      .select({ id: investment.id })
      .from(investment)
      .where(
        and(
          eq(investment.id, data.investmentId),
          eq(investment.userId, userId),
        ),
      )
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match (id/userId not found) makes it undefined at runtime
    if (!inv) return { ok: false as const, code: 'NOT_FOUND' as const }

    await db
      .insert(portfolioHolding)
      .values({
        userId,
        investmentId: data.investmentId,
        quantity: String(data.quantity),
        avgCost: String(data.avgCost),
        broker: data.broker?.trim() ? data.broker.trim() : null,
        lastOperationAt: data.lastOperationAt
          ? new Date(data.lastOperationAt)
          : null,
      })
      .onConflictDoUpdate({
        target: [portfolioHolding.userId, portfolioHolding.investmentId],
        set: {
          quantity: String(data.quantity),
          avgCost: String(data.avgCost),
          broker: data.broker?.trim() ? data.broker.trim() : null,
          lastOperationAt: data.lastOperationAt
            ? new Date(data.lastOperationAt)
            : null,
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
      .where(
        and(
          eq(portfolioHolding.userId, userId),
          eq(portfolioHolding.investmentId, data.id),
        ),
      )
    return { ok: true as const }
  })

export const listPortfolioHoldingsFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ displayCurrency: currencyCode }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const displayCurrency =
      normalizeHoldingCurrency(data.displayCurrency) ?? 'BRL'

    const rows = await db
      .select({
        investmentId: portfolioHolding.investmentId,
        ticker: investment.ticker,
        quantity: portfolioHolding.quantity,
        avgCost: portfolioHolding.avgCost,
        currency: investment.currency,
        broker: portfolioHolding.broker,
        lastOperationAt: portfolioHolding.lastOperationAt,
        investmentName: investment.name,
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
        fixedIncome: investmentType.fixedIncome,
        rfGrossAmount: rendaFixaValuation.grossAmount,
        rfGrossProfit: rendaFixaValuation.grossProfit,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(
        investmentType,
        eq(investment.investmentTypeId, investmentType.id),
      )
      .leftJoin(
        rendaFixaValuation,
        and(
          eq(rendaFixaValuation.userId, userId),
          eq(rendaFixaValuation.investmentId, portfolioHolding.investmentId),
        ),
      )
      .where(
        and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)),
      )
      .orderBy(asc(investmentType.sortOrder), asc(investment.name))

    // For renda fixa holdings, substitute avgCost with the latest computed grossAmount
    // so the valuation pipeline returns the interest-accrued value, not just book value.
    const rowsForValuation = rows.map((r) =>
      r.rfGrossAmount != null ? { ...r, avgCost: r.rfGrossAmount } : r,
    )

    const { valuated, quotesStale, fxAsOf, fxStale, fxMissingPairs } =
      await valuateHoldings(db, rowsForValuation, displayCurrency)

    const enriched = rows.map((r, i) => {
      const v = valuated[i]
      const rfCapital = Number(r.avgCost)
      const unrealizedPl =
        r.rfGrossProfit != null
          ? Number(r.rfGrossProfit) * (v.fxRateUsed ?? 1)
          : v.unrealizedPlDisplay
      return {
        ...r,
        ...v,
        rfCapital,
        marketValue: v.marketValueDisplay,
        unrealizedPl,
      }
    })

    return {
      rows: enriched,
      quotesStale,
      displayCurrency,
      fxAsOf,
      fxStale,
      fxMissingPairs,
    }
  })
