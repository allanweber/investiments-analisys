import { describe, expect, it } from 'vitest'

import { buildRateMatrix } from '@/lib/fx'
import type { InvestmentOverviewRow } from '@/lib/investment-scoring'
import type { AporteInput, AportePortfolioState, AporteTypeRow } from './aporte-algorithm'
import { PRIORITY_SCORE_THRESHOLD, simulateAporte } from './aporte-algorithm'

// --- helpers ---

function makeInv(
  overrides: Partial<InvestmentOverviewRow> & { id: string; investmentTypeId: string; score: number },
): InvestmentOverviewRow {
  return {
    name: overrides.id,
    ticker: overrides.id,
    currency: null,
    typeName: 'Tipo',
    typeSortOrder: 1,
    fixedIncome: false,
    active: true,
    activeQuestionCount: 1,
    answeredActiveCount: 1,
    lastAiCheckedAt: null,
    ...overrides,
  }
}

function makeType(
  investmentTypeId: string,
  overrides?: Partial<AporteTypeRow>,
): AporteTypeRow {
  return {
    investmentTypeId,
    investmentTypeName: `Tipo ${investmentTypeId}`,
    typeSortOrder: 1,
    ...overrides,
  }
}

const emptyPortfolio: AportePortfolioState = { total: 0, byType: new Map() }

const identityMatrix = buildRateMatrix([
  { baseCurrency: 'BRL', quoteCurrency: 'USD', rate: 0.2 },
  { baseCurrency: 'BRL', quoteCurrency: 'EUR', rate: 0.17 },
])

function baseInput(overrides?: Partial<AporteInput>): AporteInput {
  return {
    amount: 1000,
    contributionCurrency: 'BRL',
    portfolio: emptyPortfolio,
    targetsMap: {},
    typeRows: [],
    scoredInvestments: [],
    quoteBySymbol: new Map(),
    fxMatrix: identityMatrix,
    ...overrides,
  }
}

// --- tests ---

describe('simulateAporte — NO_TARGETS', () => {
  it('returns NO_TARGETS when targetsMap is empty', () => {
    const result = simulateAporte(baseInput({ targetsMap: {} }))
    expect(result.reason).toBe('NO_TARGETS')
    expect(result.suggestions).toEqual([])
  })
})

describe('simulateAporte — NO_ELIGIBLE_INVESTMENTS', () => {
  it('returns NO_ELIGIBLE_INVESTMENTS when eligible types have no scorable investments', () => {
    const typeId = 'ti-1'
    const result = simulateAporte(
      baseInput({
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        // all investments have score = 0 → no suggestions generated
        scoredInvestments: [makeInv({ id: 'inv-1', investmentTypeId: typeId, score: 0 })],
      }),
    )
    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })
})

