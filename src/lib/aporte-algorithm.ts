import type { InvestmentOverviewRow } from '@/lib/investment-scoring'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { getFxRate, type FxRateMatrix } from '@/lib/fx'
import { num } from '@/lib/math'

export const PRIORITY_SCORE_THRESHOLD = 60

export type ContributionSuggestion = {
  investmentId: string
  investmentName: string
  investmentTypeId: string
  investmentTypeName: string
  suggestedAmount: number
  suggestedCurrency: string
  contributionAmount: number
  contributionCurrency: string
  units: number | null
  contributionPct: number
  missingQuote: boolean
  currentTypePct: number
  projectedTypePct: number
  targetTypePct: number
}

export type TypeProjection = {
  investmentTypeId: string
  investmentTypeName: string
  currentTypePct: number
  projectedTypePct: number
  targetTypePct: number
}

export type AporteSimulationResult =
  | { reason: 'NO_TARGETS'; suggestions: [] }
  | { reason: 'NO_ELIGIBLE_INVESTMENTS'; suggestions: [] }
  | { reason: 'OK'; suggestions: ContributionSuggestion[]; typeProjections: TypeProjection[] }

export type AportePortfolioState = {
  total: number
  byType: Map<string, { marketValue: number }>
}

export type AporteTypeRow = {
  investmentTypeId: string
  investmentTypeName: string
  typeSortOrder: number
}

export type AporteTargetsMap = Record<string, { targetPct: number } | undefined>

export type AporteHoldingInfo = {
  ticker: string | null
  currency: string
}

export type AporteQuote = {
  price: number | null
  currency: string | null
}

export type AporteInput = {
  amount: number
  contributionCurrency: string
  portfolio: AportePortfolioState
  targetsMap: AporteTargetsMap
  typeRows: AporteTypeRow[]
  scoredInvestments: InvestmentOverviewRow[]
  holdingByInvestmentId: Map<string, AporteHoldingInfo>
  quoteBySymbol: Map<string, AporteQuote>
  fxMatrix: FxRateMatrix
}

