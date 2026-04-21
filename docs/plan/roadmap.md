---

name: Product evolution roadmap
overview: Prioritized next features for your personal investment scoring app, sequenced to maximize user value while reusing the current Types/Questions/Investments/Scoring foundation.
todos:

- id: phase1-portfolio-holdings
content: Add holdings model and a portfolio overview route with allocation by type.
status: pending
- id: phase1-targets-rebalancing
content: Add per-type allocation targets and a rebalancing/new-capital suggestion view.
status: pending
- id: phase2-answer-notes
content: Add optional notes/evidence per answer and show indicators in the scoring UI and lists.
status: pending
- id: phase2-explain-ranking
content: Implement ranking explanation (drivers + impactful unanswered) for an investment and surface it on dashboard/list.
status: pending
- id: phase3-market-data
content: Introduce optional ticker + market data cache and display latest quote/fundamentals; add answer suggestions.
status: pending
- id: phase4-import-export-history
content: Add CSV import/export and score snapshots/history views.
status: pending
isProject: false

---

## Current product baseline

- **What it is now**: authenticated checklist-based scoring and ranking of investments within a “Tipo”, using active yes/no questions. Key routes: `/dashboard`, `/tipos`, `/tipos/$typeId/perguntas`, `/investimentos`, `/investimentos/$id/pontuacao` (see [C:\Users\allan\projects\investiments-analisys\src\routeTree.gen.ts](C:\Users\allan\projects\investiments-analisys\src\routeTree.gen.ts)).
- **Core scoring logic**: `computeScoreFromActiveQuestions` in [C:\Users\allan\projects\investiments-analisys\src\lib\investment-scoring.ts](C:\Users\allan\projects\investiments-analisys\src\lib\investment-scoring.ts).
- **Server CRUD + dashboard**: [C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts](C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts).
- **DB schema**: [C:\Users\allan\projects\investiments-analisys\src\db\schema.ts](C:\Users\allan\projects\investiments-analisys\src\db\schema.ts).

## Roadmap (phased, incremental)

### Phase 1: portfolio + allocation (turn rankings into actions)

- **Portfolio holdings**
  - Add holdings per investment: `ticker?`, `quantity`, `avgCost`, `currency`, `broker?`.
  - Compute: market value, unrealized P/L, allocation by type.
  - New route: `/portfolio` (overview) and `/portfolio/holdings` (table).
- **Targets & rebalancing helper**
  - Add per-type target allocation % (sum to 100) and optional max/min bands.
  - Show drift vs target, and suggest where to deploy new capital (e.g., “allocate next $X to top-ranked items in underweight types”).
  - Store targets in `user_allocation_profile` (one JSON row per `user_id`, map by `investment_type_id`).

### Phase 2 (high leverage): make scoring more “decision-grade”

- **Answer notes + evidence**
  - For each answer, allow optional `note` (short text) and `evidenceUrl`.
  - UX: a compact expandable panel per question on the scoring page; show “has note” indicator.
  - DB: extend `investment_answer` (or add `investment_answer_note` table) in [C:\Users\allan\projects\investiments-analisys\src\db\schema.ts](C:\Users\allan\projects\investiments-analisys\src\db\schema.ts).
- **Explain ranking**
  - Add a “Why is this #1?” view: top positive/negative drivers, unanswered active questions, and a short list of “unanswered that could change the ranking” (heuristic-based, since all questions are equal weight).
  - Implement as a section on `/investimentos` and `/dashboard` fed by a new server fn in [C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts](C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts).

### Phase 3: automation with market data (optional, controlled)

- **Ticker-based investments**
  - Add `ticker` field on investments (optional) and “link ticker” UI.
- **Quotes/fundamentals ingestion**
  - Background fetch + cache quotes; display last updated.
  - Use fetched metrics to *suggest* answers (never auto-answer), e.g., “P/E < 15 suggests YES for Valuation question”.
  - Implement with a server fn layer alongside your existing server fns in [C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts](C:\Users\allan\projects\investiments-analisys\src\lib\investment-server.ts), plus a `market_data_cache` table.

### Phase 4: sharing & durability

- **Import/export**
  - CSV import for investments; export types/questions/investments/scores.
- **Snapshots & history**
  - Periodic “score snapshot” table; view score trend and diffs (what changed since last snapshot).
- **Backup + share**
  - Generate shareable, read-only report (PDF/HTML) for a given type or portfolio.

## Architecture notes (how this fits your current structure)

- Keep “rules/math” pure in `src/lib/*-scoring.ts` and keep IO (db/auth) in `src/lib/*-server.ts`.
- Extend the existing route pattern in `src/routes/` and update the generated route tree.
- Ensure all new server functions continue to use `requireUserId()` and preserve your existing guardrails.

## Success metrics (personal user)

- Faster scoring: fewer clicks to complete a scoring session.
- Better confidence: notes/evidence attached to key decisions.
- Actionability: clear “what to buy next” based on targets + rankings.

## Suggested first slice (1 week)

- Add holdings fields and a `/portfolio` overview with allocation by type.
- Add per-type allocation targets (sum to 100) and show drift.
- Add a simple “deploy new capital” suggestion: underweight types → top-ranked investments.