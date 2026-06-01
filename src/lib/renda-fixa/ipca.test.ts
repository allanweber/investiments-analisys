import { describe, expect, it } from 'vitest'

import {
  calculateIndexedInvestment,
  calculateTreasuryMtm,
} from './index'

const monthlyIpcaRates = [
  0.0042, 0.0083, 0.0016, 0.0038, 0.0046, 0.0036, 0.0038, 0.0044, 0.0054, 0.0056, 0.0039, 0.0052,
] as const

describe('IPCA, IGPM and treasury products', () => {
  it('calculates a generic IPCA+ investment', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.06,
      businessDays: 252,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1111.2, 2)
    expect(result.ir).toBeCloseTo(19.46, 2)
    expect(result.netAmount).toBeCloseTo(1091.74, 2)
  })

  it('calculates taxable IPCA+ products', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.06,
      businessDays: 252,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(1111.2, 2)
    expect(result.grossProfit).toBeCloseTo(111.2, 2)
    expect(result.ir).toBeCloseTo(19.46, 2)
    expect(result.netAmount).toBeCloseTo(1091.74, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })

  it('uses the generic IGPM+ helper as a tax-exempt indexed investment', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      indexRate: 0.035,
      realAnnualRate: 0.05,
      businessDays: 252,
      calendarDays: 365,
      hasIof: false,
      isTaxExempt: true,
    })

    expect(result.grossAmount).toBeCloseTo(1086.75, 2)
    expect(result.netAmount).toBeCloseTo(1086.75, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('calculates tax-exempt IPCA+ products', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.055,
      businessDays: 252,
      calendarDays: 365,
      hasIof: false,
      isTaxExempt: true,
    })

    expect(result.grossAmount).toBeCloseTo(1105.96, 2)
    expect(result.ir).toBe(0)
    expect(result.netAmount).toBeCloseTo(1105.96, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('calculates IGPM+ the same way as a generic indexed product', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      indexRate: 0.035,
      realAnnualRate: 0.05,
      businessDays: 252,
      calendarDays: 365,
      hasIof: false,
      isTaxExempt: true,
    })

    expect(result.grossAmount).toBeCloseTo(1086.75, 2)
    expect(result.netAmount).toBeCloseTo(1086.75, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('chains monthly IPCA rates before applying the real rate', () => {
    const result = calculateIndexedInvestment({
      capital: 1000,
      monthlyRates: monthlyIpcaRates,
      realAnnualRate: 0.068,
      businessDays: 252,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.vnaFinal).toBeCloseTo(1055.76, 2)
    expect(result.grossAmount).toBeCloseTo(1127.55, 2)
    expect(result.ir).toBeCloseTo(22.32, 2)
    expect(result.netAmount).toBeCloseTo(1105.23, 2)
  })

  it('keeps Treasury MTM aligned to the fixed-rate base', () => {
    const result = calculateTreasuryMtm({
      kind: 'fixed-rate',
      capital: 1000,
      contractedAnnualRate: 0.055,
      marketAnnualRate: 0.06,
      daysToMaturity: 720,
      daysPassed: 360,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.purchasePrice).toBeGreaterThan(0)
    expect(result.marketPrice).toBeGreaterThan(0)
    expect(result.netAmount).toBeLessThan(result.grossAmount)
  })
})
