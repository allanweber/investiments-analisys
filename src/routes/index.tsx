import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'

export const Route = createFileRoute('/')({
  head: () => ({
    links: [
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&display=swap',
      },
    ],
  }),
  component: LandingPage,
})

const LANDING_CSS = `
.tfa-root {
  --navy: #101c2e;
  --navy-2: #0b1420;
  --paper: #f4f6f8;
  --surface: #ffffff;
  --surface-2: #eef1f5;
  --line: #d7dde5;
  --ink: #14202f;
  --text: #33404f;
  --muted: #66727f;
  --mint: #12a674;
  --mint-ink: #0c7d57;
  --on-navy: #eef2f7;
  --on-navy-muted: #9fb0c4;
  --on-navy-line: rgba(255, 255, 255, 0.12);
  --mint-on-navy: #2ad395;
  --seg-1: #2f3f9e; --seg-2: #17a67a; --seg-3: #2f8fd6;
  --seg-4: #0f5f57; --seg-5: #6d3bd1; --seg-6: #b23052;
  --shadow: 0 1px 2px rgba(16, 28, 46, .06), 0 24px 48px -24px rgba(16, 28, 46, .28);
  --shadow-sm: 0 1px 2px rgba(16, 28, 46, .05), 0 8px 24px -16px rgba(16, 28, 46, .22);
  --maxw: 1160px;
  background: var(--paper);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
html.dark .tfa-root {
  --paper: #0d1622;
  --surface: #131f2d;
  --surface-2: #0f1a27;
  --line: #24313f;
  --ink: #eaf0f6;
  --text: #b8c4d0;
  --muted: #7f8d9c;
  --mint: #2ad395;
  --mint-ink: #4fe0a9;
  --shadow: 0 1px 2px rgba(0,0,0,.4), 0 24px 48px -24px rgba(0, 0, 0, .6);
  --shadow-sm: 0 1px 2px rgba(0,0,0,.35), 0 8px 24px -16px rgba(0, 0, 0, .5);
}

.tfa-root * { box-sizing: border-box; }
.tfa-root img { max-width: 100%; }
.tfa-root h1, .tfa-root h2, .tfa-root h3 { font-family: "Manrope", system-ui, sans-serif; color: var(--ink); text-wrap: balance; margin: 0; }
.tfa-root p { margin: 0; }
.tfa-root a { color: inherit; }
.tfa-root .wrap { width: 100%; max-width: var(--maxw); margin: 0 auto; padding: 0 24px; }

.tfa-root .eyebrow {
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase;
  color: var(--mint-ink); margin: 0 0 14px;
}
.tfa-root .eyebrow.on-navy { color: var(--mint-on-navy); }

.tfa-root .allocbar { display: flex; height: 6px; border-radius: 99px; overflow: hidden; gap: 2px; }
.tfa-root .allocbar > i { display: block; }
.tfa-root .allocbar > i:nth-child(1) { flex: 25; background: var(--seg-1); }
.tfa-root .allocbar > i:nth-child(2) { flex: 30; background: var(--seg-2); }
.tfa-root .allocbar > i:nth-child(3) { flex: 15; background: var(--seg-3); }
.tfa-root .allocbar > i:nth-child(4) { flex: 10; background: var(--seg-4); }
.tfa-root .allocbar > i:nth-child(5) { flex: 15; background: var(--seg-5); }
.tfa-root .allocbar > i:nth-child(6) { flex: 5;  background: var(--seg-6); }

.tfa-root .nav {
  position: sticky; top: 0; z-index: 50;
  background: color-mix(in srgb, var(--paper) 82%, transparent);
  backdrop-filter: saturate(1.4) blur(12px);
  border-bottom: 1px solid var(--line);
}
.tfa-root .nav__inner { display: flex; align-items: center; justify-content: space-between; min-height: 66px; gap: 16px; padding-block: 10px; }
.tfa-root .brand { display: flex; align-items: center; gap: 11px; font-family: "Manrope"; font-weight: 800; color: var(--ink); font-size: 17px; letter-spacing: -.01em; text-decoration: none; }
.tfa-root .brand .mark { width: 30px; height: 30px; border-radius: 8px; background: var(--navy); display: grid; place-items: center; color: var(--mint-on-navy); flex: none; }
.tfa-root .brand .mark svg { width: 17px; height: 17px; }
.tfa-root .nav__links { display: flex; gap: 28px; }
.tfa-root .nav__links a { font-size: 14.5px; font-weight: 500; color: var(--muted); text-decoration: none; transition: color .15s; white-space: nowrap; }
.tfa-root .nav__links a:hover { color: var(--ink); }
.tfa-root .nav__actions { display: flex; align-items: center; gap: 10px; flex: none; }
.tfa-root .btn {
  display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14.5px;
  padding: 10px 18px; border-radius: 99px; text-decoration: none; border: 1px solid transparent;
  white-space: nowrap; cursor: pointer;
  transition: transform .15s ease, background .15s, border-color .15s, opacity .15s;
}
.tfa-root .btn:active { transform: translateY(1px); }
.tfa-root .btn--primary { background: var(--navy); color: #fff; }
.tfa-root .btn--primary:hover { opacity: .92; }
.tfa-root .btn--mint { background: var(--mint); color: #06231a; }
.tfa-root .btn--ghost { border-color: var(--line); color: var(--ink); background: var(--surface); }
.tfa-root .btn--ghost:hover { background: var(--surface-2); }
.tfa-root .btn--ghost-navy { border-color: var(--on-navy-line); color: var(--on-navy); background: transparent; }
.tfa-root .btn--ghost-navy:hover { background: rgba(255,255,255,.06); }
@media (max-width: 900px){ .tfa-root .nav__links { display: none; } }
@media (max-width: 560px){
  .tfa-root .nav__actions .btn--ghost { display: none; }
  .tfa-root .brand { font-size: 15px; gap: 9px; }
  .tfa-root .btn { padding: 9px 15px; font-size: 14px; }
}

.tfa-root .hero { background: radial-gradient(120% 120% at 80% -10%, #1b2c44 0%, var(--navy) 42%, var(--navy-2) 100%); color: var(--on-navy); position: relative; overflow: hidden; }
.tfa-root .hero::after { content: ""; position: absolute; inset: 0; background: radial-gradient(60% 50% at 15% 110%, rgba(42,211,149,.10), transparent 70%); pointer-events: none; }
.tfa-root .hero__grid { display: grid; grid-template-columns: 1.05fr 1fr; gap: 56px; align-items: center; padding-block: 84px 92px; position: relative; z-index: 1; }
.tfa-root .hero__grid > * { min-width: 0; }
.tfa-root .hero h1 { color: #fff; font-size: clamp(34px, 5.4vw, 62px); font-weight: 800; line-height: 1.03; letter-spacing: -.025em; }
.tfa-root .hero h1 .accent { color: var(--mint-on-navy); }
.tfa-root .hero .lede { color: var(--on-navy-muted); font-size: 19px; margin-top: 22px; max-width: 40ch; }
.tfa-root .hero__cta { display: flex; gap: 14px; margin-top: 34px; flex-wrap: wrap; }
.tfa-root .hero__meta { margin-top: 30px; display: flex; align-items: center; gap: 14px; color: var(--on-navy-muted); font-size: 13.5px; font-family: "JetBrains Mono", monospace; }
.tfa-root .hero__meta .allocbar { width: 120px; }
@media (max-width: 940px){ .tfa-root .hero__grid { grid-template-columns: 1fr; gap: 40px; padding-block: 56px 60px; } .tfa-root .hero__shot { order: 2; } }

.tfa-root .window { border-radius: 14px; overflow: hidden; background: var(--surface); box-shadow: var(--shadow); border: 1px solid var(--line); }
.tfa-root .window--float { box-shadow: 0 40px 80px -30px rgba(0,0,0,.55), 0 8px 24px -12px rgba(0,0,0,.4); border-color: rgba(255,255,255,.08); }
.tfa-root .window__bar { height: 38px; display: flex; align-items: center; gap: 7px; padding: 0 14px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
.tfa-root .window__bar i { width: 11px; height: 11px; border-radius: 50%; background: #cfd6de; flex: none; }
.tfa-root .window__bar i:nth-child(1){ background:#ec6a5e; } .tfa-root .window__bar i:nth-child(2){ background:#f4bf4f; } .tfa-root .window__bar i:nth-child(3){ background:#61c554; }
.tfa-root .window__bar span { margin-left: 10px; font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tfa-root .window__shot { display: block; width: 100%; object-fit: cover; object-position: top; background: var(--surface); }

.tfa-root section { padding: 92px 0; }
.tfa-root .section-head { max-width: 720px; margin: 0 auto 8px; text-align: center; }
.tfa-root .section-head h2 { font-size: clamp(26px, 3.6vw, 40px); font-weight: 800; letter-spacing: -.02em; }
.tfa-root .section-head p { color: var(--muted); font-size: 18px; margin-top: 14px; }

.tfa-root .stats { padding: 30px 0; border-bottom: 1px solid var(--line); background: var(--surface); }
.tfa-root .stats__row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.tfa-root .stat { text-align: center; padding: 6px 10px; }
.tfa-root .stat b { display: block; font-family: "Manrope"; font-weight: 800; color: var(--ink); font-size: 21px; letter-spacing: -.01em; }
.tfa-root .stat span { font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
@media (max-width: 780px){ .tfa-root .stats__row { grid-template-columns: repeat(2, 1fr); gap: 18px 8px; } .tfa-root .stat:last-child { grid-column: span 2; } }

.tfa-root .feature { display: grid; grid-template-columns: 1fr 1.12fr; gap: 60px; align-items: center; }
.tfa-root .feature > * { min-width: 0; }
.tfa-root .feature + .feature { margin-top: 96px; }
.tfa-root .feature.reverse .feature__text { order: 2; }
.tfa-root .feature__text h3 { font-size: clamp(23px, 2.9vw, 33px); font-weight: 800; letter-spacing: -.015em; line-height: 1.14; }
.tfa-root .feature__text p.claim { font-size: 18px; color: var(--text); margin-top: 16px; }
.tfa-root .feature__list { list-style: none; padding: 0; margin: 24px 0 0; display: flex; flex-direction: column; gap: 13px; }
.tfa-root .feature__list li { position: relative; padding-left: 30px; color: var(--text); font-size: 15.5px; }
.tfa-root .feature__list li::before { content: ""; position: absolute; left: 0; top: 7px; width: 16px; height: 16px; border-radius: 5px; background: color-mix(in srgb, var(--mint) 18%, transparent); box-shadow: inset 0 0 0 1.5px var(--mint); }
.tfa-root .feature__list li strong { color: var(--ink); font-weight: 600; }
.tfa-root .feature__list li code { font-family: "JetBrains Mono", monospace; font-size: 13px; background: var(--surface-2); padding: 1px 6px; border-radius: 5px; }
@media (max-width: 900px){ .tfa-root .feature { grid-template-columns: 1fr; gap: 30px; } .tfa-root .feature.reverse .feature__text { order: 0; } }

.tfa-root .spotlight { background: linear-gradient(180deg, var(--navy) 0%, var(--navy-2) 100%); color: var(--on-navy); }
.tfa-root .spotlight .eyebrow { color: var(--mint-on-navy); }
.tfa-root .spotlight h2 { color: #fff; }
.tfa-root .spotlight .section-head p { color: var(--on-navy-muted); }
.tfa-root .spotlight__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; margin-top: 54px; }
.tfa-root .spotlight__grid > * { min-width: 0; }
.tfa-root .spotlight__grid .lead { color: var(--on-navy-muted); font-size: 17px; }
.tfa-root .callout { display: flex; gap: 14px; padding: 18px 20px; border: 1px solid var(--on-navy-line); border-radius: 14px; background: rgba(255,255,255,.03); margin-top: 22px; }
.tfa-root .callout .num { font-family: "Manrope"; font-weight: 800; color: var(--mint-on-navy); font-size: 30px; line-height: 1; flex: none; }
.tfa-root .callout .k { color: #fff; font-weight: 600; }
.tfa-root .callout .d { color: var(--on-navy-muted); font-size: 14.5px; margin-top: 2px; }
.tfa-root .spotlight .feature__list li { color: var(--on-navy-muted); }
.tfa-root .spotlight .feature__list li strong { color: #fff; }
.tfa-root .spotlight .feature__list li code { background: rgba(255,255,255,.08); color: var(--mint-on-navy); }
@media (max-width: 900px){ .tfa-root .spotlight__grid { grid-template-columns: 1fr; gap: 34px; } }

.tfa-root .mobile { background: var(--surface); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.tfa-root .phones { display: grid; grid-template-columns: repeat(4, 1fr); gap: 22px; margin-top: 52px; }
.tfa-root .phone { border: 8px solid var(--ink); border-radius: 30px; overflow: hidden; box-shadow: var(--shadow-sm); background: var(--ink); aspect-ratio: 390 / 844; }
.tfa-root .phone img { width: 100%; height: 100%; object-fit: cover; object-position: top; display: block; }
.tfa-root .phone-cap { text-align: center; font-family: "JetBrains Mono", monospace; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin-top: 12px; }
@media (max-width: 820px){ .tfa-root .phones { grid-template-columns: repeat(2, 1fr); gap: 26px; } }

.tfa-root .tech { text-align: center; }
.tfa-root .chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 30px; }
.tfa-root .chip { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 500; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 8px 13px; }
.tfa-root .chip b { color: var(--mint-ink); font-weight: 600; }

.tfa-root .cta { background: radial-gradient(90% 120% at 50% -20%, #1b2c44, var(--navy) 55%, var(--navy-2)); color: var(--on-navy); text-align: center; }
.tfa-root .cta h2 { color: #fff; font-size: clamp(28px, 4vw, 46px); font-weight: 800; letter-spacing: -.02em; }
.tfa-root .cta p { color: var(--on-navy-muted); font-size: 18px; margin: 16px auto 0; max-width: 46ch; }
.tfa-root .cta__buttons { display: flex; gap: 14px; justify-content: center; margin-top: 32px; flex-wrap: wrap; }
.tfa-root .foot { background: var(--navy-2); color: var(--on-navy-muted); border-top: 1px solid var(--on-navy-line); }
.tfa-root .foot__inner { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-block: 26px; font-size: 13.5px; }
.tfa-root .foot .brand { color: #fff; }
.tfa-root .foot__inner a { color: var(--on-navy-muted); text-decoration: none; }
.tfa-root .foot__inner a:hover { color: #fff; }
@media (max-width: 620px){ .tfa-root .foot__inner { flex-direction: column; text-align: center; } }

.tfa-root .reveal { opacity: 0; transform: translateY(18px); transition: opacity .7s ease, transform .7s ease; }
.tfa-root .reveal.in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .tfa-root .reveal { opacity: 1; transform: none; transition: none; } }
.tfa-root a:focus-visible, .tfa-root button:focus-visible { outline: 2px solid var(--mint); outline-offset: 3px; border-radius: 4px; }
`

