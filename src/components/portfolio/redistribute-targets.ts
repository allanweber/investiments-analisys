/**
 * When tipo at `index` moves to `newVal`, offset the remainder across other
 * tipos in order 0 → n−1 (skipping `index`), then nudge to sum exactly 100.
 */
export function redistributeAfterChange(pcts: number[], index: number, newVal: number): number[] {
  const n = pcts.length
  if (n === 0) return []

  const v = Math.max(0, Math.min(100, Math.round(newVal)))
  const cur = pcts.map((x) => Math.round(x))
  const delta = v - cur[index]
  const out = [...cur]
  out[index] = v
  let need = -delta

  if (need > 0) {
    for (let j = 0; j < n && need > 0; j++) {
      if (j === index) continue
      const room = 100 - out[j]
      const add = Math.min(need, room)
      out[j] += add
      need -= add
    }
    if (need > 0) out[index] -= need
  } else if (need < 0) {
    let take = -need
    for (let j = 0; j < n && take > 0; j++) {
      if (j === index) continue
      const give = Math.min(take, out[j])
      out[j] -= give
      take -= give
    }
    if (take > 0) out[index] += take
  }

  const sum = out.reduce((a, b) => a + b, 0)
  if (sum !== 100) {
    const drift = 100 - sum
    let fixed = false
    for (let j = n - 1; j >= 0; j--) {
      if (j === index) continue
      const nv = out[j] + drift
      if (nv >= 0 && nv <= 100) {
        out[j] = nv
        fixed = true
        break
      }
    }
    if (!fixed) {
      out[index] = Math.max(0, Math.min(100, out[index] + (100 - out.reduce((a, b) => a + b, 0))))
    }
  }

  return out
}

/**
 * Default edit state: 100% on «Renda fixa» (name match, case-insensitive), else first category.
 */
export function defaultTargetsHundredRendaFixa(
  orderedRows: { investmentTypeName: string }[],
): number[] {
  const n = orderedRows.length
  if (n === 0) return []
  const norm = (s: string) => s.trim().toLowerCase()
  let idx = orderedRows.findIndex((r) => norm(r.investmentTypeName) === 'renda fixa')
  if (idx < 0) {
    idx = orderedRows.findIndex((r) => norm(r.investmentTypeName).includes('renda fixa'))
  }
  if (idx < 0) idx = 0
  return Array.from({ length: n }, (_, i) => (i === idx ? 100 : 0))
}

export function equalSplit100(n: number): number[] {
  if (n <= 0) return []
  const base = Math.floor(100 / n)
  const rem = 100 - base * n
  return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0))
}

/** Scale arbitrary shares to integer percentages summing to 100. */
export function normalizeToHundred(parts: number[]): number[] {
  const n = parts.length
  if (n === 0) return []
  const sum = parts.reduce((a, b) => a + Math.max(0, b), 0)
  if (sum <= 0) return equalSplit100(n)
  const scaled = parts.map((p) => (Math.max(0, p) / sum) * 100)
  const rounded = scaled.map((x) => Math.round(x))
  const out = [...rounded]
  let d = 100 - out.reduce((a, b) => a + b, 0)
  let guard = 0
  while (d !== 0 && guard < 1000) {
    guard++
    let moved = false
    for (let j = n - 1; j >= 0; j--) {
      const step = d > 0 ? 1 : -1
      const nv = out[j] + step
      if (nv >= 0 && nv <= 100) {
        out[j] = nv
        d -= step
        moved = true
        break
      }
    }
    if (!moved) break
  }
  if (d !== 0) out[0] = Math.max(0, Math.min(100, out[0] + d))
  return out
}
