import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useRouterState,
} from '@tanstack/react-router'

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { requireSessionFn } from '@/lib/account-server'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/account')({
  beforeLoad: async () => {
    try {
      await requireSessionFn()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AccountLayout,
})

function AccountLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const activeTab = pathname.startsWith('/account/profile')
    ? 'profile'
    : 'settings'

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
          {m.account.title}
        </span>
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-outline no-underline hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-lg leading-none">
            arrow_back
          </span>
          {m.account.backToApp}
        </Link>
      </div>
      <Tabs value={activeTab}>
        <TabsList>
          <TabsTrigger value="profile" asChild>
            <Link to="/account/profile">{m.account.tabProfile}</Link>
          </TabsTrigger>
          <TabsTrigger value="settings" asChild>
            <Link to="/account/settings">{m.account.tabSettings}</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-6">
        <Outlet />
      </div>
    </div>
  )
}