describe('simulateAporte — deficit-proportional distribution', () => {
  it('allocates proportionally to deficit across two under-allocated types', () => {
    const rf = 'ti-rf'
    const rv = 'ti-rv'

    const result = simulateAporte(
      baseInput({
        amount: 10_000,
        targetsMap: {
          [rf]: { targetPct: 60 },
          [rv]: { targetPct: 40 },
        },
        typeRows: [makeType(rf, { typeSortOrder: 1 }), makeType(rv, { typeSortOrder: 2 })],
        portfolio: {
          total: 10_000,
          byType: new Map([
            [rf, { marketValue: 3_000 }],
            [rv, { marketValue: 3_000 }],
          ]),
        },
        scoredInvestments: [
          makeInv({ id: 'inv-rf', investmentTypeId: rf, score: 5, fixedIncome: true, typeName: 'RF' }),
          makeInv({ id: 'inv-rv', investmentTypeId: rv, score: 5, fixedIncome: false, typeName: 'RV' }),
        ],
        quoteBySymbol: new Map([['inv-rv', { price: 10, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return

    // newTotal = 10000 + 10000 = 20000
    // rf needed = 60% × 20000 − 3000 = 9000
    // rv needed = 40% × 20000 − 3000 = 5000, total needed = 14000
    // rf gets 9000/14000 ≈ 64.29%, rv gets 5000/14000 ≈ 35.71%
    const rfSug = result.suggestions.find((s) => s.investmentId === 'inv-rf')!
    const rvSug = result.suggestions.find((s) => s.investmentId === 'inv-rv')!

    expect(rfSug.contributionPct).toBeCloseTo(64.2857, 3)
    expect(rvSug.contributionPct).toBeCloseTo(35.7143, 3)
  })
})

describe('simulateAporte — types at/above post-aporte target excluded', () => {
  it('excludes types that exceed target even in the post-aporte world', () => {
    // atTarget: 900/1000 = 90%, target = 50%
    // newTotal = 1000 + 100 = 1100
    // atTarget needed = 50% × 1100 − 900 = 550 − 900 = −350 → excluded
    // below needed = 50% × 1100 − 0 = 550 > 0 → eligible
    const atTarget = 'ti-at'
    const below = 'ti-below'

    const result = simulateAporte(
      baseInput({
        amount: 100,
        targetsMap: {
          [atTarget]: { targetPct: 50 },
          [below]: { targetPct: 50 },
        },
        typeRows: [makeType(atTarget), makeType(below)],
        portfolio: {
          total: 1000,
          byType: new Map([
            [atTarget, { marketValue: 900 }],
            [below, { marketValue: 0 }],
          ]),
        },
        scoredInvestments: [
          makeInv({ id: 'at-inv', investmentTypeId: atTarget, score: 5 }),
          makeInv({ id: 'below-inv', investmentTypeId: below, score: 5 }),
        ],
        quoteBySymbol: new Map([
          ['at-inv', { price: 10, currency: 'BRL' }],
          ['below-inv', { price: 10, currency: 'BRL' }],
        ]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'at-inv')).toBe(false)
    expect(result.suggestions.some((s) => s.investmentId === 'below-inv')).toBe(true)
  })
})

describe('simulateAporte — PriorityInvestments filter', () => {
  it(`uses only investments with score >= ${PRIORITY_SCORE_THRESHOLD} when any exist`, () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'high', investmentTypeId: typeId, score: 80 }),
          makeInv({ id: 'low', investmentTypeId: typeId, score: 5 }),
        ],
        quoteBySymbol: new Map([
          ['high', { price: 10, currency: 'BRL' }],
          ['low', { price: 10, currency: 'BRL' }],
        ]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'high')).toBe(true)
    expect(result.suggestions.some((s) => s.investmentId === 'low')).toBe(false)
  })
})

describe('simulateAporte — proportional-to-score within type', () => {
  it('distributes amounts proportionally to scores', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 900,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          // all below PRIORITY_SCORE_THRESHOLD so all three compete proportionally
          makeInv({ id: 'a', investmentTypeId: typeId, score: 6 }),
          makeInv({ id: 'b', investmentTypeId: typeId, score: 3 }),
          makeInv({ id: 'c', investmentTypeId: typeId, score: 1 }),
        ],
        quoteBySymbol: new Map([
          ['a', { price: 1, currency: 'BRL' }],
          ['b', { price: 1, currency: 'BRL' }],
          ['c', { price: 1, currency: 'BRL' }],
        ]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return

    const sa = result.suggestions.find((s) => s.investmentId === 'a')!
    const sb = result.suggestions.find((s) => s.investmentId === 'b')!
    const sc = result.suggestions.find((s) => s.investmentId === 'c')!

    // total score = 10, shares: a=60%, b=30%, c=10%
    expect(sa.contributionPct).toBeCloseTo(60, 5)
    expect(sb.contributionPct).toBeCloseTo(30, 5)
    expect(sc.contributionPct).toBeCloseTo(10, 5)
  })
})

describe('simulateAporte — type skipped when no eligible investments', () => {
  it('skips a type where all investments have score = 0', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'zero', investmentTypeId: typeId, score: 0 }),
        ],
      }),
    )

    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })
})

describe('simulateAporte — floor on units', () => {
  it('floors fractional units for renda variável', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 150,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [makeInv({ id: 'inv', investmentTypeId: typeId, score: 5 })],
        // price = 100 → amount 150 / 100 = 1.5 → floor = 1
        quoteBySymbol: new Map([['inv', { price: 100, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions[0].units).toBe(1)
  })
})

describe('simulateAporte — missing FxRate excludes investment', () => {
  it('silently excludes renda variável investment when FxRate pair is absent', () => {
    const typeId = 'ti-1'
    const emptyMatrix = buildRateMatrix([])

    const result = simulateAporte(
      baseInput({
        amount: 1000,
        contributionCurrency: 'BRL',
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [makeInv({ id: 'inv', investmentTypeId: typeId, score: 5 })],
        // quote currency is JPY — no BRL→JPY rate in matrix
        quoteBySymbol: new Map([['inv', { price: 50, currency: 'JPY' }]]),
        fxMatrix: emptyMatrix,
      }),
    )

    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })
})
