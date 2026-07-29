import type {
  ContributionSuggestion,
  TypeProjection,
} from '@/lib/aporte-server'
import { messages as m } from '@/messages'

export function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatUnits(units: number | null | undefined): string {
  if (units == null) return m.aporte.dash
  return Number.isInteger(units)
    ? String(units)
    : units.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

type RowHandlers = {
  applied: boolean
  readOnly: boolean
  onAportar?: (s: ContributionSuggestion) => void
  onRemove?: (investmentId: string, investmentName: string) => void
}

function AportadoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary-container px-2.5 py-1 font-label text-[10px] font-bold uppercase tracking-wide text-on-primary-container">
      <span className="material-symbols-outlined text-sm leading-none">
        check_circle
      </span>
      {m.aporte.aportarDone}
    </span>
  )
}

function TypeHeader({ proj: p }: { proj: TypeProjection }) {
  const hitTarget = p.projectedTypePct >= p.targetTypePct && p.targetTypePct > 0
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-outline-variant/20 bg-surface-variant/30 px-4 py-3">
      <span className="text-sm font-semibold text-on-surface">
        {p.investmentTypeName}
      </span>
      <span className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="tabular-nums">{p.currentTypePct.toFixed(1)}%</span>
        <span className="material-symbols-outlined text-[14px]">
          arrow_forward
        </span>
        <span
          className={`font-semibold tabular-nums ${hitTarget ? 'text-primary' : 'text-on-surface'}`}
        >
          {p.projectedTypePct.toFixed(1)}%
        </span>
        {p.targetTypePct > 0 && (
          <span className="text-outline">
            / meta {p.targetTypePct.toFixed(1)}%
          </span>
        )}
      </span>
    </div>
  )
}

