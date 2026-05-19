import { Link } from '@tanstack/react-router'

type Suggestion = {
  investmentTypeId: string
  investmentTypeName: string
  investmentId: string
  investmentName: string
  score: number
}

type Props = {
  suggestions: Suggestion[]
}

export function PortfolioContributionSuggestions({ suggestions }: Props) {
  if (suggestions.length === 0) return null

  return (
    <section className="mt-8 rounded-2xl bg-surface-container-low p-6">
      <h3 className="font-headline text-base font-extrabold text-on-surface">Sugestão de novos aportes</h3>
      <p className="mt-2 text-sm text-on-surface-variant">
        Para cada Tipo abaixo do alvo, sugerimos um investimento com maior pontuação.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        {suggestions.map((s) => (
          <div key={s.investmentTypeId} className="rounded-2xl bg-surface-container-high p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-outline">
                  {s.investmentTypeName}
                </p>
                <p className="mt-1 font-headline text-lg font-extrabold text-on-surface">
                  {s.investmentName}
                </p>
              </div>
              <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-extrabold text-on-primary">
                {s.score > 0 ? '+' : ''}
                {s.score}
              </span>
            </div>
            <div className="mt-4 flex gap-3">
              <Link
                to="/investimentos/$id/pontuacao"
                params={{ id: s.investmentId }}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-primary-container px-4 py-2 text-xs font-bold text-on-primary no-underline hover:opacity-95"
              >
                Abrir pontuação
              </Link>
              <Link
                to="/investimentos"
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-2 text-xs font-bold text-on-surface no-underline hover:bg-surface-container-high"
              >
                Ver lista
              </Link>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
