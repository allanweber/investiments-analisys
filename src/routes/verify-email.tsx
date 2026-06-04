import {
  Link,
  Navigate,
  createFileRoute,
  useLocation,
  useRouter,
} from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { z } from 'zod'

import { AuthAlert } from '@/components/auth/auth-alert'
import { AuthPageShell } from '@/components/auth/auth-page-shell'
import { useResendCooldown } from '@/hooks/use-resend-cooldown'
import { authClient } from '@/lib/auth-client'
import { mapOtpError, mapSignInError } from '@/lib/auth-errors'
import {
  clearVerifyPassword,
  readVerifyPassword,
} from '@/lib/auth-verify-storage'
import { messages as m } from '@/messages'

type VerifyEmailState = {
  password?: string
  fromSignUp?: boolean
}

export const Route = createFileRoute('/verify-email')({
  validateSearch: z.object({
    email: z.string().optional(),
  }),
  component: VerifyEmailPage,
})

function VerifyEmailPage() {
  const router = useRouter()
  const location = useLocation()
  const { email: emailFromSearch } = Route.useSearch()
  const state = location.state as VerifyEmailState | undefined
  const { data: session, isPending } = authClient.useSession()

  const email = emailFromSearch?.trim() ?? ''
  const password = useMemo(
    () => readVerifyPassword(state?.password),
    [state?.password],
  )

  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const { cooldown, canResend, startCooldown } = useResendCooldown()

  useEffect(() => {
    if (state?.fromSignUp) {
      startCooldown(60)
    }
  }, [state?.fromSignUp, startCooldown])

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div role="status" className="flex flex-col items-center gap-2">
          <span className="sr-only">{m.common.loading}</span>
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
            aria-hidden
          />
        </div>
      </div>
    )
  }

  if (session?.user?.emailVerified) {
    return <Navigate to="/dashboard" replace />
  }

  if (!email) {
    return <Navigate to="/login" replace />
  }

  const handleResend = async () => {
    if (!canResend || resendLoading) return
    setError('')
    setResendLoading(true)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'email-verification',
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
    setLoading(true)
    try {
      const verifyResult = await authClient.emailOtp.verifyEmail({
        email,
        otp: otp.trim(),
      })
      if (verifyResult.error) {
        setError(mapOtpError(verifyResult.error))
        return
      }

      const storedPassword = readVerifyPassword(password)

      if (verifyResult.data?.token) {
        clearVerifyPassword()
        await router.navigate({ to: '/dashboard' })
        return
      }

      if (storedPassword) {
        const signInResult = await authClient.signIn.email({
          email,
          password: storedPassword,
        })
        clearVerifyPassword()
        if (signInResult.error) {
          setError(mapSignInError(signInResult.error))
          return
        }
        await router.navigate({ to: '/dashboard' })
        return
      }

      clearVerifyPassword()
      await router.navigate({
        to: '/login',
        search: { verified: '1' },
      })
    } catch {
      setError(m.auth.errorUnexpected)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell
      icon="mark_email_read"
      title={m.auth.verifyEmailTitle}
      subtitle={m.auth.verifyEmailSubtitle(email)}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
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
            m.auth.submitVerifyEmail
          )}
        </button>

        <div className="flex flex-col items-center gap-3 text-center">
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={!canResend || resendLoading}
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
            {m.auth.linkChangeEmail}
          </Link>
        </div>
      </form>
    </AuthPageShell>
  )
}
