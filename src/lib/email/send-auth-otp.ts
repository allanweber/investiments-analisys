import { Resend } from 'resend'

import { messages as m } from '@/messages'

export type AuthOtpEmailType =
  | 'email-verification'
  | 'forget-password'
  | 'sign-in'
  | 'change-email'

function getOtpEmailContent(type: AuthOtpEmailType, otp: string) {
  switch (type) {
    case 'email-verification':
      return {
        subject: m.auth.emailOtpSubjectVerify,
        text: m.auth.emailOtpBodyVerify(otp),
      }
    case 'forget-password':
      return {
        subject: m.auth.emailOtpSubjectReset,
        text: m.auth.emailOtpBodyReset(otp),
      }
    case 'sign-in':
      return {
        subject: m.auth.emailOtpSubjectSignIn,
        text: m.auth.emailOtpBodySignIn(otp),
      }
    case 'change-email':
      return {
        subject: m.auth.emailOtpSubjectChangeEmail,
        text: m.auth.emailOtpBodyChangeEmail(otp),
      }
  }
}

/** Sends auth OTP email via Resend; logs to console in dev when API key is missing. */
export async function sendAuthOtpEmail({
  email,
  otp,
  type,
}: {
  email: string
  otp: string
  type: AuthOtpEmailType
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from =
    process.env.EMAIL_FROM ?? 'onboarding@resend.dev'

  const { subject, text } = getOtpEmailContent(type, otp)

  if (!apiKey) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[auth-otp] ${type} → ${email}: ${otp}`)
    }
    return
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from,
    to: email,
    subject,
    text,
  })

  if (error) {
    console.error('[auth-otp] Resend error:', error)
  }
}
