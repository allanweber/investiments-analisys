import { createFileRoute } from '@tanstack/react-router'

/** Dynamic import + lazy `getAuth()` keep `#/db` / `pg` off the client graph. */
async function handleAuth(request: Request) {
  const { getAuth } = await import('#/lib/auth')
  return (await getAuth()).handler(request)
}

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleAuth(request),
      POST: ({ request }) => handleAuth(request),
    },
  },
})
