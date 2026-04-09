import { type Messages, ptBR } from './pt-BR'

export type { Messages }
export { ptBR }

/** Active UI strings (pt-BR). Replace with locale resolution when adding i18n. */
export const messages = ptBR

/** BCP 47 language tag for `<html lang>` and `Intl` */
export const htmlLang = messages.meta.htmlLang

/** Same as `htmlLang` today; use for date/number formatting when you add locales */
export const locale = messages.meta.locale
