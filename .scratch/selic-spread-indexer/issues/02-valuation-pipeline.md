# Wire `selic-spread` through the valuation pipeline

Status: ready-for-agent

## Parent

`.scratch/selic-spread-indexer/PRD.md`

## What to build

Connect `selic-spread` to the BCB rate layer and persist the correct valuation. When a position uses `selic-spread`, the effective annual rate is computed as `bcbSelicAnnual + contractedSpread` and used for all valuation calculations. The contracted spread is stored in `annual_rate`; `multiplier` is `NULL`.

Specific changes:
- In `buildRendaFixaValuationRow`: for `selic-spread`, set `annualRate = rates.selicAnnual + Number(detail.annualRate)` and `indexerAnnual = selicAnnual + spread`. Do not pass a multiplier.
- In the server function's Zod schema (`indexerEnum`): add `'selic-spread'`.
- In the server function's save path: when `indexer === 'selic-spread'`, `multiplier` is not sent (remains `undefined`/`NULL` in the DB).

## Acceptance criteria

- [ ] Saving a `selic-spread` position writes `multiplier = NULL` to `renda_fixa_detail`
- [ ] `buildRendaFixaValuationRow` for a `selic-spread` detail row produces `indexerAnnual = selicAnnual + spread`
- [ ] `buildRendaFixaValuationRow` for `selic-spread` with `spread = 0` produces the same result as `indexer = 'selic'` with `multiplier = 1` (flat SELIC)
- [ ] Passing `multiplier = null` in the detail has no effect on the output (not used for `selic-spread`)
- [ ] New valuation cases covered in the existing test file alongside `renda-fixa-server.test.ts` or `renda-fixa-valuation` tests
- [ ] Existing CDI/Selic multiplier valuation tests continue to pass

## Blocked by

`.scratch/selic-spread-indexer/issues/01-calculation-layer.md`
