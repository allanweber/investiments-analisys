import type { InvestmentOverviewRow } from '@/lib/investment-scoring'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { getFxRate } from '@/lib/fx'
import type { FxRateMatrix } from '@/lib/fx'
import { num } from '@/lib/math'

export const PRIORITY_SCORE_THRESHOLD = 60

const ETF_TYPE_NAME = 'etf'
const ACOES_TYPE_NAME = 'ações'
const ACOES_INTL_TYPE_NAME = 'ações internacionais'

/** Currency amounts below this (in the contribution currency) are treated as zero. */
const EPSILON = 1e-6
/** Safety bound for the residual-redistribution loop. */
const MAX_GREEDY_ITERATIONS = 200_000

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
      reason: 'AMOUNT_BELOW_MIN'
      suggestions: []
      minUnitAmount: number
      minUnitCurrency: string
      minUnitName: string
    }
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

/**
 * A single investment that can receive part of the aporte, resolved into a
 * concrete funding shape:
 *  - `unit`: whole-unit asset (FII / ação / ETF). Bought in integer units, so it
 *    rounds down and produces a residual that gets redeployed elsewhere.
 *  - `fractional`: fixed income, crypto (3-decimal units) or a quote-less equity.
 *    Absorbs any amount exactly, so it never leaves a rounding residual.
 * `contrib`/`units` accumulate as the allocation runs.
 */
