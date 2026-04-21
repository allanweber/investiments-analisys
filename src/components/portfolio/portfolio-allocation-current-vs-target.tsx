'use client'

import { allocColorForType } from '#/components/portfolio/format'
import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'

type AllocSeg = {
  investmentTypeId: string
  investmentTypeName: string
  currentPct: number
}

type TargetSeg = {
  investmentTypeId: string
  investmentTypeName: string
  value: number
}

type Props = {
  allocation: AllocSeg[]
  targetSegments: TargetSeg[]
}

export function PortfolioAllocationCurrentVsTarget({ allocation, targetSegments }: Props) {
  const vago = Math.max(0, 100 - targetSegments.reduce((a, s) => a + s.value, 0))

  return (
    <section className="mb-8 rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10 md:p-8">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-on-surface-variant">pie_chart</span>
        <h2 className="font-headline text-lg font-extrabold text-on-surface">
          Alocação atual vs alvo (por Tipo)
        </h2>
      </div>
      <div className="mt-6 space-y-6">
        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-outline">
            <span>Alocação atual</span>
            <span>100% alocado</span>
          </div>
          <div className="flex h-11 w-full overflow-hidden rounded-2xl bg-surface-container-high ring-1 ring-outline-variant/10">
            {allocation.map((seg) => {
              const pct = seg.currentPct
              const bg = allocColorForType(seg.investmentTypeId, seg.investmentTypeName)
              return (
                <Tooltip key={seg.investmentTypeId}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="h-full min-w-[2px] border-0 p-0 transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                      style={{
                        width: `${pct}%`,
                        background: bg,
                      }}
                      aria-label={`${seg.investmentTypeName}: ${pct.toFixed(1)}% da alocação atual`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={6} className="max-w-[16rem]">
                    <p className="font-semibold">{seg.investmentTypeName}</p>
                    <p className="mt-1 opacity-90">
                      Alocação atual:{' '}
                      <span className="font-bold tabular-nums">{pct.toFixed(1)}%</span>
                    </p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
          {allocation.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda da alocação atual">
              {allocation.map((seg) => (
                <li
                  key={seg.investmentTypeId}
                  className="flex items-center gap-2 text-xs text-on-surface"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-outline-variant/20"
                    style={{
                      background: allocColorForType(seg.investmentTypeId, seg.investmentTypeName),
                    }}
                    aria-hidden
                  />
                  <span className="max-w-[10rem] truncate font-medium">{seg.investmentTypeName}</span>
                  <span className="tabular-nums text-outline">{seg.currentPct.toFixed(1)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-outline">
            <span>Alocação alvo</span>
            {vago > 0 ? (
              <span className="font-bold text-error">{vago.toFixed(0)}% vago</span>
            ) : (
              <span>100% definido</span>
            )}
          </div>
          <div className="flex h-11 w-full overflow-hidden rounded-2xl bg-surface-container-high ring-1 ring-outline-variant/10">
            {targetSegments
              .filter((s) => s.value > 0)
              .map((seg) => {
                const bg = allocColorForType(seg.investmentTypeId, seg.investmentTypeName)
                return (
                  <Tooltip key={seg.investmentTypeId}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="h-full min-w-[2px] border-0 p-0 transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                        style={{
                          width: `${seg.value}%`,
                          background: bg,
                        }}
                        aria-label={`${seg.investmentTypeName}: ${seg.value.toFixed(1)}% do alvo`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="max-w-[16rem]">
                      <p className="font-semibold">{seg.investmentTypeName}</p>
                      <p className="mt-1 text-background/90">
                        Alvo: <span className="font-bold tabular-nums">{seg.value.toFixed(1)}%</span>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            {vago > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="h-full min-w-[2px] border-0 bg-surface-container-lowest p-0 transition-opacity hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
                    style={{ width: `${vago}%` }}
                    aria-label={`Não alocado (vago): ${vago.toFixed(1)}%`}
                  />
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={6} className="max-w-[16rem]">
                  <p className="font-semibold">Não alocado (vago)</p>
                  <p className="mt-1 opacity-90">
                    <span className="font-bold tabular-nums">{vago.toFixed(1)}%</span> sem meta por tipo
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda da alocação alvo">
            {targetSegments
              .filter((s) => s.value > 0)
              .map((seg) => (
                <li
                  key={seg.investmentTypeId}
                  className="flex items-center gap-2 text-xs text-on-surface"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-outline-variant/20"
                    style={{
                      background: allocColorForType(seg.investmentTypeId, seg.investmentTypeName),
                    }}
                    aria-hidden
                  />
                  <span className="max-w-[10rem] truncate font-medium">{seg.investmentTypeName}</span>
                  <span className="tabular-nums text-outline">{seg.value.toFixed(1)}%</span>
                </li>
              ))}
            {vago > 0 && (
              <li className="flex items-center gap-2 text-xs text-on-surface">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full bg-surface-container-lowest ring-1 ring-outline-variant/25"
                  aria-hidden
                />
                <span className="max-w-[10rem] truncate font-medium">Vago (não alocado)</span>
                <span className="tabular-nums text-outline">{vago.toFixed(1)}%</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </section>
  )
}
