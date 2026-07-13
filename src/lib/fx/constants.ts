/** Currencies supported for display conversion (MVP). */
export const SUPPORTED_FX_CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP'] as const

export type FxCurrency = (typeof SUPPORTED_FX_CURRENCIES)[number]

export const DEFAULT_DISPLAY_CURRENCY: FxCurrency = 'BRL'

export const DISPLAY_CURRENCY_STORAGE_KEY = 'preferredDisplayCurrency'
