import { describe, expect, it } from 'vitest'

import {
  calculateDailyRateInvestment,
  calculateVariableDailyRateInvestment,
} from './cdi-selic'

const variablePeriods = [
  { annualRate: 0.1, businessDays: 63, multiplier: 1.1 },
  { annualRate: 0.09, businessDays: 63, multiplier: 1.1 },
  { annualRate: 0.11, businessDays: 63, multiplier: 1.1 },
  { annualRate: 0.12, businessDays: 63, multiplier: 1.1 },
] as const

describe('CDI and Selic products', () => {
  it('calculates taxable daily-rate products', () => {
    const result = calculateDailyRateInvestment({
      capital: 1000,
      annualRate: 0.105,
      multiplier: 1.1,
      businessDays: 252,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1116.09, 2)
    expect(result.grossProfit).toBeCloseTo(116.09, 2)
    expect(result.ir).toBeCloseTo(20.32, 2)
    expect(result.netAmount).toBeCloseTo(1095.77, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false, irRate: 0.175 })
  })

  it('calculates a taxable Selic-style product', () => {
    const result = calculateDailyRateInvestment({
      capital: 1000,
      annualRate: 0.105,
      businessDays: 252,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1105, 2)
    expect(result.grossProfit).toBeCloseTo(105, 2)
    expect(result.ir).toBeCloseTo(18.38, 2)
    expect(result.netAmount).toBeCloseTo(1086.62, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })

  it('chains variable CDI periods', () => {
    const result = calculateVariableDailyRateInvestment({
      capital: 1000,
      periods: variablePeriods,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1116.02, 2)
    expect(result.taxBreakdown.irRate).toBe(0.175)
    expect(result.netAmount).toBeCloseTo(1095.72, 2)
  })
})