type Candidate = {
  inv: InvestmentOverviewRow
  typeId: string
  typeName: string
  targetTypePct: number
  score: number
  kind: 'unit' | 'fractional'
  assetCurrency: string
  /** Contribution → asset-currency rate. */
  rate: number
  /** Whole-unit price in the asset currency (unit kind only). */
  unitPriceAsset: number
  /** Contribution-currency cost of one whole unit (unit kind only). */
  unitCostContrib: number
  isCrypto: boolean
  missingQuote: boolean
  contrib: number
  units: number
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
  const scoredInvestments =
    excludedIds.size > 0
      ? input.scoredInvestments.filter((inv) => !excludedIds.has(inv.id))
      : input.scoredInvestments

  // --- ETF reclassification ---
  // When the ETF category's target is 0 (or unset), ETF holdings/investments are folded into
  // Ações (BRL) or Ações internacionais (any other currency) for deficit and candidate selection
  // purposes. If the relevant destination category doesn't exist, that side is simply excluded.
  const etfType = typeRows.find(
    (t) => normTypeName(t.investmentTypeName) === ETF_TYPE_NAME,
  )
  const acoesType = typeRows.find(
    (t) => normTypeName(t.investmentTypeName) === ACOES_TYPE_NAME,
  )
  const acoesIntlType = typeRows.find(
    (t) => normTypeName(t.investmentTypeName) === ACOES_INTL_TYPE_NAME,
  )
  const etfTargetPct = etfType
    ? (targetsMap[etfType.investmentTypeId]?.targetPct ?? 0)
    : 0
  const reclassifyEtf = etfType != null && etfTargetPct <= 0

  function destTypeForEtfCurrency(currency: string | null | undefined) {
    return isBrl(currency) ? acoesType : acoesIntlType
  }

  // Per-type current market value, folding reclassified ETF holdings into their destination type.
  const byType = new Map<string, number>()
  for (const h of portfolio.holdings) {
    let typeId = h.investmentTypeId
    if (reclassifyEtf && typeId === etfType.investmentTypeId) {
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
      if (reclassifyEtf && inv.investmentTypeId === etfType.investmentTypeId) {
        const destType = destTypeForEtfCurrency(inv.currency)
        return destType?.investmentTypeId === typeId
      }
      return false
    })
  }

  // Eligible types: those that need contribution to reach target in the post-aporte world.
  // desired = targetPct * newTotal - currentMv (absolute amount, in the contribution currency)
  const newTotal = portfolio.total + amount
  type EligibleType = {
    investmentTypeId: string
    investmentTypeName: string
    typeSortOrder: number
    targetPct: number
    desired: number
  }
  const eligibleTypes: EligibleType[] = []

  for (const t of typeRows) {
    const entry = targetsMap[t.investmentTypeId]
    if (!entry || entry.targetPct <= 0) continue
    const currentMv = byType.get(t.investmentTypeId) ?? 0
    const desired = (entry.targetPct / 100) * newTotal - currentMv
    if (desired <= 0) continue
    eligibleTypes.push({
      investmentTypeId: t.investmentTypeId,
      investmentTypeName: t.investmentTypeName,
      typeSortOrder: t.typeSortOrder,
      targetPct: entry.targetPct,
      desired,
    })
  }

  if (eligibleTypes.length === 0) {
    // Every type is already at/above its post-aporte target — still invest the amount, spread by
    // target weights so the balance is preserved (rather than parking it all as unallocated).
    const typesWithTargets = typeRows.filter(
      (t) => (targetsMap[t.investmentTypeId]?.targetPct ?? 0) > 0,
    )
    if (typesWithTargets.length === 0) {
      return { reason: 'NO_ELIGIBLE_INVESTMENTS', suggestions: [] }
    }
    for (const t of typesWithTargets) {
      const targetPct = targetsMap[t.investmentTypeId]?.targetPct ?? 0
      eligibleTypes.push({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        typeSortOrder: t.typeSortOrder,
        targetPct,
        desired: (targetPct / 100) * amount,
      })
    }
  }

  // --- Resolve each eligible type's investments into funding candidates ---
  function classify(
    inv: InvestmentOverviewRow,
    eligType: EligibleType,
  ): Candidate | null {
    const base = {
      inv,
      typeId: eligType.investmentTypeId,
      typeName: eligType.investmentTypeName,
      targetTypePct: eligType.targetPct,
      score: inv.score,
      contrib: 0,
      units: 0,
    }

    if (isFixedIncomeTipo(inv.fixedIncome, inv.typeName)) {
      const assetCurrency =
        inv.currency?.toUpperCase() ?? contributionCurrency.toUpperCase()
      const rate = getFxRate(fxMatrix, contributionCurrency, assetCurrency)
      if (rate == null) return null
      return {
        ...base,
        kind: 'fractional',
        assetCurrency,
        rate,
        unitPriceAsset: 0,
        unitCostContrib: 0,
        isCrypto: false,
        missingQuote: false,
      }
    }

    const ticker = inv.ticker?.trim() || ''
    const quote = ticker ? quoteBySymbol.get(ticker) : undefined

    if (!quote?.price) {
      // No live price — allocate a fractional estimate in the contribution currency and flag it.
      return {
        ...base,
        kind: 'fractional',
        assetCurrency: contributionCurrency.toUpperCase(),
        rate: 1,
        unitPriceAsset: 0,
        unitCostContrib: 0,
        isCrypto: false,
        missingQuote: true,
      }
    }

    const assetCurrency = (
      quote.currency?.trim() ||
      inv.currency ||
      contributionCurrency
    ).toUpperCase()
    const rate = getFxRate(fxMatrix, contributionCurrency, assetCurrency)
    if (rate == null) return null

    const isCrypto = /cripto|crypto/i.test(eligType.investmentTypeName)
    const unitPriceAsset = num(quote.price)
    if (isCrypto) {
      // Crypto trades in fractional units (3 decimals) — treat it as a fractional absorber.
      return {
        ...base,
        kind: 'fractional',
        assetCurrency,
        rate,
        unitPriceAsset,
        unitCostContrib: unitPriceAsset / rate,
        isCrypto: true,
        missingQuote: false,
      }
    }

    return {
      ...base,
      kind: 'unit',
      assetCurrency,
      rate,
      unitPriceAsset,
      unitCostContrib: unitPriceAsset / rate,
      isCrypto: false,
      missingQuote: false,
    }
  }

  const candsByType = new Map<string, Candidate[]>()
  const desiredByType = new Map<string, number>()
  let hadEmptyPoolType = false
  let totalValidCandidates = 0
  let hadFractionalCandidate = false
  let cheapestUnit: { cost: number; currency: string; name: string } | null =
    null

  for (const eligType of eligibleTypes) {
    desiredByType.set(eligType.investmentTypeId, eligType.desired)

    const allTypeInvestments = investmentsForType(eligType.investmentTypeId)
    if (allTypeInvestments.length === 0) {
      hadEmptyPoolType = true
      continue
    }

    // Prefer positive-score investments; fall back to all so the amount is still allocated.
    const scoredPositive = allTypeInvestments.filter((inv) => inv.score > 0)
    const pool = scoredPositive.length > 0 ? scoredPositive : allTypeInvestments
    const priority = pool.filter((inv) => inv.score >= PRIORITY_SCORE_THRESHOLD)
    const selected = priority.length > 0 ? priority : pool

    const cands: Candidate[] = []
    for (const inv of selected) {
      const c = classify(inv, eligType)
      if (!c) continue
      cands.push(c)
      totalValidCandidates += 1
      if (c.kind === 'fractional') {
        hadFractionalCandidate = true
      } else if (
        cheapestUnit == null ||
        c.unitCostContrib < cheapestUnit.cost
      ) {
        cheapestUnit = {
          cost: c.unitCostContrib,
          currency: contributionCurrency,
          name: c.inv.name,
        }
      }
    }
    if (cands.length > 0) {
      candsByType.set(eligType.investmentTypeId, cands)
    }
  }

  // --- Phase A: water-filling target amount per type ---
  // Fill the biggest deficits first so their *remaining* gaps equalize (rather than handing each
  // type a flat proportional slice). This is the whole-amount, worst-deficit-first distribution.
  const sumDesired = eligibleTypes.reduce((s, t) => s + t.desired, 0)
  const fillTotal = Math.min(amount, sumDesired)
  const level = waterLevel(
    eligibleTypes.map((t) => t.desired),
    fillTotal,
  )
  const allocByType = new Map<string, number>()
  for (const t of eligibleTypes) {
    allocByType.set(t.investmentTypeId, Math.max(0, t.desired - level))
  }

  // --- Phase B: split each type's target across its assets, flooring whole units ---
  const allocatedByType = new Map<string, number>()
  let committed = 0
  for (const [typeId, cands] of candsByType) {
    const typeAlloc = allocByType.get(typeId) ?? 0
    if (typeAlloc <= EPSILON) continue
    const totalScore = cands.reduce((s, c) => s + c.score, 0)
    for (const c of cands) {
      const share = totalScore > 0 ? c.score / totalScore : 1 / cands.length
      const rawContrib = typeAlloc * share
      if (c.kind === 'unit') {
        const units = Math.floor((rawContrib + EPSILON) / c.unitCostContrib)
        c.units = units
        c.contrib = units * c.unitCostContrib
      } else {
        c.contrib = rawContrib
      }
      committed += c.contrib
      allocatedByType.set(
        typeId,
        (allocatedByType.get(typeId) ?? 0) + c.contrib,
      )
    }
  }

  // --- Phase C: redeploy the residual (rounding crumbs + money from asset-less types) ---
  // Cross-category, worst-current-deficit-first, in whole units — with fixed income / crypto
  // absorbing fractionally, but only while their category is still under target.
  let remaining = amount - committed
  let iterations = 0
  while (remaining > EPSILON && iterations < MAX_GREEDY_ITERATIONS) {
    iterations += 1

    type Fundable = { typeId: string; key: number; canUnit: boolean }
    const fundable: Fundable[] = []
    for (const [typeId, cands] of candsByType) {
      const key =
        (desiredByType.get(typeId) ?? 0) - (allocatedByType.get(typeId) ?? 0)
      if (key <= EPSILON) continue
      const canUnit = cands.some(
        (c) => c.kind === 'unit' && c.unitCostContrib <= remaining + EPSILON,
      )
      const canFrac = cands.some((c) => c.kind === 'fractional')
      if (!canUnit && !canFrac) continue
      fundable.push({ typeId, key, canUnit })
    }
    if (fundable.length === 0) break

    fundable.sort((a, b) => b.key - a.key)
    const maxKey = fundable[0].key
    const tied = fundable.filter((f) => f.key >= maxKey - EPSILON)
    // Prefer a type that can buy a discrete whole unit — it makes a bounded step and keeps the
    // fill balanced, instead of draining a fractional bucket ahead of the others.
    const worst = tied.find((f) => f.canUnit) ?? tied[0]
    const secondKey = fundable.find((f) => f.typeId !== worst.typeId)?.key ?? 0
    const cands = candsByType.get(worst.typeId)!

    if (worst.canUnit) {
      const affordable = cands.filter(
        (c) => c.kind === 'unit' && c.unitCostContrib <= remaining + EPSILON,
      )
      affordable.sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.unitCostContrib - b.unitCostContrib,
      )
      const best = affordable[0]
      // Buy enough units to bring this type down toward the next-worst level (at least one),
      // capped by what's left — this keeps the loop bounded without overshooting the balance.
      const byLevel = Math.max(
        1,
        Math.floor((worst.key - secondKey) / best.unitCostContrib),
      )
      const byRemaining = Math.floor(
        (remaining + EPSILON) / best.unitCostContrib,
      )
      const n = Math.max(1, Math.min(byLevel, byRemaining))
      const cost = n * best.unitCostContrib
      best.units += n
      best.contrib += cost
      allocatedByType.set(
        worst.typeId,
        (allocatedByType.get(worst.typeId) ?? 0) + cost,
      )
      remaining -= cost
    } else {
      const fracs = cands.filter((c) => c.kind === 'fractional')
      let pour = Math.min(remaining, worst.key - secondKey)
      if (pour <= EPSILON) {
        // Top tier is all fractional and tied — share what's left so none is drained first.
        pour = Math.min(worst.key, remaining / tied.length)
      }
      const totalScore = fracs.reduce((s, c) => s + c.score, 0)
      for (const c of fracs) {
        const share = totalScore > 0 ? c.score / totalScore : 1 / fracs.length
        c.contrib += pour * share
      }
      allocatedByType.set(
        worst.typeId,
        (allocatedByType.get(worst.typeId) ?? 0) + pour,
      )
      remaining -= pour
    }
  }

  // --- Build suggestions from funded candidates (whole-unit rows at 0 units are dropped) ---
  const suggestions: ContributionSuggestion[] = []
  for (const cands of candsByType.values()) {
    for (const c of cands) {
      if (c.kind === 'unit') {
        if (c.units <= 0) continue
      } else if (c.contrib <= EPSILON) {
        continue
      }

      const currentTypeMv = byType.get(c.typeId) ?? 0
      const currentTypePct =
        portfolio.total > 0 ? (currentTypeMv / portfolio.total) * 100 : 0
      const projectedTypePct =
        newTotal > 0
          ? ((currentTypeMv + (allocatedByType.get(c.typeId) ?? 0)) /
              newTotal) *
            100
          : 0

      let suggestedAmount: number
      let suggestedCurrency: string
      let units: number | null

      if (c.kind === 'unit') {
        suggestedAmount = c.units * c.unitPriceAsset
        suggestedCurrency = c.assetCurrency
        units = c.units
      } else if (c.missingQuote) {
        suggestedAmount = c.contrib
        suggestedCurrency = contributionCurrency
        units = null
      } else if (c.isCrypto) {
        suggestedAmount = c.contrib * c.rate
        suggestedCurrency = c.assetCurrency
        units =
          Math.round(((c.contrib * c.rate) / c.unitPriceAsset) * 1e3) / 1e3
      } else if (c.assetCurrency !== contributionCurrency.toUpperCase()) {
        suggestedAmount = c.contrib * c.rate
        suggestedCurrency = c.assetCurrency
        units = null
      } else {
        suggestedAmount = c.contrib
        suggestedCurrency = contributionCurrency
        units = null
      }

      suggestions.push({
        investmentId: c.inv.id,
        investmentName: c.inv.name,
        investmentTypeId: c.typeId,
        investmentTypeName: c.typeName,
        suggestedAmount,
        suggestedCurrency,
        contributionAmount: c.contrib,
        contributionCurrency,
        units,
        contributionPct: amount > 0 ? (c.contrib / amount) * 100 : 0,
        score: c.score,
        missingQuote: c.missingQuote,
        currentTypePct,
        projectedTypePct,
        targetTypePct: c.targetTypePct,
      })
    }
  }

  if (suggestions.length === 0) {
    // Nothing could be bought. Distinguish "amount too small for a single unit" from
    // "no eligible investments at all".
    if (
      cheapestUnit != null &&
      !hadFractionalCandidate &&
      amount + EPSILON < cheapestUnit.cost
    ) {
      return {
        reason: 'AMOUNT_BELOW_MIN',
        suggestions: [],
        minUnitAmount: cheapestUnit.cost,
        minUnitCurrency: cheapestUnit.currency,
        minUnitName: cheapestUnit.name,
      }
    }
    if (totalValidCandidates === 0 && !hadEmptyPoolType) {
      return { reason: 'NO_ELIGIBLE_INVESTMENTS', suggestions: [] }
    }
  }

  const totalContrib = suggestions.reduce((s, c) => s + c.contributionAmount, 0)
  const unallocatedAmount = Math.max(0, amount - totalContrib)

  const typeSortOrderById = new Map(
    typeRows.map((t) => [t.investmentTypeId, t.typeSortOrder]),
  )
  suggestions.sort((a, b) => {
    const sa = typeSortOrderById.get(a.investmentTypeId) ?? 0
    const sb = typeSortOrderById.get(b.investmentTypeId) ?? 0
    if (sa !== sb) return sa - sb
    return b.contributionPct - a.contributionPct
  })

  // Projections for all types with holdings (including those not receiving a contribution).
  const contributedProj = new Map<
    string,
    { currentTypePct: number; projectedTypePct: number; targetTypePct: number }
  >()
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
      typeProjections.push({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        ...proj,
      })
    } else if (currentMv > 0) {
      typeProjections.push({
        investmentTypeId: t.investmentTypeId,
        investmentTypeName: t.investmentTypeName,
        currentTypePct:
          portfolio.total > 0 ? (currentMv / portfolio.total) * 100 : 0,
        projectedTypePct: newTotal > 0 ? (currentMv / newTotal) * 100 : 0,
        targetTypePct: targetsMap[t.investmentTypeId]?.targetPct ?? 0,
      })
    }
  }

  return { reason: 'OK', suggestions, typeProjections, unallocatedAmount }
}

/**
 * Water-filling level L such that Σ max(0, desired_i − L) = fillTotal.
 * Returns 0 when fillTotal covers (or exceeds) every deficit.
 */
function waterLevel(desired: number[], fillTotal: number): number {
  if (fillTotal <= 0) {
    return desired.length > 0 ? Math.max(...desired) : 0
  }
  const sorted = [...desired].sort((a, b) => b - a)
  let prefix = 0
  for (let i = 0; i < sorted.length; i++) {
    const active = i + 1
    const nextLevel = i + 1 < sorted.length ? sorted[i + 1] : 0
    const capacity = active * (sorted[i] - nextLevel)
    if (prefix + capacity >= fillTotal) {
      return sorted[i] - (fillTotal - prefix) / active
    }
    prefix += capacity
  }
  return 0
}
