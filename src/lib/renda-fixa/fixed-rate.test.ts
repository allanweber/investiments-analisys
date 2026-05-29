import { describe, expect, it } from 'vitest'

import {
  calculateFixedRateCdbInvestment,
  calculateFixedRateCraInvestment,
  calculateFixedRateCriInvestment,
  calculateFixedRateEarlyRedemption,
  calculateFixedRateInvestment,
  calculateFixedRateLcaInvestment,
  calculateFixedRateLciInvestment,
  calculateTreasuryFixedRateInvestment,
} from './fixed-rate'

describe('fixed-rate investments', () => {
  it('calculates a taxable CDB fixed-rate product', () => {
    expect(
      calculateFixedRateCdbInvestment({ capital: 1000, annualRate: 0.11, calendarDays: 365 }),
    ).toMatchObject({
      grossAmount: 1110,
      grossProfit: 110,
      iof: 0,
      ir: 19.25,
      netAmount: 1090.75,
      taxBreakdown: { hasIof: true, isTaxExempt: false, irRate: 0.175 },
    })
  })

  it('calculates early redemption with IOF and IR', () => {
    const result = calculateFixedRateEarlyRedemption({
      capital: 1000,
      annualRate: 0.135,
      calendarDays: 15,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1005.22, 2)
    expect(result.iof).toBeCloseTo(2.61, 2)
    expect(result.ir).toBeCloseTo(0.59, 2)
    expect(result.netAmount).toBeCloseTo(1002.02, 2)
  })

  it('keeps tax-exempt products free from IR and IOF', () => {
    expect(
      calculateFixedRateLciInvestment({ capital: 1000, annualRate: 0.11, calendarDays: 365 }),
    ).toMatchObject({
      grossAmount: 1110,
      iof: 0,
      ir: 0,
      netAmount: 1110,
      taxBreakdown: { hasIof: false, isTaxExempt: true },
    })
  })

  it.each([
    ['LCA', calculateFixedRateLcaInvestment],
    ['CRI', calculateFixedRateCriInvestment],
    ['CRA', calculateFixedRateCraInvestment],
  ] as const)('wraps %s as tax-exempt', (_label, fn) => {
    expect(fn({ capital: 1000, annualRate: 0.11, calendarDays: 365 })).toMatchObject({
      iof: 0,
      ir: 0,
      netAmount: 1110,
      taxBreakdown: { hasIof: false, isTaxExempt: true },
    })
  })

  it.each([
    ['Treasury fixed-rate', calculateTreasuryFixedRateInvestment],
    ['generic fixed-rate', calculateFixedRateInvestment],
  ] as const)('keeps %s taxable', (_label, fn) => {
    expect(fn({ capital: 1000, annualRate: 0.11, calendarDays: 365 })).toMatchObject({
      grossAmount: 1110,
      ir: 19.25,
      netAmount: 1090.75,
      taxBreakdown: { hasIof: true, isTaxExempt: false },
    })
  })
})
