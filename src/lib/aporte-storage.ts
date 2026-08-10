import type { AporteSimulationResult } from '@/lib/aporte-server'
import type { FxCurrency } from '@/lib/fx'

/**
 * The current, unsaved aporte simulation kept in the browser so it stays on
 * screen across reloads and navigation. It lives until the user runs a new
 * simulation (overwrite), discards it, or saves it to the history.
 */
export type PersistedAporte = {
  currency: FxCurrency
  amount: number
  result: AporteSimulationResult
  computedAt: string
  excludedIds: string[]
  removedNames: [string, string][]
  appliedIds: string[]
}

const STORAGE_KEY = 'aporte:current:v1'

export function loadPersistedAporte(): PersistedAporte | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedAporte
    // Only OK results carry suggestions worth restoring.
    if (parsed.result.reason !== 'OK') return null
    return parsed
  } catch {
    return null
  }
}

export function savePersistedAporte(data: PersistedAporte): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore quota / serialization errors — persistence is best-effort.
  }
}

export function clearPersistedAporte(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore.
  }
}
