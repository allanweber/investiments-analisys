import { describe, expect, it } from 'vitest'

import { buildRateMatrix } from '@/lib/fx'
import type { InvestmentOverviewRow } from '@/lib/investment-scoring'
import type {
  AporteInput,
  AportePortfolioState,
  AporteTypeRow,
} from './aporte-algorithm'
import { PRIORITY_SCORE_THRESHOLD, simulateAporte } from './aporte-algorithm'

// --- helpers ---

function makeInv(
  overrides: Partial<InvestmentOverviewRow> & {
    id: string
    investmentTypeId: string
    score: number
  },
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

const emptyPortfolio: AportePortfolioState = { total: 0, holdings: [] }

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
  it('returns NO_ELIGIBLE_INVESTMENTS only when there are no target types at all', () => {
    const result = simulateAporte(
      baseInput({
        targetsMap: { 'ti-1': { targetPct: 0 } },
        typeRows: [makeType('ti-1')],
        scoredInvestments: [],
      }),
    )
    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })

  it('falls back to zero-score investments in a type rather than leaving the amount unallocated', () => {
    const typeId = 'ti-1'
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        // all investments have score = 0 → still eligible as a last resort
        scoredInvestments: [
          makeInv({ id: 'inv-1', investmentTypeId: typeId, score: 0 }),
        ],
      }),
    )
    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'inv-1')).toBe(
      true,
    )
    expect(result.unallocatedAmount).toBeCloseTo(0, 5)
  })
})

