import { PRODUCT_RULES } from '@/lib/renda-fixa/products'
import type { Indexer, ProductType } from '@/lib/renda-fixa/products'
import { messages as m } from '@/messages'

import type { UseHoldingModalResult } from '../hooks/use-holding-modal'
import type { UseRendaFixaFormResult } from '../hooks/use-renda-fixa-form'
import { CurrencyInput } from '../CurrencyInput'
import { PercentInput } from '../PercentInput'
import { useModalFocus } from '../hooks/use-modal-focus'

const PRODUCT_TYPE_OPTIONS: { value: ProductType; label: string }[] = [
  { value: 'cdb', label: 'CDB' },
  { value: 'lci', label: 'LCI' },
  { value: 'lca', label: 'LCA' },
  { value: 'cri', label: 'CRI' },
  { value: 'cra', label: 'CRA' },
  { value: 'tesouro-selic', label: 'Tesouro Selic' },
  { value: 'tesouro-prefixado', label: 'Tesouro Prefixado' },
  { value: 'tesouro-ipca', label: 'Tesouro IPCA+' },
  { value: 'tesouro-renda-mais', label: 'Tesouro Renda+' },
  { value: 'tesouro-educa-mais', label: 'Tesouro Educa+' },
  { value: 'debenture-incentivada', label: 'Debênture Incentivada' },
  { value: 'debenture-comum', label: 'Debênture Comum' },
]

const INDEXER_LABELS: Record<Indexer, string> = {
  pre: 'Prefixado',
  cdi: 'CDI',
  selic: 'Selic',
  'selic-spread': 'Selic+',
  ipca: 'IPCA+',
  igpm: 'IGP-M+',
}

const FIELD_CLASS =
  'mt-2 w-full border-0 border-b-2 border-outline-variant/50 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50'

const LABEL_CLASS =
  'block text-[10px] font-bold uppercase tracking-widest text-outline'

const SELECT_CLASS = `${FIELD_CLASS} cursor-pointer`

type Props = {
  modal: UseHoldingModalResult
  rfForm: UseRendaFixaFormResult
}

