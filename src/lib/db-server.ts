import { createServerOnlyFn } from '@tanstack/react-start'

export const getDb = createServerOnlyFn(async () => {
  return (await import('@/db')).db
})

export const requireUserId = createServerOnlyFn(async (): Promise<string> => {
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const { getAuth } = await import('@/lib/auth')
  const auth = await getAuth()
  const session = await auth.api.getSession({ headers: request.headers })
  const id = session?.user?.id
  if (!id) throw new Error('UNAUTHORIZED')
  return id
})
