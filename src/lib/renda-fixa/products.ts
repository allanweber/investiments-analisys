import { calculateDailyRateInvestment } from './cdi-selic'
import { calculateFixedRateInvestment } from './fixed-rate'
import { calculateIndexedInvestment } from './ipca'
import { calculateTreasuryMtm } from './market'
import type { TaxedReturn } from './core'

export type ProductType =
  | 'cdb'
  | 'lci'
  | 'lca'
  | 'cri'
  | 'cra'
  | 'tesouro-selic'
  | 'tesouro-prefixado'
  | 'tesouro-ipca'
  | 'tesouro-renda-mais'
  | 'tesouro-educa-mais'
  | 'debenture-incentivada'
  | 'debenture-comum'

export type Indexer = 'pre' | 'cdi' | 'selic' | 'ipca' | 'igpm'

export type ProductRule = {
  taxExempt: boolean
  hasIof: boolean
  hasFgc: boolean
  /** Minimum liquidity lock in calendar days. Infinity = secondary market only. */
  carenciaDays: number
  usesMtm: boolean
  allowedIndexers: readonly Indexer[]
}

/** rf_02 product rules matrix. */
export const PRODUCT_RULES: Record<ProductType, ProductRule> = {
  cdb: {
    taxExempt: false,
    hasIof: true,
    hasFgc: true,
    carenciaDays: 0,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'selic', 'ipca', 'igpm'],
  },
  lci: {
    taxExempt: true,
    hasIof: false,
    hasFgc: true,
    carenciaDays: 90,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'selic', 'ipca', 'igpm'],
  },
  lca: {
    taxExempt: true,
    hasIof: false,
    hasFgc: true,
    carenciaDays: 90,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'selic', 'ipca', 'igpm'],
  },
  cri: {
    taxExempt: true,
    hasIof: false,
    hasFgc: false,
    carenciaDays: Infinity,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'ipca', 'igpm'],
  },
  cra: {
    taxExempt: true,
    hasIof: false,
    hasFgc: false,
    carenciaDays: Infinity,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'ipca', 'igpm'],
  },
  'tesouro-selic': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: false,
    allowedIndexers: ['selic'],
  },
  'tesouro-prefixado': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: true,
    allowedIndexers: ['pre'],
  },
  'tesouro-ipca': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: true,
    allowedIndexers: ['ipca'],
  },
  'tesouro-renda-mais': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: true,
    allowedIndexers: ['ipca'],
  },
  'tesouro-educa-mais': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: true,
    allowedIndexers: ['ipca'],
  },
  'debenture-incentivada': {
    taxExempt: true,
    hasIof: false,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'ipca', 'igpm'],
  },
  'debenture-comum': {
    taxExempt: false,
    hasIof: true,
    hasFgc: false,
    carenciaDays: 0,
    usesMtm: false,
    allowedIndexers: ['pre', 'cdi', 'ipca', 'igpm'],
  },
}

/** Market data for MtM-capable Tesouro Direto products. */
export type MtmMarketData =
  | {
      kind: 'fixed-rate'
      marketAnnualRate: number
      contractedAnnualRate: number
      daysToMaturity: number
      daysPassed: number
    }
  | {
      kind: 'indexed'
      marketRealAnnualRate: number
      contractedRealAnnualRate: number
      daysToMaturity: number
      daysPassed: number
      vnaCurrent: number
      vnaBase?: number
    }

export type CalculateInvestmentInput = {
  productType: ProductType
  indexer: Indexer
  capital: number
  /** Annual contracted rate as decimal. For `pre` and CDI/Selic: the base annual rate. For `ipca`/`igpm`: the real annual spread. */
  annualRate: number
  calendarDays: number
  /** Required for CDI/Selic/IPCA/IGPM paths. */
  businessDays?: number
  /** CDI multiplier (e.g. 1.1 = 110% CDI). Only for CDI/Selic indexers. */
  multiplier?: number
  /** Fixed index accumulation for IPCA/IGPM when monthly series is unavailable. */
  indexRate?: number
  /** Last 12 monthly rates as decimals (preferred over indexRate). */
  monthlyRates?: readonly number[]
  /** When present AND rule.usesMtm is true, routes to mark-to-market calculation. */
  market?: MtmMarketData
}

