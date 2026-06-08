import { describe, expect, it } from 'vitest'

import { calculateInvestment } from '@/lib/renda-fixa/products'

import { approxBusinessDays, buildRendaFixaValuationRow } from './renda-fixa-valuation'
import type { RendaFixaDetailInput } from './renda-fixa-valuation'

// Fixed reference date used in all cases — makes calendarDays deterministic.
const TODAY = new Date('2025-06-04T00:00:00.000Z')

function daysAgo(n: number): Date {
  return new Date(TODAY.getTime() - n * 86_400_000)
}

const STUB_RATES = {
  cdiAnnual: 0.105,
  selicAnnual: 0.105,
  ipcaMonthly: [] as readonly number[],
  ipcaAccumulated12m: 0.0483,
  igpmMonthly: [] as readonly number[],
  igpmAccumulated12m: 0.035,
  asOf: null,
}

// ---------------------------------------------------------------------------
// approxBusinessDays
// ---------------------------------------------------------------------------

describe('approxBusinessDays', () => {
  it('returns 0 for same-day', () => {
    const d = new Date('2025-06-04T00:00:00Z')
    expect(approxBusinessDays(d, d)).toBe(0)
  })

  it('returns 0 when to < from', () => {
    const from = new Date('2025-06-04T00:00:00Z')
    const to = new Date('2025-06-01T00:00:00Z')
    expect(approxBusinessDays(from, to)).toBe(0)
  })

  it('Mon → Mon (7 calendar days) = 5 weekdays', () => {
    // 2025-06-02 is Monday
    const from = new Date('2025-06-02T00:00:00Z')
    const to = new Date('2025-06-09T00:00:00Z')
    expect(approxBusinessDays(from, to)).toBe(5)
  })

  it('Mon → Mon (14 calendar days) = 10 weekdays', () => {
    const from = new Date('2025-06-02T00:00:00Z')
    const to = new Date('2025-06-16T00:00:00Z')
    expect(approxBusinessDays(from, to)).toBe(10)
  })

  it('counts correctly across a single weekend', () => {
    // Wed → Wed spanning one weekend = 5 weekdays
    const from = new Date('2025-06-04T00:00:00Z') // Wed
    const to = new Date('2025-06-11T00:00:00Z')   // Wed
    expect(approxBusinessDays(from, to)).toBe(5)
  })

  it('Fri → Mon = 1 weekday (Friday; Sat+Sun are skipped)', () => {
    // From Fri to Mon: 3 calendar days, Fri is the one weekday elapsed.
    const from = new Date('2025-05-30T00:00:00Z') // Fri
    const to = new Date('2025-06-02T00:00:00Z')   // Mon
    expect(approxBusinessDays(from, to)).toBe(1)
  })

  it('Sat → Mon = 0 weekdays (both elapsed days are weekend)', () => {
    const from = new Date('2025-05-31T00:00:00Z') // Sat
    const to = new Date('2025-06-02T00:00:00Z')   // Mon
    expect(approxBusinessDays(from, to)).toBe(0)
  })

  it('is consistent with 252 business-day year approximation (~5/7 of 365)', () => {
    // A full 365-day year starting on a weekday contains 261 weekdays (52*5 + 1).
    // Starting on Mon 2024-06-03 → 2025-06-03 = 365 calendar days.
    const from = new Date('2024-06-03T00:00:00Z')
    const to = new Date('2025-06-03T00:00:00Z')
    const bd = approxBusinessDays(from, to)
    expect(bd).toBeGreaterThanOrEqual(260)
    expect(bd).toBeLessThanOrEqual(262)
  })
})

// ---------------------------------------------------------------------------
// buildRendaFixaValuationRow — plan cases (pre indexer, deterministic)
// ---------------------------------------------------------------------------

