import { eq } from 'drizzle-orm'

import { getDefaultQuestionsForTypeName } from '#/db/default-question-bank'
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
  const { db } = await import('#/db')
  const existing = await db
    .select({ id: schema.investmentType.id })
    .from(schema.investmentType)
    .where(eq(schema.investmentType.userId, userId))
    .limit(1)

  if (existing.length > 0) return

  const inserted = await db
    .insert(schema.investmentType)
    .values(
      DEFAULT_TYPE_NAMES.map((name, i) => ({
        userId,
        name,
        sortOrder: i,
      })),
    )
    .returning({ id: schema.investmentType.id, name: schema.investmentType.name })

  for (const row of inserted) {
    const prompts = getDefaultQuestionsForTypeName(row.name)
    if (prompts.length === 0) continue
    await db.insert(schema.question).values(
      prompts.map((prompt, i) => ({
        userId,
        investmentTypeId: row.id,
        prompt,
        sortOrder: i,
        active: true,
      })),
    )
  }
}
