import { useMemo } from 'react'
import type { DonutSegment } from './types'

function donutSlicePath(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startDeg: number,
  endDeg: number,
): string {
  const sweep = endDeg - startDeg
  if (sweep <= 0) return ''
  if (sweep >= 360) endDeg = startDeg + 359.99

  const rad = (deg: number) => ((deg - 90) * Math.PI) / 180
  const pt = (r: number, deg: number) => ({
    x: cx + r * Math.cos(rad(deg)),
    y: cy + r * Math.sin(rad(deg)),
  })

  const o0 = pt(rOuter, startDeg)
  const o1 = pt(rOuter, endDeg)
  const i0 = pt(rInner, endDeg)
  const i1 = pt(rInner, startDeg)
  const large = sweep > 180 ? 1 : 0

  return [
    `M ${o0.x} ${o0.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o1.x} ${o1.y}`,
    `L ${i0.x} ${i0.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}`,
    'Z',
  ].join(' ')
}

export function DonutAllocation({ segments }: { segments: DonutSegment[] }) {
  const size = 208
  const cx = size / 2
  const cy = size / 2
  const rOuter = size / 2 - 2
  const rInner = rOuter * 0.58

  const slices = useMemo(() => {
    const total = segments.reduce((a, s) => a + s.pct, 0) || 1
    let angle = 0
    return segments.map((s) => {
      const sweep = (s.pct / total) * 360
      const start = angle
      const end = angle + sweep
      angle = end
      return { ...s, d: donutSlicePath(cx, cy, rOuter, rInner, start, end) }
    })
  }, [segments, cx, cy, rOuter, rInner])

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-6">
      <h3 className="font-headline text-base font-extrabold text-on-surface">Alocação atual</h3>
      <div className="relative mx-auto mt-6 flex h-52 w-52 max-w-full items-center justify-center">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-full w-full"
          role="img"
          aria-label={`Alocação por tipo: ${segments.map((s) => `${s.label} ${s.pct.toFixed(0)}%`).join(', ')}`}
        >
          {slices.map((s) =>
            s.d ? (
              <path
                key={s.investmentTypeId}
                d={s.d}
                fill={s.color}
                className="transition-opacity hover:opacity-90"
              />
            ) : null,
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="max-w-[9rem] text-center">
            <p className="font-headline text-2xl font-extrabold leading-tight text-on-surface">100%</p>
            <p className="mt-1 text-[10px] font-bold uppercase leading-snug tracking-widest text-outline">
              por tipo
            </p>
          </div>
        </div>
      </div>
      <ul className="mt-6 space-y-1">
        {segments.map((s) => (
          <li
            key={s.investmentTypeId}
            className="flex items-center justify-between rounded-xl px-2 py-2 text-sm transition-colors hover:bg-surface-container-low"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: s.color }}
              />
              <span className="truncate font-medium text-on-surface">{s.label}</span>
            </span>
            <span className="shrink-0 pl-2 font-bold text-on-surface">{s.pct.toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
