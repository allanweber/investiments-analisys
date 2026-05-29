import { describe, expect, it } from 'vitest'

import {
  calculateCdbFromCdiInvestment,
  calculateCraFromCdiInvestment,
  calculateLcaFromCdiInvestment,
  calculateLciFromCdiInvestment,
  calculateSelicInvestment,
  calculateTreasurySelicInvestment,
  calculateVariableCdiSelicInvestment,
} from './cdi-selic'

const variablePeriods = [
  { annualRate: 0.1, businessDays: 63, cdiMultiplier: 1.1 },
  { annualRate: 0.09, businessDays: 63, cdiMultiplier: 1.1 },
  { annualRate: 0.11, businessDays: 63, cdiMultiplier: 1.1 },
  { annualRate: 0.12, businessDays: 63, cdiMultiplier: 1.1 },
] as const

describe('CDI and Selic products', () => {
  it('calculates taxable CDI products', () => {
    const result = calculateCdbFromCdiInvestment({
      capital: 1000,
      annualCdiRate: 0.105,
      cdiMultiplier: 1.1,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1116.09, 2)
    expect(result.grossProfit).toBeCloseTo(116.09, 2)
    expect(result.ir).toBeCloseTo(20.32, 2)
    expect(result.netAmount).toBeCloseTo(1095.77, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false, irRate: 0.175 })
  })

  it('calculates Treasury Selic as a taxable daily compound product', () => {
    const result = calculateTreasurySelicInvestment({
      capital: 1000,
      annualSelicRate: 0.105,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1105, 2)
    expect(result.grossProfit).toBeCloseTo(105, 2)
    expect(result.ir).toBeCloseTo(18.375, 3)
    expect(result.netAmount).toBeCloseTo(1086.625, 3)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })

  it('chains variable CDI periods', () => {
    const result = calculateVariableCdiSelicInvestment({
      capital: 1000,
      periods: variablePeriods,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1116.02, 2)
    expect(result.taxBreakdown.irRate).toBe(0.175)
    expect(result.netAmount).toBeCloseTo(1095.72, 2)
  })

  it.each([
    ['LCI', calculateLciFromCdiInvestment],
    ['LCA', calculateLcaFromCdiInvestment],
    ['CRI', calculateCraFromCdiInvestment],
  ] as const)('wraps %s as tax-exempt', (_label, fn) => {
    const result = fn({
      capital: 1000,
      annualCdiRate: 0.105,
      cdiMultiplier: 1,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.iof).toBe(0)
    expect(result.ir).toBe(0)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('keeps the Selic generic wrapper aligned with the taxable base', () => {
    const result = calculateSelicInvestment({
      capital: 1000,
      annualSelicRate: 0.105,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1105, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })
})
