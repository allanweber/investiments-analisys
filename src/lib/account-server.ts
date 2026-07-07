import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { aiProvider, userApiKey } from '@/db/schema'
import { getDb, requireUserId } from '@/lib/db-server'
import { encryptSecret } from '@/lib/settings-encryption'

export const requireSessionFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireUserId()
    return { ok: true }
  },
)

const providerSchema = z.enum(aiProvider)

export type AiApiKeyStatus = {
  provider: (typeof aiProvider)[number]
  lastFour: string
  updatedAt: string
}

export const listAiApiKeysFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AiApiKeyStatus[]> => {
    const db = await getDb()
    const userId = await requireUserId()
    const rows = await db
      .select({
        provider: userApiKey.provider,
        lastFour: userApiKey.lastFour,
        updatedAt: userApiKey.updatedAt,
      })
      .from(userApiKey)
      .where(eq(userApiKey.userId, userId))

    return rows.map((r) => ({
      provider: r.provider,
      lastFour: r.lastFour,
      updatedAt: r.updatedAt.toISOString(),
    }))
  },
)

const saveAiApiKeyInput = z.object({
  provider: providerSchema,
  apiKey: z.string().min(1).max(512),
})

export const saveAiApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => saveAiApiKeyInput.parse(d))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    const encryptedKey = await encryptSecret(data.apiKey)
    const lastFour = data.apiKey.slice(-4)

    await db
      .insert(userApiKey)
      .values({ userId, provider: data.provider, encryptedKey, lastFour })
      .onConflictDoUpdate({
        target: [userApiKey.userId, userApiKey.provider],
        set: { encryptedKey, lastFour, updatedAt: new Date() },
      })
  })

const removeAiApiKeyInput = z.object({ provider: providerSchema })

export const removeAiApiKeyFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => removeAiApiKeyInput.parse(d))
  .handler(async ({ data }) => {
    const db = await getDb()
    const userId = await requireUserId()
    await db
      .delete(userApiKey)
      .where(
        and(
          eq(userApiKey.userId, userId),
          eq(userApiKey.provider, data.provider),
        ),
      )
  })
