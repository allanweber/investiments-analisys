import type { HoldingRow } from '../types'

type Props = {
  pending: HoldingRow | null
  deletingId: string | null
  onConfirm: (row: HoldingRow) => void
  onCancel: () => void
}

export function DeleteConfirmModal({ pending, deletingId, onConfirm, onCancel }: Props) {
  if (!pending) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-scrim p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-holding-title"
        aria-describedby="delete-holding-desc"
        className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-2xl ring-1 ring-outline-variant/15 sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-container/55">
          <span className="material-symbols-outlined text-2xl text-error">delete_forever</span>
        </div>
        <h2
          id="delete-holding-title"
          className="font-headline text-lg font-extrabold tracking-tight text-on-surface"
        >
          Excluir posição?
        </h2>
        <p id="delete-holding-desc" className="mt-3 text-sm leading-relaxed text-on-surface-variant">
          A posição em{' '}
          <span className="font-semibold text-on-surface">
            {pending.ticker?.trim() || pending.investmentName}
          </span>{' '}
          será removida da carteira nesta moeda. O investimento continua cadastrado em Investimentos.
        </p>
        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-6 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={deletingId === pending.investmentId}
            className="inline-flex items-center justify-center rounded-full bg-error-container px-6 py-3 text-sm font-bold text-on-error-container transition-opacity hover:opacity-95 disabled:opacity-45"
            onClick={() => onConfirm(pending)}
          >
            {deletingId === pending.investmentId ? 'Excluindo…' : 'Excluir posição'}
          </button>
        </div>
      </div>
    </div>
  )
}
