# Renda Fixa Calculations

Pure estimate-oriented calculations for fixed-income products.

## Recommended entry point: `calculateInvestment`

`calculateInvestment` is the high-level dispatcher. It accepts a product type by name, looks up the rf_02 tax/liquidity rules automatically, and routes to the correct underlying formula.

```ts
import { calculateInvestment } from '@/lib/renda-fixa'

// CDB prefixado — tax and IOF handled automatically
const result = calculateInvestment({
  productType: 'cdb',
  indexer: 'pre',
  capital: 10000,
  annualRate: 0.125,
  calendarDays: 737,
})
// result.netAmount ≈ 12282.14

// LCI CDI-indexada — IR-exempt, no IOF, liquidity check
const lci = calculateInvestment({
  productType: 'lci',
  indexer: 'cdi',
  capital: 10000,
  annualRate: 0.105,
  calendarDays: 180,
  businessDays: 126,
})
// lci.ir === 0, lci.liquidity.blocked === false (180d ≥ 90d carência)
```

## Product / Indexer matrix

| Product | Allowed Indexers | IR-exempt | IOF | FGC | Carência | MtM |
| --- | --- | --- | --- | --- | --- | --- |
| `cdb` | pre, cdi, selic, ipca, igpm | no | yes | yes | 0 | no |
| `lci` | pre, cdi, selic, ipca, igpm | yes | no | yes | 90d | no |
| `lca` | pre, cdi, selic, ipca, igpm | yes | no | yes | 90d | no |
| `cri` | pre, cdi, ipca, igpm | yes | no | no | ∞ (secondary) | no |
| `cra` | pre, cdi, ipca, igpm | yes | no | no | ∞ (secondary) | no |
| `tesouro-selic` | selic | no | yes | no | 0 | no |
| `tesouro-prefixado` | pre | no | yes | no | 0 | yes |
| `tesouro-ipca` | ipca | no | yes | no | 0 | yes |
| `tesouro-renda-mais` | ipca | no | yes | no | 0 | yes |
| `tesouro-educa-mais` | ipca | no | yes | no | 0 | yes |
| `debenture-incentivada` | pre, cdi, ipca, igpm | yes | no | no | 0 | no |
| `debenture-comum` | pre, cdi, ipca, igpm | no | yes | no | 0 | no |

## How rates come from the BCB server function

Live CDI/Selic/IPCA/IGPM rates are fetched from BCB SGS and cached in the `market_rate` DB table. Use `getBcbRatesFn` from `#/lib/renda-fixa-server` to get current decimals server-side:

```ts
import { getBcbRatesFn } from '@/lib/renda-fixa-server'

const rates = await getBcbRatesFn()
// rates.cdiAnnual, rates.selicAnnual, rates.ipcaAccumulated12m, rates.igpmAccumulated12m
```

Feed those decimals into `calculateInvestment`. If BCB is unreachable, hardcoded fallback constants (CDI/Selic 10.5%, IPCA 4.83%, IGPM 3.5%) are used so calculations never block.

## Low-level API (pure functions)

Use these when you need direct control:

- `calculateFixedRateInvestment(input)` — calendar-day compounding for `pre` rates
- `calculateDailyRateInvestment(input)` — business-day compounding for CDI/Selic
- `calculateVariableDailyRateInvestment(input)` — chained periods
- `calculateIndexedInvestment(input)` — IPCA/IGPM + real spread
- `calculateTreasuryMtm(input)` — Tesouro Direto mark-to-market

## Notes

- All functions are pure and stateless; rates are decimal values (e.g. `0.105` not `10.5`)
- `calculateInvestment` throws a clear `Error` on programmer error only (indexer not allowed for product, missing required field)
- `calculateIndexedInvestment` accepts either `indexRate` (single accumulated) or `monthlyRates` (chained)
- `calculateTreasuryMtm` uses `kind: 'fixed-rate'` or `kind: 'indexed'`
