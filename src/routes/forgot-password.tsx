import {
  Link,
  Navigate,
  createFileRoute,
  useRouter,
} from '@tanstack/react-router'
import { useState } from 'react'

import { AuthAlert } from '@/components/auth/auth-alert'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { authClient } from '@/lib/auth-client'
import { mapOtpError } from '@/lib/auth-errors'
import { messages as m } from '@/messages'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <span className="sr-only">{m.common.loading}</span>
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
      const result = await authClient.emailOtp.requestPasswordReset({
        email: email.trim(),
      })
      if (result.error) {
        setError(mapOtpError(result.error))
        return
      }
      await router.navigate({
        to: '/reset-password',
        search: { email: email.trim() },
      })
    } catch {
      setError(m.auth.errorUnexpected)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      icon="lock_reset"
      title={m.auth.forgotPasswordTitle}
      subtitle={m.auth.forgotPasswordSubtitle}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            {m.auth.labelEmail}
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
              placeholder={m.auth.placeholderEmail}
              required
            />
          </div>
        </div>

        <AuthAlert message={error} />

        <p className="font-body text-xs text-on-surface-variant">
          {m.auth.forgotPasswordSuccess}
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-container py-4 font-headline text-base font-bold text-on-primary shadow-lg transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <span
                className="material-symbols-outlined animate-spin"
                aria-hidden
              >
                progress_activity
              </span>
              {m.common.wait}
            </>
          ) : (
            m.auth.submitForgotPassword
          )}
        </button>

        <p className="text-center font-body text-sm text-on-surface-variant">
          <Link
            to="/login"
            className="font-semibold text-primary underline decoration-surface-tint underline-offset-4"
          >
            {m.auth.linkSignIn}
          </Link>
        </p>
      </form>
    </AuthPageShell>
  )
}
