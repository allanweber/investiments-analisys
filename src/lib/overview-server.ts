import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investmentType, userAllocationProfile } from '@/db/schema'
import type { UserAllocationTargetsJson } from '@/db/schema'
import { loadInvestmentOverviewRows } from '@/lib/investment-scoring'
import { analyzePortfolioAllocation } from '@/lib/portfolio-analysis'
import {
  loadHoldingsForValuation,
  valuateHoldings,
  withRendaFixaAvgCost,
} from '@/lib/valuation-pipeline'

import { clampPct, computePct, normalizeHoldingCurrency, num } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { currencyCode, parseTargetsJson } from '@/lib/server-utils'

const portfolioOverviewInput = z.object({ displayCurrency: currencyCode })

export const loadPortfolioOverviewFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => portfolioOverviewInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const displayCurrency =
      normalizeHoldingCurrency(data.displayCurrency) ?? 'BRL'

    const holdings = await loadHoldingsForValuation(db, userId)

    const currencies = [
      ...new Set(holdings.map((h) => h.currency ?? 'BRL')),
    ].sort((a, b) => a.localeCompare(b))

    const holdingsForValuation = withRendaFixaAvgCost(holdings)

    const {
      valuated,
      quotesStale: stale,
      fxAsOf: newestFetchedAt,
      fxStale,
      fxMissingPairs,
    } = await valuateHoldings(db, holdingsForValuation, displayCurrency)

    const byType = new Map<
      string,
      {
        investmentTypeId: string
        investmentTypeName: string
        typeSortOrder: number
        marketValue: number
      }
    >()

    const byNativeMap = new Map<
      string,
      {
        marketValueNative: number
        marketValueDisplay: number
        holdingCount: number
      }
    >()

    let total = 0
    let unrealizedPl = 0
    for (let i = 0; i < holdings.length; i++) {
      const r = holdings[i]
      const v = valuated[i]
      if (v.marketValueNative == null) continue

      const nativeCurrency = r.currency ?? 'BRL'
      const mvDisplay = v.marketValueDisplay ?? 0
      total += mvDisplay
      const rfProfit = holdings[i].rfGrossProfit
      unrealizedPl +=
        rfProfit != null
          ? Number(rfProfit) * (v.fxRateUsed ?? 1)
          : (v.unrealizedPlDisplay ?? 0)

      const nativeBucket = byNativeMap.get(nativeCurrency) ?? {
        marketValueNative: 0,
        marketValueDisplay: 0,
        holdingCount: 0,
      }
      nativeBucket.marketValueNative += v.marketValueNative
      nativeBucket.marketValueDisplay += mvDisplay
      nativeBucket.holdingCount += 1
      byNativeMap.set(nativeCurrency, nativeBucket)

      const prev = byType.get(r.investmentTypeId)
      if (!prev) {
        byType.set(r.investmentTypeId, {
          investmentTypeId: r.investmentTypeId,
          investmentTypeName: r.investmentTypeName,
          typeSortOrder: r.typeSortOrder,
          marketValue: mvDisplay,
        })
      } else {
        prev.marketValue += mvDisplay
      }
    }

    const byNativeCurrency = [...byNativeMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, bucket]) => ({
        currency,
        marketValueNative: bucket.marketValueNative,
        marketValueDisplay: bucket.marketValueDisplay,
        holdingCount: bucket.holdingCount,
        pctOfPortfolio: clampPct(computePct(bucket.marketValueDisplay, total)),
      }))

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
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- targetsMap is `Record<string, ...>` (no noUncheckedIndexedAccess), but it's parsed from a jsonb column that may simply not have an entry for this investmentTypeId, so entry is genuinely undefined at runtime for types without a saved target
      const rawPct = entry === undefined ? 0 : entry.targetPct
      return {
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        typeSortOrder: t.typeSortOrder,
        targetPct: clampPct(num(rawPct)),
      }
    })

    const allocation = [...byType.values()]
      .sort(
        (a, b) =>
          a.typeSortOrder - b.typeSortOrder ||
          a.investmentTypeName.localeCompare(b.investmentTypeName),
      )
      .map((t) => ({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        marketValue: t.marketValue,
        currentPct: clampPct(computePct(t.marketValue, total)),
      }))

    const scoredInvestments = await loadInvestmentOverviewRows(userId)
    const { drift, suggestions } = analyzePortfolioAllocation({
      allocation,
      targets,
      scoredInvestments,
    })

    const targetTotal = targets.reduce((acc, t) => acc + t.targetPct, 0)
    const quoteFetchedAts = valuated
      .map((v) => v.quoteFetchedAt?.getTime() ?? 0)
      .filter((t) => t > 0)
    const lastUpdatedAt =
      quoteFetchedAts.length === 0
        ? null
        : new Date(Math.max(...quoteFetchedAts))

    return {
      currencies,
      displayCurrency,
      quotesStale: stale,
      fxAsOf: newestFetchedAt,
      fxStale,
      fxMissingPairs,
      lastUpdatedAt,
      totals: {
        marketValue: total,
        targetTotalPct: clampPct(targetTotal),
        unrealizedPl,
      },
      byNativeCurrency,
      allocation,
      targets,
      drift,
      suggestions,
    }
  })
