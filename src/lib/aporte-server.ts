import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  investment,
  investmentType,
  portfolioHolding,
  rendaFixaValuation,
  userAllocationProfile,
} from '@/db/schema'
import { loadInvestmentOverviewRows } from '@/lib/investment-scoring'
import { SUPPORTED_FX_CURRENCIES } from '@/lib/fx'
import { ensureFxRatesForDisplay } from '@/lib/market-data/fx-refresh'
import { loadQuotesFromDb } from '@/lib/market-data/quote-cache'
import { refreshMarketQuotesForInputs } from '@/lib/market-data/quote-refresh'
import type { MarketQuoteInput } from '@/lib/market-data'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { valuateHoldings } from '@/lib/valuation-pipeline'
import { normalizeHoldingCurrency } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { parseTargetsJson } from '@/lib/server-utils'
import { simulateAporte } from '@/lib/aporte-algorithm'

export { PRIORITY_SCORE_THRESHOLD } from '@/lib/aporte-algorithm'
export type { AporteSimulationResult, ContributionSuggestion, TypeProjection } from '@/lib/aporte-algorithm'

const simulateAporteInput = z.object({
  amount: z.number().positive(),
  currency: z.enum(SUPPORTED_FX_CURRENCIES),
})

export const simulateAporteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: z.infer<typeof simulateAporteInput>) => simulateAporteInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const { amount, currency: contributionCurrency } = data

    // --- Portfolio state ---
    const holdings = await db
      .select({
        currency: portfolioHolding.currency,
        ticker: portfolioHolding.ticker,
        quantity: portfolioHolding.quantity,
        avgCost: portfolioHolding.avgCost,
        investmentId: portfolioHolding.investmentId,
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
        fixedIncome: investmentType.fixedIncome,
        rfGrossAmount: rendaFixaValuation.grossAmount,
      })
      .from(portfolioHolding)
      .innerJoin(investment, eq(portfolioHolding.investmentId, investment.id))
      .innerJoin(investmentType, eq(investment.investmentTypeId, investmentType.id))
      .leftJoin(
        rendaFixaValuation,
        and(
          eq(rendaFixaValuation.userId, userId),
          eq(rendaFixaValuation.investmentId, portfolioHolding.investmentId),
        ),
      )
      .where(and(eq(portfolioHolding.userId, userId), eq(investment.userId, userId)))

    const holdingsForValuation = holdings.map((h) =>
      h.rfGrossAmount != null ? { ...h, avgCost: h.rfGrossAmount } : h,
    )

    const { valuated } = await valuateHoldings(db, holdingsForValuation, contributionCurrency)

    const byType = new Map<string, { marketValue: number }>()
    let portfolioTotal = 0
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i]
      const v = valuated[i]
      if (v.marketValueNative == null) continue
      const mv = v.marketValueDisplay ?? 0
      portfolioTotal += mv
      const prev = byType.get(h.investmentTypeId)
      if (!prev) {
        byType.set(h.investmentTypeId, { marketValue: mv })
      } else {
        prev.marketValue += mv
      }
    }

    // --- Targets ---
    const profileSelect = await db
      .select({ targets: userAllocationProfile.targets })
      .from(userAllocationProfile)
      .where(eq(userAllocationProfile.userId, userId))

    const targetsMap =
      profileSelect.length > 0 ? parseTargetsJson(profileSelect[0].targets) : {}

    const typeRows = await db
      .select({
        investmentTypeId: investmentType.id,
        investmentTypeName: investmentType.name,
        typeSortOrder: investmentType.sortOrder,
      })
      .from(investmentType)
      .where(eq(investmentType.userId, userId))
      .orderBy(asc(investmentType.sortOrder), asc(investmentType.name))

    const scoredInvestments = await loadInvestmentOverviewRows(userId)

    // --- Holding map for ticker + currency lookup ---
    const holdingByInvestmentId = new Map(
      holdings.map((h) => [h.investmentId, { ticker: h.ticker, currency: h.currency }]),
    )

    // --- Collect renda variável tickers for quote resolution ---
    const varQuoteInputs: MarketQuoteInput[] = []
    for (const inv of scoredInvestments) {
      if (!inv.active) continue
      if (isFixedIncomeTipo(inv.fixedIncome, inv.typeName)) continue
      const holding = holdingByInvestmentId.get(inv.id)
      const ticker = holding?.ticker?.trim() || inv.name
      varQuoteInputs.push({
        symbol: ticker,
        holdingCurrency: normalizeHoldingCurrency(holding?.currency ?? contributionCurrency),
      })
    }

    // Deduplicate by symbol
    const uniqueQuoteInputs = [
      ...new Map(varQuoteInputs.map((v) => [v.symbol, v])).values(),
    ]

    let quoteMap = new Map<string, { price: number | null; currency: string | null }>()

    if (uniqueQuoteInputs.length > 0) {
      const { bySymbol } = await loadQuotesFromDb({ inputs: uniqueQuoteInputs })

      const staleInputs = uniqueQuoteInputs.filter((qi) => !bySymbol.get(qi.symbol)?.price)
      if (staleInputs.length > 0) {
        await refreshMarketQuotesForInputs({
          actorId: userId,
          reason: 'immediate',
          inputs: staleInputs,
        })
        const refreshed = await loadQuotesFromDb({ inputs: uniqueQuoteInputs })
        for (const [sym, q] of refreshed.bySymbol) {
          quoteMap.set(sym, q)
        }
      } else {
        for (const [sym, q] of bySymbol) {
          quoteMap.set(sym, q)
        }
      }
    }

    // --- FX matrix ---
    const { matrix } = await ensureFxRatesForDisplay(
      db,
      [...SUPPORTED_FX_CURRENCIES],
      contributionCurrency,
    )

    const eligibleScoredInvestments = scoredInvestments.filter((inv) => inv.active)

    return simulateAporte({
      amount,
      contributionCurrency,
      portfolio: { total: portfolioTotal, byType },
      targetsMap,
      typeRows,
      scoredInvestments: eligibleScoredInvestments,
      holdingByInvestmentId,
      quoteBySymbol: quoteMap,
      fxMatrix: matrix,
    })
  })
