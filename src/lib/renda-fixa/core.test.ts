import { describe, expect, it } from 'vitest'

import {
  buildTaxBreakdown,
  compoundByAnnualRate,
  compoundByDailyRate,
  getIofRateByDays,
  getIrRateByDays,
} from './core'

describe('renda fixa core helpers', () => {
  it('returns the IR table by holding period', () => {
    expect(getIrRateByDays(30)).toBe(0.225)
    expect(getIrRateByDays(181)).toBe(0.2)
    expect(getIrRateByDays(361)).toBe(0.175)
    expect(getIrRateByDays(721)).toBe(0.15)
  })

  it('returns the IOF table for days 1 to 29 and zero after 30', () => {
    expect(getIofRateByDays(1)).toBe(0.96)
    expect(getIofRateByDays(15)).toBe(0.5)
    expect(getIofRateByDays(29)).toBe(0.03)
    expect(getIofRateByDays(30)).toBe(0)
  })

  it('compounds annual and daily rates', () => {
    expect(compoundByAnnualRate(1000, 0.135, 365)).toBeCloseTo(1135, 10)
    expect(compoundByDailyRate(1000, (1.105 ** (1 / 252)) - 1, 252)).toBeCloseTo(1105, 2)
  })

  it('applies IOF before IR and leaves tax-exempt products untouched', () => {
    expect(
      buildTaxBreakdown({
        capital: 1000,
        grossAmount: 1005,
        calendarDays: 15,
        hasIof: true,
        isTaxExempt: false,
      }),
    ).toMatchObject({
      grossProfit: 5,
      iof: 2.5,
      ir: 0.5625,
      netAmount: 1001.9375,
      taxBreakdown: {
        hasIof: true,
        isTaxExempt: false,
        iofRate: 0.5,
        irRate: 0.225,
      },
    })

    expect(
      buildTaxBreakdown({
        capital: 1000,
        grossAmount: 1005,
        calendarDays: 15,
        hasIof: false,
        isTaxExempt: true,
      }),
    ).toMatchObject({
      iof: 0,
      ir: 0,
      netAmount: 1005,
      taxBreakdown: {
        hasIof: false,
        isTaxExempt: true,
      },
    })
  })
})
