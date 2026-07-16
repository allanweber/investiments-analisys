type Props = {
  onAdd: () => void
}

const STEPS = [
  {
    icon: 'add_circle',
    color: 'text-tertiary-fixed-dim',
    title: 'Adicione posições',
    body: 'Informe seus ativos de renda fixa e variável.',
  },
  {
    icon: 'monitoring',
    color: 'text-primary-container',
    title: 'Acompanhe cotações',
    body: 'Veja o valor atualizado do seu portfólio.',
  },
  {
    icon: 'pie_chart',
    color: 'text-on-secondary-fixed',
    title: 'Analise alocação',
    body: 'Entenda como seu patrimônio está distribuído.',
  },
]

export function HoldingsEmptyState({ onAdd }: Props) {
  return (
    <>
      <section className="mx-auto max-w-3xl rounded-3xl bg-surface-container-lowest p-10 text-center md:p-14">
        <div className="mx-auto mb-8 flex max-w-sm justify-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-surface-container-low">
            <span className="material-symbols-outlined text-5xl text-secondary-container">
              account_balance_wallet
            </span>
          </div>
        </div>
        <h2 className="font-headline mb-3 text-2xl font-extrabold text-on-surface md:text-3xl">
          Sua lista de posições está vazia.
        </h2>
        <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-on-surface-variant">
          Comece a monitorar seu patrimônio adicionando seus primeiros ativos de renda fixa, variável ou
          investimentos alternativos.
        </p>
        <button
          type="button"
          className="inline-flex w-full max-w-md items-center justify-center gap-2 rounded-full bg-primary-container px-8 py-3.5 text-sm font-bold text-on-primary shadow-md transition-opacity hover:opacity-95 md:w-auto"
          onClick={onAdd}
        >
          <span className="material-symbols-outlined text-[20px] leading-none">add</span>
          Adicionar primeira posição
        </button>
      </section>

      <section className="mx-auto mt-12 max-w-3xl">
        <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-widest text-outline">
          Como funciona
        </p>
        <div className="flex flex-col gap-8 sm:flex-row sm:gap-4">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-1 flex-col items-center text-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container-low text-xs font-extrabold text-on-surface-variant">
                {i + 1}
              </div>
              <span className={`material-symbols-outlined mt-4 text-3xl ${step.color}`}>{step.icon}</span>
              <p className="mt-3 font-headline text-sm font-extrabold text-on-surface">{step.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-on-surface-variant">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
