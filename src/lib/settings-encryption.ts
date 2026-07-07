import { createServerOnlyFn } from '@tanstack/react-start'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

async function getKey(): Promise<Buffer> {
  const { createHash } = await import('node:crypto')
  const secret = process.env.SETTINGS_ENCRYPTION_KEY
  if (!secret) throw new Error('SETTINGS_ENCRYPTION_KEY is not set')
  // Accepts any-length secret (e.g. the recommended `openssl rand -hex 32`) and derives a 32-byte key from it.
  return createHash('sha256').update(secret).digest()
}

export const encryptSecret = createServerOnlyFn(
  async (plaintext: string): Promise<string> => {
    const { createCipheriv, randomBytes } = await import('node:crypto')
    const key = await getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ])
    const authTag = cipher.getAuthTag()
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
  },
)

export const decryptSecret = createServerOnlyFn(
  async (payload: string): Promise<string> => {
    const { createDecipheriv } = await import('node:crypto')
    const key = await getKey()
    const buf = Buffer.from(payload, 'base64')
    const iv = buf.subarray(0, IV_LENGTH)
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + 16)
    const encrypted = buf.subarray(IV_LENGTH + 16)
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString('utf8')
  },
)
