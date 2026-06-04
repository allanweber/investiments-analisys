import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { investment, portfolioHolding, rendaFixaDetail, rendaFixaValuation } from '@/db/schema'
import { ensureBcbRatesForDisplay, refreshBcbRatesIfStale } from '@/lib/market-data/bcb-refresh'
import type { BcbRates } from '@/lib/market-data/providers/bcb'
import { calculateInvestment } from '@/lib/renda-fixa/products'
import type { Indexer, ProductType } from '@/lib/renda-fixa/products'
import { getDb, requireUserId, uuid } from '@/lib/server-utils'

type Db = Awaited<ReturnType<typeof getDb>>

export type RendaFixaDetailInput = {
  productType: string
  indexer: string
  capital: string
  annualRate: string
  purchaseDate: Date
  multiplier: string | null
}

export type RendaFixaValuationRow = {
  grossAmount: string
  grossProfit: string
  iof: string
  ir: string
  netAmount: string
  netProfit: string
  netRate: string
  calendarDays: number
  liquidityBlocked: boolean
  carenciaDays: number | null
  liquidityReason: string | null
  indexerAnnual: string | null
  computedAt: Date
}

/**
 * Weekday-only business day approximation.
 * Brazil has national holidays that further reduce business days; a proper SELIC/CDI
 * calendar is not yet available in this codebase. The approximation is accurate enough
 * for display purposes and consistent with the 252-day convention used in calculateInvestment.
 */
export function approxBusinessDays(from: Date, to: Date): number {
  const msPerDay = 86_400_000
  const totalDays = Math.max(0, Math.floor((to.getTime() - from.getTime()) / msPerDay))
  const weeks = Math.floor(totalDays / 7)
  const remainder = totalDays % 7
  const fromDay = from.getDay()
  let weekendDays = weeks * 2
  for (let i = 0; i < remainder; i++) {
    const d = (fromDay + i) % 7
    if (d === 0 || d === 6) weekendDays++
  }
  return Math.max(0, totalDays - weekendDays)
}

/** Pure function: given a detail row, BCB rates, and a reference date, returns the valuation row to persist. */
export function buildRendaFixaValuationRow(detail: RendaFixaDetailInput, rates: BcbRates, today: Date): RendaFixaValuationRow {
  const purchaseDate = new Date(detail.purchaseDate)
  const calendarDays = Math.max(0, Math.floor((today.getTime() - purchaseDate.getTime()) / 86_400_000))
  const businessDays = approxBusinessDays(purchaseDate, today)
  const capital = Number(detail.capital)
  const indexer = detail.indexer as Indexer

  // For CDI/Selic, annualRate comes from BCB at valuation time (these products float daily).
  // For pre/ipca/igpm, the contracted rate is stored in detail.annualRate.
  const annualRate =
    indexer === 'cdi' ? rates.cdiAnnual
    : indexer === 'selic' ? rates.selicAnnual
    : Number(detail.annualRate)

  const monthlyRates =
    indexer === 'ipca' ? rates.ipcaMonthly
    : indexer === 'igpm' ? rates.igpmMonthly
    : undefined

  const indexRate =
    indexer === 'ipca' ? rates.ipcaAccumulated12m
    : indexer === 'igpm' ? rates.igpmAccumulated12m
    : undefined

  const indexerAnnual =
    indexer === 'cdi' ? rates.cdiAnnual
    : indexer === 'selic' ? rates.selicAnnual
    : indexer === 'ipca' ? rates.ipcaAccumulated12m
    : indexer === 'igpm' ? rates.igpmAccumulated12m
    : null

  const result = calculateInvestment({
    productType: detail.productType as ProductType,
    indexer,
    capital,
    annualRate,
    calendarDays,
    businessDays,
    multiplier: detail.multiplier != null ? Number(detail.multiplier) : undefined,
    monthlyRates,
    indexRate,
  })

  const carenciaDays = Number.isFinite(result.liquidity.carenciaDays) ? result.liquidity.carenciaDays : null

  return {
    grossAmount: String(result.grossAmount),
    grossProfit: String(result.grossProfit),
    iof: String(result.iof),
    ir: String(result.ir),
    netAmount: String(result.netAmount),
    netProfit: String(result.netProfit),
    netRate: String(result.netRate),
    calendarDays: result.calendarDays,
    liquidityBlocked: result.liquidity.blocked,
    carenciaDays,
    liquidityReason: result.liquidity.reason ?? null,
    indexerAnnual: indexerAnnual != null ? String(indexerAnnual) : null,
    computedAt: today,
  }
}