function SuggestionCard({
  suggestion: s,
  applied,
  readOnly,
  onAportar,
  onRemove,
}: { suggestion: ContributionSuggestion } & RowHandlers) {
  const showDual =
    s.suggestedCurrency.toUpperCase() !== s.contributionCurrency.toUpperCase()

  return (
    <div className="border-b border-outline-variant/10 p-4 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-on-surface">
          {s.investmentName}
          {s.missingQuote && (
            <span
              className="material-symbols-outlined text-[16px] text-tertiary"
              title={m.aporte.missingQuoteTooltip}
              aria-label={m.aporte.missingQuoteTooltip}
            >
              info
            </span>
          )}
        </span>
        {!readOnly && !applied && (
          <button
            type="button"
            onClick={() => onRemove?.(s.investmentId, s.investmentName)}
            aria-label={m.aporte.removeSuggestion}
            title={m.aporte.removeSuggestion}
            className="-mr-1 shrink-0 rounded-full p-1 text-on-surface-variant transition-opacity hover:opacity-70"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        )}
        {applied && <AportadoBadge />}
      </div>

      <div className="mt-3 flex flex-col gap-0.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
          {m.aporte.colValor}
        </span>
        <span className="text-lg font-semibold tabular-nums text-on-surface">
          {formatCurrency(s.suggestedAmount, s.suggestedCurrency)}
        </span>
        {showDual && (
          <span className="text-xs tabular-nums text-on-surface-variant">
            {formatCurrency(s.contributionAmount, s.contributionCurrency)}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colUnidades}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {formatUnits(s.units)}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colPct}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {s.contributionPct.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-outline">
            {m.aporte.colScore}
          </p>
          <p className="mt-1 font-semibold tabular-nums text-on-surface">
            {s.score}
          </p>
        </div>
      </div>

      {!readOnly && !applied && (
        <button
          type="button"
          onClick={() => onAportar?.(s)}
          className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary-container px-3 py-2.5 font-body text-sm font-semibold text-on-primary transition-opacity hover:opacity-90"
        >
          <span className="material-symbols-outlined text-lg leading-none">
            savings
          </span>
          {m.aporte.aportarButton}
        </button>
      )}
    </div>
  )
}

function SuggestionRow({
  suggestion: s,
  applied,
  readOnly,
  onAportar,
  onRemove,
}: { suggestion: ContributionSuggestion } & RowHandlers) {
  const showDual =
    s.suggestedCurrency.toUpperCase() !== s.contributionCurrency.toUpperCase()

  return (
    <tr className="border-b border-outline-variant/10 hover:bg-surface-variant/20">
      <td className="px-4 py-3 font-medium text-on-surface">
        <span className="flex items-center gap-1.5">
          {s.investmentName}
          {s.missingQuote && (
            <span
              className="material-symbols-outlined text-[16px] text-tertiary"
              title={m.aporte.missingQuoteTooltip}
              aria-label={m.aporte.missingQuoteTooltip}
            >
              info
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface">
        {showDual ? (
          <span className="flex flex-col items-end gap-0.5">
            <span>
              {formatCurrency(s.suggestedAmount, s.suggestedCurrency)}
            </span>
            <span className="text-xs text-on-surface-variant">
              {formatCurrency(s.contributionAmount, s.contributionCurrency)}
            </span>
          </span>
        ) : (
          formatCurrency(s.suggestedAmount, s.suggestedCurrency)
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
        {formatUnits(s.units)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface">
        {s.contributionPct.toFixed(1)}%
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-on-surface-variant">
        {s.score}
      </td>
      <td className="px-2 py-3 text-right">
        {applied ? (
          <AportadoBadge />
        ) : readOnly ? null : (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={() => onAportar?.(s)}
              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg bg-primary-container/25 px-2.5 py-1.5 font-body text-xs font-semibold text-on-surface transition-colors hover:bg-primary-container/45"
              title={m.aporte.aportarButton}
            >
              <span className="material-symbols-outlined text-base leading-none">
                savings
              </span>
              {m.aporte.aportarButton}
            </button>
            <button
              type="button"
              onClick={() => onRemove?.(s.investmentId, s.investmentName)}
              aria-label={m.aporte.removeSuggestion}
              title={m.aporte.removeSuggestion}
              className="rounded-full p-1 text-on-surface-variant transition-opacity hover:opacity-70"
            >
              <span className="material-symbols-outlined text-[18px]">
                close
              </span>
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

export type AporteResultsProps = {
  suggestions: ContributionSuggestion[]
  typeProjections: TypeProjection[]
  unallocatedAmount: number
  currency: string
  appliedIds: Set<string>
  onAportar?: (s: ContributionSuggestion) => void
  onRemove?: (investmentId: string, investmentName: string) => void
  readOnly?: boolean
  recomputing?: boolean
}

export function AporteResults({
  suggestions,
  typeProjections,
  unallocatedAmount,
  currency,
  appliedIds,
  onAportar,
  onRemove,
  readOnly = false,
  recomputing = false,
}: AporteResultsProps) {
  const suggestionsByType = suggestions.reduce<
    Record<string, ContributionSuggestion[]>
  >((acc, s) => {
    ;(acc[s.investmentTypeId] ??= []).push(s)
    return acc
  }, {})

  return (
    <section className={`space-y-3 ${recomputing ? 'opacity-60' : ''}`}>
      {typeProjections.map((proj) => {
        const items = suggestionsByType[proj.investmentTypeId]
        return (
          <div
            key={proj.investmentTypeId}
            className="rounded-2xl border border-outline-variant/30"
          >
            <TypeHeader proj={proj} />
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- suggestionsByType is Record<string,...> (no noUncheckedIndexedAccess); items is genuinely undefined for a type with no contribution suggestion */}
            {!items && proj.targetTypePct > 0 && (
              <p className="px-4 py-3 text-xs text-on-surface-variant">
                {m.aporte.categoryAboveTarget}
              </p>
            )}
            {/* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- same suggestionsByType Record<string,...> gap as above */}
            {items && (
              <>
                <div className="md:hidden">
                  {items.map((s) => (
                    <SuggestionCard
                      key={s.investmentId}
                      suggestion={s}
                      applied={appliedIds.has(s.investmentId)}
                      readOnly={readOnly}
                      onAportar={onAportar}
                      onRemove={onRemove}
                    />
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-outline-variant/15 text-left text-xs font-semibold text-on-surface-variant">
                        <th className="px-4 py-2">
                          {m.aporte.colInvestimento}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colValor}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colUnidades}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colPct}
                        </th>
                        <th className="px-4 py-2 text-right">
                          {m.aporte.colScore}
                        </th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((s) => (
                        <SuggestionRow
                          key={s.investmentId}
                          suggestion={s}
                          applied={appliedIds.has(s.investmentId)}
                          readOnly={readOnly}
                          onAportar={onAportar}
                          onRemove={onRemove}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )
      })}
      {unallocatedAmount > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-outline-variant/30 bg-surface-variant/20 px-4 py-3">
          <span className="text-sm font-semibold text-on-surface">
            {m.aporte.naoAlocado}
          </span>
          <span className="tabular-nums text-on-surface">
            {formatCurrency(unallocatedAmount, currency)}
          </span>
        </div>
      )}
    </section>
  )
}