export function AddRendaFixaModal({ modal, rfForm }: Props) {
  const isOpen =
    modal.state.kind === 'addFixedIncome' ||
    modal.state.kind === 'editFixedIncome'
  const panelRef = useModalFocus(modal.close, isOpen)
  if (!isOpen) return null

  const {
    form,
    setForm,
    invOptions,
    typeOptions,
    allowedIndexers,
    fieldError,
    saveError,
    saveBlockReason,
    isSaving,
    canSave,
    isEdit,
    save,
  } = rfForm

  const isNew = form.investmentId === '__new__'
  const isFloating = form.indexer === 'cdi' || form.indexer === 'selic'
  const needsRate =
    form.indexer === 'pre' || form.indexer === 'ipca' || form.indexer === 'igpm'
  const needsSpread = form.indexer === 'selic-spread'

  function handleProductTypeChange(pt: string) {
    const rule = PRODUCT_RULES[pt as ProductType]
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- pt is a plain string from a <select> onChange, cast `as ProductType` without runtime validation, so the cast can be wrong
    const allowed = rule?.allowedIndexers ?? []
    const nextIndexer = (allowed as readonly string[]).includes(form.indexer)
      ? form.indexer
      : (allowed[0] ?? 'cdi')
    setForm((f) => ({
      ...f,
      productType: pt,
      indexer: nextIndexer,
      annualRate: 0,
      multiplierPct: 100,
    }))
  }

  function handleIndexerChange(idx: string) {
    setForm((f) => ({ ...f, indexer: idx, annualRate: 0, multiplierPct: 100 }))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-scrim sm:items-center sm:px-4 sm:py-10"
      data-holding-modal="add-fixed-income"
      onClick={modal.close}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-renda-fixa-title"
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface px-6 pb-24 pt-6 shadow-2xl sm:max-h-[90vh] sm:rounded-3xl sm:px-8 sm:pb-10 sm:pt-8"
        onClick={(e) => e.stopPropagation()}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSave) void save()
          }}
        >
          {/* Header */}
          <div className="mb-6 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3
                id="modal-renda-fixa-title"
                className="font-headline text-xl font-extrabold tracking-tight text-on-surface"
              >
                {isEdit ? 'Editar Renda Fixa' : m.portfolio.rendaFixaTitle}
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-outline">
                {m.portfolio.rendaFixaSubtitle}
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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Investment select: existing fixed-income investments + create-new option */}
            <label className={`${LABEL_CLASS} sm:col-span-2`}>
              {m.portfolio.rendaFixaInvestmentLabel}
              <select
                value={form.investmentId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    investmentId: e.target.value,
                    newName: '',
                  }))
                }
                disabled={isEdit || invOptions === null}
                className={SELECT_CLASS}
              >
                {!isEdit && (
                  <option value="">
                    {invOptions === null ? 'Carregando…' : 'Selecione…'}
                  </option>
                )}
                {(invOptions ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
                {!isEdit && (
                  <option value="__new__">
                    {m.portfolio.rendaFixaNewInvestmentOption}
                  </option>
                )}
              </select>
            </label>

            {/* New investment fields — shown only when "__new__" is selected */}
            {isNew && (
              <>
                <div className="flex gap-2 rounded-xl border border-secondary-fixed/35 bg-secondary-fixed/12 px-3 py-2 text-xs leading-relaxed text-on-surface sm:col-span-2">
                  <span className="material-symbols-outlined shrink-0 text-base text-secondary-fixed">
                    add_circle
                  </span>
                  <p>
                    Informe o nome do novo investimento. Ele ficará disponível
                    para pontuação.
                  </p>
                </div>

                {typeOptions !== null && typeOptions.length === 0 && (
                  <div className="flex gap-2 rounded-xl border border-error/30 bg-error/8 px-3 py-2 text-xs leading-relaxed text-on-surface sm:col-span-2">
                    <span className="material-symbols-outlined shrink-0 text-base text-error">
                      warning
                    </span>
                    <p>
                      Nenhum tipo de renda fixa encontrado. Crie um tipo de
                      investimento com a opção &ldquo;Renda fixa&rdquo; ativada
                      antes de continuar.
                    </p>
                  </div>
                )}

                <label className={`${LABEL_CLASS} sm:col-span-2`}>
                  {m.portfolio.rendaFixaNewInvestmentName}
                  <input
                    type="text"
                    value={form.newName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, newName: e.target.value }))
                    }
                    className={FIELD_CLASS}
                    placeholder="Ex: CDB Banco Inter Nov/2026"
                    autoFocus
                    autoComplete="off"
                  />
                </label>
              </>
            )}

            {/* Product type */}
            <label className={LABEL_CLASS}>
              {m.portfolio.rendaFixaProductTypeLabel}
              <select
                value={form.productType}
                onChange={(e) => handleProductTypeChange(e.target.value)}
                className={SELECT_CLASS}
              >
                {PRODUCT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {/* Indexer */}
            <label className={LABEL_CLASS}>
              {m.portfolio.rendaFixaIndexerLabel}
              <select
                value={form.indexer}
                onChange={(e) => handleIndexerChange(e.target.value)}
                className={SELECT_CLASS}
              >
                {(allowedIndexers as Indexer[]).map((idx) => (
                  <option key={idx} value={idx}>
                    {INDEXER_LABELS[idx]}
                  </option>
                ))}
              </select>
            </label>

            {/* BCB rate banner for floating indexers and Selic+ */}
            {(isFloating || needsSpread) && (
              <div className="flex gap-2 rounded-xl border border-tertiary-fixed-dim/30 bg-tertiary-fixed-dim/12 px-4 py-3 text-xs leading-relaxed text-on-surface sm:col-span-2">
                <span className="material-symbols-outlined shrink-0 text-lg text-tertiary-fixed-dim">
                  account_balance
                </span>
                <p>
                  {form.indexer === 'cdi'
                    ? m.portfolio.rendaFixaBcbRateCdi
                    : m.portfolio.rendaFixaBcbRateSelic}
                </p>
              </div>
            )}

            {/* Multiplier — CDI/Selic only */}
            {isFloating && (
              <PercentInput
                value={form.multiplierPct}
                label={
                  form.indexer === 'cdi'
                    ? m.portfolio.rendaFixaMultiplierCdi
                    : m.portfolio.rendaFixaMultiplierSelic
                }
                placeholder="100,00"
                onChange={(v) => setForm((f) => ({ ...f, multiplierPct: v }))}
              />
            )}

            {/* Spread — Selic+ only (zero is valid, 4 decimal places) */}
            {needsSpread && (
              <PercentInput
                value={form.annualRate}
                label={m.portfolio.rendaFixaAnnualRateSelicSpread}
                placeholder="0,050"
                decimals={3}
                onChange={(v) => setForm((f) => ({ ...f, annualRate: v }))}
              />
            )}

            {/* Annual rate — pre/ipca/igpm only */}
            {needsRate && (
              <PercentInput
                value={form.annualRate}
                label={
                  form.indexer === 'pre'
                    ? m.portfolio.rendaFixaAnnualRatePre
                    : m.portfolio.rendaFixaAnnualRateSpread
                }
                placeholder={form.indexer === 'pre' ? '14,50' : '6,00'}
                onChange={(v) => setForm((f) => ({ ...f, annualRate: v }))}
              />
            )}

            {/* Capital */}
            <CurrencyInput
              value={form.capital}
              currency="BRL"
              label={m.portfolio.rendaFixaCapitalLabel}
              onChange={(v) => setForm((f) => ({ ...f, capital: v }))}
            />

            {/* Dates */}
            <label className={LABEL_CLASS}>
              {m.portfolio.rendaFixaPurchaseDateLabel}
              <input
                type="date"
                value={form.purchaseDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, purchaseDate: e.target.value }))
                }
                className={FIELD_CLASS}
              />
            </label>

            <label className={LABEL_CLASS}>
              {m.portfolio.rendaFixaMaturityDateLabel}
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maturityDate: e.target.value }))
                }
                className={FIELD_CLASS}
              />
            </label>

            {/* Broker */}
            <label className={`${LABEL_CLASS} sm:col-span-2`}>
              {m.portfolio.rendaFixaBrokerLabel}
              <input
                type="text"
                value={form.broker}
                onChange={(e) =>
                  setForm((f) => ({ ...f, broker: e.target.value }))
                }
                className={FIELD_CLASS}
                placeholder="Ex: XP Investimentos"
              />
            </label>
          </div>

          {/* Errors */}
          {(fieldError ?? saveError) && (
            <p className="mt-4 text-sm font-medium text-error" role="alert">
              {fieldError ?? saveError}
            </p>
          )}

          {/* Save block hint — only shown when nothing else is already shown */}
          {!canSave && !fieldError && !saveError && saveBlockReason && (
            <p className="mt-4 text-xs text-outline" role="status">
              {saveBlockReason}
            </p>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:gap-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border-2 border-outline-variant/40 px-8 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low"
              onClick={isEdit ? modal.close : modal.openChooseAssetClass}
            >
              {isEdit ? 'Cancelar' : 'Voltar'}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="inline-flex items-center justify-center rounded-full bg-primary-container px-8 py-3 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95 disabled:opacity-45"
            >
              {isSaving
                ? 'Salvando…'
                : isEdit
                  ? 'Salvar alterações'
                  : m.portfolio.rendaFixaAddButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
