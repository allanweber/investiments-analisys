import { compareInvestmentsByRank, type InvestmentOverviewRow } from '#/lib/investment-scoring'

type AllocationRow = {
  investmentTypeId: string
  currentPct: number
}

type TargetRow = {
  investmentTypeId: string
  investmentTypeName: string
  typeSortOrder: number
  targetPct: number
}

export type DriftRow = {
  investmentTypeId: string
  investmentTypeName: string
  currentPct: number
  targetPct: number
  delta: number
  status: 'SEM_META' | 'ACIMA' | 'ABAIXO' | 'EM_ALVO'
}

export type SuggestionRow = {
  investmentTypeId: string
  investmentTypeName: string
  deltaPct: number
  investmentId: string
  investmentName: string
  score: number
}

function computeAllocationDrift(allocation: AllocationRow[], targets: TargetRow[]): DriftRow[] {
  const allocByTypeId = new Map(allocation.map((a) => [a.investmentTypeId, a]))
  return targets
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
}

function computeRebalanceSuggestions(
  drift: DriftRow[],
  scoredInvestments: InvestmentOverviewRow[],
): SuggestionRow[] {
  const byTypeId = new Map<string, InvestmentOverviewRow[]>()
  for (const r of scoredInvestments) {
    const list = byTypeId.get(r.investmentTypeId) ?? []
    list.push(r)
    byTypeId.set(r.investmentTypeId, list)
  }
  return drift
    .filter((d) => d.targetPct > 0 && d.currentPct < d.targetPct)
    .map((d) => {
      const list = byTypeId.get(d.investmentTypeId) ?? []
      if (list.length === 0) return null
      const best = [...list].sort(compareInvestmentsByRank)[0]!
      return {
        investmentTypeId: d.investmentTypeId,
        investmentTypeName: d.investmentTypeName,
        deltaPct: d.targetPct - d.currentPct,
        investmentId: best.id,
        investmentName: best.name,
        score: best.score,
      }
    })
    .filter(Boolean) as SuggestionRow[]
}

export function analyzePortfolioAllocation(params: {
  allocation: AllocationRow[]
  targets: TargetRow[]
  scoredInvestments: InvestmentOverviewRow[]
}): { drift: DriftRow[]; suggestions: SuggestionRow[] } {
  const drift = computeAllocationDrift(params.allocation, params.targets)
  const suggestions = computeRebalanceSuggestions(drift, params.scoredInvestments)
  return { drift, suggestions }
}
