import { describe, expect, it } from 'vitest'

import { calculateInvestment, PRODUCT_RULES } from './products'

describe('calculateInvestment — routing', () => {
  it('CDB (pre) matches plan case: netAmount ≈ 12282.14', () => {
    const result = calculateInvestment({
      productType: 'cdb',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.125,
      calendarDays: 737,
    })
    expect(result.netAmount).toBeCloseTo(12282.14, 2)
    expect(result.ir).toBeGreaterThan(0)
    expect(result.taxBreakdown.isTaxExempt).toBe(false)
    expect(result.taxBreakdown.hasIof).toBe(true)
    expect(result.productType).toBe('cdb')
    expect(result.indexer).toBe('pre')
  })

  it('LCI (pre) is IR-exempt with no IOF', () => {
    const result = calculateInvestment({
      productType: 'lci',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.124,
      calendarDays: 291,
    })
    expect(result.netAmount).toBeCloseTo(10976.75, 2)
    expect(result.ir).toBe(0)
    expect(result.iof).toBe(0)
    expect(result.taxBreakdown.isTaxExempt).toBe(true)
    expect(result.taxBreakdown.hasIof).toBe(false)
  })

  it('LCA (pre) is IR-exempt with no IOF', () => {
    const result = calculateInvestment({
      productType: 'lca',
      indexer: 'pre',
      capital: 15000,
      annualRate: 0.103,
      calendarDays: 732,
    })
    expect(result.ir).toBe(0)
    expect(result.iof).toBe(0)
    expect(result.taxBreakdown.isTaxExempt).toBe(true)
  })

  it('CRI (ipca) is IR-exempt and always liquidity-blocked', () => {
    const result = calculateInvestment({
      productType: 'cri',
      indexer: 'ipca',
      capital: 10000,
      annualRate: 0.06,
      calendarDays: 365,
      businessDays: 252,
      indexRate: 0.0483,
    })
    expect(result.ir).toBe(0)
    expect(result.liquidity.blocked).toBe(true)
    expect(result.liquidity.reason).toBe('secondary-market-only')
  })

  it('Debenture incentivada (cdi) is tax-exempt', () => {
    const result = calculateInvestment({
      productType: 'debenture-incentivada',
      indexer: 'cdi',
      capital: 10000,
      annualRate: 0.105,
      calendarDays: 365,
      businessDays: 252,
    })
    expect(result.ir).toBe(0)
    expect(result.taxBreakdown.isTaxExempt).toBe(true)
  })

  it('Debenture comum (cdi) is taxable', () => {
    const result = calculateInvestment({
      productType: 'debenture-comum',
      indexer: 'cdi',
      capital: 10000,
      annualRate: 0.105,
      calendarDays: 365,
      businessDays: 252,
    })
    expect(result.ir).toBeGreaterThan(0)
    expect(result.taxBreakdown.isTaxExempt).toBe(false)
  })

  it('Tesouro Selic (selic) routes to daily-rate path', () => {
    const result = calculateInvestment({
      productType: 'tesouro-selic',
      indexer: 'selic',
      capital: 6067.47,
      annualRate: 0.105,
      calendarDays: 812,
      businessDays: 582,
    })
    expect(result.grossAmount).toBeCloseTo(7641.06, 2)
    expect(result.netAmount).toBeCloseTo(7405.02, 2)
  })

  it('Tesouro IPCA+ routes to indexed path (no MtM when market absent)', () => {
    const result = calculateInvestment({
      productType: 'tesouro-ipca',
      indexer: 'ipca',
      capital: 6430.2,
      annualRate: 0.06,
      calendarDays: 365,
      businessDays: 298,
      indexRate: 0.0483,
    })
    expect(result.grossAmount).toBeCloseTo(7221.63, 2)
    expect(result.netAmount).toBeCloseTo(7083.13, 2)
    expect('indexFactor' in result).toBe(true)
  })

  it('Tesouro Prefixado routes to MtM fixed-rate when market is supplied', () => {
    const result = calculateInvestment({
      productType: 'tesouro-prefixado',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.1566,
      calendarDays: 513,
      market: {
        kind: 'fixed-rate',
        contractedAnnualRate: 0.1566,
        marketAnnualRate: 0.14,
        daysToMaturity: 730,
        daysPassed: 200,
      },
    })
    expect(result.purchasePrice).toBeDefined()
    expect(result.marketPrice).toBeDefined()
    expect(result.units).toBeDefined()
  })

  it('Tesouro IPCA+ routes to MtM indexed when market is supplied', () => {
    const result = calculateInvestment({
      productType: 'tesouro-ipca',
      indexer: 'ipca',
      capital: 10000,
      annualRate: 0.06,
      calendarDays: 365,
      market: {
        kind: 'indexed',
        contractedRealAnnualRate: 0.06,
        marketRealAnnualRate: 0.055,
        daysToMaturity: 730,
        daysPassed: 365,
        vnaCurrent: 3500,
        vnaBase: 3200,
      },
    })
    expect(result.vnaCurrent).toBeDefined()
    expect(result.purchasePrice).toBeDefined()
  })

  it('LCI liquidity: blocked at 30 days, unblocked at 90 days', () => {
    const blocked = calculateInvestment({
      productType: 'lci',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.10,
      calendarDays: 30,
    })
    expect(blocked.liquidity.blocked).toBe(true)
    expect(blocked.liquidity.carenciaDays).toBe(90)

    const unblocked = calculateInvestment({
      productType: 'lci',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.10,
      calendarDays: 90,
    })
    expect(unblocked.liquidity.blocked).toBe(false)
  })

  it('CRA is always liquidity-blocked regardless of days', () => {
    const result = calculateInvestment({
      productType: 'cra',
      indexer: 'ipca',
      capital: 10000,
      annualRate: 0.06,
      calendarDays: 1000,
      businessDays: 700,
      indexRate: 0.05,
    })
    expect(result.liquidity.blocked).toBe(true)
  })

  it('IOF applies only within first 29 days for taxable products', () => {
    const within30 = calculateInvestment({
      productType: 'cdb',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.125,
      calendarDays: 15,
    })
    expect(within30.iof).toBeGreaterThan(0)

    const after30 = calculateInvestment({
      productType: 'cdb',
      indexer: 'pre',
      capital: 10000,
      annualRate: 0.125,
      calendarDays: 30,
    })
    expect(after30.iof).toBe(0)
  })

  it('throws when indexer is not allowed for product', () => {
    expect(() =>
      calculateInvestment({
        productType: 'tesouro-selic',
        indexer: 'pre',
        capital: 10000,
        annualRate: 0.10,
        calendarDays: 365,
      }),
    ).toThrow()
  })

  it('throws when businessDays is missing for CDI indexer', () => {
    expect(() =>
      calculateInvestment({
        productType: 'cdb',
        indexer: 'cdi',
        capital: 10000,
        annualRate: 0.105,
        calendarDays: 365,
        // businessDays intentionally omitted
      }),
    ).toThrow()
  })
})

describe('PRODUCT_RULES', () => {
  it('tax-exempt products: lci, lca, cri, cra, debenture-incentivada', () => {
    for (const p of ['lci', 'lca', 'cri', 'cra', 'debenture-incentivada'] as const) {
      expect(PRODUCT_RULES[p].taxExempt).toBe(true)
      expect(PRODUCT_RULES[p].hasIof).toBe(false)
    }
  })

  it('tesouro products use MtM', () => {
    for (const p of ['tesouro-prefixado', 'tesouro-ipca', 'tesouro-renda-mais', 'tesouro-educa-mais'] as const) {
      expect(PRODUCT_RULES[p].usesMtm).toBe(true)
    }
    expect(PRODUCT_RULES['tesouro-selic'].usesMtm).toBe(false)
  })

  it('cdb and tesouro have FGC where expected', () => {
    expect(PRODUCT_RULES['cdb'].hasFgc).toBe(true)
    expect(PRODUCT_RULES['tesouro-prefixado'].hasFgc).toBe(false)
  })
})