const HOUSE_SVG = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" />
  </svg>
)

function AllocBar() {
  return (
    <span className="allocbar" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}

function LandingPage() {
  useEffect(() => {
    const els = document.querySelectorAll('.tfa-root .reveal')
    if (
      !('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      els.forEach((e) => e.classList.add('in'))
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('in')
            io.unobserve(en.target)
          }
        })
      },
      { threshold: 0.12 },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])

  return (
    <div className="tfa-root" id="top">
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <header className="nav">
        <div className="wrap nav__inner">
          <a
            className="brand"
            href="#top"
            aria-label="The Financial Architect — início"
          >
            <span className="mark">{HOUSE_SVG}</span>
            The Financial Architect
          </a>
          <nav className="nav__links" aria-label="Seções">
            <a href="#aporte">Simulação de aporte</a>
            <a href="#recursos">Recursos</a>
            <a href="#mobile">No celular</a>
            <a href="#tecnologia">Tecnologia</a>
          </nav>
          <div className="nav__actions">
            <a
              className="btn btn--ghost"
              href="https://github.com/allanweber/investiments-analisys"
              target="_blank"
              rel="noopener"
            >
              Ver o código
            </a>
            <a className="btn btn--primary" href="/login">
              Entrar
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="hero" style={{ padding: 0 }}>
          <div className="wrap hero__grid">
            <div>
              <p className="eyebrow on-navy">
                Alocação de carteira, do jeito certo
              </p>
              <h1>
                Seu patrimônio,
                <br />
                <span className="accent">arquitetado.</span>
              </h1>
              <p className="lede">
                O centro de comando da sua alocação que mostra{' '}
                <strong style={{ color: '#fff', fontWeight: 600 }}>
                  exatamente o que comprar no próximo aporte
                </strong>{' '}
                — valorização multimoeda, rebalanceamento por metas, pontuação
                de investimentos e um analista de IA integrado, em um único
                painel.
              </p>
              <div className="hero__cta">
                <a className="btn btn--mint" href="#aporte">
                  Ver a simulação de aporte
                </a>
                <a className="btn btn--ghost-navy" href="/login">
                  Entrar
                </a>
              </div>
              <div className="hero__meta">
                <AllocBar />
                BRL · USD · EUR
              </div>
            </div>
            <div className="hero__shot reveal">
              <div className="window window--float">
                <div className="window__bar">
                  <i />
                  <i />
                  <i />
                  <span>invest.tradefastapp.com · carteira</span>
                </div>
                <img
                  className="window__shot"
                  src="/landing/03-allocation.png"
                  alt="Alocação da carteira: percentuais atual vs alvo com análise de desvio por categoria"
                  style={{ aspectRatio: '1440 / 1180' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* STAT STRIP */}
        <div className="stats">
          <div className="wrap stats__row">
            <div className="stat">
              <b>3 moedas</b>
              <span>BRL · USD · EUR</span>
            </div>
            <div className="stat">
              <b>8 classes</b>
              <span>RF · Ações · FII · ETF · Cripto</span>
            </div>
            <div className="stat">
              <b>Cotas inteiras</b>
              <span>Rebalanceamento</span>
            </div>
            <div className="stat">
              <b>IA Claude</b>
              <span>Analista integrado</span>
            </div>
            <div className="stat">
              <b>132 testes</b>
              <span>Aprovados</span>
            </div>
          </div>
        </div>

        {/* APORTE SPOTLIGHT */}
        <section className="spotlight" id="aporte">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">O destaque · Simulação de Aporte</p>
              <h2>
                Transforme “quanto devo investir?” em uma lista de compra.
              </h2>
              <p>
                Informe um valor e receba um plano concreto e executável hoje,
                que aproxima cada classe de ativo da sua meta — em cotas
                inteiras negociáveis, não em frações impossíveis.
              </p>
            </div>
            <div className="spotlight__grid">
              <div className="reveal">
                <div className="window window--float">
                  <div className="window__bar">
                    <i />
                    <i />
                    <i />
                    <span>simulação de aporte · R$ 5.000,00</span>
                  </div>
                  <img
                    className="window__shot"
                    src="/landing/05-aporte.png"
                    alt="Simulação de aporte: projeções por categoria e sugestões em cotas inteiras, com apenas R$ 3,90 não alocados"
                    style={{ aspectRatio: '1440 / 1453' }}
                  />
                </div>
              </div>
              <div>
                <p className="lead">
                  Um algoritmo de alocação de verdade, não uma simples divisão
                  por porcentagem. Ele preenche primeiro as categorias mais
                  abaixo da meta, arredonda cada compra para cotas inteiras e
                  redistribui a sobra entre as categorias — para que quase nada
                  fique parado.
                </p>
                <div className="callout">
                  <div className="num">R$ 3,90</div>
                  <div>
                    <div className="k">
                      não alocados em um aporte de R$ 5.000
                    </div>
                    <div className="d">
                      Tudo o que <em>podia</em> ser investido, foi — a sobra é
                      só o que não compra mais uma cota inteira, mostrada de
                      forma transparente como “Não alocado”.
                    </div>
                  </div>
                </div>
                <ul className="feature__list" style={{ marginTop: 24 }}>
                  <li>
                    <strong>Cotas inteiras de verdade</strong> — o valor
                    sugerido é <code>cotas × preço</code>; nenhuma ordem
                    impossível de executar.
                  </li>
                  <li>
                    <strong>Preenchimento por nível</strong> — as maiores
                    lacunas de alocação são preenchidas primeiro, e a carteira
                    inteira converge para a meta.
                  </li>
                  <li>
                    <strong>Redistribuição da sobra</strong> — o dinheiro que
                    resta compra cotas em outros ativos; a renda fixa absorve o
                    restante enquanto está abaixo da meta.
                  </li>
                  <li>
                    <strong>Aplicar com um clique</strong> — lance a posição na
                    quantidade sugerida e salve o plano inteiro como um registro
                    somente leitura.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* RECURSOS */}
        <section id="recursos">
          <div className="wrap">
            <div className="section-head" style={{ marginBottom: 64 }}>
              <p className="eyebrow">Tudo em um só lugar</p>
              <h2>Um centro de comando para o investidor de longo prazo.</h2>
            </div>

            <div className="feature reverse">
              <div className="feature__text">
                <p className="eyebrow">Metas, não achismo</p>
                <h3>Veja exatamente o quanto você se afastou do plano.</h3>
                <p className="claim">
                  Defina uma meta em % para cada classe de ativo e o app mede a
                  realidade contra ela, continuamente.
                </p>
                <ul className="feature__list">
                  <li>
                    Atual vs projetado vs meta %, categoria por categoria.
                  </li>
                  <li>
                    Tabela de desvio com status{' '}
                    <strong>acima / abaixo da meta</strong> num relance.
                  </li>
                  <li>
                    Patrimônio total e P/L não realizado, com detalhamento por
                    moeda.
                  </li>
                </ul>
              </div>
              <div className="reveal">
                <div className="window">
                  <div className="window__bar">
                    <i />
                    <i />
                    <i />
                    <span>carteira · alocação</span>
                  </div>
                  <img
                    className="window__shot"
                    src="/landing/03-allocation.png"
                    alt="Alocação vs meta com tabela de análise de desvio"
                    style={{ aspectRatio: '1440 / 900' }}
                  />
                </div>
              </div>
            </div>

            <div className="feature">
              <div className="feature__text">
                <p className="eyebrow">Valorização ao vivo</p>
                <h3>Cada posição, valorizada ao vivo e convertida.</h3>
                <p className="claim">
                  Ações, FIIs, ETFs, ações internacionais, cripto e renda fixa —
                  uma tabela, na moeda que você escolher.
                </p>
                <ul className="feature__list">
                  <li>
                    Posições em <strong>BRL, USD e EUR</strong>, exibidas na
                    moeda nativa <em>e</em> convertidas.
                  </li>
                  <li>
                    Preço ao vivo, variação vs preço médio e status da cotação
                    por ativo.
                  </li>
                  <li>
                    Rosca de alocação e um alerta de “desvio de estratégia
                    detectado”.
                  </li>
                </ul>
              </div>
              <div className="reveal">
                <div className="window">
                  <div className="window__bar">
                    <i />
                    <i />
                    <i />
                    <span>carteira · posições</span>
                  </div>
                  <img
                    className="window__shot"
                    src="/landing/04-holdings.png"
                    alt="Tabela de posições com valorização multimoeda e rosca de alocação"
                    style={{ aspectRatio: '1440 / 1000' }}
                  />
                </div>
              </div>
            </div>

            <div className="feature reverse">
              <div className="feature__text">
                <p className="eyebrow">Qualidade dos investimentos</p>
                <h3>Pontue o que você tem com o seu próprio checklist.</h3>
                <p className="claim">
                  Cada classe de ativo tem seu questionário; respostas sim/não
                  viram uma pontuação que ordena os ativos dentro da classe.
                </p>
                <ul className="feature__list">
                  <li>
                    Banco de perguntas editável por categoria —{' '}
                    <strong>68 perguntas</strong> prontas para usar.
                  </li>
                  <li>Pontuação comparável e ranking dentro de cada classe.</li>
                  <li>
                    Detalhamento transparente do “porquê da pontuação”, pergunta
                    por pergunta.
                  </li>
                </ul>
              </div>
              <div className="reveal">
                <div className="window">
                  <div className="window__bar">
                    <i />
                    <i />
                    <i />
                    <span>investimentos · pontuação</span>
                  </div>
                  <img
                    className="window__shot"
                    src="/landing/08-scoring.png"
                    alt="Pontuação por investimento com questionário sim/não"
                    style={{ aspectRatio: '1440 / 1020' }}
                  />
                </div>
              </div>
            </div>

            <div className="feature">
              <div className="feature__text">
                <p className="eyebrow">Com ajuda de IA</p>
                <h3>Deixe o Claude ler por você.</h3>
                <p className="claim">
                  Use sua própria chave da Anthropic e deixe a IA responder o
                  checklist a partir dos fundamentos — um ativo ou uma categoria
                  inteira em lote.
                </p>
                <ul className="feature__list">
                  <li>Verificação em lote em uma classe de ativo inteira.</li>
                  <li>
                    Revise e aplique as sugestões da IA antes de elas valerem.
                  </li>
                  <li>
                    Chaves armazenadas{' '}
                    <strong>criptografadas em repouso</strong> (AES-256-GCM).
                  </li>
                </ul>
              </div>
              <div className="reveal">
                <div className="window">
                  <div className="window__bar">
                    <i />
                    <i />
                    <i />
                    <span>investimentos · verificação em lote com IA</span>
                  </div>
                  <img
                    className="window__shot"
                    src="/landing/09-ai-batch.png"
                    alt="Verificação em lote com IA entre investimentos"
                    style={{ aspectRatio: '1440 / 1000' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MOBILE */}
        <section className="mobile" id="mobile">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">Cabe no seu bolso</p>
              <h2>Todos os recursos também no celular.</h2>
              <p>
                Navegação inferior dedicada, cards em coluna única e os mesmos
                números — a partir de uma tela de 390px.
              </p>
            </div>
            <div className="phones">
              <div>
                <div className="phone">
                  <img
                    src="/landing/m1-dashboard.png"
                    alt="Início no celular"
                  />
                </div>
                <p className="phone-cap">Início</p>
              </div>
              <div>
                <div className="phone">
                  <img
                    src="/landing/m2-holdings.png"
                    alt="Posições no celular"
                  />
                </div>
                <p className="phone-cap">Posições</p>
              </div>
              <div>
                <div className="phone">
                  <img
                    src="/landing/m3-aporte.png"
                    alt="Simulação de aporte no celular"
                  />
                </div>
                <p className="phone-cap">Aporte</p>
              </div>
              <div>
                <div className="phone">
                  <img
                    src="/landing/m4-allocation.png"
                    alt="Alocação no celular"
                  />
                </div>
                <p className="phone-cap">Alocação</p>
              </div>
            </div>
          </div>
        </section>

        {/* TECNOLOGIA */}
        <section className="tech" id="tecnologia">
          <div className="wrap">
            <div className="section-head">
              <p className="eyebrow">Por baixo do capô</p>
              <h2>Type-safe, do schema ao pixel.</h2>
              <p>
                Um app full-stack moderno feito para ser correto — os dados de
                mercado são cache, não dependência, e a matemática da alocação
                tem testes.
              </p>
            </div>
            <div className="chips">
              <span className="chip">
                <b>TanStack</b> Start · SSR
              </span>
              <span className="chip">
                <b>React</b> 19
              </span>
              <span className="chip">
                <b>TypeScript</b>
              </span>
              <span className="chip">
                <b>PostgreSQL</b> · Drizzle ORM
              </span>
              <span className="chip">
                <b>Better Auth</b> · OTP · Google
              </span>
              <span className="chip">
                <b>Tailwind</b> v4 · Material 3
              </span>
              <span className="chip">
                <b>Anthropic</b> Claude SDK
              </span>
              <span className="chip">
                <b>Zod</b>
              </span>
              <span className="chip">
                <b>Vitest</b>
              </span>
              <span className="chip">
                <b>Docker</b> · quote worker
              </span>
            </div>
            <div style={{ maxWidth: 420, margin: '44px auto 0' }}>
              <AllocBar />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="cta">
          <div className="wrap">
            <p className="eyebrow" style={{ color: 'var(--mint-on-navy)' }}>
              Quando você quiser
            </p>
            <h2>Construa sua carteira com a precisão de um arquiteto.</h2>
            <p>
              Defina suas metas, valorize tudo ao vivo e deixe a simulação de
              aporte dizer o que comprar a seguir.
            </p>
            <div className="cta__buttons">
              <a className="btn btn--mint" href="/login">
                Entrar
              </a>
              <a
                className="btn btn--ghost-navy"
                href="https://github.com/allanweber/investiments-analisys"
                target="_blank"
                rel="noopener"
              >
                Ver o código
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__inner">
          <span className="brand" style={{ fontSize: 15 }}>
            <span className="mark" style={{ width: 26, height: 26 }}>
              {HOUSE_SVG}
            </span>
            The Financial Architect
          </span>
          <span>Seu patrimônio, arquitetado. · Feito com TanStack Start</span>
        </div>
      </footer>
    </div>
  )
}
