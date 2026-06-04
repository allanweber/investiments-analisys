import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  investment,
  investmentType,
  portfolioHolding,
  userAllocationProfile,
} from '#/db/schema'
import type { UserAllocationTargetsJson } from '#/db/schema'
import {
  compareInvestmentsByRank,
  type InvestmentOverviewRow,
  loadInvestmentOverviewRows,
} from '#/lib/investment-scoring'
import { valuateHoldings } from '#/lib/valuation-pipeline'

import { clampPct, computePct, normalizeHoldingCurrency, num } from '#/lib/math'
import { getDb, requireUserId, currencyCode, parseTargetsJson } from '#/lib/server-utils'


const portfolioOverviewInput = z.object({ displayCurrency: currencyCode })

export const loadPortfolioOverviewFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => portfolioOverviewInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const displayCurrency = normalizeHoldingCurrency(data.displayCurrency) ?? 'BRL'

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

    const { valuated, quotesStale: stale, fxAsOf: newestFetchedAt, fxStale, fxMissingPairs } =
      await valuateHoldings(db, holdings, displayCurrency)

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
      { marketValueNative: number; marketValueDisplay: number; holdingCount: number }
    >()

    let total = 0
    let unrealizedPl = 0
    for (let i = 0; i < holdings.length; i++) {
      const r = holdings[i]
      const v = valuated[i]
      if (v.marketValueNative == null) continue

      const mvDisplay = v.marketValueDisplay ?? 0
      total += mvDisplay
      unrealizedPl += v.unrealizedPlDisplay ?? 0

      const nativeBucket = byNativeMap.get(r.currency) ?? {
        marketValueNative: 0,
        marketValueDisplay: 0,
        holdingCount: 0,
      }
      nativeBucket.marketValueNative += v.marketValueNative
      nativeBucket.marketValueDisplay += mvDisplay
      nativeBucket.holdingCount += 1
      byNativeMap.set(r.currency, nativeBucket)

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

    const scoredInvestments = await loadInvestmentOverviewRows(userId)
    const byTypeId = new Map<string, InvestmentOverviewRow[]>()
    for (const r of scoredInvestments) {
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
    const quoteFetchedAts = valuated
      .map((v) => v.quoteFetchedAt?.getTime() ?? 0)
      .filter((t) => t > 0)
    const lastUpdatedAt =
      quoteFetchedAts.length === 0 ? null : new Date(Math.max(...quoteFetchedAts))

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