describe('buildRendaFixaValuationRow — plan cases (pre indexer)', () => {
  // CDB BMG - NOV/2026 — from plan-cases.test.ts
  it('CDB BMG (pre, 737 days): netAmount ≈ 12282.14', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.125',
      purchaseDate: daysAgo(737),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(12282.14, 2)
    expect(Number(row.ir)).toBeCloseTo(402.73, 2)
    expect(row.liquidityBlocked).toBe(false)
    expect(row.carenciaDays).toBe(0)
    expect(row.calendarDays).toBe(737)
    expect(row.indexerAnnual).toBeNull()
    expect(row.computedAt).toBe(TODAY)
  })

  // LCI BANCO INTER - AGO/2026 — from plan-cases.test.ts
  it('LCI BANCO INTER (pre, tax-exempt, 291 days): netAmount ≈ 10976.75', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'lci',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.124',
      purchaseDate: daysAgo(291),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(10976.75, 2)
    expect(Number(row.ir)).toBe(0)
    expect(Number(row.iof)).toBe(0)
    // LCI carencia = 90 days; 291 > 90 → unblocked
    expect(row.liquidityBlocked).toBe(false)
    expect(row.carenciaDays).toBe(90)
  })

  // LCA AGROLEND - MAI/2028 — from plan-cases.test.ts
  it('LCA AGROLEND (pre, tax-exempt, 732 days): netAmount ≈ 18258.94', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'lca',
      indexer: 'pre',
      capital: '15000',
      annualRate: '0.103',
      purchaseDate: daysAgo(732),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(18258.94, 2)
    expect(Number(row.ir)).toBe(0)
    expect(Number(row.iof)).toBe(0)
  })

  // Tesouro Prefixado 2027 — from plan-cases.test.ts (no market data → plain pre path)
  it('Tesouro Prefixado (pre, 513 days): netAmount ≈ 14240.24', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'tesouro-prefixado',
      indexer: 'pre',
      capital: '11995.04',
      annualRate: '0.1566',
      purchaseDate: daysAgo(513),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(14240.24, 2)
    expect(Number(row.ir)).toBeCloseTo(476.25, 2)
  })
})

// ---------------------------------------------------------------------------
// buildRendaFixaValuationRow — rate resolution by indexer
// ---------------------------------------------------------------------------

