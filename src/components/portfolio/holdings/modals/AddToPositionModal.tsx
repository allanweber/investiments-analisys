import { CurrencyInput } from '../CurrencyInput'
import type { UseHoldingModalResult } from '../hooks/use-holding-modal'
import type { UseAddToPositionResult } from '../hooks/use-add-to-position'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { useModalFocus } from '../hooks/use-modal-focus'

type Props = {
  modal: UseHoldingModalResult
  addToPos: UseAddToPositionResult
}

export function AddToPositionModal({ modal, addToPos }: Props) {
  const isOpen = modal.state.kind === 'addToPosition'
  const panelRef = useModalFocus(modal.close, isOpen)
  if (modal.state.kind !== 'addToPosition') return null

  const r = modal.state.row
  const isRF = isFixedIncomeTipo(Boolean(r.fixedIncome), r.investmentTypeName)
  const tickerLabel = r.ticker?.trim() || r.investmentName || '—'
  const initials = (r.ticker ?? r.investmentName)
    .replace(/\s/g, '')
    .slice(0, 2)
    .toUpperCase()
  const unitLabel =
    r.currency === 'BRL'
      ? 'PREÇO UNITÁRIO (R$)'
      : r.currency === 'USD'
        ? 'PREÇO UNITÁRIO (US$)'
        : r.currency === 'EUR'
          ? 'PREÇO UNITÁRIO (€)'
          : `PREÇO UNITÁRIO (${r.currency})`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim backdrop-blur-[2px] sm:items-center sm:px-4 sm:py-10"
      data-holding-modal="add-to-position"
      onClick={modal.close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-add-to-position-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-24 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void addToPos.save(r)
          }}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="min-w-0 pr-2">
              <h3
                id="modal-add-to-position-title"
                className="font-headline text-xl font-extrabold tracking-tight text-on-surface"
              >
                Adicionar cotas
              </h3>
              <p className="mt-2 text-sm leading-snug text-on-surface-variant">
                Registre a compra adicional do ativo{' '}
                <span className="font-bold text-on-surface">{tickerLabel}</span>{' '}
                na sua carteira. O preço médio será recalculado.
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
              onClick={modal.close}
              aria-label="Fechar"
            >
              <span className="material-symbols-outlined text-2xl leading-none">
                close
              </span>
            </button>
          </div>

          <div className="mb-7 rounded-2xl bg-surface-container-low px-4 py-3.5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-highest/80 font-headline text-sm font-extrabold tracking-tight text-on-surface shadow-inner ring-1 ring-outline-variant/20">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-headline text-lg font-extrabold leading-tight text-on-surface">
                  {tickerLabel}
                </p>
                <p className="mt-0.5 truncate text-sm text-on-surface-variant">
                  {r.investmentName}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {isRF ? (
              <>
                <CurrencyInput
                  value={addToPos.additionalCapital}
                  currency="BRL"
                  label="Valor do investimento (R$)"
                  hasError={addToPos.error?.includes('valor') ?? false}
                  onChange={(v) => {
                    addToPos.setError(null)
                    addToPos.setAdditionalCapital(v)
                  }}
                />
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    Data da compra (opcional)
                  </span>
                  <div className="relative mt-2 flex items-center border-b-2 border-outline-variant/50 focus-within:border-primary">
                    <input
                      type="date"
                      value={addToPos.lastOpDate}
                      onChange={(e) => addToPos.setLastOpDate(e.target.value)}
                      className="w-full flex-1 cursor-pointer border-0 bg-transparent py-2.5 pr-10 text-sm font-semibold text-on-surface outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    <span
                      className="pointer-events-none absolute right-0 text-outline"
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        calendar_month
                      </span>
                    </span>
                  </div>
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    Quantidade adicional
                  </span>
                  <div className="relative mt-2">
                    <input
                      ref={addToPos.qtyInputRef}
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-invalid={
                        addToPos.error?.includes('quantidade') ?? false
                      }
                      value={addToPos.additionalQty}
                      onChange={(e) => {
                        addToPos.setError(null)
                        addToPos.setAdditionalQty(
                          e.target.value.replace(/-/g, ''),
                        )
                      }}
                      className={`w-full border-0 border-b-2 bg-transparent py-2.5 pr-8 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary ${
                        addToPos.error?.includes('quantidade')
                          ? 'border-error focus:border-error'
                          : 'border-outline-variant/50'
                      }`}
                    />
                    {addToPos.error?.includes('quantidade') && (
                      <span
                        className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-error"
                        aria-hidden
                      >
                        <span className="material-symbols-outlined text-xl">
                          error
                        </span>
                      </span>
                    )}
                  </div>
                </label>

                <CurrencyInput
                  value={addToPos.unitPrice}
                  currency={r.currency ?? 'BRL'}
                  label={unitLabel}
                  hasError={addToPos.error?.includes('preço') ?? false}
                  onChange={(v) => {
                    addToPos.setError(null)
                    addToPos.setUnitPrice(v)
                  }}
                />

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
                    Data da última operação (opcional)
                  </span>
                  <div className="relative mt-2 flex items-center border-b-2 border-outline-variant/50 focus-within:border-primary">
                    <input
                      type="date"
                      value={addToPos.lastOpDate}
                      onChange={(e) => addToPos.setLastOpDate(e.target.value)}
                      className="w-full flex-1 cursor-pointer border-0 bg-transparent py-2.5 pr-10 text-sm font-semibold text-on-surface outline-none [color-scheme:light] dark:[color-scheme:dark]"
                    />
                    <span
                      className="pointer-events-none absolute right-0 text-outline"
                      aria-hidden
                    >
                      <span className="material-symbols-outlined text-[22px]">
                        calendar_month
                      </span>
                    </span>
                  </div>
                </label>
              </>
            )}
          </div>

          {addToPos.error && (
            <p className="mt-5 text-xs font-semibold text-error" role="alert">
              {addToPos.error}
            </p>
          )}

          <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-surface-container-high px-8 py-2.5 text-sm font-bold text-on-surface shadow-sm ring-1 ring-outline-variant/25 transition-colors hover:bg-surface-container-highest"
              onClick={modal.close}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary-container px-8 py-2.5 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
