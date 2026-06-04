type Props = {
  onReconnect: () => void
}

export function StaleQuotesBanner({ onReconnect }: Props) {
  return (
    <section className="mb-8 rounded-2xl border border-error/20 border-l-4 border-l-error bg-error-container/35 p-5 pl-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined mt-0.5 text-2xl text-error">warning</span>
          <div>
            <p className="font-headline text-sm font-bold text-error">Cotações desatualizadas</p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Detectamos instabilidade na conexão com os provedores de mercado.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex shrink-0 items-center justify-center rounded-full bg-error-container px-5 py-2.5 text-xs font-bold text-on-error-container shadow-sm hover:opacity-95"
          onClick={onReconnect}
        >
          TENTAR RECONECTAR
        </button>
      </div>
    </section>
  )
}
