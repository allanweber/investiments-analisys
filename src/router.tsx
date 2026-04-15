import {
  ErrorComponent,
  Navigate,
  createRouter as createTanStackRouter,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error }) => {
      const message = error instanceof Error ? error.message : ''
      const status = typeof error === 'object' && error ? (error as any).status : undefined

      if (message === 'UNAUTHORIZED' || status === 401) {
        return <Navigate to="/login" />
      }

      return <ErrorComponent error={error} />
    },
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
