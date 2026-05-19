import {
  Link,
  Navigate,
  createFileRoute,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { z } from 'zod'

import { AuthAlert } from '#/components/auth/auth-alert'
import { AuthPageShell } from '#/components/auth/auth-page-shell'
import { useResendCooldown } from '#/hooks/use-resend-cooldown'
import { authClient } from '#/lib/auth-client'
import { mapOtpError } from '#/lib/auth-errors'
import { messages as m } from '#/messages'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({
    email: z.string().optional(),
  }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const router = useRouter()
  const { email: emailFromSearch } = Route.useSearch()
  const { data: session, isPending } = authClient.useSession()

  const [email, setEmail] = useState(emailFromSearch?.trim() ?? '')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const { cooldown, canResend, startCooldown } = useResendCooldown()

  useEffect(() => {
    if (emailFromSearch?.trim()) {
      setEmail(emailFromSearch.trim())
      startCooldown(60)
    }
  }, [emailFromSearch, startCooldown])

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

  const handleResend = async () => {
    if (!email.trim() || !canResend || resendLoading) return
    setError('')
    setResendLoading(true)
    try {
      const result = await authClient.emailOtp.requestPasswordReset({
        email: email.trim(),
      })
      if (result.error) {
        setError(mapOtpError(result.error))
      } else {
        startCooldown(60)
      }
    } catch {
      setError(m.auth.errorUnexpected)
    } finally {
      setResendLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(m.auth.errorPasswordMismatch)
      return
    }

    setLoading(true)
    try {
      const result = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        password,
      })
      if (result.error) {
        setError(mapOtpError(result.error))
        return
      }
      await router.navigate({
        to: '/login',
        search: { reset: 'success' },
      })
    } catch {
      setError(m.auth.errorUnexpected)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      icon="password"
      title={m.auth.resetPasswordTitle}
      subtitle={m.auth.resetPasswordSubtitle}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            {m.auth.labelEmail}
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border-none bg-surface-container-highest px-4 py-3.5 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={m.auth.placeholderEmail}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="otp"
            className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            {m.auth.labelOtp}
          </label>
          <input
            id="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-md border-none bg-surface-container-highest px-4 py-3.5 text-center font-headline text-lg tracking-[0.3em] text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={m.auth.placeholderOtp}
            required
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            {m.auth.labelNewPassword}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border-none bg-surface-container-highest px-4 py-3.5 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={m.auth.placeholderPassword}
            required
            minLength={8}
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirmPassword"
            className="font-label block text-xs font-semibold uppercase tracking-wider text-on-surface-variant"
          >
            {m.auth.labelConfirmPassword}
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-md border-none bg-surface-container-highest px-4 py-3.5 font-body text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder={m.auth.placeholderPassword}
            required
            minLength={8}
          />
        </div>

        <AuthAlert message={error} />

        <button
          type="submit"
          disabled={loading || otp.length !== 6}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-container py-4 font-headline text-base font-bold text-on-primary shadow-lg transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
            m.auth.submitResetPassword
          )}
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={!canResend || resendLoading || !email.trim()}
            className="cursor-pointer font-body text-sm font-semibold text-primary underline decoration-surface-tint underline-offset-4 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canResend
              ? m.auth.resendOtp
              : m.auth.resendOtpCooldown(cooldown)}
          </button>
          <Link
            to="/login"
            className="font-body text-sm text-on-surface-variant no-underline hover:text-on-surface"
          >
            {m.auth.linkSignIn}
          </Link>
        </div>
      </form>
    </AuthPageShell>
  )
}
