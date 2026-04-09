import {
  Link,
  Navigate,
  createFileRoute,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import ThemeToggle from '#/components/ThemeToggle'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
          aria-hidden
        />
      </div>
    )
  }

  if (session?.user) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isSignUp) {
        const result = await authClient.signUp.email({ email, password, name })
        if (result.error) {
          setError(result.error.message || 'Falha no cadastro')
        } else {
          await router.navigate({ to: '/dashboard' })
        }
      } else {
        const result = await authClient.signIn.email({ email, password })
        if (result.error) {
          setError(result.error.message || 'Falha no login')
        } else {
          await router.navigate({ to: '/dashboard' })
        }
      }
    } catch {
      setError('Ocorreu um erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  const googleSignIn = () => {
    void authClient.signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface font-body text-on-surface">
      <header className="fa-glass sticky top-0 z-50 border-b border-outline-variant/15">
        <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <span className="font-headline text-lg font-bold tracking-tight text-on-surface">
            The Financial Architect
          </span>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-6 font-headline text-sm font-semibold md:flex">
              <Link
                to="/dashboard"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                Início
              </Link>
              <Link
                to="/investimentos"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                Investimentos
              </Link>
              <Link
                to="/tipos"
                className="text-outline no-underline transition-colors hover:text-on-surface"
              >
                Tipos
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main className="relative flex flex-grow flex-col items-center justify-center overflow-hidden px-4 py-12">
        <div className="pointer-events-none absolute inset-0 -z-10 opacity-30">
          <div className="absolute right-[-5%] top-[-10%] h-96 w-96 rounded-full bg-primary-fixed blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-5%] h-96 w-96 rounded-full bg-tertiary-fixed-dim blur-3xl" />
        </div>

        <div className="z-10 w-full max-w-[440px]">
          <div className="mb-10 text-center">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-xl bg-primary-container shadow-lg">
              <span className="material-symbols-outlined text-3xl text-on-primary">
                account_balance
              </span>
            </div>
            <h1 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
              {isSignUp ? 'Criar conta' : 'Entrar no Financial Architect'}
            </h1>
            <p className="mt-2 font-body text-sm text-on-surface-variant">
              Acesse sua conta para gerenciar seu patrimônio com precisão editorial.
            </p>
          </div>

          <div className="rounded-xl bg-surface-container-lowest p-8 shadow-[0px_12px_32px_-4px_rgba(25,28,30,0.06)] md:p-10">
            <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void googleSignIn()}
                className="flex items-center justify-center gap-3 rounded-lg bg-surface-container-low px-4 py-3 font-body text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-high"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google
              </button>
            </div>

            <div className="relative mb-8 flex items-center py-2">
              <div className="flex-grow border-t border-outline-variant/20" />
              <span className="font-label mx-4 flex-shrink text-xs uppercase tracking-widest text-outline">
                Ou use seu e-mail
              </span>
              <div className="flex-grow border-t border-outline-variant/20" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {isSignUp && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                  >
                    Nome
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border-none bg-surface-container-highest px-4 py-3.5 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  E-mail
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-outline">
                    mail
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border-none bg-surface-container-highest py-3.5 pl-12 pr-4 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="nome@exemplo.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
                >
                  Senha
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-outline">
                    lock
                  </span>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border-none bg-surface-container-highest py-3.5 pl-12 pr-4 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="••••••••"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-lg bg-error-container/50 p-3.5 font-body text-xs text-on-error-container">
                  <span className="material-symbols-outlined text-lg">error</span>
                  <p>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-container py-4 font-headline text-base font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">
                      progress_activity
                    </span>
                    Aguarde
                  </>
                ) : isSignUp ? (
                  'Criar conta'
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              {isSignUp ? (
                <p className="font-body text-sm text-on-surface-variant">
                  Já tem conta?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(false)
                      setError('')
                    }}
                    className="font-semibold text-primary underline decoration-surface-tint underline-offset-4"
                  >
                    Entrar
                  </button>
                </p>
              ) : (
                <p className="font-body text-sm text-on-surface-variant">
                  Novo por aqui?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSignUp(true)
                      setError('')
                    }}
                    className="font-semibold text-primary underline decoration-surface-tint underline-offset-4"
                  >
                    Criar conta
                  </button>
                </p>
              )}
            </div>
          </div>

          <div className="mt-12 flex justify-center gap-8">
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Privacidade
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Termos
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Suporte
            </span>
          </div>
        </div>
      </main>
    </div>
  )
}
