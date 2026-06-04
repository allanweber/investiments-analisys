type Props = {
  onAdd: () => void
}

const FEATURE_CARDS = [
  {
    icon: 'candlestick_chart',
    bg: 'bg-tertiary-fixed-dim/20 text-tertiary-fixed-dim',
    title: 'Importação automática',
    body: 'Conecte suas contas de corretoras para sincronizar posições em tempo real.',
  },
  {
    icon: 'shield',
    bg: 'bg-secondary-fixed/30 text-on-secondary-fixed',
    title: 'Segurança de dados',
    body: 'Seus ativos são criptografados com padrões bancários de alta segurança.',
  },
  {
    icon: 'pie_chart',
    bg: 'bg-secondary-fixed/20 text-primary-container',
    title: 'Visão por tipos',
    body: 'Visualize sua alocação por classes de ativos assim que adicionar posições.',
  },
]

export function HoldingsEmptyState({ onAdd }: Props) {
  return (
    <>
      <section className="mx-auto max-w-3xl rounded-3xl bg-surface p-10 text-center shadow-lg ring-1 ring-outline-variant/10 md:p-14">
        <div className="relative mx-auto mb-8 flex max-w-sm justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-secondary-fixed/25 to-transparent blur-2xl" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-surface shadow-md ring-1 ring-outline-variant/15">
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
      <section className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURE_CARDS.map((card) => (
          <div
            key={card.title}
            className="rounded-2xl bg-surface p-5 shadow-md ring-1 ring-outline-variant/10"
          >
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${card.bg}`}>
              <span className="material-symbols-outlined text-[22px]">{card.icon}</span>
            </div>
            <p className="font-headline text-sm font-extrabold text-on-surface">{card.title}</p>
            <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{card.body}</p>
          </div>
        ))}
      </section>
    </>
  )
}
