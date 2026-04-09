import { eq } from 'drizzle-orm'

import { db } from '#/db'
import * as schema from '#/db/schema'

/** Types suggested after signup (pt-BR labels). Idempotent per user. */
const DEFAULT_TYPE_NAMES = [
  'Renda fixa',
  'Ações',
  'Ações internacionais',
  'FIIs',
  'Cripto',
  'REITs',
  'Reserva de valor',
] as const

export async function seedDefaultInvestmentTypesForUser(userId: string) {
  const existing = await db
    .select({ id: schema.investmentType.id })
    .from(schema.investmentType)
    .where(eq(schema.investmentType.userId, userId))
    .limit(1)

  if (existing.length > 0) return

  await db.insert(schema.investmentType).values(
    DEFAULT_TYPE_NAMES.map((name, i) => ({
      userId,
      name,
      sortOrder: i,
    })),
  )
}
