# Project Context

> This file is written for AI assistants (Claude Code sessions). It captures non-obvious invariants, conventions, and domain knowledge that cannot be inferred from code alone.

---

## What this app does

A Brazilian personal investment portfolio tool. Two main capabilities:

1. **Investment scoring / ranking** — the user defines *InvestmentTypes* (e.g. "Ações BR", "FIIs", "Renda Fixa"), attaches yes/no *Questions* to each type, and scores individual *Investments* against those questions. The score drives a ranking within each type.

2. **Portfolio holdings** — the user records positions (*PortfolioHoldings*: ticker, quantity, avgCost, currency, broker). The app fetches market quotes and FX rates, computes market value and unrealized P&L, shows allocation vs. user-defined targets, drift analysis, and contribution suggestions.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | TanStack Start (React 19, SSR via Nitro) |
| Routing | TanStack Router (file-based, `src/routes/`) |
| Server functions | `createServerFn` from `@tanstack/react-start` |
| ORM | Drizzle ORM — PostgreSQL |
| Auth | Better Auth (email OTP) |
| Styling | Tailwind CSS v4 + custom Material Design 3 tokens (`--fa-*` CSS vars in `src/styles.css`) |
| Icons | Material Symbols (loaded via Google Fonts) |
| Tests | Vitest |
| Dev server | `pnpm dev` → port 3002 |

---

## Domain glossary

