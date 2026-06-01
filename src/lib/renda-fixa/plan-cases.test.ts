import { describe, expect, it } from 'vitest'

import { calculateDailyRateInvestment } from './cdi-selic'
import { calculateFixedRateInvestment } from './fixed-rate'
import { calculateIndexedInvestment } from './ipca'

describe('documented plan cases', () => {
  it('calculates Tesouro IPCA+ 2029', () => {
    const result = calculateIndexedInvestment({
      capital: 6430.2,
      indexRate: 0.0483,
      realAnnualRate: 0.06,
      businessDays: 298,
      calendarDays: 365,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(7221.63, 2)
    expect(result.ir).toBeCloseTo(138.5, 2)
    expect(result.netAmount).toBeCloseTo(7083.13, 2)
  })

  it('calculates Tesouro Prefixado 2027', () => {
    const result = calculateFixedRateInvestment({
      capital: 11995.04,
      annualRate: 0.1566,
      calendarDays: 513,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(14716.49, 2)
    expect(result.ir).toBeCloseTo(476.25, 2)
    expect(result.netAmount).toBeCloseTo(14240.24, 2)
  })

  it('calculates Tesouro Selic 2029', () => {
    const result = calculateDailyRateInvestment({
      capital: 6067.47,
      annualRate: 0.105,
      businessDays: 582,
      calendarDays: 812,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(7641.06, 2)
    expect(result.ir).toBeCloseTo(236.04, 2)
    expect(result.netAmount).toBeCloseTo(7405.02, 2)
  })

  it('calculates LCA AGROLEND - MAI/2028', () => {
    const result = calculateFixedRateInvestment({
      capital: 15000,
      annualRate: 0.103,
      calendarDays: 732,
      hasIof: false,
      isTaxExempt: true,
    })

    expect(result.grossAmount).toBeCloseTo(18258.94, 2)
    expect(result.ir).toBe(0)
    expect(result.netAmount).toBeCloseTo(18258.94, 2)
  })

  it('calculates CDB BMG - NOV/2026', () => {
    const result = calculateFixedRateInvestment({
      capital: 10000,
      annualRate: 0.125,
      calendarDays: 737,
      hasIof: true,
      isTaxExempt: false,
    })

    expect(result.grossAmount).toBeCloseTo(12684.87, 2)
    expect(result.ir).toBeCloseTo(402.73, 2)
    expect(result.netAmount).toBeCloseTo(12282.14, 2)
  })

  it('calculates LCI BANCO INTER - AGO/2026', () => {
    const result = calculateFixedRateInvestment({
      capital: 10000,
      annualRate: 0.124,
      calendarDays: 291,
      hasIof: false,
      isTaxExempt: true,
    })

    expect(result.grossAmount).toBeCloseTo(10976.75, 2)
    expect(result.ir).toBe(0)
    expect(result.netAmount).toBeCloseTo(10976.75, 2)
  })
})
