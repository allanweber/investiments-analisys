import { authClient } from '#/lib/auth-client'
import { Link } from '@tanstack/react-router'

type Props = { variant?: 'topbar' | 'default' }

export default function BetterAuthHeader({ variant = 'default' }: Props) {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-full bg-surface-container-highest" />
    )
  }

  if (session?.user) {
    if (variant === 'topbar') {
      return (
        <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-outline-variant/30 sm:pl-4">
          {session.user.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high font-body text-xs font-semibold text-on-surface">
              {session.user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              void authClient.signOut()
            }}
            className="hidden text-xs font-medium uppercase tracking-wider text-outline transition-colors hover:text-on-surface sm:inline"
          >
            Sair
          </button>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2">
        {session.user.image ? (
          <img src={session.user.image} alt="" className="h-8 w-8 rounded-full" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-high">
            <span className="font-body text-xs font-medium text-on-surface-variant">
              {session.user.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            void authClient.signOut()
          }}
          className="h-9 flex-1 rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 font-body text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
        >
          Sair
        </button>
      </div>
    )
  }

  return (
    <Link
      to="/login"
      className="inline-flex h-9 items-center rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-4 font-body text-sm font-medium text-on-surface no-underline transition-colors hover:bg-surface-container-high"
    >
      Entrar
    </Link>
  )
}
