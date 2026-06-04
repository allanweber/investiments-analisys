import { Link } from '@tanstack/react-router'

export function StrategyDriftBanner() {
  return (
    <section className="mt-10 rounded-2xl border border-outline-variant/15 bg-surface-container-high px-6 py-6 shadow-md ring-1 ring-outline-variant/10 lg:col-span-2">
      <p className="font-headline text-lg font-extrabold text-on-surface">
        Desvio de estratégia detectado
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
        Sua carteira divergiu do plano de alocação. Revise os alvos por tipo na Carteira para realinhar
        risco e retorno.
      </p>
      <Link
        to="/portfolio"
        className="mt-5 inline-flex items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-low px-5 py-2 text-xs font-bold text-on-surface no-underline transition-colors hover:border-outline-variant/50 hover:bg-surface-container-highest"
      >
        Ver detalhes
      </Link>
    </section>
  )
}
