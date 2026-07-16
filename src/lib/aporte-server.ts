import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investmentType, userAllocationProfile } from '@/db/schema'
import { loadInvestmentOverviewRows } from '@/lib/investment-scoring'
import { SUPPORTED_FX_CURRENCIES } from '@/lib/fx'
import { ensureFxRatesForDisplay } from '@/lib/market-data/fx-refresh'
import { loadQuotesFromDb } from '@/lib/market-data/quote-cache'
import { refreshMarketQuotesForInputs } from '@/lib/market-data/quote-refresh'
import type { MarketQuoteInput } from '@/lib/market-data'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import {
  loadHoldingsForValuation,
  valuateHoldings,
  withRendaFixaAvgCost,
} from '@/lib/valuation-pipeline'
import { normalizeHoldingCurrency } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { parseTargetsJson } from '@/lib/server-utils'
import { simulateAporte } from '@/lib/aporte-algorithm'

export { PRIORITY_SCORE_THRESHOLD } from '@/lib/aporte-algorithm'
export type {
  AporteSimulationResult,
  ContributionSuggestion,
  TypeProjection,
} from '@/lib/aporte-algorithm'

const simulateAporteInput = z.object({
  amount: z.number().positive(),
  currency: z.enum(SUPPORTED_FX_CURRENCIES),
  excludedInvestmentIds: z.array(z.string()).optional(),
})

export const simulateAporteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: z.infer<typeof simulateAporteInput>) =>
    simulateAporteInput.parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const {
      amount,
      currency: contributionCurrency,
      excludedInvestmentIds,
    } = data

    // --- Portfolio state ---
    const holdings = await loadHoldingsForValuation(db, userId)

    const holdingsForValuation = withRendaFixaAvgCost(holdings)

    const { valuated } = await valuateHoldings(
      db,
      holdingsForValuation,
      contributionCurrency,
    )

    const aporteHoldings: {
      investmentTypeId: string
      currency: string | null
      marketValue: number
    }[] = []
    let portfolioTotal = 0
    for (let i = 0; i < holdings.length; i++) {
      const h = holdings[i]
      const v = valuated[i]
      if (v.marketValueNative == null) continue
      const mv = v.marketValueDisplay ?? 0
      portfolioTotal += mv
      aporteHoldings.push({
        investmentTypeId: h.investmentTypeId,
        currency: h.currency,
        marketValue: mv,
      })
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

    // --- Collect renda variável tickers for quote resolution ---
    const varQuoteInputs: MarketQuoteInput[] = []
    for (const inv of scoredInvestments) {
      if (!inv.active) continue
      if (isFixedIncomeTipo(inv.fixedIncome, inv.typeName)) continue
      const ticker = inv.ticker?.trim()
      if (!ticker) continue
      varQuoteInputs.push({
        symbol: ticker,
        holdingCurrency: normalizeHoldingCurrency(
          inv.currency ?? contributionCurrency,
        ),
      })
    }

    // Deduplicate by symbol
    const uniqueQuoteInputs = [
      ...new Map(varQuoteInputs.map((v) => [v.symbol, v])).values(),
    ]

    const quoteMap = new Map<
      string,
      { price: number | null; currency: string | null }
    >()

    if (uniqueQuoteInputs.length > 0) {
      // Aporte suggestions drive real buy amounts, so always refetch live prices
      // instead of trusting the (up to 12h-stale) quote cache.
      await refreshMarketQuotesForInputs({
        actorId: userId,
        reason: 'immediate',
        inputs: uniqueQuoteInputs,
      })
      const { bySymbol } = await loadQuotesFromDb({ inputs: uniqueQuoteInputs })
      for (const [sym, q] of bySymbol) {
        quoteMap.set(sym, q)
      }
    }

    // --- FX matrix ---
    const { matrix } = await ensureFxRatesForDisplay(
      db,
      [...SUPPORTED_FX_CURRENCIES],
      contributionCurrency,
    )

    const eligibleScoredInvestments = scoredInvestments.filter(
      (inv) => inv.active,
    )

    return simulateAporte({
      amount,
      contributionCurrency,
      portfolio: { total: portfolioTotal, holdings: aporteHoldings },
      targetsMap,
      typeRows,
      scoredInvestments: eligibleScoredInvestments,
      quoteBySymbol: quoteMap,
      fxMatrix: matrix,
      excludedInvestmentIds,
    })
  })
