import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import {
  aporteRun,
  investment,
  investmentType,
  portfolioHolding,
  rendaFixaDetail,
} from '@/db/schema'
import type { AporteRunSnapshot } from '@/db/schema'
import { loadQuotesFromDb } from '@/lib/market-data/quote-cache'
import { refreshMarketQuotesForInputs } from '@/lib/market-data/quote-refresh'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { normalizeHoldingCurrency } from '@/lib/math'
import { getDb, requireUserId } from '@/lib/db-server'
import { uuid, idInput } from '@/lib/server-utils'

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// —— Live quote for a single investment (used at Aportar time) ——

export const getInvestmentLiveQuoteFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) =>
    z.object({ investmentId: uuid }).parse(data),
  )
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const [inv] = await db
      .select({
        ticker: investment.ticker,
        currency: investment.currency,
        fixedIncome: investmentType.fixedIncome,
        typeName: investmentType.name,
      })
      .from(investment)
      .innerJoin(
        investmentType,
        eq(investment.investmentTypeId, investmentType.id),
      )
      .where(
        and(
          eq(investment.id, data.investmentId),
          eq(investment.userId, userId),
        ),
      )
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match makes it undefined at runtime
    if (!inv) return { ok: false as const, code: 'NOT_FOUND' as const }
    if (isFixedIncomeTipo(inv.fixedIncome, inv.typeName)) {
      return { ok: false as const, code: 'FIXED_INCOME' as const }
    }

    const symbol = inv.ticker?.trim() ?? ''
    if (!symbol) return { ok: false as const, code: 'NO_TICKER' as const }

    const inputs = [
      {
        symbol,
        holdingCurrency: normalizeHoldingCurrency(inv.currency ?? 'BRL'),
      },
    ]
    await refreshMarketQuotesForInputs({
      actorId: userId,
      reason: 'immediate',
      inputs,
    })
    const { bySymbol } = await loadQuotesFromDb({ inputs })
    const q = bySymbol.get(symbol)
    return {
      ok: true as const,
      price: q?.price ?? null,
      currency: q?.currency ?? inv.currency ?? null,
    }
  })

// —— Aportar: increment the real holding (weighted avg cost) ——

const aportarInput = z.object({
  investmentId: uuid,
  /** renda variável: units to add (>0) and the unit price to book them at. */
  units: z.number().positive().optional(),
  unitPrice: z.number().positive().optional(),
  /** renda fixa: capital to add (>0). */
  capital: z.number().positive().optional(),
  operationDate: z.string().datetime().optional().nullable(),
})

export const aportarFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => aportarInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()

    const [inv] = await db
      .select({
        id: investment.id,
        fixedIncome: investmentType.fixedIncome,
        typeName: investmentType.name,
      })
      .from(investment)
      .innerJoin(
        investmentType,
        eq(investment.investmentTypeId, investmentType.id),
      )
      .where(
        and(
          eq(investment.id, data.investmentId),
          eq(investment.userId, userId),
        ),
      )
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess, so TS types this as always-defined even though a 0-row match makes it undefined at runtime
    if (!inv) return { ok: false as const, code: 'NOT_FOUND' as const }

    const opDate = data.operationDate
      ? new Date(data.operationDate)
      : new Date()

    if (isFixedIncomeTipo(inv.fixedIncome, inv.typeName)) {
      const addCapital = data.capital
      if (!addCapital || addCapital <= 0) {
        return { ok: false as const, code: 'MISSING_CAPITAL' as const }
      }
      // Requires an existing renda-fixa position (product/indexer/rate/maturity
      // can't be inferred from an aporte). New titles are handled in the UI.
      const [detail] = await db
        .select({ capital: rendaFixaDetail.capital })
        .from(rendaFixaDetail)
        .where(
          and(
            eq(rendaFixaDetail.userId, userId),
            eq(rendaFixaDetail.investmentId, data.investmentId),
          ),
        )
        .limit(1)
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess; a 0-row match makes this undefined at runtime
      if (!detail)
        return { ok: false as const, code: 'NEEDS_RF_DETAILS' as const }

      const newCapital = round2(Number(detail.capital) + addCapital)
      await db
        .update(rendaFixaDetail)
        .set({ capital: String(newCapital), updatedAt: new Date() })
        .where(
          and(
            eq(rendaFixaDetail.userId, userId),
            eq(rendaFixaDetail.investmentId, data.investmentId),
          ),
        )
      // RF holding invariant: quantity=1, avgCost=capital (marketValue = capital).
      await db
        .update(portfolioHolding)
        .set({
          quantity: '1',
          avgCost: String(newCapital),
          lastOperationAt: opDate,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(portfolioHolding.userId, userId),
            eq(portfolioHolding.investmentId, data.investmentId),
          ),
        )
      return { ok: true as const }
    }

    // renda variável: add units at the given unit price, recompute weighted avg cost.
    const addQ = data.units
    const unit = data.unitPrice
    if (!addQ || addQ <= 0 || !unit || unit <= 0) {
      return { ok: false as const, code: 'MISSING_UNITS_OR_PRICE' as const }
    }

    const [existing] = await db
      .select({
        quantity: portfolioHolding.quantity,
        avgCost: portfolioHolding.avgCost,
        broker: portfolioHolding.broker,
      })
      .from(portfolioHolding)
      .where(
        and(
          eq(portfolioHolding.userId, userId),
          eq(portfolioHolding.investmentId, data.investmentId),
        ),
      )
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess; a 0-row match makes this undefined at runtime (new position)
    const oldQ = existing ? Number(existing.quantity) : 0
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- see above
    const oldAvg = existing ? Number(existing.avgCost) : 0
    const newQ = oldQ + addQ
    const newAvg = newQ > 0 ? (oldQ * oldAvg + addQ * unit) / newQ : unit

    await db
      .insert(portfolioHolding)
      .values({
        userId,
        investmentId: data.investmentId,
        quantity: String(newQ),
        avgCost: String(round2(newAvg)),
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- existing may be undefined (new position)
        broker: existing?.broker ?? null,
        lastOperationAt: opDate,
      })
      .onConflictDoUpdate({
        target: [portfolioHolding.userId, portfolioHolding.investmentId],
        set: {
          quantity: String(newQ),
          avgCost: String(round2(newAvg)),
          lastOperationAt: opDate,
          updatedAt: new Date(),
        },
      })
    return { ok: true as const }
  })