async function computeAndSaveValuation(db: Db, userId: string, investmentId: string): Promise<void> {
  const [detail] = await db
    .select()
    .from(rendaFixaDetail)
    .where(and(eq(rendaFixaDetail.userId, userId), eq(rendaFixaDetail.investmentId, investmentId)))

  if (!detail) return

  const rates = await ensureBcbRatesForDisplay(db)
  const today = new Date()
  const row = buildRendaFixaValuationRow(detail, rates, today)

  await db
    .insert(rendaFixaValuation)
    .values({ userId, investmentId, ...row })
    .onConflictDoUpdate({
      target: [rendaFixaValuation.userId, rendaFixaValuation.investmentId],
      set: row,
    })
}

const productTypeEnum = z.enum([
  'cdb',
  'lci',
  'lca',
  'cri',
  'cra',
  'tesouro-selic',
  'tesouro-prefixado',
  'tesouro-ipca',
  'tesouro-renda-mais',
  'tesouro-educa-mais',
  'debenture-incentivada',
  'debenture-comum',
])

const indexerEnum = z.enum(['pre', 'cdi', 'selic', 'ipca', 'igpm'])

const rendaFixaHoldingInput = z.object({
  investmentId: uuid,
  productType: productTypeEnum,
  indexer: indexerEnum,
  /** Invested amount in BRL. */
  capital: z.number().positive(),
  /**
   * Contracted rate as a decimal:
   *   pre        → fixed annual rate (e.g. 0.14 for 14% a.a.)
   *   cdi/selic  → pass 0; the BCB rate is used at valuation time
   *   ipca/igpm  → real annual spread (e.g. 0.06 for IPCA + 6%)
   */
  annualRate: z.number().min(0),
  /** ISO datetime string. */
  purchaseDate: z.string().datetime(),
  /** ISO datetime string. */
  maturityDate: z.string().datetime(),
  /** CDI multiplier (e.g. 1.10 for 110% CDI). Required when indexer is cdi or selic. */
  multiplier: z.number().positive().optional(),
  broker: z.string().min(1).optional(),
})

/** Returns current BCB indexer rates (CDI/Selic/IPCA/IGPM) as decimals for use in fixed-income calculations. */
export const getBcbRatesFn = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await getDb()
  const rates = await ensureBcbRatesForDisplay(db)
  return {
    cdiAnnual: rates.cdiAnnual,
    selicAnnual: rates.selicAnnual,
    ipcaAccumulated12m: rates.ipcaAccumulated12m,
    igpmAccumulated12m: rates.igpmAccumulated12m,
    ipcaMonthly: [...rates.ipcaMonthly],
    igpmMonthly: [...rates.igpmMonthly],
    asOf: rates.asOf?.toISOString() ?? null,
  }
})

/**
 * Create or update a renda fixa holding.
 * Writes to portfolio_holding (quantity=1, avgCost=capital) and renda_fixa_detail,
 * refreshes BCB rates if stale, then computes and stores the initial valuation snapshot.
 */
export const upsertRendaFixaHoldingFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => rendaFixaHoldingInput.parse(data))
  .handler(async ({ data }) => {
    const [userId, db] = await Promise.all([requireUserId(), getDb()])

    await refreshBcbRatesIfStale({ db })

    // quantity=1, avgCost=capital preserves the book-value invariant: marketValue = qty × avgCost = capital
    await db
      .insert(portfolioHolding)
      .values({
        userId,
        investmentId: data.investmentId,
        ticker: null,
        quantity: '1',
        avgCost: String(data.capital),
        currency: 'BRL',
        broker: data.broker ?? null,
        lastOperationAt: new Date(data.purchaseDate),
      })
      .onConflictDoUpdate({
        target: [portfolioHolding.userId, portfolioHolding.investmentId],
        set: {
          avgCost: String(data.capital),
          broker: data.broker ?? null,
          lastOperationAt: new Date(data.purchaseDate),
          updatedAt: new Date(),
        },
      })

    await db
      .insert(rendaFixaDetail)
      .values({
        userId,
        investmentId: data.investmentId,
        productType: data.productType,
        indexer: data.indexer,
        capital: String(data.capital),
        annualRate: String(data.annualRate),
        purchaseDate: new Date(data.purchaseDate),
        maturityDate: new Date(data.maturityDate),
        multiplier: data.multiplier != null ? String(data.multiplier) : null,
      })
      .onConflictDoUpdate({
        target: [rendaFixaDetail.userId, rendaFixaDetail.investmentId],
        set: {
          productType: data.productType,
          indexer: data.indexer,
          capital: String(data.capital),
          annualRate: String(data.annualRate),
          purchaseDate: new Date(data.purchaseDate),
          maturityDate: new Date(data.maturityDate),
          multiplier: data.multiplier != null ? String(data.multiplier) : null,
          updatedAt: new Date(),
        },
      })

    await computeAndSaveValuation(db, userId, data.investmentId)

    return { ok: true }
  })

