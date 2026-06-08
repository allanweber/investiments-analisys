import { useEffect, useMemo, useRef, useState } from 'react'

import { createInvestmentFn } from '@/lib/investment-server'
import { listInvestmentTypesOptionsFn } from '@/lib/investment-type-server'
import { getRendaFixaDetailFn, upsertRendaFixaHoldingFn } from '@/lib/renda-fixa-server'
import { PRODUCT_RULES } from '@/lib/renda-fixa/products'
import type { Indexer, ProductType } from '@/lib/renda-fixa/products'
import { isFixedIncomeTipo } from '@/lib/portfolio-valuation'
import { messages as m } from '@/messages'
import { toDateInputValue } from '../utils/holdings-format'
import { listInvestmentsOverviewFn } from '@/lib/scoring-server'

import type { UseHoldingModalResult } from './use-holding-modal'

// investmentId === '' → nothing selected
// investmentId === '__new__' → user wants to create a new investment
// investmentId === <uuid> → existing investment selected
export type RendaFixaForm = {
  investmentId: string
  newName: string
  newTypeId: string
  productType: string
  indexer: string
  capital: number
  /** Annual rate as a percent value (e.g. 14.5 means 14.5% a.a.). 0 = not set. */
  annualRate: number
  /** CDI/Selic multiplier as a percent value (e.g. 110 means 110% CDI). */
  multiplierPct: number
  purchaseDate: string
  maturityDate: string
  broker: string
}

export type RendaFixaInvOption = { id: string; name: string }
export type RendaFixaTypeOption = { id: string; name: string }

export type UseRendaFixaFormResult = {
  form: RendaFixaForm
  setForm: React.Dispatch<React.SetStateAction<RendaFixaForm>>
  invOptions: RendaFixaInvOption[] | null
  typeOptions: RendaFixaTypeOption[] | null
  allowedIndexers: readonly Indexer[]
  fieldError: string | null
  saveError: string | null
  saveBlockReason: string | null
  isSaving: boolean
  canSave: boolean
  isEdit: boolean
  save: () => Promise<void>
}

const DEFAULT_FORM: RendaFixaForm = {
  investmentId: '',
  newName: '',
  newTypeId: '',
  productType: 'cdb',
  indexer: 'cdi',
  capital: 0,
  annualRate: 0,
  multiplierPct: 100,
  purchaseDate: '',
  maturityDate: '',
  broker: '',
}

