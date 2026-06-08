# PRD: Selic + Spread Indexer

Status: ready-for-agent

## Problem Statement

Users holding Tesouro Selic positions cannot register them accurately. Tesouro Selic contracts are structured as **SELIC + a fixed annual spread** (e.g., SELIC + 0.0500% a.a.) — an additive relationship. The current system only offers a "% da Selic" (multiplicative multiplier) indexer, which is the correct structure for CDBs and similar bank products but is mathematically wrong for Tesouro Selic. There is no way to represent the additive spread, so positions are recorded with incorrect valuation parameters.

## Solution

Introduce a new `selic-spread` indexer type that models the additive structure: `effectiveRate = currentSelicRate + contractedSpread`. The contracted spread (which can be zero) is stored at purchase time; the BCB SELIC rate is always fetched live at valuation time. The existing `selic` indexer (multiplier-based) is retained for CDBs and other products that genuinely use a percentage of SELIC.

Tesouro Selic's allowed indexers are changed from `['selic']` to `['selic-spread']` exclusively. CDB gains `selic-spread` as an additional option.

## User Stories

1. As an investor holding Tesouro Selic, I want to register my position with the correct SELIC + spread structure, so that my portfolio shows an accurate valuation.
2. As an investor, I want to enter the contracted spread (e.g., +0.0500%) when registering a Tesouro Selic, so that the system knows exactly how my return is calculated.
3. As an investor, I want the spread field to accept zero, so that I can register a flat-SELIC position (spread = 0) without being blocked by a required-rate validation.
4. As an investor holding a CDB with a SELIC + spread contract, I want to be able to select the SELIC + Spread indexer for that product too, so that my CDB is also valued correctly.
5. As an investor, I want the renda fixa modal to clearly distinguish between "% da Selic" and "Selic+" indexer options, so that I choose the right structure for my product.
6. As an investor, I want the modal to show the current BCB SELIC rate when I select the Selic+ indexer, so that I understand what rate my spread will be added to.
7. As an investor, I want to register a Tesouro Selic with no maturity date (open-ended), so that secondary-market or rolling positions are supported.
8. As an investor, I want the valuation to update automatically whenever BCB changes the SELIC rate, so that my displayed balance reflects the current rate at all times.

## Implementation Decisions

- **New indexer value**: `'selic-spread'` is added to the `Indexer` union type. It is a first-class value that flows through the entire pipeline — from the form, through the server function schema, the DB column (plain text, no migration needed), the valuation builder, and into `calculateInvestment`.

- **Storage convention**: `annual_rate` stores only the **contracted spread** (e.g., `0.0005` for +0.05% a.a.). The BCB SELIC rate is always fetched live and added at valuation time. `multiplier` is `NULL` for all `selic-spread` positions, consistent with the existing convention for non-CDI/Selic indexers.

- **Effective rate computation** (in `buildRendaFixaValuationRow`):
  ```
  annualRate = bcbRates.selicAnnual + Number(detail.annualRate)
  ```
  This effective rate is passed to `calculateInvestment` as `indexer = 'selic-spread'`. `indexerAnnual` in the valuation row stores this effective rate.

- **Routing in `calculateInvestment`**: `selic-spread` routes to the same `calculateDailyRateInvestment` branch as `selic`, with no multiplier. No new calculation function is needed.

- **PRODUCT_RULES changes**:
  - `tesouro-selic.allowedIndexers`: `['selic']` → `['selic-spread']` (replace exclusively)
  - `cdb.allowedIndexers`: add `'selic-spread'` alongside existing options
  - No other products are changed in this iteration

- **Form UX**:
  - `selic-spread` shows a percent-per-year spread input (same `PercentInput` component used for `pre`/`ipca`/`igpm`), labeled to indicate it is a spread (e.g., "Spread a.a.")
  - Zero is a valid spread value — `selic-spread` is excluded from the `needsRate > 0` validation guard
  - The BCB SELIC rate info banner is shown for `selic-spread` (same as for `selic`)
  - The multiplier input is NOT shown for `selic-spread`
  - `INDEXER_LABELS['selic-spread']` = `"Selic+"` — visually distinct from `"Selic"` (multiplier)

- **No DB migration**: `indexer` is a plain `text` column. No existing `tesouro-selic` positions exist with `indexer = 'selic'` that need patching.

- **No changes** to LCI, LCA, CRI, CRA, or debenture products in this iteration.

## Testing Decisions

Good tests verify observable outputs given controlled inputs — they do not assert on internal routing or intermediate variables.

**`calculateInvestment` (products layer)** — existing test suite in `products.test.ts` is the right seam. Add cases:
- `tesouro-selic` + `selic-spread` with spread = 0 and spread > 0 produces correct gross amounts
- `tesouro-selic` + `selic` now throws (indexer no longer allowed for that product)
- `cdb` + `selic-spread` is accepted and produces correct output

**`buildRendaFixaValuationRow` (valuation builder)** — existing tests in `renda-fixa-server.test.ts` cover this seam. Add cases:
- For `selic-spread`, the BCB `selicAnnual` rate is added to the stored spread before calculation
- `indexerAnnual` in the returned row equals `selicAnnual + spread`
- `multiplier` is not used (passing `null` in detail produces the same result as not passing it)

Prior art: `renda-fixa-server.test.ts`, `products.test.ts`, `plan-cases.test.ts`.

## Out of Scope

- LCI, LCA, CRI, CRA, debenture products gaining `selic-spread`
- A proper SELIC/CDI business-day calendar (the weekday approximation remains)
- Mark-to-market for Tesouro Selic (it is already `usesMtm: false`)
- Historical spread data or spread changes over time

## Further Notes

The Brazilian fixed income market uses two distinct SELIC-linked structures:
- **% da Selic** (multiplicative): common in CDBs, e.g. "95% da Selic". Stored as `indexer = 'selic'` with a `multiplier`.
- **Selic + spread** (additive): used by Tesouro Selic and some structured products, e.g. "Selic + 0,0500% a.a.". Stored as `indexer = 'selic-spread'` with the spread in `annual_rate`.

The spread for Tesouro Selic is set at auction and printed on the investor's statement. It is typically a very small number (around 0.00%–0.10% a.a.) and can be zero.
