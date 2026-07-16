import { useCallback, useState } from 'react'

import {
  DEFAULT_DISPLAY_CURRENCY,
  DISPLAY_CURRENCY_STORAGE_KEY,
  SUPPORTED_FX_CURRENCIES,
} from '@/lib/fx'
import type { FxCurrency } from '@/lib/fx'

function readStoredDisplayCurrency(): FxCurrency {
  if (typeof window === 'undefined') return DEFAULT_DISPLAY_CURRENCY
  const stored = localStorage
    .getItem(DISPLAY_CURRENCY_STORAGE_KEY)
    ?.trim()
    .toUpperCase()
  if (
    stored &&
    (SUPPORTED_FX_CURRENCIES as readonly string[]).includes(stored)
  ) {
    return stored as FxCurrency
  }
  return DEFAULT_DISPLAY_CURRENCY
}

export function useDisplayCurrency() {
  const [displayCurrency, setDisplayCurrencyState] = useState<FxCurrency>(
    readStoredDisplayCurrency,
  )

  const setDisplayCurrency = useCallback((c: FxCurrency) => {
    setDisplayCurrencyState(c)
    if (typeof window !== 'undefined') {
      localStorage.setItem(DISPLAY_CURRENCY_STORAGE_KEY, c)
    }
  }, [])

  return {
    displayCurrency,
    setDisplayCurrency,
    displayCurrencyOptions: SUPPORTED_FX_CURRENCIES,
  }
}
