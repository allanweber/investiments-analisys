import { describe, expect, it } from 'vitest'

import { calculateTreasuryFixedRateMtm, calculateTreasuryIpcaMtm } from './market'

describe('mark-to-market calculations', () => {
  it('calculates Treasury fixed-rate mark-to-market with taxable gains', () => {
    const result = calculateTreasuryFixedRateMtm({
      capital: 1000,
      contractedAnnualRate: 0.132,
      marketAnnualRate: 0.145,
      daysToMaturity: 730,
      daysPassed: 180,
    })

    expect(result.purchasePrice).toBeCloseTo(780.38, 2)
    expect(result.marketPrice).toBeCloseTo(815.43, 2)
    expect(result.units).toBeCloseTo(1.28142, 5)
    expect(result.grossAmount).toBeCloseTo(1044.92, 2)
    expect(result.ir).toBeCloseTo(10.11, 2)
    expect(result.netAmount).toBeCloseTo(1034.81, 2)
  })

  it('calculates Treasury IPCA mark-to-market and suppresses IR on losses', () => {
    const profitable = calculateTreasuryIpcaMtm({
      capital: 1000,
      contractedRealAnnualRate: 0.068,
      marketRealAnnualRate: 0.06,
      daysToMaturity: 730,
      daysPassed: 180,
      vnaCurrent: 1000,
    })

    expect(profitable.daysRemaining).toBe(550)
    expect(profitable.grossAmount).toBeGreaterThan(1000)
    expect(profitable.ir).toBeGreaterThan(0)

    const loss = calculateTreasuryIpcaMtm({
      capital: 1000,
      contractedRealAnnualRate: 0.068,
      marketRealAnnualRate: 0.2,
      daysToMaturity: 730,
      daysPassed: 180,
      vnaCurrent: 1000,
    })

    expect(loss.grossAmount).toBeLessThan(1000)
    expect(loss.ir).toBe(0)
    expect(loss.netAmount).toBe(loss.grossAmount)
  })
})
