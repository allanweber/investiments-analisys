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

### 5. `renda-fixa/` math is not yet wired into valuation
The library (`src/lib/renda-fixa/`) has full formulas for prefixado, CDI, and IPCA products. It is **not** called by `portfolio-valuation.ts` yet. Wiring it requires a DB schema extension on `portfolio_holding` (maturity date, rate, index type, face value) — that migration is pending.

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

2. **Renda-fixa valuation wiring** — pending a `portfolio_holding` schema extension to store fixed-income parameters (rate, index, maturity, face value). Once the migration lands, `portfolio-valuation.ts` can call into `src/lib/renda-fixa/` for mark-to-model pricing instead of book value.