describe('buildRendaFixaValuationRow — rate resolution', () => {
  it('CDI: ignores stored annualRate=0, uses rates.cdiAnnual', () => {
    const rates = { ...STUB_RATES, cdiAnnual: 0.11 }
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'cdi',
      capital: '10000',
      annualRate: '0',      // stored as 0 for floating products
      purchaseDate: daysAgo(365),
      multiplier: null,
    }
    const direct = calculateInvestment({
      productType: 'cdb',
      indexer: 'cdi',
      capital: 10000,
      annualRate: 0.11,
      calendarDays: 365,
      businessDays: approxBusinessDays(daysAgo(365), TODAY),
    })
    const row = buildRendaFixaValuationRow(detail, rates, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(direct.netAmount, 6)
    expect(row.indexerAnnual).toBe('0.11')
  })

  it('selic-spread (spread=0): uses rates.selicAnnual as effective rate', () => {
    const rates = { ...STUB_RATES, selicAnnual: 0.1075 }
    const calendarDays = 812
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)
    const detail: RendaFixaDetailInput = {
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: '6067.47',
      annualRate: '0',  // spread = 0 → effective = selicAnnual
      purchaseDate,
      multiplier: null,
    }
    const direct = calculateInvestment({
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: 6067.47,
      annualRate: 0.1075,
      calendarDays,
      businessDays,
    })
    const row = buildRendaFixaValuationRow(detail, rates, TODAY)
    expect(Number(row.grossAmount)).toBeCloseTo(direct.grossAmount, 6)
    expect(row.indexerAnnual).toBe('0.1075')
  })

  it('IPCA: uses rates.ipcaAccumulated12m as indexRate', () => {
    // Note: when ipcaMonthly is [] (empty), buildAccumulatedIndexFactor([]) = 1 (truthy array
    // takes the monthly path). The direct call must also pass monthlyRates:[] to match.
    const rates = { ...STUB_RATES, ipcaAccumulated12m: 0.055, ipcaMonthly: [] as readonly number[] }
    const calendarDays = 365
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)
    const detail: RendaFixaDetailInput = {
      productType: 'tesouro-ipca',
      indexer: 'ipca',
      capital: '6430.2',
      annualRate: '0.06',
      purchaseDate,
      multiplier: null,
    }
    const direct = calculateInvestment({
      productType: 'tesouro-ipca',
      indexer: 'ipca',
      capital: 6430.2,
      annualRate: 0.06,
      calendarDays,
      businessDays,
      indexRate: 0.055,
      monthlyRates: [],   // match what the server passes when cache has no monthly data
    })
    const row = buildRendaFixaValuationRow(detail, rates, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(direct.netAmount, 6)
    expect(row.indexerAnnual).toBe('0.055')
  })

  it('IGPM: uses rates.igpmAccumulated12m as indexRate', () => {
    const rates = { ...STUB_RATES, igpmAccumulated12m: 0.04, igpmMonthly: [] as readonly number[] }
    const calendarDays = 400
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'igpm',
      capital: '5000',
      annualRate: '0.05',
      purchaseDate,
      multiplier: null,
    }
    const direct = calculateInvestment({
      productType: 'cdb',
      indexer: 'igpm',
      capital: 5000,
      annualRate: 0.05,
      calendarDays,
      businessDays,
      indexRate: 0.04,
      monthlyRates: [],   // match server: empty array is truthy → buildAccumulatedIndexFactor([])=1
    })
    const row = buildRendaFixaValuationRow(detail, rates, TODAY)
    expect(Number(row.netAmount)).toBeCloseTo(direct.netAmount, 6)
    expect(row.indexerAnnual).toBe('0.04')
  })

  it('selic-spread: effectiveRate = selicAnnual + spread, indexerAnnual reflects that', () => {
    const rates = { ...STUB_RATES, selicAnnual: 0.105 }
    const spread = 0.0005  // 0.05% a.a.
    const calendarDays = 365
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)
    const detail: RendaFixaDetailInput = {
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: '10000',
      annualRate: String(spread),
      purchaseDate,
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, rates, TODAY)
    expect(row.indexerAnnual).toBe(String(0.105 + spread))
    // Must earn more than flat SELIC (spread=0)
    const flatDetail: RendaFixaDetailInput = { ...detail, annualRate: '0' }
    const flatRow = buildRendaFixaValuationRow(flatDetail, rates, TODAY)
    expect(Number(row.grossAmount)).toBeGreaterThan(Number(flatRow.grossAmount))
  })

  it('selic-spread with spread=0 produces same grossAmount as selic with multiplier=1', () => {
    const rates = { ...STUB_RATES, selicAnnual: 0.105 }
    const calendarDays = 812
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)

    const spreadDetail: RendaFixaDetailInput = {
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: '6067.47',
      annualRate: '0',
      purchaseDate,
      multiplier: null,
    }
    const direct = calculateInvestment({
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: 6067.47,
      annualRate: 0.105,
      calendarDays,
      businessDays,
    })
    const row = buildRendaFixaValuationRow(spreadDetail, rates, TODAY)
    expect(Number(row.grossAmount)).toBeCloseTo(direct.grossAmount, 6)
  })

  it('selic-spread: multiplier in detail is ignored', () => {
    const rates = { ...STUB_RATES, selicAnnual: 0.105 }
    const calendarDays = 365
    const purchaseDate = daysAgo(calendarDays)
    const withMultiplier: RendaFixaDetailInput = {
      productType: 'tesouro-selic',
      indexer: 'selic-spread',
      capital: '10000',
      annualRate: '0.0005',
      purchaseDate,
      multiplier: '1.5',  // should be ignored
    }
    const withoutMultiplier: RendaFixaDetailInput = { ...withMultiplier, multiplier: null }
    const rowWith = buildRendaFixaValuationRow(withMultiplier, rates, TODAY)
    const rowWithout = buildRendaFixaValuationRow(withoutMultiplier, rates, TODAY)
    expect(Number(rowWith.grossAmount)).toBeCloseTo(Number(rowWithout.grossAmount), 6)
  })

  it('pre: indexerAnnual is null (no BCB rate applies)', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.125',
      purchaseDate: daysAgo(200),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.indexerAnnual).toBeNull()
  })

  it('CDI multiplier is forwarded to calculateInvestment', () => {
    const rates = { ...STUB_RATES, cdiAnnual: 0.105 }
    const calendarDays = 365
    const purchaseDate = daysAgo(calendarDays)
    const businessDays = approxBusinessDays(purchaseDate, TODAY)

    const withMultiplier: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'cdi',
      capital: '10000',
      annualRate: '0',
      purchaseDate,
      multiplier: '1.1',   // 110% CDI
    }
    const withoutMultiplier: RendaFixaDetailInput = { ...withMultiplier, multiplier: null }

    const rowWith = buildRendaFixaValuationRow(withMultiplier, rates, TODAY)
    const rowWithout = buildRendaFixaValuationRow(withoutMultiplier, rates, TODAY)

    // 110% CDI earns more than 100% CDI
    expect(Number(rowWith.grossAmount)).toBeGreaterThan(Number(rowWithout.grossAmount))

    const direct = calculateInvestment({
      productType: 'cdb',
      indexer: 'cdi',
      capital: 10000,
      annualRate: 0.105,
      calendarDays,
      businessDays,
      multiplier: 1.1,
    })
    expect(Number(rowWith.netAmount)).toBeCloseTo(direct.netAmount, 6)
  })
})

