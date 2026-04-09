# Plano do produto — Financial Architect (ledger de investimentos)

## Visão geral

O aplicativo é um **sistema de pontuação de investimentos** para avaliar ativos (ações, fundos imobiliários, renda fixa, títulos públicos, etc.) com base em **perguntas cadastráveis por tipo de investimento** e uma regra de pontuação simples. No longo prazo, a ideia é que o investimento com melhor pontuação em cada categoria receba uma **parcela da sua meta de alocação** (percentuais que somam até 100%), aplicada sobre um **valor total** que você define no app.

Hoje o foco não é ainda a carteira com valor e quantidade nem a distribuição automática por meta — isso entra em fases posteriores.

## O que entra **agora** (MVP de pontuação)

- **Tipos de investimento** (CRUD): nome, ordem de exibição; isolados por utilizador.
- **Perguntas por tipo** (CRUD): texto, ordem, ativa/inativa; cada tipo tem o seu conjunto de perguntas.
- **Investimentos avaliados** (CRUD): nome + tipo; respostas **Sim/Não** por pergunta **ativa**;
  - **Sim** → +1, **Não** → −1; sem resposta conta como 0 na soma e aparece como não respondida na UI.
- **Ranking dentro do mesmo tipo**: ordenar por total de pontos (decrescente), desempate por nome.
- Na lista com filtro **“Todos” os tipos**, os investimentos aparecem **agrupados por tipo**; a **posição** (1.º, 2.º…) vale **só dentro de cada grupo**, porque as pontuações não são comparáveis entre tipos diferentes.

## Autenticação e dados

- **Better Auth** com **email e palavra-passe** e **Google**.
- **PostgreSQL** + **Drizzle ORM**; todas as tabelas de domínio com `user_id` (multiutilizador).

## Não perder dados sem querer

- **Eliminar um tipo** só é permitido se **não** existirem perguntas nem investimentos daquele tipo; caso contrário o sistema **bloqueia** e explica o que falta resolver.
- **Eliminar uma pergunta** com respostas gravadas é **bloqueado**; usar **inativar** a pergunta (some da pontuação e do denominador de “ativas”, mas o histórico na base pode ficar guardado).
- **Mudar o tipo de um investimento** depois de existirem respostas é **bloqueado**; pode oferecer-se duplicar o investimento noutro tipo.
- **Eliminar um investimento** continua a ser uma ação explícita do utilizador (remove esse registo e as respostas associadas).

**Nomes de investimento**: no mesmo tipo, o mesmo utilizador **pode** ter dois investimentos com o mesmo nome (não há regra de unicidade de nome por tipo).

## Primeira experiência

Após o **registo**, o sistema faz **auto-seed** dos tipos sugeridos (alinhados à visão do produto: Renda Fixa, Ações, Ações internacionais, FIIs, Cripto, REITs, Reserva de valor, etc.). Os tipos continuam editáveis pelo CRUD.

## Navegação principal (MVP)

- `**/`** redireciona para `**/dashboard`** (início com atalhos).
- **Tipos**, **Perguntas** (por tipo), **Investimentos**, **Pontuação** (por investimento) — detalhe de rotas e telas no documento técnico abaixo.

## Stack técnica (MVP)

- **TanStack Start** e ecossistema (Router, Form, Table, etc.): [TanStack Start](https://tanstack.com/start/latest)
- **Better Auth**: [documentação](https://www.better-auth.com/docs/introduction)
- **Drizzle** + **PostgreSQL**
- **shadcn/ui** + **Tailwind**; design conforme `DESIGN.md` e mocks em `design/`
- **pnpm** como gestor de pacotes
- Repositório: aplicação na **raiz** do projeto (junto de `DESIGN.md`, `design/`, `plans/`), não em `apps/web`

## Desenvolvimento local e Docker

- O `docker-compose.yml` do repositório serve para subir **só PostgreSQL** (por defeito `localhost:5432`, base `investiments`). A **aplicação corre na máquina de desenvolvimento** com `pnpm dev` (porta **3001**; alinhar `DATABASE_URL`, `BETTER_AUTH_URL` e `trustedOrigins` em `.env.local`).
- O plano técnico original previa também um serviço da app no compose; **ainda não está modelado** — para produção/VPS falta documentar ou acrescentar **`Dockerfile`** e eventual `docker-compose` de deploy. Isto não bloqueia o MVP em local.

## O que fica para **depois** deste MVP

- Metas percentuais (0–100%, soma ≤ 100%) e distribuição de valor por categoria.
- Carteira com valor atual, quantidade e “investimentos desejados” sem valor/quantidade.
- Recuperação de palavra-passe, testes automatizados amplos, provedores OAuth extra (ex.: GitHub), se fizer sentido.

## Documentação detalhada para implementação

O plano técnico passo a passo (schema, rotas, edge cases, deploy, ordem de trabalhos) está em:

- `[plans/tanstack_start_mvp_7b936246.plan.md](plans/tanstack_start_mvp_7b936246.plan.md)` — scaffolding e MVP de pontuação.
- `[plans/questions_and_scoring_f659a63c.plan.md](plans/questions_and_scoring_f659a63c.plan.md)` — banco de perguntas padrão, restaurar defaults, destaques no dashboard.

Quem for implementar deve manter estes ficheiros atualizados quando surgirem decisões novas (incluindo o frontmatter `todos` quando aplicável).