---
name: UI i18n full extraction (pt-BR)
overview: "Move every user-visible string in the React app into the messages module (pt-BR first), with stable keys and optional interpolation; prepare structure for a second locale later without rewriting call sites."
todos:
  - id: i18n-conventions
    content: "Document & implement key structure, naming rules, and optional `useMessages()`/`t()` helper; split `pt-BR` by domain file if `pt-BR.ts` exceeds ~400 lines"
    status: completed
  - id: i18n-shell
    content: "AppShell (nav labels, brand, mobile bar), ThemeToggle, Footer, header-user (sign out, greetings)"
    status: completed
  - id: i18n-auth
    content: "login.tsx — titles, form labels, placeholders, buttons, errors, links, support copy"
    status: completed
  - id: i18n-dashboard-about
    content: "dashboard.tsx, about.tsx — headings, body, empty states, CTAs, stats labels"
    status: completed
  - id: i18n-tipos
    content: "tipos.tsx — remaining UI (forms, table headers, mobile cards, aria, toasts if any); already partial messages"
    status: completed
  - id: i18n-perguntas
    content: "tipos/$typeId/perguntas.tsx — remaining UI; already partial messages"
    status: completed
  - id: i18n-investimentos
    content: "investimentos.tsx — remaining UI (bulk panel, filters, table/card, actions); already partial messages"
    status: completed
  - id: i18n-pontuacao
    content: "investimentos/$id/pontuacao.tsx — row labels, buttons, summaries; already partial scoring legend"
    status: completed
  - id: i18n-shared-components
    content: "fa/details-card if any hardcoded aria; demo.FormComponents only if shipped in prod (or exclude)"
    status: completed
  - id: i18n-verify
    content: "Manual pass + optional script — grep for common Portuguese articles/prepositions in TSX strings; fix stragglers; run `pnpm test` + `pnpm exec tsc`"
    status: completed
isProject: false
---

# Plano: extrair **todas** as strings de UI para i18n (fase pt-BR)

## Objetivo

- **Nenhum texto de interface** voltado ao utilizador deve ficar como literal solto em JSX/TSX da app (exceto excepções abaixo).
- Um único módulo de verdade: **`#/messages`** (hoje `pt-BR`; mais tarde `en`, etc., com as mesmas chaves).
- Manter **acessibilidade**: `aria-label`, `title`, texto de botões de ícone, estados de `loading`/`disabled` quando forem strings.

## Fora de âmbito (explicitamente)

- Ficheiros em **`design/*.html`** (mocks estáticos).
- **`README.md`**, **`plan.md`**, comentários de código, **nomes de variáveis**.
- Mensagens **cruas** devolvidas por APIs de terceiros (ex.: erros detalhados do Google OAuth), se existirem — mapear para chave genérica na UI quando fizer sentido.
- **Conteúdo dinâmico de dados** (nomes de tipos/perguntas/investimentos introduzidos pelo utilizador).

## Nomenclatura e estrutura

### Chaves e agrupamento

Sugerido (espelha rotas + shell):

```text
messages.<domínio>.<subsecção>.<nome>
```

Domínios principais: `shell`, `auth`, `dashboard`, `about`, `tipos`, `perguntas`, `investimentos`, `pontuacao`, `common` (partilhado: `save`, `cancel`, `edit`, `delete`, `loading`, …).

### Interpolação

- Usar **funções** onde há variáveis: `deleteConfirm: (name: string) => \`…\`` (já em uso).
- Pluralização simples (ex. “1 investimento” vs “N investimentos”): função `(n: number) => string` ou duas chaves `one` / `other` se preferires explicitamente.

### Plural / `as const`

- O objeto `ptBR` pode deixar de ser `as const` global se funções e chaves dinâmicas complicarem tipos; preferir **`export type Messages = typeof ptBR`** gerado ou `satisfies` por secção.

### Ficheiros

- **Opção A**: um único `src/messages/pt-BR.ts` até ~300–400 linhas.
- **Opção B** (recomendado quando crescer): `src/messages/pt-BR/shell.ts`, `auth.ts`, … re-exportados em `src/messages/pt-BR/index.ts` e agregados em `src/messages/index.ts`.

## Ordem de migração (dependências e impacto)

1. **`common`** — botões e rótulos repetidos (`Salvar`, `Cancelar`, `Editar`, `Excluir`, `Carregando…`) para evitar duplicação antes de tocar nas rotas grandes.
2. **`shell`** — `AppShell`, `header-user`, `ThemeToggle`, `Footer`: tudo o que envolve cada página.
3. **`auth`** — `login.tsx` (fluxo isolado).
4. **`dashboard`** + **`about`** — poucos ficheiros, alto valor visual.
5. **`tipos`** → **`perguntas`** → **`investimentos`** → **`pontuacao`** — já existe uso parcial de `messages`; completar headers, tabelas, cards mobile, placeholders, `Label`s, breadcrumbs.
6. **Componentes partilhados** — `fa/details-card` apenas se tiver strings; ignorar `demo.*` em build de produção se não forem rota pública.

## Padrão de uso no código

- Import: `import { messages as m } from '#/messages'` ou `import { messages } from '#/messages'` (consistente em todo o repo).
- Evitar `messages.shell.foo` em linha gigante — desestruturar no topo do componente quando útil: `const { title } = m.investimentos.list`.
- **Server functions**: manter **códigos** (`HAS_ANSWERS`, `BAD_TYPE`, …) no servidor; mapear para `messages.*` **só na UI** (já alinhado com alertas actuais).

## Verificação (“feito está feito”)

1. **Revisão manual** rota a rota em pt-BR.
2. **Grep heurístico** (opcional): procurar padrões como `'[A-Za-zÁ-ú]'` em `src/**/*.tsx` dentro de JSX — requer filtro manual para não apanhar `className`, imports, etc. Alternativa: checklist por ficheiro no fim de cada todo.
3. **`pnpm exec tsc`** e **`pnpm test`** após cada bloco grande de mudanças.
4. Critério de aceitação: **zero literais pt-BR de produto** em `src/routes/**` e `src/components/**` (excepções documentadas), com strings apenas em `src/messages/**`.

## Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Ficheiro `pt-BR` enorme | partir por domínio + re-exports |
| Regressões de copy | diff legível; não alterar texto ao mover salvo pedido explícito |
| Chaves inconsistentes | prefixo fixo por rota; revisão no PR “i18n shell” |
| A11y esquecida | checklist `aria-label` / `title` na mesma migração |

## Depois desta fase (não obrigatório aqui)

- Segundo locale (`en`): `src/messages/en.ts` + `getMessages(locale)` a partir de cookie/`Accept-Language`.
- Formatação de datas/números com `Intl` por locale.

## Referência

- Estado actual: `src/messages/pt-BR/index.ts` + `import { messages as m } from '#/messages'` nas rotas e shell; 404 em `__root.tsx` usa `m.notFound`.

Quem implementar deve marcar os `todos` deste ficheiro como `completed` à medida que cada bloco ficar migrado e validado.