describe('simulateAporte — water-filling distribution across types', () => {
  it('fills the biggest deficits first so the remaining gaps equalize', () => {
    const rf = 'ti-rf'
    const rv = 'ti-rv'

    const result = simulateAporte(
      baseInput({
        amount: 10_000,
        targetsMap: {
          [rf]: { targetPct: 60 },
          [rv]: { targetPct: 40 },
        },
        typeRows: [
          makeType(rf, { typeSortOrder: 1 }),
          makeType(rv, { typeSortOrder: 2 }),
        ],
        portfolio: {
          total: 10_000,
          holdings: [
            { investmentTypeId: rf, currency: 'BRL', marketValue: 3_000 },
            { investmentTypeId: rv, currency: 'BRL', marketValue: 3_000 },
          ],
        },
        scoredInvestments: [
          makeInv({
            id: 'inv-rf',
            investmentTypeId: rf,
            score: 5,
            fixedIncome: true,
            typeName: 'RF',
          }),
          makeInv({
            id: 'inv-rv',
            investmentTypeId: rv,
            score: 5,
            fixedIncome: false,
            typeName: 'RV',
          }),
        ],
        quoteBySymbol: new Map([['inv-rv', { price: 10, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return

    // newTotal = 10000 + 10000 = 20000
    // rf deficit = 60% × 20000 − 3000 = 9000, rv deficit = 40% × 20000 − 3000 = 5000
    // amount 10000 < 14000 total deficit → water level L solves (9000−L)+(5000−L)=10000 → L=2000
    // rf gets 9000−2000 = 7000 (70%), rv gets 5000−2000 = 3000 (30%): remaining gaps equalize at 2000
    const rfSug = result.suggestions.find((s) => s.investmentId === 'inv-rf')!
    const rvSug = result.suggestions.find((s) => s.investmentId === 'inv-rv')!

    expect(rfSug.contributionPct).toBeCloseTo(70, 3)
    expect(rvSug.contributionPct).toBeCloseTo(30, 3)
  })
})

describe('simulateAporte — whole-unit rounding and residual redistribution', () => {
  it('caps the suggested amount at whole units instead of inflating it', () => {
    const typeId = 'ti-1'
    // Mirrors the reported bug: R$300 routed to an asset priced R$152 must suggest 1 unit at
    // R$152 (not the raw R$300), leaving the R$148 remainder unallocated rather than advertised.
    const result = simulateAporte(
      baseInput({
        amount: 300,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'inv', investmentTypeId: typeId, score: 5 }),
        ],
        quoteBySymbol: new Map([['inv', { price: 152, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    const sug = result.suggestions.find((s) => s.investmentId === 'inv')!
    expect(sug.units).toBe(1)
    expect(sug.suggestedAmount).toBeCloseTo(152, 5)
    expect(sug.contributionAmount).toBeCloseTo(152, 5)
    expect(result.unallocatedAmount).toBeCloseTo(148, 5)
  })

  it('hides whole-unit rows that cannot afford a single unit and redeploys their money', () => {
    const typeId = 'ti-1'
    // The pricey asset gets a small score-share (100) that cannot buy a 1000-priced unit, so its
    // money is redeployed to the cheap asset instead of showing a "buy 0 units" row.
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'pricey', investmentTypeId: typeId, score: 1 }),
          makeInv({ id: 'cheap', investmentTypeId: typeId, score: 9 }),
        ],
        quoteBySymbol: new Map([
          ['pricey', { price: 1000, currency: 'BRL' }],
          ['cheap', { price: 10, currency: 'BRL' }],
        ]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'pricey')).toBe(
      false,
    )
    const cheap = result.suggestions.find((s) => s.investmentId === 'cheap')!
    expect(cheap.units).toBe(100)
    expect(result.unallocatedAmount).toBeCloseTo(0, 5)
  })

  it('lets fixed income absorb the residual left by whole-unit rounding while under target', () => {
    const rv = 'ti-rv'
    const rf = 'ti-rf'
    // newTotal = 1000 + 700 = 1700 → each deficit = 50% × 1700 − 100 = 750, total 1500 > 700.
    // Water level 400 → rv and rf each targeted at 350. rv (price 250) floors to 1 unit (250),
    // leaving 100; rf is still under target, so it absorbs that 100 fractionally (350 → 450)
    // rather than the money being parked as unallocated.
    const result = simulateAporte(
      baseInput({
        amount: 700,
        targetsMap: {
          [rv]: { targetPct: 50 },
          [rf]: { targetPct: 50 },
        },
        typeRows: [
          makeType(rv, { typeSortOrder: 1 }),
          makeType(rf, { typeSortOrder: 2 }),
        ],
        portfolio: {
          total: 1000,
          holdings: [
            { investmentTypeId: rv, currency: 'BRL', marketValue: 100 },
            { investmentTypeId: rf, currency: 'BRL', marketValue: 100 },
          ],
        },
        scoredInvestments: [
          makeInv({
            id: 'inv-rv',
            investmentTypeId: rv,
            score: 5,
            fixedIncome: false,
            typeName: 'RV',
          }),
          makeInv({
            id: 'inv-rf',
            investmentTypeId: rf,
            score: 5,
            fixedIncome: true,
            typeName: 'RF',
          }),
        ],
        quoteBySymbol: new Map([['inv-rv', { price: 250, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    const rvSug = result.suggestions.find((s) => s.investmentId === 'inv-rv')!
    const rfSug = result.suggestions.find((s) => s.investmentId === 'inv-rf')!
    expect(rvSug.units).toBe(1)
    expect(rvSug.contributionAmount).toBeCloseTo(250, 5)
    expect(rfSug.contributionAmount).toBeCloseTo(450, 5)
    expect(result.unallocatedAmount).toBeCloseTo(0, 5)
  })

  it('returns AMOUNT_BELOW_MIN when the amount cannot buy a single unit of the cheapest asset', () => {
    const typeId = 'ti-1'
    const result = simulateAporte(
      baseInput({
        amount: 100,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({
            id: 'inv',
            investmentTypeId: typeId,
            score: 5,
            name: 'Fundo X',
          }),
        ],
        quoteBySymbol: new Map([['inv', { price: 500, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('AMOUNT_BELOW_MIN')
    if (result.reason !== 'AMOUNT_BELOW_MIN') return
    expect(result.minUnitAmount).toBeCloseTo(500, 5)
    expect(result.minUnitName).toBe('Fundo X')
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
          holdings: [
            { investmentTypeId: atTarget, currency: 'BRL', marketValue: 900 },
          ],
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
    expect(result.suggestions.some((s) => s.investmentId === 'at-inv')).toBe(
      false,
    )
    expect(result.suggestions.some((s) => s.investmentId === 'below-inv')).toBe(
      true,
    )
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
  it('sends the whole amount to unallocatedAmount only when the type has no investments at all', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [],
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions).toEqual([])
    expect(result.unallocatedAmount).toBeCloseTo(1000, 5)
  })

  it("splits evenly across a type's investments when all have score = 0, instead of parking as unallocated", () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'zero-a', investmentTypeId: typeId, score: 0 }),
          makeInv({ id: 'zero-b', investmentTypeId: typeId, score: 0 }),
        ],
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.unallocatedAmount).toBeCloseTo(0, 5)
    const sa = result.suggestions.find((s) => s.investmentId === 'zero-a')!
    const sb = result.suggestions.find((s) => s.investmentId === 'zero-b')!
    expect(sa.contributionPct).toBeCloseTo(50, 5)
    expect(sb.contributionPct).toBeCloseTo(50, 5)
  })
})

describe('simulateAporte — excludedInvestmentIds', () => {
  it('redistributes an excluded investment share to remaining investments in the same type', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 900,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'a', investmentTypeId: typeId, score: 6 }),
          makeInv({ id: 'b', investmentTypeId: typeId, score: 3 }),
          makeInv({ id: 'c', investmentTypeId: typeId, score: 1 }),
        ],
        quoteBySymbol: new Map([
          ['a', { price: 1, currency: 'BRL' }],
          ['b', { price: 1, currency: 'BRL' }],
          ['c', { price: 1, currency: 'BRL' }],
        ]),
        excludedInvestmentIds: ['a'],
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'a')).toBe(false)
    // total score among remaining = 4, shares: b=75%, c=25%
    const sb = result.suggestions.find((s) => s.investmentId === 'b')!
    const sc = result.suggestions.find((s) => s.investmentId === 'c')!
    expect(sb.contributionPct).toBeCloseTo(75, 5)
    expect(sc.contributionPct).toBeCloseTo(25, 5)
    expect(result.unallocatedAmount).toBe(0)
  })

  it('sends the full type share to unallocatedAmount when every investment in the type is excluded', () => {
    const typeId = 'ti-1'

    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [typeId]: { targetPct: 100 } },
        typeRows: [makeType(typeId)],
        scoredInvestments: [
          makeInv({ id: 'a', investmentTypeId: typeId, score: 5 }),
        ],
        quoteBySymbol: new Map([['a', { price: 1, currency: 'BRL' }]]),
        excludedInvestmentIds: ['a'],
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions).toEqual([])
    expect(result.unallocatedAmount).toBeCloseTo(1000, 5)
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
        scoredInvestments: [
          makeInv({ id: 'inv', investmentTypeId: typeId, score: 5 }),
        ],
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
        scoredInvestments: [
          makeInv({ id: 'inv', investmentTypeId: typeId, score: 5 }),
        ],
        // quote currency is JPY — no BRL→JPY rate in matrix
        quoteBySymbol: new Map([['inv', { price: 50, currency: 'JPY' }]]),
        fxMatrix: emptyMatrix,
      }),
    )

    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })
})

describe('simulateAporte — ETF reclassification when ETF target is 0', () => {
  const etfId = 'ti-etf'
  const acoesId = 'ti-acoes'
  const acoesIntlId = 'ti-acoes-intl'

  const typeRows = [
    makeType(etfId, { investmentTypeName: 'ETF', typeSortOrder: 3 }),
    makeType(acoesId, { investmentTypeName: 'Ações', typeSortOrder: 1 }),
    makeType(acoesIntlId, {
      investmentTypeName: 'Ações internacionais',
      typeSortOrder: 2,
    }),
  ]

  it('folds a BRL ETF holding into Ações current market value, excluding it from the deficit once it already covers the target', () => {
    const below = 'ti-below'
    const result = simulateAporte(
      baseInput({
        amount: 100,
        targetsMap: {
          [etfId]: { targetPct: 0 },
          [acoesId]: { targetPct: 50 },
          [below]: { targetPct: 50 },
        },
        typeRows: [
          ...typeRows,
          makeType(below, { investmentTypeName: 'Outro', typeSortOrder: 4 }),
        ],
        portfolio: {
          total: 1000,
          holdings: [
            { investmentTypeId: etfId, currency: 'BRL', marketValue: 550 },
          ],
        },
        scoredInvestments: [
          makeInv({
            id: 'brl-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'BRL',
            score: 5,
          }),
          makeInv({
            id: 'below-inv',
            investmentTypeId: below,
            typeName: 'Outro',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([
          ['brl-etf', { price: 10, currency: 'BRL' }],
          ['below-inv', { price: 10, currency: 'BRL' }],
        ]),
      }),
    )

    // newTotal = 1100, Ações needed = 50% × 1100 − 550 (folded ETF mv) = 0 → not eligible,
    // so the ETF-backed Ações bucket gets nothing while the other under-allocated type does.
    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'brl-etf')).toBe(
      false,
    )
    expect(result.suggestions.some((s) => s.investmentId === 'below-inv')).toBe(
      true,
    )
  })

  it('treats a reclassified BRL ETF as a candidate for the Ações deficit, grouped under Ações', () => {
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: {
          [etfId]: { targetPct: 0 },
          [acoesId]: { targetPct: 100 },
        },
        typeRows,
        scoredInvestments: [
          makeInv({
            id: 'brl-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'BRL',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([['brl-etf', { price: 10, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    const sug = result.suggestions.find((s) => s.investmentId === 'brl-etf')!
    expect(sug).toBeDefined()
    // suggestion is grouped under the destination category it funded (Ações), so the UI
    // (which groups by investmentTypeId against typeProjections) renders it correctly
    expect(sug.investmentTypeId).toBe(acoesId)
    expect(sug.investmentTypeName).toBe('Ações')
    expect(sug.targetTypePct).toBe(100)
  })

  it('routes a non-BRL ETF into Ações internacionais instead', () => {
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: {
          [etfId]: { targetPct: 0 },
          [acoesIntlId]: { targetPct: 100 },
        },
        typeRows,
        scoredInvestments: [
          makeInv({
            id: 'usd-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'USD',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([['usd-etf', { price: 10, currency: 'USD' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    expect(result.suggestions.some((s) => s.investmentId === 'usd-etf')).toBe(
      true,
    )
  })

  it('excludes an ETF when its destination category does not exist', () => {
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: { [etfId]: { targetPct: 0 } },
        // no Ações / Ações internacionais categories at all
        typeRows: [makeType(etfId, { investmentTypeName: 'ETF' })],
        scoredInvestments: [
          makeInv({
            id: 'orphan-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'BRL',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([
          ['orphan-etf', { price: 10, currency: 'BRL' }],
        ]),
      }),
    )

    expect(result.reason).toBe('NO_ELIGIBLE_INVESTMENTS')
  })

  it('does not reclassify ETF when its target is above 0', () => {
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: {
          [etfId]: { targetPct: 100 },
          [acoesId]: { targetPct: 0 },
        },
        typeRows,
        scoredInvestments: [
          makeInv({
            id: 'brl-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'BRL',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([['brl-etf', { price: 10, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    const sug = result.suggestions.find((s) => s.investmentId === 'brl-etf')!
    expect(sug.targetTypePct).toBe(100)
  })

  it('folds the reclassified ETF market value into the Ações row in typeProjections', () => {
    const result = simulateAporte(
      baseInput({
        amount: 1000,
        targetsMap: {
          [etfId]: { targetPct: 0 },
          [acoesId]: { targetPct: 100 },
        },
        typeRows,
        portfolio: {
          total: 500,
          holdings: [
            { investmentTypeId: etfId, currency: 'BRL', marketValue: 500 },
          ],
        },
        scoredInvestments: [
          makeInv({
            id: 'brl-etf',
            investmentTypeId: etfId,
            typeName: 'ETF',
            currency: 'BRL',
            score: 5,
          }),
        ],
        quoteBySymbol: new Map([['brl-etf', { price: 10, currency: 'BRL' }]]),
      }),
    )

    expect(result.reason).toBe('OK')
    if (result.reason !== 'OK') return
    const acoesProj = result.typeProjections.find(
      (p) => p.investmentTypeId === acoesId,
    )!
    expect(acoesProj).toBeDefined()
    expect(acoesProj.currentTypePct).toBeCloseTo(100, 5) // 500/500 folded in fully
    // no separate ETF row since all of its value was folded into Ações
    expect(
      result.typeProjections.some((p) => p.investmentTypeId === etfId),
    ).toBe(false)
  })
})
