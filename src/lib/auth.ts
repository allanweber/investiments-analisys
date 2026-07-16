import { betterAuth } from 'better-auth'

import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { admin, emailOTP } from 'better-auth/plugins'

import { tanstackStartCookies } from 'better-auth/tanstack-start'

import * as schema from '@/db/schema'

import { sendAuthOtpEmail } from '@/lib/email/send-auth-otp'

const googleClientId = process.env.GOOGLE_CLIENT_ID

const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET

const authBaseURL = process.env.BETTER_AUTH_URL ?? 'http://localhost:3002'

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
      ? (['http://localhost:3002', 'http://127.0.0.1:3002'] as const)
      : []),
  ]),
]

let authInstance: ReturnType<typeof betterAuth> | undefined

/**

 * Lazy init so `#/db` / `pg` are not loaded when this module is only referenced

 * from client-side server-fn stubs (dynamic `import('@/lib/auth')`).

 */

export async function getAuth(): Promise<ReturnType<typeof betterAuth>> {
  if (authInstance) return authInstance

  const { db } = await import('@/db')

  const { seedDefaultInvestmentTypesForUser } =
    await import('@/db/seed-default-types')

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

      requireEmailVerification: true,

      autoSignIn: false,

      minPasswordLength: 8,

      revokeSessionsOnPasswordReset: true,
    },

    emailVerification: {
      sendOnSignUp: true,

      autoSignInAfterVerification: true,
    },

    socialProviders:
      googleClientId && googleClientSecret
        ? {
            google: {
              clientId: googleClientId,

              clientSecret: googleClientSecret,
              scope: ['email', 'profile'],
              overrideUserInfoOnSignIn: true,

              mapProfileToUser: (profile) => {
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- profile is Google's OAuth response (external data); better-auth's type is optimistic, and the `as unknown as Record<...>` cast below is exactly the kind of unvalidated-shape signal this guards against
                if (!profile || typeof profile !== 'object') return {}

                const p = profile as unknown as Record<string, unknown>
                const image =
                  (typeof p.picture === 'string' && p.picture) ||
                  (typeof p.avatar_url === 'string' && p.avatar_url) ||
                  (typeof p.image === 'string' && p.image) ||
                  undefined

                return image ? { image } : {}
              },
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

      session: {
        create: {
          after: async (session) => {
            const { db: sessionDb } = await import('@/db')

            const { user } = await import('@/db/schema')

            const { eq } = await import('drizzle-orm')

            await sessionDb

              .update(user)

              .set({ lastLoginAt: new Date() })

              .where(eq(user.id, session.userId))
          },
        },
      },
    },

    plugins: [
      admin(),

      emailOTP({
        overrideDefaultEmailVerification: true,

        sendVerificationOnSignUp: true,

        otpLength: 6,

        expiresIn: 600,

        allowedAttempts: 5,

        resendStrategy: 'reuse',

        rateLimit: { window: 60, max: 3 },

        async sendVerificationOTP({ email, otp, type }) {
          void sendAuthOtpEmail({ email, otp, type })
        },
      }),

      tanstackStartCookies(),
    ],
  })

  authInstance = instance as unknown as ReturnType<typeof betterAuth>

  void seedAdminRole(authInstance)

  return authInstance
}

async function seedAdminRole(_auth: ReturnType<typeof betterAuth>) {
  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail) return
  try {
    const { db } = await import('@/db')
    const { user } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')
    await db
      .update(user)
      .set({ role: 'admin' })
      .where(eq(user.email, adminEmail))
  } catch {
    // non-fatal — user may not exist yet; will be promoted on next boot after signup
  }
}