| Term | Meaning |
|---|---|
| **InvestmentType** / tipo | Category of investment (e.g. "Ações BR", "FIIs", "Renda Fixa") |
| **Investment** / investimento | A named asset belonging to a type |
| **Question** / pergunta | A yes/no scoring criterion attached to a type |
| **Answer** / resposta | A user's yes/no answer for a specific investment × question |
| **Score** / pontuação | % of yes answers out of active questions (0–100) |
| **PortfolioHolding** / posição | A position: ticker + qty + avgCost + currency + broker |
| **AllocationTarget** / meta | User-defined target % per type (stored as JSON in `user_allocation_profile`) |
| **Drift** | delta between current allocation % and target % |
| **Aporte** | A contribution / new purchase |
| **Renda Fixa** | Fixed income (CDB, LCI, Tesouro, etc.) — no market quote; valued at book |
| **CDI / Selic / IPCA** | Brazilian benchmark rates fetched from BCB |
| **MarketQuote** | Cached ticker price (provider: brapi or yfinance) |
| **FxRate** | Cached currency pair rate (provider: yfinance / Yahoo Finance) |
| **MarketRate** | Cached BCB indexer rate (CDI, Selic, IPCA, IGP-M) |
| **RendaFixaDetail** | Fixed-income contract terms stored at purchase: productType, indexer, capital, contractedRate, purchaseDate, maturityDate, multiplier. Child of PortfolioHolding — shares the same (userId, investmentId) composite key. |
| **RendaFixaValuation** | Latest computed snapshot of a fixed-income position's gross/net return, tax breakdown (IOF + IR), and liquidity status. Overwritten on each valuation run using current BCB rates. |
| **ProductType** | One of 12 fixed-income product codes: cdb · lci · lca · cri · cra · tesouro-selic · tesouro-prefixado · tesouro-ipca · tesouro-renda-mais · tesouro-educa-mais · debenture-incentivada · debenture-comum |
| **Indexer** | Rate index used for a renda fixa product: pre · cdi · selic · ipca · igpm |
| **Multiplier** | CDI/Selic multiplier stored in RendaFixaDetail (e.g. 1.10 = 110% CDI). Null for non-CDI/Selic indexers. |
| **AporteSimulation** / simulação de aporte | A one-shot calculation that distributes a contribution amount across investments based on allocation drift. Input: currency + amount. Output: list of ContributionSuggestions. |
| **ContributionSuggestion** | One line in an AporteSimulation result: investment name, suggested amount (in the asset's native currency), and % of total contribution. |
| **EligibleInvestment** | An investment with score > 0 within an under-allocated type. Only eligible investments receive contribution allocation. |
| **PriorityInvestment** | An eligible investment with score ≥ 60 (PRIORITY_SCORE_THRESHOLD). When any priority investments exist in a type, only they receive allocation for that type. |

---

## Module map

```
src/
├── routes/                         Pages (TanStack Router file-based)
│   ├── dashboard.tsx               Summary counts + top-scored investments
│   ├── investimentos.tsx           Full investment list + ranking
│   ├── investimentos/$id/pontuacao.tsx   Per-investment Q&A scoring form
│   ├── tipos.tsx                   InvestmentType CRUD
│   ├── tipos/$typeId/perguntas.tsx Questions CRUD for a type
│   ├── portfolio.tsx               Overview: totals, allocation, drift, suggestions
│   └── portfolio/holdings.tsx      Holdings list — add / edit / delete positions
│
├── lib/
│   ├── investment-server.ts        ALL server functions (RPC layer) — see below
│   ├── renda-fixa-server.ts        Renda fixa CRUD + valuation RPC (getBcbRatesFn, upsertRendaFixaHoldingFn, deleteRendaFixaHoldingFn, listRendaFixaHoldingsFn, refreshRendaFixaValuationsFn)
│   ├── portfolio-valuation.ts      valueHolding() pure fn — BOOK_VALUE | MISSING_TICKER | MISSING_QUOTE | OK
│   ├── investment-scoring.ts       computeScoreFromActiveQuestions(), compareInvestmentsByRank()
│   ├── fx/                         Currency conversion (convert, load, constants)
│   ├── market-data/
│   │   ├── quote-refresh.ts        refreshMarketQuotesForInputs() → writes MarketQuote cache
│   │   ├── fx-refresh.ts           ensureFxRatesForDisplay() → writes FxRate cache
│   │   ├── bcb-refresh.ts          BCB indexer → writes MarketRate cache
│   │   └── providers/              brapi.ts · yfinance.ts · bcb.ts
│   └── renda-fixa/                 Fixed-income math library (prefixado, CDI, IPCA)
│       ├── core.ts                 Primitives
│       ├── fixed-rate.ts           Prefixado formulas
│       ├── cdi-selic.ts            CDI / Selic-linked formulas
│       ├── ipca.ts                 IPCA-linked formulas
│       ├── products.ts             Product definitions
│       └── market.ts               Market rate helpers
│
├── db/
│   ├── schema.ts                   Drizzle schema (single source of truth)
│   ├── index.ts                    DB client (server-only)
│   ├── browser-stub.ts             Null stub — resolves #/db on the client bundle
│   └── default-question-bank.ts   Seed question prompts per type name
│
├── components/
│   ├── portfolio/                  Portfolio overview widgets
│   └── portfolio/holdings/         Holdings page components + hooks + modals (active work)
│
└── scripts/
    └── quote-worker.ts             Scheduled background worker — refreshes quotes + FX rates
```

---

## Server functions (`src/lib/investment-server.ts`)

All RPC calls go through `createServerFn`. The file is the single server boundary.

**InvestmentType:** `listInvestmentTypesWithCounts` · `createInvestmentTypeFn` · `updateInvestmentTypeFn` · `deleteInvestmentTypeFn` · `listInvestmentTypesOptionsFn`

**Questions:** `listQuestionsForTypeFn` · `createQuestionFn` · `updateQuestionFn` · `deleteQuestionFn` · `restoreDefaultQuestionsForTypeFn`

**Investments:** `listInvestmentsOverviewFn` · `createInvestmentFn` · `createInvestmentsBulkFn` · `updateInvestmentFn` · `deleteInvestmentFn` · `loadInvestmentScoringFn` · `saveInvestmentScoringFn`

**Portfolio holdings:** `listPortfolioCurrenciesFn` · `listPortfolioHoldingsFn` · `upsertPortfolioHoldingFn` · `deletePortfolioHoldingFn` · `refreshPortfolioQuotesFn`

**Allocation targets:** `listAllocationTargetsFn` · `upsertAllocationTargetFn` · `saveAllocationTargetsBulkFn`

**Portfolio overview:** `loadPortfolioOverviewFn` → `{ totals, byNativeCurrency, allocation, targets, drift, suggestions }`

---

## Key invariants — read before touching anything

### 1. Never import `#/db` at the top level of server files
```ts
// ✅ correct — lazy import
async function getDb() {
  return (await import('#/db')).db
}

// ❌ wrong — bundles pg into the client chunk
import { db } from '#/db'
```
The `viteDbClientStub` Vite plugin resolves `#/db` to a null stub on the client. A top-level import defeats this and breaks Better Auth at runtime.

### 2. `isFixedIncomeTipo` checks both the flag AND the type name
```ts
// src/lib/portfolio-valuation.ts
export function isFixedIncomeTipo(fixedIncome: boolean, typeName: string | null | undefined): boolean {
  if (fixedIncome) return true
  return (typeName ?? '').trim().toLowerCase() === 'renda fixa'
}
```
Do not simplify to just `fixedIncome`. Legacy holdings may have types named "Renda Fixa" with the flag unset.

### 3. Fixed-income holdings are valued at book value — no market quote
`valueHolding()` short-circuits for fixed income: `marketValue = quantity × avgCost`, `unrealizedPl = 0`, `quoteStatus = 'BOOK_VALUE'`. Do not try to fetch a quote for them.

### 4. Holding currency is locked after the first upsert
In `upsertPortfolioHoldingFn`, when an existing holding is found the incoming currency is ignored — the stored currency is kept. To change denomination the holding must be deleted and re-created.

### 5. Renda fixa valuation uses a child-table pattern, not a `portfolio_holding` extension
Fixed-income contract terms live in `renda_fixa_detail` (child of `portfolio_holding`, same composite PK). Computed returns are cached in `renda_fixa_valuation`. Both tables cascade on `investment.id` deletion but have **no FK to `portfolio_holding`** — deleting a renda fixa holding via `deleteRendaFixaHoldingFn` explicitly removes all three rows in order: valuation → detail → holding.

### 6. `renda_fixa_detail.annualRate` meaning depends on indexer
- `pre`: contracted fixed annual rate (e.g. 0.14 = 14% a.a.)
- `cdi` / `selic`: store 0; the current BCB rate is substituted at valuation time (these products float)
- `ipca` / `igpm`: real annual spread (e.g. 0.06 = IPCA + 6%)

### 7. Business day approximation
`computeAndSaveValuation` (in `renda-fixa-server.ts`) derives `businessDays` from a weekday-only calendar — no Brazilian national holiday table is available yet. The 252-day convention used in `calculateInvestment` absorbs this imprecision for display purposes.

### 8. BCB rate refresh is staleness-gated
`refreshBcbRatesIfStale` (in `bcb-refresh.ts`) no-ops when the cache is fresh (default TTL: 24h, overridable via `BCB_REFRESH_HOURS`). It is called by `upsertRendaFixaHoldingFn` and `refreshRendaFixaValuationsFn`, and once per sweep in `quote-worker.ts`. Never force-refresh on every insert to avoid BCB rate-limiting.

---

## Language rules

| What | Language |
|---|---|
| Code identifiers, comments | English |
| User-visible strings in JSX | Portuguese (pt-BR), routed through `src/messages/pt-BR/index.ts` |
| Brazilian finance terms in code | Use as-is (CDI, IPCA, Selic, renda fixa, aporte, etc.) — no English translation |

No hardcoded PT strings directly in JSX. Always use the messages object: `import { messages as m } from '#/messages'`.

---

## Design system

Tailwind CSS v4 with Material Design 3 color tokens defined as CSS vars in `src/styles.css`. Use the semantic token names, not raw hex values:

- Surfaces: `surface`, `surface-variant`, `surface-container`, `surface-container-high`, etc.
- Content: `on-surface`, `on-surface-variant`, `on-primary`, `on-error`, etc.
- Roles: `primary`, `secondary`, `tertiary`, `error`, `outline`, `outline-variant`
- Allocation swatches: `--fa-alloc-1` … `--fa-alloc-12` (paired by hue for donut chart)

Headings use `font-headline` (Manrope). Body uses Inter.

---

## Commands

```bash
pnpm dev          # dev server on :3002
pnpm test         # vitest run (unit tests — renda-fixa, fx, scoring)
pnpm lint         # eslint
pnpm check        # prettier --write + eslint --fix
pnpm db:generate  # drizzle-kit generate (after schema changes)
pnpm db:migrate   # apply migrations
pnpm db:studio    # Drizzle Studio GUI
pnpm quote-worker # run quote worker manually (tsx)
```

Unit tests cover pure math only (`src/lib/renda-fixa/`, `src/lib/fx/`, `src/lib/investment-scoring.ts`). UI changes require manual browser verification.

---

## Active work (as of last session)

1. **Holdings page** (`src/components/portfolio/holdings/`) — UI for listing, adding, editing, and deleting portfolio positions. Components, hooks, and modals are staged but not yet committed.

2. **Renda fixa backend** — `renda_fixa_detail` and `renda_fixa_valuation` tables added (migration: `drizzle/0005_renda_fixa.sql`). Server actions live in `src/lib/renda-fixa-server.ts`. BCB rate refresh wired into quote-worker sweep. Screens not yet created.
