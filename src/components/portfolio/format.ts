/** Stacked bar swatches (`styles.css` --fa-alloc-*). Index chosen by `allocSwatchIndexForType`. */
export const ALLOC_SEGMENT_BG: string[] = [
  'var(--fa-alloc-1)',
  'var(--fa-alloc-2)',
  'var(--fa-alloc-3)',
  'var(--fa-alloc-4)',
  'var(--fa-alloc-5)',
  'var(--fa-alloc-6)',
  'var(--fa-alloc-7)',
  'var(--fa-alloc-8)',
  'var(--fa-alloc-9)',
  'var(--fa-alloc-10)',
  'var(--fa-alloc-11)',
  'var(--fa-alloc-12)',
]

/** FNV-1a 32-bit — stable per string (e.g. investment type id). */
function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Optional PT-BR hints: each category maps to a 2-slice band in the palette so names read
 * “in family” (renda fixa ≈ blues, cripto ≈ magentas) while `id` still splits ties inside the band.
 * Order is specific → general (e.g. internacional before ações).
 */
const NAME_HINT_RULES: { re: RegExp; bandStart: number }[] = [
  {
    re: /ações\s+internacionais|internacionais|mercado\s+global|(^|\s)(exterior|internacional)(\s|$)|\bad[rz]\b/i,
    bandStart: 4,
  },
  {
    re: /renda\s+fixa|tesouro(\s+(direto|selic))?|\bcdb\b|pós[-\s]?fix|prefix|lig\s|título\s+público/i,
    bandStart: 0,
  },
  { re: /cripto|bitcoin|btc|ethereum|altcoin/i, bandStart: 8 },
  { re: /fii|fundos?\s+imobiliár|imobiliário/i, bandStart: 6 },
  { re: /reserva(\s+de\s+valor)?|commodit|ouro\b/i, bandStart: 10 },
  { re: /\ba(ções|coes)\b|bolsa/i, bandStart: 2 },
]

const N = ALLOC_SEGMENT_BG.length

/** Stable swatch index for a tipo: same id (+ name) always maps to the same color. */
export function allocSwatchIndexForType(investmentTypeId: string, investmentTypeName = ''): number {
  const raw = investmentTypeName.trim()
  const h = hashString(investmentTypeId)
  for (const { re, bandStart } of NAME_HINT_RULES) {
    if (raw && re.test(raw)) {
      return (bandStart + (h % 2)) % N
    }
  }
  return h % N
}

export function allocColorForType(investmentTypeId: string, investmentTypeName = ''): string {
  return ALLOC_SEGMENT_BG[allocSwatchIndexForType(investmentTypeId, investmentTypeName)]!
}

export function fmtMoneyBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

export function fmtMoney(v: number, currency: string | null): string {
  const c = currency ?? 'BRL'
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: c }).format(v)
  } catch {
    return `${v.toFixed(2)} ${c}`
  }
}

export function fmtPct(v: number): string {
  return `${v.toFixed(0)}%`
}

export function fmtSignedMoney(v: number, currency: string | null): string {
  const c = currency ?? 'BRL'
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: c,
      signDisplay: 'always',
    }).format(v)
  } catch {
    return `${v >= 0 ? '+' : ''}${v.toFixed(2)} ${c}`
  }
}
