import { describe, expect, it } from 'vitest'

import {
  calculateCdbFromIpcaInvestment,
  calculateCraFromIgpmInvestment,
  calculateCraFromIpcaInvestment,
  calculateCriFromIpcaInvestment,
  calculateIgpmPlusInvestment,
  calculateIpcaPlusInvestment,
  calculateLcaFromIpcaInvestment,
  calculateLciFromIpcaInvestment,
  calculateTreasuryEducationAccumulation,
  calculateTreasuryIncomeAAccumulation,
  calculateTreasuryIpcaInvestment,
  calculateVariableIpcaInvestment,
} from './ipca'

const monthlyIpcaRates = [
  0.0042, 0.0083, 0.0016, 0.0038, 0.0046, 0.0036, 0.0038, 0.0044, 0.0054, 0.0056, 0.0039, 0.0052,
] as const

describe('IPCA, IGPM and treasury products', () => {
  it('calculates a generic IPCA+ investment', () => {
    const result = calculateIpcaPlusInvestment({
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
    const result = calculateCdbFromIpcaInvestment({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.06,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1111.2, 2)
    expect(result.grossProfit).toBeCloseTo(111.2, 2)
    expect(result.ir).toBeCloseTo(19.46, 2)
    expect(result.netAmount).toBeCloseTo(1091.74, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })

  it('uses the generic IGPM+ helper as a taxable indexed investment', () => {
    const result = calculateIgpmPlusInvestment({
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
    const result = calculateLciFromIpcaInvestment({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.055,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1105.96, 2)
    expect(result.ir).toBe(0)
    expect(result.netAmount).toBeCloseTo(1105.96, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('calculates IGPM+ the same way as a generic indexed product', () => {
    const result = calculateCraFromIgpmInvestment({
      capital: 1000,
      indexRate: 0.035,
      realAnnualRate: 0.05,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1086.75, 2)
    expect(result.netAmount).toBeCloseTo(1086.75, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it('chains monthly IPCA rates before applying the real rate', () => {
    const result = calculateVariableIpcaInvestment({
      capital: 1000,
      monthlyRates: monthlyIpcaRates,
      realAnnualRate: 0.068,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.vnaFinal).toBeCloseTo(1055.76, 2)
    expect(result.grossAmount).toBeCloseTo(1127.55, 2)
    expect(result.ir).toBeCloseTo(22.32, 2)
    expect(result.netAmount).toBeCloseTo(1105.23, 2)
  })

  it.each([
    ['LCA', calculateLcaFromIpcaInvestment],
    ['CRI', calculateCriFromIpcaInvestment],
    ['CRA', calculateCraFromIpcaInvestment],
  ] as const)('wraps %s as tax-exempt', (_label, fn) => {
    const result = fn({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.06,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.ir).toBe(0)
    expect(result.taxBreakdown).toMatchObject({ hasIof: false, isTaxExempt: true })
  })

  it.each([
    ['Treasury IPCA', calculateTreasuryIpcaInvestment],
    ['Treasury Income A', calculateTreasuryIncomeAAccumulation],
    ['Treasury Education', calculateTreasuryEducationAccumulation],
  ] as const)('keeps %s aligned to the Treasury IPCA base', (_label, fn) => {
    const result = fn({
      capital: 1000,
      indexRate: 0.0483,
      realAnnualRate: 0.068,
      businessDays: 252,
      calendarDays: 365,
    })

    expect(result.grossAmount).toBeCloseTo(1119.58, 2)
    expect(result.ir).toBeCloseTo(20.93, 2)
    expect(result.netAmount).toBeCloseTo(1098.66, 2)
    expect(result.taxBreakdown).toMatchObject({ hasIof: true, isTaxExempt: false })
  })
})
