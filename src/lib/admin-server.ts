import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

async function requireAdminRequest() {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()

  const allowedIp = process.env.ADMIN_ALLOWED_IP
  if (allowedIp) {
    // Cloudflare's edge sets this and strips any client-supplied copy — trustworthy
    // when the app is only reachable via the documented Cloudflare Tunnel topology
    // (see docs/plans/hetzner_coolify_cloudflare_deploy.plan.md). Fall back to
    // x-forwarded-for/x-real-ip for non-Cloudflare deployments (e.g. local dev) —
    // those headers are attacker-controllable unless the fronting proxy is known to
    // overwrite (not append to) them, so this fallback is weaker and best-effort only.
    const cfIp = request.headers.get('cf-connecting-ip')
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = request.headers.get('x-real-ip')
    const clientIp = cfIp ?? forwarded ?? realIp
    if (clientIp !== allowedIp) throw new Error('FORBIDDEN')
  }

  const { getAuth } = await import('@/lib/auth')
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) throw new Error('UNAUTHORIZED')

  const userWithRole = session.user as typeof session.user & { role?: string }
  if (userWithRole.role !== 'admin') throw new Error('FORBIDDEN')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { auth: auth as any, headers: request.headers }
}

export type AdminUserRow = {
  id: string
  name: string
  email: string
  createdAt: string
  lastSeen: string | null
  banned: boolean
  role: string | null
  typesCount: number
  investmentsCount: number
  holdingsCount: number
}

export const listAdminUsersFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdminRequest()
  const { db } = await import('@/db')
  const { investmentType, investment, portfolioHolding, user } = await import('@/db/schema')
  const { count, desc } = await import('drizzle-orm')

  const users = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      banned: user.banned,
      role: user.role,
    })
    .from(user)
    .orderBy(desc(user.createdAt))

  const [typeCounts, investCounts, holdingCounts] = await Promise.all([
    db.select({ userId: investmentType.userId, cnt: count() }).from(investmentType).groupBy(investmentType.userId),
    db.select({ userId: investment.userId, cnt: count() }).from(investment).groupBy(investment.userId),
    db.select({ userId: portfolioHolding.userId, cnt: count() }).from(portfolioHolding).groupBy(portfolioHolding.userId),
  ])

  const typeMap = new Map(typeCounts.map((r) => [r.userId, r.cnt]))
  const investMap = new Map(investCounts.map((r) => [r.userId, r.cnt]))
  const holdingMap = new Map(holdingCounts.map((r) => [r.userId, r.cnt]))

  return users.map((u): AdminUserRow => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    lastSeen: u.lastLoginAt?.toISOString() ?? null,
    banned: u.banned ?? false,
    role: u.role ?? null,
    typesCount: typeMap.get(u.id) ?? 0,
    investmentsCount: investMap.get(u.id) ?? 0,
    holdingsCount: holdingMap.get(u.id) ?? 0,
  }))
})

const userIdInput = z.object({ userId: z.string() })

export const banAdminUserFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => userIdInput.parse(d))
  .handler(async ({ data }) => {
    const { auth, headers } = await requireAdminRequest()
    await auth.api.banUser({ body: { userId: data.userId }, headers })
  })

export const unbanAdminUserFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => userIdInput.parse(d))
  .handler(async ({ data }) => {
    const { auth, headers } = await requireAdminRequest()
    await auth.api.unbanUser({ body: { userId: data.userId }, headers })
  })

export const deleteAdminUserFn = createServerFn({ method: 'POST' })
  .inputValidator((d: unknown) => userIdInput.parse(d))
  .handler(async ({ data }) => {
    const { auth, headers } = await requireAdminRequest()
    await auth.api.removeUser({ body: { userId: data.userId }, headers })
  })

export const checkAdminAccessFn = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAdminRequest()
  return { ok: true }
})