export function useRendaFixaForm({
  modal,
  refresh,
}: {
  modal: UseHoldingModalResult
  refresh: () => Promise<void>
}): UseRendaFixaFormResult {
  const [form, setForm] = useState<RendaFixaForm>(DEFAULT_FORM)
  const [invOptions, setInvOptions] = useState<RendaFixaInvOption[] | null>(null)
  const [typeOptions, setTypeOptions] = useState<RendaFixaTypeOption[] | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const loadingInvs = useRef(false)
  const loadingTypes = useRef(false)

  // Trigger loading and reset form whenever the modal opens
  useEffect(() => {
    const state = modal.state
    if (state.kind !== 'addFixedIncome' && state.kind !== 'editFixedIncome') return

    setFieldError(null)
    setSaveError(null)

    if (state.kind === 'editFixedIncome') {
      const { row } = state
      setForm({ ...DEFAULT_FORM, investmentId: row.investmentId })
      setInvOptions([{ id: row.investmentId, name: row.investmentName }])
      getRendaFixaDetailFn({ data: { investmentId: row.investmentId } })
        .then((detail) => {
          if (!detail) return
          setForm((f) => ({
            ...f,
            investmentId: detail.investment.id,
            productType: detail.detail.productType,
            indexer: detail.detail.indexer,
            capital: Number(detail.detail.capital),
            annualRate: Number(detail.detail.annualRate) * 100,
            multiplierPct: detail.detail.multiplier != null ? Number(detail.detail.multiplier) * 100 : 100,
            purchaseDate: toDateInputValue(detail.detail.purchaseDate),
            maturityDate: toDateInputValue(detail.detail.maturityDate),
            broker: detail.broker ?? '',
          }))
        })
      return
    }

    // add mode
    const cachedTypeId = typeOptions?.[0]?.id ?? ''
    setForm({ ...DEFAULT_FORM, newTypeId: cachedTypeId })

    if (!loadingInvs.current) {
      loadingInvs.current = true
      listInvestmentsOverviewFn()
        .then((list) =>
          setInvOptions(
            list
              .filter((x) => isFixedIncomeTipo(Boolean(x.fixedIncome), x.typeName))
              .map((x) => ({ id: x.id, name: x.name })),
          ),
        )
        .finally(() => { loadingInvs.current = false })
    }

    if (!loadingTypes.current) {
      loadingTypes.current = true
      listInvestmentTypesOptionsFn()
        .then((list) => {
          const fixed = list
            .filter((t) => isFixedIncomeTipo(Boolean(t.fixedIncome), t.name))
            .map((t) => ({ id: t.id, name: t.name }))
          setTypeOptions(fixed)
          if (fixed.length > 0) {
            setForm((f) => ({ ...f, newTypeId: fixed[0].id }))
          }
        })
        .finally(() => { loadingTypes.current = false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modal.state.kind])

  // As soon as fixed-income types are available, ensure newTypeId is set
  useEffect(() => {
    if (!typeOptions || typeOptions.length === 0) return
    setForm((f) => f.newTypeId ? f : { ...f, newTypeId: typeOptions[0].id })
  }, [typeOptions])

  const allowedIndexers = useMemo(
    () => PRODUCT_RULES[form.productType as ProductType]?.allowedIndexers ?? [],
    [form.productType],
  )

  const isEdit = modal.state.kind === 'editFixedIncome'
  const isNew = form.investmentId === '__new__'

  const saveBlockReason = useMemo((): string | null => {
    if (isSaving) return null
    if (!form.investmentId) return 'Selecione ou crie um investimento.'
    if (isNew && !form.newName.trim()) return m.portfolio.rendaFixaNameRequired
    if (isNew && !form.newTypeId) return typeOptions === null ? 'Carregando tipos…' : m.portfolio.rendaFixaTypeRequired
    if (form.capital <= 0) return m.portfolio.rendaFixaCapitalRequired
    if (!form.purchaseDate) return m.portfolio.rendaFixaPurchaseDateRequired
    if (form.maturityDate && form.maturityDate <= form.purchaseDate) return m.portfolio.rendaFixaMaturityBeforePurchase
    const needsPositiveRate = form.indexer === 'pre' || form.indexer === 'ipca' || form.indexer === 'igpm'
    if (needsPositiveRate && form.annualRate <= 0) return m.portfolio.rendaFixaRateRequired
    return null
  }, [isSaving, form, isNew, typeOptions])

  const canSave = saveBlockReason === null && !isSaving

  async function save() {
    setFieldError(null)
    setSaveError(null)

    if (!form.investmentId) { setFieldError(m.portfolio.rendaFixaNameRequired); return }
    if (isNew && !form.newName.trim()) { setFieldError(m.portfolio.rendaFixaNameRequired); return }
    if (isNew && !form.newTypeId) { setSaveError(m.portfolio.rendaFixaTypeRequired); return }
    if (form.capital <= 0) { setFieldError(m.portfolio.rendaFixaCapitalRequired); return }
    if (!form.purchaseDate) { setFieldError(m.portfolio.rendaFixaPurchaseDateRequired); return }
    if (form.maturityDate && form.maturityDate <= form.purchaseDate) { setFieldError(m.portfolio.rendaFixaMaturityBeforePurchase); return }
    const needsPositiveRate = form.indexer === 'pre' || form.indexer === 'ipca' || form.indexer === 'igpm'
    if (needsPositiveRate && form.annualRate <= 0) { setFieldError(m.portfolio.rendaFixaRateRequired); return }

    setIsSaving(true)
    try {
      let investmentId = isNew ? '' : form.investmentId
      if (isNew) {
        const created = await createInvestmentFn({
          data: { name: form.newName.trim(), investmentTypeId: form.newTypeId },
        })
        if (!created) { setSaveError(m.portfolio.rendaFixaCreateError); return }
        investmentId = created.id
      }

      const annualRate = (needsPositiveRate || form.indexer === 'selic-spread') ? form.annualRate / 100 : 0
      const multiplier =
        (form.indexer === 'cdi' || form.indexer === 'selic') && form.multiplierPct > 0
          ? form.multiplierPct / 100
          : undefined

      await upsertRendaFixaHoldingFn({
        data: {
          investmentId,
          productType: form.productType as ProductType,
          indexer: form.indexer as Indexer,
          capital: form.capital,
          annualRate,
          purchaseDate: new Date(`${form.purchaseDate}T12:00:00`).toISOString(),
          maturityDate: form.maturityDate ? new Date(`${form.maturityDate}T12:00:00`).toISOString() : null,
          multiplier,
          broker: form.broker.trim() || undefined,
        },
      })

      modal.close()
      setForm(DEFAULT_FORM)
      await refresh()
    } catch {
      setSaveError(m.portfolio.rendaFixaCreateError)
    } finally {
      setIsSaving(false)
    }
  }

  return {
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
  }
}
