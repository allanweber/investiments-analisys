import { useRef, useState } from 'react'

import {
  formatCurrencyFixed2,
  moneyMeta,
  parseAvgCostDraft,
  round2,
  sanitizeAvgCostTyping,
} from './utils/currency-input'

type Props = {
  value: number
  currency: string
  label: string
  disabled?: boolean
  hasError?: boolean
  onChange: (value: number) => void
  className?: string
}

export function CurrencyInput({ value, currency, label, disabled, hasError, onChange, className }: Props) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const suppressNextMouseUpRef = useRef(false)
  const pointerDownBeforeFocusRef = useRef(false)

  const displayValue = focused ? draft : formatCurrencyFixed2(value, currency)

  return (
    <label className={`block text-[10px] font-bold uppercase tracking-widest text-outline ${className ?? ''}`}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={displayValue}
        disabled={disabled}
        onMouseDown={(e) => {
          if (e.currentTarget !== document.activeElement) {
            pointerDownBeforeFocusRef.current = true
          }
        }}
        onFocus={(e) => {
          const el = e.currentTarget
          if (disabled) {
            pointerDownBeforeFocusRef.current = false
            return
          }
          const meta = moneyMeta(currency)
          setFocused(true)
          setDraft(sanitizeAvgCostTyping(formatCurrencyFixed2(value, currency), meta))
          if (pointerDownBeforeFocusRef.current) {
            suppressNextMouseUpRef.current = true
            pointerDownBeforeFocusRef.current = false
          }
          setTimeout(() => { el.select() }, 0)
        }}
        onMouseUp={(e) => {
          if (suppressNextMouseUpRef.current) {
            e.preventDefault()
            suppressNextMouseUpRef.current = false
          }
        }}
        onChange={(e) => {
          if (disabled) return
          const meta = moneyMeta(currency)
          const next = sanitizeAvgCostTyping(e.target.value, meta)
          setDraft(next)
          onChange(parseAvgCostDraft(next, meta))
        }}
        onBlur={() => {
          const meta = moneyMeta(currency)
          onChange(round2(parseAvgCostDraft(draft, meta)))
          setFocused(false)
          setDraft('')
        }}
        className={`mt-2 w-full border-0 border-b-2 bg-transparent px-0 py-2.5 text-sm font-semibold text-on-surface outline-none transition-colors focus:border-primary disabled:opacity-50 ${
          hasError ? 'border-error focus:border-error' : 'border-outline-variant/50'
        }`}
      />
    </label>
  )
}