/**
 * Delete a renda fixa holding and its associated detail and valuation rows.
 * Explicit deletion is required because renda_fixa_detail has no FK to portfolio_holding.
 */
const deleteHoldingInput = z.object({ investmentId: uuid })

export const deleteRendaFixaHoldingFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => deleteHoldingInput.parse(data))
  .handler(async ({ data }) => {
    const [userId, db] = await Promise.all([requireUserId(), getDb()])

    await db
      .delete(rendaFixaValuation)
      .where(and(eq(rendaFixaValuation.userId, userId), eq(rendaFixaValuation.investmentId, data.investmentId)))

    await db
      .delete(rendaFixaDetail)
      .where(and(eq(rendaFixaDetail.userId, userId), eq(rendaFixaDetail.investmentId, data.investmentId)))

    await db
      .delete(portfolioHolding)
      .where(and(eq(portfolioHolding.userId, userId), eq(portfolioHolding.investmentId, data.investmentId)))

    return { ok: true }
  })

/**
 * List all renda fixa holdings for the authenticated user with their contract details
 * and latest valuation snapshot. Valuation fields are null when no snapshot exists yet.
 */
export const listRendaFixaHoldingsFn = createServerFn({ method: 'GET' }).handler(async () => {
  const [userId, db] = await Promise.all([requireUserId(), getDb()])

  return db
    .select({
      investment: { id: investment.id, name: investment.name },
      detail: {
        productType: rendaFixaDetail.productType,
        indexer: rendaFixaDetail.indexer,
        capital: rendaFixaDetail.capital,
        annualRate: rendaFixaDetail.annualRate,
        purchaseDate: rendaFixaDetail.purchaseDate,
        maturityDate: rendaFixaDetail.maturityDate,
        multiplier: rendaFixaDetail.multiplier,
      },
      broker: portfolioHolding.broker,
      valuation: {
        grossAmount: rendaFixaValuation.grossAmount,
        grossProfit: rendaFixaValuation.grossProfit,
        iof: rendaFixaValuation.iof,
        ir: rendaFixaValuation.ir,
        netAmount: rendaFixaValuation.netAmount,
        netProfit: rendaFixaValuation.netProfit,
        netRate: rendaFixaValuation.netRate,
        calendarDays: rendaFixaValuation.calendarDays,
        liquidityBlocked: rendaFixaValuation.liquidityBlocked,
        carenciaDays: rendaFixaValuation.carenciaDays,
        liquidityReason: rendaFixaValuation.liquidityReason,
        indexerAnnual: rendaFixaValuation.indexerAnnual,
        computedAt: rendaFixaValuation.computedAt,
      },
    })
    .from(rendaFixaDetail)
    .innerJoin(investment, eq(rendaFixaDetail.investmentId, investment.id))
    .innerJoin(
      portfolioHolding,
      and(
        eq(portfolioHolding.userId, rendaFixaDetail.userId),
        eq(portfolioHolding.investmentId, rendaFixaDetail.investmentId),
      ),
    )
    .leftJoin(
      rendaFixaValuation,
      and(
        eq(rendaFixaValuation.userId, rendaFixaDetail.userId),
        eq(rendaFixaValuation.investmentId, rendaFixaDetail.investmentId),
      ),
    )
    .where(eq(rendaFixaDetail.userId, userId))
})

/**
 * Recompute and persist valuation snapshots for all of the user's renda fixa holdings.
 * Refreshes BCB rates if stale before computing. Returns the count of holdings recomputed.
 */
export const refreshRendaFixaValuationsFn = createServerFn({ method: 'POST' }).handler(async () => {
  const [userId, db] = await Promise.all([requireUserId(), getDb()])

  await refreshBcbRatesIfStale({ db })

  const details = await db
    .select({ investmentId: rendaFixaDetail.investmentId })
    .from(rendaFixaDetail)
    .where(eq(rendaFixaDetail.userId, userId))

  await Promise.all(details.map((d) => computeAndSaveValuation(db, userId, d.investmentId)))

  return { refreshed: details.length }
})