export function simulateAporte(input: AporteInput): AporteSimulationResult {
  const {
    amount,
    contributionCurrency,
    portfolio,
    targetsMap,
    typeRows,
    scoredInvestments,
    holdingByInvestmentId,
    quoteBySymbol,
    fxMatrix,
  } = input

  if (Object.keys(targetsMap).length === 0) {
    return { reason: 'NO_TARGETS', suggestions: [] }
  }

  // Eligible types: those that need contribution to reach target in the post-aporte world.
  // deficit = targetPct * newTotal - currentMv (absolute amount, in display currency)
  const newTotal = portfolio.total + amount
  const eligibleTypes: Array<{
    investmentTypeId: string
    investmentTypeName: string
    typeSortOrder: number
    deficit: number
  }> = []

  for (const t of typeRows) {
    const entry = targetsMap[t.investmentTypeId]
    if (!entry || entry.targetPct <= 0) continue
    const currentMv = portfolio.byType.get(t.investmentTypeId)?.marketValue ?? 0
    const deficit = (entry.targetPct / 100) * newTotal - currentMv
    if (deficit <= 0) continue
    eligibleTypes.push({
      investmentTypeId: t.investmentTypeId,
      investmentTypeName: t.investmentTypeName,
      typeSortOrder: t.typeSortOrder,
      deficit,
    })
  }

  if (eligibleTypes.length === 0) {
    // All types already above post-aporte target — distribute by targetPct to maintain balance
    const typesWithTargets = typeRows.filter(
      (t) => (targetsMap[t.investmentTypeId]?.targetPct ?? 0) > 0,
    )
    if (typesWithTargets.length === 0) {
      return { reason: 'NO_ELIGIBLE_INVESTMENTS', suggestions: [] }
    }
    for (const t of typesWithTargets) {
      eligibleTypes.push({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        typeSortOrder: t.typeSortOrder,
        deficit: targetsMap[t.investmentTypeId]?.targetPct ?? 0,
      })
    }
  }

  const totalDeficit = eligibleTypes.reduce((sum, t) => sum + t.deficit, 0)
  const suggestions: ContributionSuggestion[] = []

  for (const eligType of eligibleTypes) {
    const typeShare = eligType.deficit / totalDeficit
    const typeAmount = amount * typeShare

    const currentTypeMv = portfolio.byType.get(eligType.investmentTypeId)?.marketValue ?? 0
    const currentTypePct = portfolio.total > 0 ? (currentTypeMv / portfolio.total) * 100 : 0
    const projectedTypePct = newTotal > 0 ? ((currentTypeMv + typeAmount) / newTotal) * 100 : 0
    const targetTypePct = targetsMap[eligType.investmentTypeId]?.targetPct ?? 0

    // Eligible investments for type: score > 0
    const typeInvestments = scoredInvestments.filter(
      (inv) => inv.investmentTypeId === eligType.investmentTypeId && inv.score > 0,
    )
    if (typeInvestments.length === 0) continue

    // PriorityInvestments: score >= PRIORITY_SCORE_THRESHOLD
    const priority = typeInvestments.filter((inv) => inv.score >= PRIORITY_SCORE_THRESHOLD)
    const selected = priority.length > 0 ? priority : typeInvestments
    const totalScore = selected.reduce((sum, inv) => sum + inv.score, 0)

    for (const inv of selected) {
      const invShare = inv.score / totalScore
      const rawAmount = typeAmount * invShare

      const holding = holdingByInvestmentId.get(inv.id)
      const isFixed = isFixedIncomeTipo(inv.fixedIncome, inv.typeName)

      if (isFixed) {
        const assetCurrency = holding?.currency?.toUpperCase() ?? contributionCurrency.toUpperCase()
        if (assetCurrency !== contributionCurrency.toUpperCase()) {
          const rate = getFxRate(fxMatrix, contributionCurrency, assetCurrency)
          if (rate == null) continue
          suggestions.push({
            investmentId: inv.id,
            investmentName: inv.name,
            investmentTypeId: eligType.investmentTypeId,
            investmentTypeName: eligType.investmentTypeName,
            suggestedAmount: rawAmount * rate,
            suggestedCurrency: assetCurrency,
            contributionAmount: rawAmount,
            contributionCurrency,
            units: null,
            contributionPct: (rawAmount / amount) * 100,
            missingQuote: false,
            currentTypePct,
            projectedTypePct,
            targetTypePct,
          })
        } else {
          suggestions.push({
            investmentId: inv.id,
            investmentName: inv.name,
            investmentTypeId: eligType.investmentTypeId,
            investmentTypeName: eligType.investmentTypeName,
            suggestedAmount: rawAmount,
            suggestedCurrency: contributionCurrency,
            contributionAmount: rawAmount,
            contributionCurrency,
            units: null,
            contributionPct: (rawAmount / amount) * 100,
            missingQuote: false,
            currentTypePct,
            projectedTypePct,
            targetTypePct,
          })
        }
      } else {
        const ticker = holding?.ticker?.trim() || inv.name
        const quote = quoteBySymbol.get(ticker)

        if (!quote?.price) {
          suggestions.push({
            investmentId: inv.id,
            investmentName: inv.name,
            investmentTypeId: eligType.investmentTypeId,
            investmentTypeName: eligType.investmentTypeName,
            suggestedAmount: rawAmount,
            suggestedCurrency: contributionCurrency,
            contributionAmount: rawAmount,
            contributionCurrency,
            units: null,
            contributionPct: (rawAmount / amount) * 100,
            missingQuote: true,
            currentTypePct,
            projectedTypePct,
            targetTypePct,
          })
          continue
        }

        const assetCurrency = (quote.currency?.trim() || holding?.currency || contributionCurrency).toUpperCase()
        const rate = getFxRate(fxMatrix, contributionCurrency, assetCurrency)
        if (rate == null) continue

        const amountInAsset = rawAmount * rate
        const rawUnits = amountInAsset / num(quote.price)
        const isCrypto = /cripto|crypto/i.test(eligType.investmentTypeName)
        const units = isCrypto
          ? Math.round(rawUnits * 1e3) / 1e3
          : Math.floor(rawUnits)

        suggestions.push({
          investmentId: inv.id,
          investmentName: inv.name,
          investmentTypeId: eligType.investmentTypeId,
          investmentTypeName: eligType.investmentTypeName,
          suggestedAmount: amountInAsset,
          suggestedCurrency: assetCurrency,
          contributionAmount: rawAmount,
          contributionCurrency,
          units,
          contributionPct: (rawAmount / amount) * 100,
          missingQuote: false,
          currentTypePct,
          projectedTypePct,
          targetTypePct,
        })
      }
    }
  }

  if (suggestions.length === 0) {
    return { reason: 'NO_ELIGIBLE_INVESTMENTS', suggestions: [] }
  }

  const typeSortOrderById = new Map(typeRows.map((t) => [t.investmentTypeId, t.typeSortOrder]))
  suggestions.sort((a, b) => {
    const sa = typeSortOrderById.get(a.investmentTypeId) ?? 0
    const sb = typeSortOrderById.get(b.investmentTypeId) ?? 0
    if (sa !== sb) return sa - sb
    return b.contributionPct - a.contributionPct
  })

  // Projections for all types with holdings (including those not receiving contribution)
  const contributedProj = new Map<string, { currentTypePct: number; projectedTypePct: number; targetTypePct: number }>()
  for (const s of suggestions) {
    if (!contributedProj.has(s.investmentTypeId)) {
      contributedProj.set(s.investmentTypeId, {
        currentTypePct: s.currentTypePct,
        projectedTypePct: s.projectedTypePct,
        targetTypePct: s.targetTypePct,
      })
    }
  }

  const typeProjections: TypeProjection[] = []
  for (const t of typeRows) {
    const currentMv = portfolio.byType.get(t.investmentTypeId)?.marketValue ?? 0
    const proj = contributedProj.get(t.investmentTypeId)
    if (proj) {
      typeProjections.push({ investmentTypeId: t.investmentTypeId, investmentTypeName: t.investmentTypeName, ...proj })
    } else if (currentMv > 0) {
      typeProjections.push({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        currentTypePct: portfolio.total > 0 ? (currentMv / portfolio.total) * 100 : 0,
        projectedTypePct: newTotal > 0 ? (currentMv / newTotal) * 100 : 0,
        targetTypePct: targetsMap[t.investmentTypeId]?.targetPct ?? 0,
      })
    }
  }

  return { reason: 'OK', suggestions, typeProjections }
}
