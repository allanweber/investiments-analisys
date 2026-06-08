# Form + modal UI for `selic-spread`

Status: ready-for-agent

## Parent

`.scratch/selic-spread-indexer/PRD.md`

## What to build

Expose the `selic-spread` indexer in the renda fixa modal so users can register Tesouro Selic and CDB positions with the correct additive spread structure.

Specific changes:
- Add `INDEXER_LABELS['selic-spread'] = "Selic+"` so the dropdown shows a distinct label from `"Selic"` (the multiplier variant)
- For `selic-spread`, show the spread percent-per-year input (same `PercentInput` component used by `pre`/`ipca`/`igpm`), labeled to indicate it is a spread (e.g., "Spread a.a.")
- Zero is a valid spread — exclude `selic-spread` from the `annualRate > 0` validation guard in both `saveBlockReason` and the `save()` function
- Show the BCB SELIC rate info banner for `selic-spread` (same banner as for `selic`)
- Do NOT show the multiplier input for `selic-spread`
- In the save path, do not send `multiplier` when `indexer === 'selic-spread'`

## Acceptance criteria

- [ ] Selecting "Tesouro Selic" as product type auto-selects "Selic+" as the only indexer option (no "Selic" multiplier option available)
- [ ] Selecting "CDB" shows both "Selic" (multiplier) and "Selic+" (spread) as indexer options
- [ ] When "Selic+" is selected, a spread input field is shown (percent a.a.)
- [ ] When "Selic+" is selected, the BCB SELIC rate info banner is shown
- [ ] When "Selic+" is selected, the multiplier input is not shown
- [ ] A spread value of 0 is accepted — the save button is not blocked by a "rate required" message
- [ ] A spread value > 0 (e.g., 0.05) is accepted and saved correctly
- [ ] Saving a Tesouro Selic position with "Selic+" results in a valuation row in the portfolio

## Blocked by

`.scratch/selic-spread-indexer/issues/02-valuation-pipeline.md`