// ---------------------------------------------------------------------------
// buildRendaFixaValuationRow — liquidity rules
// ---------------------------------------------------------------------------

describe('buildRendaFixaValuationRow — liquidity', () => {
  it('CRI: carenciaDays=null, liquidityBlocked=true, reason=secondary-market-only', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cri',
      indexer: 'ipca',
      capital: '10000',
      annualRate: '0.06',
      purchaseDate: daysAgo(1000),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.liquidityBlocked).toBe(true)
    expect(row.carenciaDays).toBeNull()
    expect(row.liquidityReason).toBe('secondary-market-only')
  })

  it('CRA: always liquidity-blocked regardless of days', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cra',
      indexer: 'ipca',
      capital: '10000',
      annualRate: '0.06',
      purchaseDate: daysAgo(2000),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.liquidityBlocked).toBe(true)
    expect(row.carenciaDays).toBeNull()
  })

  it('LCI before carencia (30 days): liquidityBlocked=true, carenciaDays=90', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'lci',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.12',
      purchaseDate: daysAgo(30),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.liquidityBlocked).toBe(true)
    expect(row.carenciaDays).toBe(90)
    expect(row.liquidityReason).toBe('carencia')
  })

  it('LCI after carencia (91 days): liquidityBlocked=false', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'lci',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.12',
      purchaseDate: daysAgo(91),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.liquidityBlocked).toBe(false)
    expect(row.liquidityReason).toBeNull()
  })

  it('CDB (no carencia): liquidityBlocked=false from day 0', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.12',
      purchaseDate: daysAgo(1),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.liquidityBlocked).toBe(false)
    expect(row.carenciaDays).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// buildRendaFixaValuationRow — row structure invariants
// ---------------------------------------------------------------------------

describe('buildRendaFixaValuationRow — row structure', () => {
  it('all numeric fields are serialised as strings', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.125',
      purchaseDate: daysAgo(365),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(typeof row.grossAmount).toBe('string')
    expect(typeof row.netAmount).toBe('string')
    expect(typeof row.iof).toBe('string')
    expect(typeof row.ir).toBe('string')
    expect(typeof row.netRate).toBe('string')
  })

  it('computedAt equals the today argument', () => {
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.1',
      purchaseDate: daysAgo(100),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.computedAt).toBe(TODAY)
  })

  it('calendarDays matches the difference between purchaseDate and today', () => {
    const n = 200
    const detail: RendaFixaDetailInput = {
      productType: 'cdb',
      indexer: 'pre',
      capital: '10000',
      annualRate: '0.1',
      purchaseDate: daysAgo(n),
      multiplier: null,
    }
    const row = buildRendaFixaValuationRow(detail, STUB_RATES, TODAY)
    expect(row.calendarDays).toBe(n)
  })
})
