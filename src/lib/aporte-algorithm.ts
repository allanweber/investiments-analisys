import type { InvestmentOverviewRow } from '@/lib/investment-scoring'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { getFxRate, type FxRateMatrix } from '@/lib/fx'
import { num } from '@/lib/math'

export const PRIORITY_SCORE_THRESHOLD = 60

const ETF_TYPE_NAME = 'etf'
const ACOES_TYPE_NAME = 'ações'
const ACOES_INTL_TYPE_NAME = 'ações internacionais'

function normTypeName(name: string): string {
  return name.trim().toLowerCase()
}

function isBrl(currency: string | null | undefined): boolean {
  return (currency ?? '').toUpperCase() === 'BRL'
}

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
  score: number
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
  | {
      reason: 'OK'
      suggestions: ContributionSuggestion[]
      typeProjections: TypeProjection[]
      unallocatedAmount: number
    }

/** One holding's contribution to portfolio totals — used to compute per-type market value. */
export type AporteHolding = {
  investmentTypeId: string
  currency: string | null
  marketValue: number
}

export type AportePortfolioState = {
  total: number
  holdings: AporteHolding[]
}

export type AporteTypeRow = {
  investmentTypeId: string
  investmentTypeName: string
  typeSortOrder: number
}

export type AporteTargetsMap = Record<string, { targetPct: number } | undefined>

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
  quoteBySymbol: Map<string, AporteQuote>
  fxMatrix: FxRateMatrix
  excludedInvestmentIds?: string[]
}

export function simulateAporte(input: AporteInput): AporteSimulationResult {
  const {
    amount,
    contributionCurrency,
    portfolio,
    targetsMap,
    typeRows,
    quoteBySymbol,
    fxMatrix,
    excludedInvestmentIds,
  } = input

  if (Object.keys(targetsMap).length === 0) {
    return { reason: 'NO_TARGETS', suggestions: [] }
  }

  const excludedIds = new Set(excludedInvestmentIds ?? [])
  const scoredInvestments = excludedIds.size > 0
    ? input.scoredInvestments.filter((inv) => !excludedIds.has(inv.id))
    : input.scoredInvestments

  // --- ETF reclassification ---
  // When the ETF category's target is 0 (or unset), ETF holdings/investments are folded into
  // Ações (BRL) or Ações internacionais (any other currency) for deficit and candidate selection
  // purposes. If the relevant destination category doesn't exist, that side is simply excluded.
  const etfType = typeRows.find((t) => normTypeName(t.investmentTypeName) === ETF_TYPE_NAME)
  const acoesType = typeRows.find((t) => normTypeName(t.investmentTypeName) === ACOES_TYPE_NAME)
  const acoesIntlType = typeRows.find(
    (t) => normTypeName(t.investmentTypeName) === ACOES_INTL_TYPE_NAME,
  )
  const etfTargetPct = etfType ? (targetsMap[etfType.investmentTypeId]?.targetPct ?? 0) : 0
  const reclassifyEtf = etfType != null && etfTargetPct <= 0

  function destTypeForEtfCurrency(currency: string | null | undefined) {
    return isBrl(currency) ? acoesType : acoesIntlType
  }

  // Per-type current market value, folding reclassified ETF holdings into their destination type.
  const byType = new Map<string, number>()
  for (const h of portfolio.holdings) {
    let typeId = h.investmentTypeId
    if (reclassifyEtf && etfType && typeId === etfType.investmentTypeId) {
      const destType = destTypeForEtfCurrency(h.currency)
      if (!destType) continue
      typeId = destType.investmentTypeId
    }
    byType.set(typeId, (byType.get(typeId) ?? 0) + h.marketValue)
  }

  // Investments eligible to receive a contribution for a given (possibly reclassification-fed) type.
  function investmentsForType(typeId: string): InvestmentOverviewRow[] {
    return scoredInvestments.filter((inv) => {
      if (inv.investmentTypeId === typeId) return true
      if (reclassifyEtf && etfType && inv.investmentTypeId === etfType.investmentTypeId) {
        const destType = destTypeForEtfCurrency(inv.currency)
        return destType?.investmentTypeId === typeId
      }
      return false
    })
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
    const currentMv = byType.get(t.investmentTypeId) ?? 0
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
  let unallocatedAmount = 0

  for (const eligType of eligibleTypes) {
    const typeShare = eligType.deficit / totalDeficit
    const typeAmount = amount * typeShare

    const currentTypeMv = byType.get(eligType.investmentTypeId) ?? 0
    const currentTypePct = portfolio.total > 0 ? (currentTypeMv / portfolio.total) * 100 : 0
    const projectedTypePct = newTotal > 0 ? ((currentTypeMv + typeAmount) / newTotal) * 100 : 0
    const targetTypePct = targetsMap[eligType.investmentTypeId]?.targetPct ?? 0

    // All investments belonging to this type (before score filtering) — only an empty type
    // (e.g. every investment excluded) routes its share to unallocatedAmount.
    const allTypeInvestments = investmentsForType(eligType.investmentTypeId)
    if (allTypeInvestments.length === 0) {
      unallocatedAmount += typeAmount
      continue
    }

    // Prefer investments with a positive score; fall back to all of them (split evenly) so the
    // amount is still allocated as much as possible instead of being parked as unallocated.
    const scoredPositive = allTypeInvestments.filter((inv) => inv.score > 0)
    const pool = scoredPositive.length > 0 ? scoredPositive : allTypeInvestments

    // PriorityInvestments: score >= PRIORITY_SCORE_THRESHOLD
    const priority = pool.filter((inv) => inv.score >= PRIORITY_SCORE_THRESHOLD)
    const selected = priority.length > 0 ? priority : pool
    const totalScore = selected.reduce((sum, inv) => sum + inv.score, 0)

    for (const inv of selected) {
      const invShare = totalScore > 0 ? inv.score / totalScore : 1 / selected.length
      const rawAmount = typeAmount * invShare

      const isFixed = isFixedIncomeTipo(inv.fixedIncome, inv.typeName)

      if (isFixed) {
        const assetCurrency = inv.currency?.toUpperCase() ?? contributionCurrency.toUpperCase()
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
            score: inv.score,
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
            score: inv.score,
            missingQuote: false,
            currentTypePct,
            projectedTypePct,
            targetTypePct,
          })
        }
      } else {
        const ticker = inv.ticker?.trim() || ''
        const quote = ticker ? quoteBySymbol.get(ticker) : undefined

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
            score: inv.score,
            missingQuote: true,
            currentTypePct,
            projectedTypePct,
            targetTypePct,
          })
          continue
        }

        const assetCurrency = (quote.currency?.trim() || inv.currency || contributionCurrency).toUpperCase()
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
            score: inv.score,
          missingQuote: false,
          currentTypePct,
          projectedTypePct,
          targetTypePct,
        })
      }
    }
  }

  if (suggestions.length === 0 && unallocatedAmount === 0) {
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
    const currentMv = byType.get(t.investmentTypeId) ?? 0
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

  return { reason: 'OK', suggestions, typeProjections, unallocatedAmount }
}
