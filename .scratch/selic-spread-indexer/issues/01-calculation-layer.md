# Add `selic-spread` to the calculation layer

Status: ready-for-agent

## Parent

`.scratch/selic-spread-indexer/PRD.md`

## What to build

Add `'selic-spread'` as a first-class `Indexer` value in the core calculation layer. This slice covers the domain types, product rules, and calculation routing — no UI, no BCB rate fetching.

Specific changes:
- Add `'selic-spread'` to the `Indexer` union type
- Update `PRODUCT_RULES`:
  - `tesouro-selic.allowedIndexers`: replace `['selic']` with `['selic-spread']` exclusively
  - `cdb.allowedIndexers`: add `'selic-spread'` alongside existing options
- In `calculateInvestment`, route `selic-spread` to the same daily-rate branch as `selic` (calls `calculateDailyRateInvestment` with no multiplier). The caller is responsible for passing the already-resolved effective rate as `annualRate`.

## Acceptance criteria

- [ ] `Indexer` type includes `'selic-spread'`
- [ ] `calculateInvestment` with `productType = 'tesouro-selic'` and `indexer = 'selic-spread'` returns a correct gross amount given an effective annual rate
- [ ] `calculateInvestment` with `productType = 'tesouro-selic'` and `indexer = 'selic'` throws (indexer no longer allowed)
- [ ] `calculateInvestment` with `productType = 'cdb'` and `indexer = 'selic-spread'` is accepted and returns correct output
- [ ] Existing `selic` multiplier tests for `cdb` continue to pass unchanged
- [ ] All new cases covered in `products.test.ts`

## Blocked by

None — can start immediately.
