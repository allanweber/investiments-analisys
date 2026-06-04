import { createServerFn } from '@tanstack/react-start'
import { and, asc, count, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import {
  getDefaultQuestionsForTypeName,
  hasDefaultQuestionPackForTypeName,
  normalizeQuestionPrompt,
} from '#/db/default-question-bank'
import { investmentAnswer, investmentType, question } from '#/db/schema'
import { getDb, idInput, requireUserId, uuid } from '#/lib/server-utils'

const listQuestionsInput = z.object({ typeId: uuid })

export const listQuestionsForTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => listQuestionsInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const typeRow = await db
      .select({ id: investmentType.id, name: investmentType.name })
      .from(investmentType)
      .where(
        and(eq(investmentType.id, data.typeId), eq(investmentType.userId, userId)),
      )
      .limit(1)

    if (typeRow.length === 0) return { type: null, questions: [] as const }

    const questions = await db
      .select()
      .from(question)
      .where(
        and(eq(question.investmentTypeId, data.typeId), eq(question.userId, userId)),
      )
      .orderBy(asc(question.sortOrder), asc(question.createdAt))

    return { type: typeRow[0], questions }
  })

const createQuestionInput = z.object({
  investmentTypeId: uuid,
  prompt: z.string().min(1).max(2000),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})

export const createQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => createQuestionInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({ id: investmentType.id })
      .from(investmentType)
      .where(
        and(
          eq(investmentType.id, data.investmentTypeId),
          eq(investmentType.userId, userId),
        ),
      )
      .limit(1)
    if (!t) return null

    const [maxRow] = await db
      .select({
        m: sql<number>`COALESCE(MAX(${question.sortOrder}), -1)`,
      })
      .from(question)
      .where(eq(question.investmentTypeId, data.investmentTypeId))

    const order = data.sortOrder ?? Number(maxRow?.m ?? -1) + 1

    const [row] = await db
      .insert(question)
      .values({
        userId,
        investmentTypeId: data.investmentTypeId,
        prompt: data.prompt.trim(),
        sortOrder: order,
        active: data.active ?? true,
      })
      .returning()
    return row
  })

const updateQuestionInput = z.object({
  id: uuid,
  prompt: z.string().min(1).max(2000),
  sortOrder: z.number().int(),
  active: z.boolean(),
})

export const updateQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => updateQuestionInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [row] = await db
      .update(question)
      .set({
        prompt: data.prompt.trim(),
        sortOrder: data.sortOrder,
        active: data.active,
      })
      .where(and(eq(question.id, data.id), eq(question.userId, userId)))
      .returning()
    return row ?? null
  })

export const deleteQuestionFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => idInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [aRow] = await db
      .select({ n: count() })
      .from(investmentAnswer)
      .where(eq(investmentAnswer.questionId, data.id))

    if (aRow && Number(aRow.n) > 0) {
      return { ok: false as const, code: 'HAS_ANSWERS' as const }
    }

    await db
      .delete(question)
      .where(and(eq(question.id, data.id), eq(question.userId, userId)))
    return { ok: true as const }
  })

const restoreDefaultsInput = z.object({ typeId: uuid })

export const restoreDefaultQuestionsForTypeFn = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => restoreDefaultsInput.parse(data))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const [t] = await db
      .select({
        id: investmentType.id,
        name: investmentType.name,
      })
      .from(investmentType)
      .where(
        and(eq(investmentType.id, data.typeId), eq(investmentType.userId, userId)),
      )
      .limit(1)

    if (!t) return { ok: false as const, code: 'NOT_FOUND' as const }

    if (!hasDefaultQuestionPackForTypeName(t.name)) {
      return { ok: false as const, code: 'NO_PACK' as const }
    }

    const bankPrompts = getDefaultQuestionsForTypeName(t.name)
    const existing = await db
      .select({ prompt: question.prompt })
      .from(question)
      .where(
        and(eq(question.investmentTypeId, data.typeId), eq(question.userId, userId)),
      )

    const seenNorm = new Set(
      existing.map((e) => normalizeQuestionPrompt(e.prompt)),
    )

    const [maxRow] = await db
      .select({
        m: sql<number>`COALESCE(MAX(${question.sortOrder}), -1)`,
      })
      .from(question)
      .where(eq(question.investmentTypeId, data.typeId))

    let nextOrder = Number(maxRow?.m ?? -1)
    let inserted = 0

    for (const prompt of bankPrompts) {
      const norm = normalizeQuestionPrompt(prompt)
      if (seenNorm.has(norm)) continue
      nextOrder += 1
      await db.insert(question).values({
        userId,
        investmentTypeId: data.typeId,
        prompt,
        sortOrder: nextOrder,
        active: true,
      })
      seenNorm.add(norm)
      inserted += 1
    }

    return { ok: true as const, inserted }
  })
