import { messages as m } from '#/messages'

type AuthErrorLike = {
  code?: string
  status?: number
  message?: string
} | null | undefined

export function mapOtpError(error: AuthErrorLike): string {
  if (!error) return m.auth.errorUnexpected
  if (error.status === 429) return m.auth.errorRateLimit
  if (error.code === 'TOO_MANY_ATTEMPTS') return m.auth.errorTooManyOtpAttempts
  if (error.code === 'INVALID_OTP' || error.code === 'OTP_EXPIRED') {
    return m.auth.errorInvalidOtp
  }
  return error.message ?? m.auth.errorUnexpected
}

export function isEmailNotVerifiedError(error: AuthErrorLike): boolean {
  if (!error) return false
  return error.status === 403
}

export function isInvalidCredentialsError(error: AuthErrorLike): boolean {
  if (!error) return false
  return (
    error.status === 401 ||
    error.code === 'INVALID_EMAIL_OR_PASSWORD' ||
    error.code === 'INVALID_CREDENTIALS'
  )
}

export function mapSignInError(error: AuthErrorLike): string {
  if (!error) return m.auth.errorUnexpected
  if (isEmailNotVerifiedError(error)) return m.auth.errorEmailNotVerified
  if (isInvalidCredentialsError(error)) return m.auth.errorSignIn
  return error.message ?? m.auth.errorSignIn
}
