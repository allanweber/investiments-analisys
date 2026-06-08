import { messages as m } from '@/messages'

import type { UseHoldingFormResult } from '../hooks/use-holding-form'
import type { UseHoldingModalResult } from '../hooks/use-holding-modal'
import { HOLDING_CURRENCY_OPTIONS } from '../types'
import { CurrencyInput } from '../CurrencyInput'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { round2 } from '../utils/currency-input'
import { findExistingHoldingForAdd } from '../utils/investment-match'
import { useModalFocus } from '../hooks/use-modal-focus'

type Props = {
  modal: UseHoldingModalResult
  form: UseHoldingFormResult
  rows: import('../types').HoldingRow[]
}

export function AddEditHoldingModal({ modal, form, rows }: Props) {
  const { state } = modal
  const isOpen = state.kind === 'add' || state.kind === 'edit'
  const panelRef = useModalFocus(modal.close, isOpen)
  if (!isOpen) return null

  const isEdit = state.kind === 'edit'
  const { form: f, setForm, invOptions, typeOptions, variableInvOptions, variableTypeOptions,
    quantityError, setQuantityError, saveHoldingError, setInvestmentPickManual,
    tickerInvestHint, canSaveAddHolding, addModalTickerInputRef, saveHolding } = form

  const selectedOpt = invOptions?.find((o) => o.id === f.investmentId)
  const existingHoldingForAdd =
    !isEdit && rows ? findExistingHoldingForAdd(rows, f.investmentId, f.ticker) : undefined
  const holdingIsFixedIncome = isEdit
    ? isFixedIncomeTipo(state.row.fixedIncome, state.row.investmentTypeName)
    : Boolean(
        isFixedIncomeTipo(selectedOpt?.fixedIncome ?? false, selectedOpt?.typeName) ||
          isFixedIncomeTipo(existingHoldingForAdd?.fixedIncome ?? false, existingHoldingForAdd?.investmentTypeName),
      )
  const mergingAdd = !isEdit && Boolean(existingHoldingForAdd)
  const avgCostFieldLabel = mergingAdd
    ? holdingIsFixedIncome ? 'Valor desta aplicação' : m.portfolio.addMergeUnitPriceLabel
    : holdingIsFixedIncome ? 'Valor atual' : 'Preço médio'
  const quantityFieldLabel = mergingAdd ? m.portfolio.addMergeQuantityLabel : 'Quantidade'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:px-4 sm:py-10"
      data-holding-modal={isEdit ? 'edit' : 'add'}
      onClick={modal.close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-add-edit-holding-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-8 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 id="modal-add-edit-holding-title" className="font-headline text-xl font-extrabold tracking-tight text-on-surface">
              {isEdit ? 'Editar posição' : 'Adicionar posição'}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-outline">{m.portfolio.holdingsRecordingNote}</p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-full p-2 text-outline transition-colors hover:bg-surface-container-low"
            onClick={modal.close}
            aria-label="Fechar"
          >
            <span className="material-symbols-outlined text-2xl leading-none">close</span>
          </button>
        </div>

        {!isEdit && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/12 px-4 py-3 text-xs leading-relaxed text-on-surface">
            <span className="material-symbols-outlined shrink-0 text-lg text-tertiary-fixed-dim">info</span>
            <p>{m.portfolio.addVariableBanner}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
            Ticker
            <input
              ref={addModalTickerInputRef}
              value={f.ticker}
              onChange={(e) => {
                if (!isEdit) setInvestmentPickManual(false)
                setForm({ ...f, ticker: e.target.value.toUpperCase() })
              }}
              disabled={invOptions === null}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
            />
          </label>

          <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
            Investimento
            <select
              value={f.investmentId}
              onChange={(e) => {
                setInvestmentPickManual(true)
                setForm({
                  ...f,
                  investmentId: e.target.value,
                  investmentTypeId: e.target.value ? '' : f.investmentTypeId,
                })
              }}
              disabled={invOptions === null || isEdit}
              className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
            >
              <option value="">{invOptions === null ? 'Carregando…' : 'Selecione…'}</option>
              {(isEdit ? (invOptions ?? []) : variableInvOptions).map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </label>

          {tickerInvestHint?.type === 'loading' && (
            <p className="text-xs text-outline sm:col-span-2">Carregando investimentos…</p>
          )}
          {tickerInvestHint?.type === 'matched' && (
            <div className="flex gap-2 rounded-xl border border-tertiary-fixed-dim/35 bg-tertiary-fixed-dim/10 px-3 py-2 text-xs text-on-surface sm:col-span-2">
              <span className="material-symbols-outlined shrink-0 text-base text-tertiary-fixed-dim">link</span>
              <p>
                Investimento vinculado:{' '}
                <span className="font-bold text-on-surface">{tickerInvestHint.name}</span>
              </p>
            </div>
          )}
          {mergingAdd && (
            <div className="flex gap-2 rounded-xl border border-primary-container/35 bg-primary-container/12 px-3 py-2 text-xs leading-relaxed text-on-surface sm:col-span-2">
              <span className="material-symbols-outlined shrink-0 text-base text-primary-container">merge</span>
              <p>{m.portfolio.addMergeHint}</p>
            </div>
          )}
          {!isEdit && tickerInvestHint?.type === 'no-match' && (
            <div className="flex flex-col gap-4 sm:col-span-2">
              <div className="flex gap-2 rounded-xl border border-secondary-fixed/35 bg-secondary-fixed/12 px-3 py-2 text-xs leading-relaxed text-on-surface">
                <span className="material-symbols-outlined shrink-0 text-base text-secondary-fixed">add_circle</span>
                <p>{m.portfolio.addVariableWillCreate(f.ticker.trim())}</p>
              </div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-outline">
                {m.portfolio.addVariableTypeLabel}
                <select
                  value={f.investmentTypeId}
                  onChange={(e) => setForm({ ...f, investmentTypeId: e.target.value })}
                  disabled={typeOptions === null}
                  className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
                >
                  <option value="">
                    {typeOptions === null ? 'Carregando…' : m.portfolio.addVariableTypePlaceholder}
                  </option>
                  {variableTypeOptions.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {/* Quantity */}
          <div className="sm:col-span-1">
            <label
              htmlFor="holding-qty-input"
              className="block text-[10px] font-bold uppercase tracking-widest text-outline"
            >
              {quantityFieldLabel}
            </label>
            <input
              id="holding-qty-input"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              aria-invalid={quantityError}
              value={f.quantity === 0 ? '' : String(f.quantity)}
              onChange={(e) => {
                if (invOptions === null) return
                setQuantityError(false)
                const raw = e.target.value.replace(/\D/g, '').slice(0, 12)
                if (raw === '') { setForm({ ...f, quantity: 0 }); return }
                const n = parseInt(raw, 10)
                setForm({ ...f, quantity: Number.isFinite(n) && n >= 0 ? n : 0 })
              }}
              disabled={invOptions === null}
              className={`mt-2 w-full border-0 border-b-2 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 ${
                quantityError ? 'border-error focus:border-error' : 'border-outline-variant/50'
              }`}
            />
            {quantityError && (
              <p className="mt-2 text-xs font-semibold text-error">A quantidade deve ser maior que zero.</p>
            )}
          </div>

          <CurrencyInput
            value={f.avgCost}
            currency={f.currency}
            label={avgCostFieldLabel}
            disabled={invOptions === null}
            onChange={(v) => setForm((prev) => ({ ...prev, avgCost: v }))}
          />

          <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-1">
            Corretora (opcional)
            <input
              value={f.broker}
              onChange={(e) => setForm({ ...f, broker: e.target.value })}
              disabled={invOptions === null}
              className="mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50"
              placeholder="Ex: XP Investimentos"
            />
          </label>

          <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-1">
            Moeda
            <select
              value={f.currency}
              onChange={(e) => {
                setForm((prev) => ({
                  ...prev,
                  currency: e.target.value,
                  avgCost: round2(prev.avgCost),
                }))
              }}
              disabled={invOptions === null || mergingAdd}
              className="mt-2 w-full cursor-pointer border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {HOLDING_CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="block text-[10px] font-bold uppercase tracking-widest text-outline sm:col-span-2">
            Data da última operação (opcional)
            <input
              type="date"
              value={f.lastOpDate}
              onChange={(e) => setForm({ ...f, lastOpDate: e.target.value })}
              disabled={invOptions === null}
              className="mt-2 w-full max-w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 sm:max-w-xs"
            />
          </label>
        </div>

        {saveHoldingError && (
          <p className="mt-4 text-sm font-medium text-error" role="alert">{saveHoldingError}</p>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-8 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            onClick={() => isEdit ? modal.close() : modal.openChooseAssetClass()}
          >
            {isEdit ? 'Cancelar' : 'Voltar'}
          </button>
          <button
            type="button"
            disabled={isEdit ? invOptions === null || !f.investmentId : !canSaveAddHolding}
            className="inline-flex items-center justify-center rounded-full bg-primary-container px-8 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95 disabled:opacity-45"
            onClick={() => void saveHolding()}
          >
            {isEdit ? 'Salvar alterações' : 'Adicionar posição'}
          </button>
        </div>
      </div>
    </div>
  )
}
