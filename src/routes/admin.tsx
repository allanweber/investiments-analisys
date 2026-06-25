import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { checkAdminAccessFn } from '@/lib/admin-server'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    try {
      await checkAdminAccessFn()
    } catch {
      throw redirect({ to: '/login' })
    }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="fa-glass fixed top-0 z-50 w-full border-b border-outline-variant/15 shadow-sm">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link
              to="/admin"
              className="font-headline text-lg font-bold tracking-tight text-on-surface no-underline"
            >
              Admin
            </Link>
            <span className="rounded-full bg-error-container px-2 py-0.5 font-label text-[10px] font-bold uppercase tracking-wider text-on-error-container">
              restrito
            </span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-outline no-underline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-lg leading-none">arrow_back</span>
            App
          </Link>
        </div>
      </header>
      <div className="pt-16">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
