const VERIFY_PASSWORD_STORAGE_KEY = 'auth:verify-password'

export function stashVerifyPassword(password: string) {
  try {
    sessionStorage.setItem(VERIFY_PASSWORD_STORAGE_KEY, password)
  } catch {
    /* private mode / blocked storage */
  }
}

export function readVerifyPassword(fallback?: string) {
  if (fallback) return fallback
  try {
    return sessionStorage.getItem(VERIFY_PASSWORD_STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function clearVerifyPassword() {
  try {
    sessionStorage.removeItem(VERIFY_PASSWORD_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