// —— Saved aporte runs (frozen snapshots) ——

const snapshotSchema: z.ZodType<AporteRunSnapshot> = z.object({
  input: z.object({
    amount: z.number(),
    currency: z.string(),
    excludedInvestmentIds: z.array(z.string()),
  }),
  suggestions: z.array(z.any()),
  typeProjections: z.array(z.any()),
  unallocatedAmount: z.number(),
  appliedInvestmentIds: z.array(z.string()),
}) as z.ZodType<AporteRunSnapshot>

const saveAporteRunInput = z.object({
  name: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  currency: z.string().min(1).max(3),
  simulatedAt: z.string().datetime(),
  snapshot: snapshotSchema,
})

export const saveAporteRunFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => saveAporteRunInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [row] = await db
      .insert(aporteRun)
      .values({
        userId,
        name: data.name,
        amount: String(data.amount),
        currency: data.currency,
        simulatedAt: new Date(data.simulatedAt),
        snapshot: data.snapshot,
      })
      .returning({ id: aporteRun.id })
    return { ok: true as const, id: row.id }
  })

export const listAporteRunsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await getDb()
    const userId = await requireUserId()
    const rows = await db
      .select({
        id: aporteRun.id,
        name: aporteRun.name,
        amount: aporteRun.amount,
        currency: aporteRun.currency,
        simulatedAt: aporteRun.simulatedAt,
        snapshot: aporteRun.snapshot,
      })
      .from(aporteRun)
      .where(eq(aporteRun.userId, userId))
      .orderBy(desc(aporteRun.simulatedAt))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      amount: Number(r.amount),
      currency: r.currency,
      simulatedAt:
        r.simulatedAt instanceof Date
          ? r.simulatedAt.toISOString()
          : String(r.simulatedAt),
      suggestionCount: r.snapshot.suggestions.length,
      appliedCount: r.snapshot.appliedInvestmentIds.length,
    }))
  },
)

export const getAporteRunFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [row] = await db
      .select({
        id: aporteRun.id,
        name: aporteRun.name,
        amount: aporteRun.amount,
        currency: aporteRun.currency,
        simulatedAt: aporteRun.simulatedAt,
        snapshot: aporteRun.snapshot,
      })
      .from(aporteRun)
      .where(and(eq(aporteRun.id, data.id), eq(aporteRun.userId, userId)))
      .limit(1)

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- tsconfig lacks noUncheckedIndexedAccess; a 0-row match makes this undefined at runtime
    if (!row) return { ok: false as const, code: 'NOT_FOUND' as const }
    return {
      ok: true as const,
      run: {
        id: row.id,
        name: row.name,
        amount: Number(row.amount),
        currency: row.currency,
        simulatedAt:
          row.simulatedAt instanceof Date
            ? row.simulatedAt.toISOString()
            : String(row.simulatedAt),
        snapshot: row.snapshot,
      },
    }
  })

export const deleteAporteRunFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    await db
      .delete(aporteRun)
      .where(and(eq(aporteRun.id, data.id), eq(aporteRun.userId, userId)))
    return { ok: true as const }
  })
