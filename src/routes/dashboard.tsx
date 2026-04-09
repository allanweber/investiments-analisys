import { Link, createFileRoute, Navigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { authClient } from '#/lib/auth-client'
import {
  getDashboardHighlightsFn,
  getDashboardSummaryFn,
} from '#/lib/investment-server'

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { data: session, isPending } = authClient.useSession()
  const [stats, setStats] = useState<{
    typeCount: number
    investmentCount: number
    answerCount: number
  } | null>(null)
  const [highlights, setHighlights] = useState<{
    groups: Array<{
      typeId: string
      typeName: string
      top: Array<{ id: string; name: string; score: number }>
    }>
  } | null>(null)

  useEffect(() => {
    if (!session?.user) return
    void Promise.all([
      getDashboardSummaryFn().catch(() => ({
        typeCount: 0,
        investmentCount: 0,
        answerCount: 0,
      })),
      getDashboardHighlightsFn().catch(() => ({
        groups: [] as Array<{
          typeId: string
          typeName: string
          top: Array<{ id: string; name: string; score: number }>
        }>,
      })),
    ]).then(([s, h]) => {
      setStats(s)
      setHighlights(h)
    })
  }, [session?.user])

  if (isPending) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center px-4">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-outline-variant border-t-primary"
          aria-hidden
        />
      </main>
    )
  }

  if (!session?.user) {
    return <Navigate to="/login" />
  }

  const tc = stats?.typeCount ?? 0
  const ic = stats?.investmentCount ?? 0
  const ac = stats?.answerCount ?? 0
  const fmt = (n: number) => n.toString().padStart(2, '0')

  return (
    <main className="w-full max-w-7xl px-4 py-8 sm:p-8 lg:p-12">
      <section className="mb-12">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <span className="mb-2 block font-label text-xs font-semibold uppercase tracking-[0.2em] text-outline">
              Visão geral
            </span>
            <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
              Seu patrimônio, arquitetado.
            </h1>
            <p className="mt-4 max-w-xl leading-relaxed text-on-surface-variant">
              Olá, {session.user.name || session.user.email}. Centro de comando
              para tipos, perguntas e pontuação dos investimentos.
            </p>
          </div>
          <div className="flex items-center gap-2 font-body text-sm text-outline">
            <span>Dashboard</span>
            <span className="text-surface-dim">/</span>
            <span className="font-semibold text-on-surface">Início</span>
          </div>
        </div>
      </section>

      {highlights && highlights.groups.length > 0 && (
        <section className="mb-12">
          <span className="mb-3 block font-label text-xs font-semibold uppercase tracking-[0.2em] text-outline">
            Destaques
          </span>
          <h2 className="font-headline text-2xl font-extrabold tracking-tight text-on-surface md:text-3xl">
            Melhor pontuação por tipo
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-on-surface-variant">
            Até três investimentos com maior pontuação em cada tipo (só
            comparável dentro do mesmo tipo).
          </p>
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {highlights.groups.map((g) => (
              <div
                key={g.typeId}
                className="rounded-xl bg-surface-container-low p-6 transition-colors hover:bg-surface-container-high"
              >
                <h3 className="font-headline text-lg font-bold text-on-surface">
                  {g.typeName}
                </h3>
                {g.top.length === 0 ? (
                  <p className="mt-4 font-body text-sm text-on-surface-variant">
                    Sem investimentos neste tipo.
                  </p>
                ) : (
                  <ol className="mt-4 space-y-3 font-body text-sm">
                    {g.top.map((inv, idx) => (
                      <li key={inv.id}>
                        <Link
                          to="/investimentos/$id/pontuacao"
                          params={{ id: inv.id }}
                          className="flex items-center justify-between gap-3 text-on-surface no-underline transition-colors hover:text-primary"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-label text-xs font-bold text-outline">
                              {idx + 1}.
                            </span>{' '}
                            <span className="font-medium">{inv.name}</span>
                          </span>
                          <span className="shrink-0 font-headline text-base font-bold tabular-nums text-on-surface">
                            {inv.score > 0 ? '+' : ''}
                            {inv.score}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 transition-all hover:-translate-y-1">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary-container text-on-secondary-container">
              <span className="material-symbols-outlined text-2xl leading-none">
                category
              </span>
            </div>
            <span className="rounded px-2 py-1 font-label text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed-variant bg-tertiary-fixed-dim">
              Tipos
            </span>
          </div>
          <div>
            <p className="mb-1 font-label text-xs font-bold uppercase tracking-widest text-outline">
              Total de tipos
            </p>
            <h3 className="font-headline text-4xl font-extrabold text-on-surface">
              {fmt(tc)}
            </h3>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 transition-all hover:-translate-y-1">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-fixed text-on-primary-fixed-variant">
              <span className="material-symbols-outlined text-2xl leading-none">
                account_balance
              </span>
            </div>
            <span className="rounded px-2 py-1 font-label text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed-variant bg-tertiary-fixed-dim">
              Carteira
            </span>
          </div>
          <div>
            <p className="mb-1 font-label text-xs font-bold uppercase tracking-widest text-outline">
              Investimentos
            </p>
            <h3 className="font-headline text-4xl font-extrabold text-on-surface">
              {fmt(ic)}
            </h3>
          </div>
        </div>

        <div className="flex flex-col justify-between rounded-xl bg-surface-container-lowest p-8 transition-all hover:-translate-y-1">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-tertiary-container text-tertiary-fixed-dim">
              <span className="material-symbols-outlined text-2xl leading-none">
                quiz
              </span>
            </div>
            <span className="rounded px-2 py-1 font-label text-[10px] font-bold uppercase tracking-wider text-on-tertiary-fixed-variant bg-tertiary-fixed-dim">
              Respostas
            </span>
          </div>
          <div>
            <p className="mb-1 font-label text-xs font-bold uppercase tracking-widest text-outline">
              Respostas salvas
            </p>
            <h3 className="font-headline text-4xl font-extrabold text-on-surface">
              {ac >= 100 ? String(ac) : fmt(ac)}
            </h3>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-stretch">
        <Link
          to="/investimentos"
          className="group relative flex min-h-[12rem] cursor-pointer flex-col overflow-hidden rounded-xl border border-outline-variant/20 bg-surface-container-low p-8 no-underline outline-none transition-all hover:bg-surface-container-high hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99] md:h-full"
        >
          <div className="relative z-10 flex flex-1 flex-col">
            <h4 className="mb-2 font-headline text-xl font-bold text-on-surface">
              Ver investimentos e ranking
            </h4>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-on-surface-variant">
              Compare a pontuação por tipo na sua carteira.
            </p>
            <span className="inline-flex items-center text-sm font-bold text-primary transition-transform group-hover:translate-x-2">
              Ver lista
              <span className="material-symbols-outlined ml-2 shrink-0 text-xl leading-none">
                trending_up
              </span>
            </span>
          </div>
        </Link>

        <Link
          to="/tipos"
          className="group relative flex min-h-[12rem] cursor-pointer flex-col overflow-hidden rounded-xl bg-primary-container p-8 text-on-primary no-underline outline-none transition-all hover:shadow-2xl focus-visible:ring-2 focus-visible:ring-on-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.99] md:h-full"
        >
          <div className="relative z-10 flex flex-1 flex-col">
            <h4 className="mb-2 font-headline text-xl font-bold">
              Gerenciar tipos e perguntas
            </h4>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-on-primary-container">
              Refine os critérios de avaliação e crie categorias de ativos.
            </p>
            <span className="inline-flex items-center text-sm font-bold text-on-primary transition-transform group-hover:translate-x-2">
              Acessar módulo
              <span className="material-symbols-outlined ml-2 shrink-0 text-xl leading-none">
                arrow_forward
              </span>
            </span>
          </div>
        </Link>
      </div>

      <div className="relative mt-10 flex flex-col items-center justify-center rounded-xl bg-surface-container-low p-12 text-center">
        <div className="mb-6 flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-surface-container-high">
          <span className="material-symbols-outlined text-5xl leading-none text-outline">
            query_stats
          </span>
        </div>
        <h4 className="mb-3 font-headline text-2xl font-bold text-on-surface">
          {tc === 0 && ic === 0
            ? 'Comece pelo primeiro tipo'
            : 'Fluxo principal'}
        </h4>
        <p className="mb-8 max-w-sm text-on-surface-variant">
          {tc === 0 && ic === 0
            ? 'Defina tipos de investimento e perguntas antes de pontuar ativos.'
            : 'Use o menu superior ou os cartões acima para continuar trabalhando.'}
        </p>
        <Link
          to="/tipos"
          className="inline-flex items-center gap-2 rounded-xl bg-tertiary-container px-8 py-4 font-headline text-sm font-bold text-tertiary-fixed-dim shadow-lg no-underline transition-all active:scale-95"
        >
          <span className="material-symbols-outlined shrink-0 text-xl leading-none">
            add_circle
          </span>
          Ir para os tipos de investimento
        </Link>
      </div>

      <footer className="mt-16 w-full border-t border-outline-variant/15 py-8">
        <div className="flex flex-col items-center justify-between gap-4 px-2 md:flex-row md:px-8">
          <p className="font-label text-[10px] uppercase tracking-widest text-outline">
            © {new Date().getFullYear()} The Financial Architect — High-Fidelity
            Ledger
          </p>
          <div className="flex gap-6">
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Privacidade
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Termos
            </span>
            <span className="font-label text-[10px] uppercase tracking-widest text-outline">
              Suporte
            </span>
          </div>
        </div>
      </footer>
    </main>
  )
}
