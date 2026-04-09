import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import * as schema from '#/db/schema'

const googleClientId = process.env.GOOGLE_CLIENT_ID
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const authBaseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3001'

const extraTrustedOrigins =
  process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? []

/** Origins allowed for cookie / CSRF checks (must include the URL users open in the browser). */
const trustedOrigins = [
  ...new Set([
    authBaseURL,
    ...extraTrustedOrigins,
    ...(process.env.NODE_ENV !== 'production'
      ? ([
          'http://localhost:3001',
          'http://127.0.0.1:3001',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ] as const)
      : []),
  ]),
]

let authInstance: ReturnType<typeof betterAuth> | undefined

/**
 * Lazy init so `#/db` / `pg` are not loaded when this module is only referenced
 * from client-side server-fn stubs (dynamic `import('#/lib/auth')`).
 */
export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  if (authInstance) return authInstance
  const { db } = await import('#/db')
  const { seedDefaultInvestmentTypesForUser } = await import('#/db/seed-default-types')
  const instance = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET ?? 'dev-only-change-me',
    baseURL: authBaseURL,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
            },
          }
        : undefined,
    databaseHooks: {
      user: {
        create: {
          after: async (user, _ctx) => {
            await seedDefaultInvestmentTypesForUser(user.id)
          },
        },
      },
    },
    plugins: [tanstackStartCookies()],
  })
  authInstance = instance as unknown as ReturnType<typeof betterAuth>
  return authInstance
}
