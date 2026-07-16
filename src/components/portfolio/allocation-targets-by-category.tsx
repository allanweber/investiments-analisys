'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'

import { allocColorForType, fmtPct } from '@/components/portfolio/format'
import { cn } from '@/lib/utils'

export type AllocationTargetRow = {
  investmentTypeId: string
  investmentTypeName: string
  typeSortOrder: number
  targetPct: number
}

type Props = {
  rows: AllocationTargetRow[]
  onSave: (targets: { investmentTypeId: string; targetPct: number }[]) => Promise<void>
  saving?: boolean
}

export function AllocationTargetsByCategory({ rows, onSave, saving }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number[]>([])

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => a.typeSortOrder - b.typeSortOrder || a.investmentTypeName.localeCompare(b.investmentTypeName),
      ),
    [rows],
  )

  const viewPcts = sorted.map((r) => r.targetPct)
  const viewSum = viewPcts.reduce((a, b) => a + b, 0)

  if (sorted.length === 0) {
    return null
  }

  function beginEdit() {
    setDraft(sorted.map((r) => Math.round(r.targetPct)))
    setEditing(true)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function commit() {
    const payload = sorted.map((r, i) => ({
      investmentTypeId: r.investmentTypeId,
      targetPct: draft[i] ?? 0,
    }))
    await onSave(payload)
    setEditing(false)
  }

  function onSliderChange(index: number, raw: number[]) {
    const nextVal = Math.max(0, Math.min(100, Math.round(raw[0] ?? 0)))
    setDraft((prev) => prev.map((v, i) => (i === index ? nextVal : v)))
  }

  const displayPcts = editing ? draft : viewPcts.map((x) => Math.round(x))
  const totalPct = displayPcts.reduce((a, b) => a + b, 0)
  const barSegments = displayPcts.map((value, i) => ({
    investmentTypeId: sorted[i].investmentTypeId,
    name: sorted[i].investmentTypeName,
    value,
    color: allocColorForType(sorted[i].investmentTypeId, sorted[i].investmentTypeName),
  }))

  return (
    <div className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant">tune</span>
          <h3 className="font-headline text-base font-extrabold text-on-surface">Alvos por categoria</h3>
        </div>
        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={beginEdit}>
            Editar
          </Button>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} disabled={saving}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void commit()}
              disabled={saving || totalPct > 100}
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-6">
        <div className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-surface-container-high ring-1 ring-outline-variant/10">
          {barSegments
            .filter((s) => s.value > 0)
            .map((seg) => (
              <div
                key={seg.investmentTypeId}
                className="h-full min-w-[2px] transition-[width]"
                style={{
                  width: `${seg.value}%`,
                  background: seg.color,
                }}
                title={`${seg.name} (${seg.value.toFixed(0)}%)`}
              />
            ))}
        </div>

        <div className="space-y-3">
          {sorted.map((row, i) => (
            <div key={row.investmentTypeId}>
              <div className="mb-1.5 flex items-center justify-between text-sm font-semibold text-on-surface">
                <span>{row.investmentTypeName}</span>
                <span className="text-outline">{fmtPct(displayPcts[i] ?? 0)}</span>
              </div>
              {editing ? (
                <Slider
                  value={[displayPcts[i] ?? 0]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={(v) => onSliderChange(i, v)}
                  className="w-full accent-primary"
                />
              ) : (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{
                      width: `${Math.min(100, displayPcts[i] ?? 0)}%`,
                      background: allocColorForType(row.investmentTypeId, row.investmentTypeName),
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm font-semibold text-outline">Total alvo acumulado:</span>
        <span
          className={cn(
            'font-headline text-lg font-extrabold',
            editing && totalPct > 100 ? 'text-error' : 'text-on-surface',
          )}
        >
          {fmtPct(editing ? totalPct : viewSum)}
        </span>
      </div>
      {editing && totalPct > 100 && (
        <p className="mt-2 text-xs text-error">O total não pode ultrapassar 100%.</p>
      )}
    </div>
  )
}
