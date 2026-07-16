import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { decryptSecret, encryptSecret } from './settings-encryption'

const ORIGINAL_KEY = process.env.SETTINGS_ENCRYPTION_KEY

beforeEach(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = 'test-key-not-a-real-secret-0123456789'
})

afterEach(() => {
  process.env.SETTINGS_ENCRYPTION_KEY = ORIGINAL_KEY
})

describe('encryptSecret / decryptSecret', () => {
  it('round-trips a plaintext value', async () => {
    const plaintext = 'sk-ant-fake-test-key-value'
    const encrypted = await encryptSecret(plaintext)
    const decrypted = await decryptSecret(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for the same plaintext on repeated calls (random IV)', async () => {
    const plaintext = 'same-input-twice'
    const a = await encryptSecret(plaintext)
    const b = await encryptSecret(plaintext)
    expect(a).not.toBe(b)
  })

  it('throws when the ciphertext is corrupted (auth tag mismatch)', async () => {
    const encrypted = await encryptSecret('some-secret')
    const buf = Buffer.from(encrypted, 'base64')
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff // flip last byte
    const tampered = buf.toString('base64')
    await expect(decryptSecret(tampered)).rejects.toThrow()
  })

  it('throws when SETTINGS_ENCRYPTION_KEY is unset', async () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY
    await expect(encryptSecret('x')).rejects.toThrow(
      'SETTINGS_ENCRYPTION_KEY is not set',
    )
  })
})