export type LiquidityInfo = {
  blocked: boolean
  carenciaDays: number
  reason?: string
}

export type InvestmentResult = TaxedReturn & {
  productType: ProductType
  indexer: Indexer
  rule: ProductRule
  liquidity: LiquidityInfo
  /** Extra fields from indexed/MtM paths (present when applicable). */
  indexFactor?: number
  realFactor?: number
  vnaFinal?: number
  purchasePrice?: number
  marketPrice?: number
  units?: number
  daysRemaining?: number
  vnaCurrent?: number
}

function liquidityFor(rule: ProductRule, calendarDays: number): LiquidityInfo {
  if (!Number.isFinite(rule.carenciaDays) || rule.carenciaDays === Infinity) {
    return { blocked: true, carenciaDays: Infinity, reason: 'secondary-market-only' }
  }
  if (rule.carenciaDays > 0 && calendarDays < rule.carenciaDays) {
    return { blocked: true, carenciaDays: rule.carenciaDays, reason: 'carencia' }
  }
  return { blocked: false, carenciaDays: rule.carenciaDays }
}

/**
 * Calculates a fixed-income investment by product type, auto-applying tax rules from the rf_02 matrix.
 * Throws on programmer error (bad indexer for product, missing required field).
 */
export function calculateInvestment(input: CalculateInvestmentInput): InvestmentResult {
  const rule = PRODUCT_RULES[input.productType]
  const { indexer, capital, annualRate, calendarDays, multiplier, businessDays, indexRate, monthlyRates, market } = input

  if (!(rule.allowedIndexers as readonly string[]).includes(indexer)) {
    throw new Error(
      `Indexer '${indexer}' is not allowed for product '${input.productType}'. Allowed: ${rule.allowedIndexers.join(', ')}`,
    )
  }

  const hasIof = rule.hasIof
  const isTaxExempt = rule.taxExempt
  const liquidity = liquidityFor(rule, calendarDays)

  // MtM path — only when market data is supplied and product uses MtM
  if (market && rule.usesMtm) {
    const mtmBase = { hasIof, isTaxExempt }
    if (market.kind === 'fixed-rate') {
      const result = calculateTreasuryMtm({
        kind: 'fixed-rate',
        capital,
        contractedAnnualRate: market.contractedAnnualRate,
        marketAnnualRate: market.marketAnnualRate,
        daysToMaturity: market.daysToMaturity,
        daysPassed: market.daysPassed,
        ...mtmBase,
      })
      return { ...result, productType: input.productType, indexer, rule, liquidity }
    }
    // indexed (IPCA+)
    const result = calculateTreasuryMtm({
      kind: 'indexed',
      capital,
      contractedRealAnnualRate: market.contractedRealAnnualRate,
      marketRealAnnualRate: market.marketRealAnnualRate,
      daysToMaturity: market.daysToMaturity,
      daysPassed: market.daysPassed,
      vnaCurrent: market.vnaCurrent,
      vnaBase: market.vnaBase,
      ...mtmBase,
    })
    return { ...result, productType: input.productType, indexer, rule, liquidity }
  }

  // Fixed rate (pre)
  if (indexer === 'pre') {
    const result = calculateFixedRateInvestment({ capital, annualRate, calendarDays, hasIof, isTaxExempt })
    return { ...result, productType: input.productType, indexer, rule, liquidity }
  }

  // Daily-rate (CDI / Selic)
  if (indexer === 'cdi' || indexer === 'selic') {
    if (businessDays == null) {
      throw new Error(`'businessDays' is required for indexer '${indexer}'`)
    }
    const result = calculateDailyRateInvestment({
      capital,
      annualRate,
      businessDays,
      calendarDays,
      multiplier,
      hasIof,
      isTaxExempt,
    })
    return { ...result, productType: input.productType, indexer, rule, liquidity }
  }

  // Indexed (IPCA / IGPM)
  if (businessDays == null) {
    throw new Error(`'businessDays' is required for indexer '${indexer}'`)
  }
  const result = calculateIndexedInvestment({
    capital,
    realAnnualRate: annualRate,
    indexRate,
    monthlyRates,
    businessDays,
    calendarDays,
    hasIof,
    isTaxExempt,
  })
  return { ...result, productType: input.productType, indexer, rule, liquidity }
}
