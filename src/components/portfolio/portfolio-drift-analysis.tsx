type DriftRow = {
  investmentTypeId: string
  investmentTypeName: string
  currentPct: number
  targetPct: number
  delta: number
  status: 'ABAIXO' | 'ACIMA' | 'EM_ALVO' | 'SEM_META'
}

type Props = {
  drift: DriftRow[]
}

function statusLabel(status: DriftRow['status']): string {
  if (status === 'ABAIXO') return 'SUB-ALOCADO'
  if (status === 'ACIMA') return 'ACIMA'
  if (status === 'EM_ALVO') return 'EM ALVO'
  return 'SEM META'
}

function badgeClass(status: DriftRow['status']): string {
  if (status === 'EM_ALVO') return 'bg-tertiary-fixed-dim/20 text-on-tertiary-container'
  if (status === 'SEM_META') return 'bg-surface-container-high text-outline'
  return 'bg-error-container/55 text-error'
}

export function PortfolioDriftAnalysis({ drift }: Props) {
  return (
    <div className="rounded-2xl bg-surface p-6 shadow-md ring-1 ring-outline-variant/10">
      <h3 className="font-headline text-base font-extrabold text-on-surface">Análise de Drift</h3>
      <div className="mt-4 space-y-3 md:hidden">
        {drift.map((d) => {
          const deltaClass =
            d.delta > 0 ? 'text-error' : d.delta < 0 ? 'text-tertiary-fixed-dim' : 'text-on-surface'
          return (
            <div
              key={d.investmentTypeId}
              className="rounded-2xl border border-outline-variant/15 bg-surface-container-low/80 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-on-surface">{d.investmentTypeName}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${badgeClass(d.status)}`}
                >
                  {statusLabel(d.status)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Atual</p>
                  <p className="mt-1 font-semibold text-on-surface">{d.currentPct.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Alvo</p>
                  <p className="mt-1 font-semibold text-on-surface">{d.targetPct.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-outline">Delta</p>
                  <p className={`mt-1 font-bold ${deltaClass}`}>
                    {d.delta >= 0 ? '+' : ''}
                    {d.delta.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-5 hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="text-[10px] font-bold uppercase tracking-widest text-outline">
            <tr>
              <th className="py-2 text-left">Tipo</th>
              <th className="py-2 text-right">Atual %</th>
              <th className="py-2 text-right">Alvo %</th>
              <th className="py-2 text-right">Delta</th>
              <th className="py-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/10">
            {drift.map((d) => (
              <tr key={d.investmentTypeId}>
                <td className="py-3 font-medium text-on-surface">{d.investmentTypeName}</td>
                <td className="py-3 text-right text-on-surface">{d.currentPct.toFixed(1)}%</td>
                <td className="py-3 text-right text-on-surface">{d.targetPct.toFixed(1)}%</td>
                <td
                  className={`py-3 text-right font-semibold ${
                    d.delta > 0 ? 'text-error' : d.delta < 0 ? 'text-tertiary-fixed-dim' : 'text-on-surface'
                  }`}
                >
                  {d.delta >= 0 ? '+' : ''}
                  {d.delta.toFixed(1)}%
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${badgeClass(d.status)}`}
                  >
                    {statusLabel(d.status)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
