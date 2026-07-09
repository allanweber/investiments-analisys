import { runAiScoringForInvestmentsFn } from '@/lib/ai/ai-scoring-server'

export type RunStatus = 'pending' | 'running' | 'ok' | 'error'

type BulkRunState = {
  selected: Set<string>
  running: boolean
  statusById: Record<string, RunStatus>
  doneCount: number
  total: number
}

const CONCURRENCY = 4
const CHUNK_SIZE = 3

const STORAGE_KEY = 'ia-em-lote:bulk-run-state:v1'

type PersistedState = {
  selected: string[]
  running: boolean
  statusById: Record<string, RunStatus>
  doneCount: number
  total: number
}

function emptyState(): BulkRunState {
  return { selected: new Set(), running: false, statusById: {}, doneCount: 0, total: 0 }
}

function loadPersisted(): BulkRunState {
  if (typeof window === 'undefined') return emptyState()
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyState()
    const parsed = JSON.parse(raw) as PersistedState

    // A `running: true` snapshot means the tab reloaded mid-run — no worker
    // survives that, so anything not already finished is treated as failed.
    const statusById = parsed.running
      ? Object.fromEntries(
          Object.entries(parsed.statusById).map(([id, s]) => [
            id,
            s === 'ok' || s === 'error' ? s : 'error',
          ]),
        )
      : parsed.statusById

    return {
      selected: new Set(parsed.selected),
      running: false,
      statusById,
      doneCount: parsed.doneCount,
      total: parsed.total,
    }
  } catch {
    return emptyState()
  }
}

function persist(s: BulkRunState) {
  if (typeof window === 'undefined') return
  try {
    const payload: PersistedState = {
      selected: [...s.selected],
      running: s.running,
      statusById: s.statusById,
      doneCount: s.doneCount,
      total: s.total,
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable or quota exceeded — persistence is best-effort
  }
}

/**
 * Module-scoped (not React state) so an in-progress run survives navigating
 * away from and back to the bulk page — the route component remounts on
 * SPA navigation, but this store doesn't. Also mirrored to sessionStorage
 * so it survives a full page reload / dev HMR refresh.
 */
let state: BulkRunState = loadPersisted()

/** Stable reference for SSR — sessionStorage doesn't exist server-side, so the server-rendered markup must always match this fixed empty snapshot. */
const SERVER_SNAPSHOT = emptyState()

const listeners = new Set<() => void>()

function setState(patch: Partial<BulkRunState>) {
  state = { ...state, ...patch }
  persist(state)
  for (const listener of listeners) listener()
}

export function getBulkRunState(): BulkRunState {
  return state
}

export function getBulkRunServerState(): BulkRunState {
  return SERVER_SNAPSHOT
}

export function subscribeBulkRun(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function toggleSelected(id: string) {
  const next = new Set(state.selected)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  setState({ selected: next })
}

export function selectAllInvestments(ids: string[]) {
  setState({ selected: new Set(ids) })
}

export function clearSelectedInvestments() {
  setState({ selected: new Set() })
}

export function toggleGroupSelected(ids: string[]) {
  const allSelected = ids.every((id) => state.selected.has(id))
  const next = new Set(state.selected)
  for (const id of ids) {
    if (allSelected) next.delete(id)
    else next.add(id)
  }
  setState({ selected: next })
}

export async function runBulkAiScoring() {
  if (state.running) return
  const ids = [...state.selected]
  if (ids.length === 0) return

  setState({
    running: true,
    doneCount: 0,
    total: ids.length,
    statusById: Object.fromEntries(ids.map((id) => [id, 'pending' as RunStatus])),
  })

  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE))
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < chunks.length) {
      const chunk = chunks[cursor]
      cursor += 1
      setState({
        statusById: {
          ...state.statusById,
          ...Object.fromEntries(chunk.map((id) => [id, 'running' as RunStatus])),
        },
      })
      try {
        const items = await runAiScoringForInvestmentsFn({ data: { investmentIds: chunk } })
        setState({
          statusById: {
            ...state.statusById,
            ...Object.fromEntries(
              items.map((item) => [item.investmentId, item.result.ok ? 'ok' : 'error'] as const),
            ),
          },
        })
      } catch {
        setState({
          statusById: {
            ...state.statusById,
            ...Object.fromEntries(chunk.map((id) => [id, 'error' as RunStatus])),
          },
        })
      } finally {
        setState({ doneCount: state.doneCount + chunk.length })
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker()),
  )
  setState({ running: false })
}
