# Renda Fixa Calculations

Pure calculations for fixed-income products.

## Goal

Provide standalone functions to calculate:

- gross return
- net return
- income tax
- IOF tax
- mark-to-market values
- fixed-rate, CDI/Selic, and IPCA/IGPM products

No API calls are performed here.

## Conventions

- rates are decimal values, not text percentages
- `0.105` = 10.5% per year
- `calendarDays` = calendar days
- `businessDays` = business days
- functions are pure and stateless

## Files

- `core.ts`: IR, IOF, compound interest, and shared helpers
- `fixed-rate.ts`: fixed-rate products and wrappers
- `cdi-selic.ts`: CDI, Selic, and variable-period products
- `ipca.ts`: IPCA+, IGPM+, and variable-index products
- `market.ts`: mark-to-market for Treasury fixed-rate and IPCA products
- `index.ts`: public exports

## Public API

### Core

- `getIrRateByDays(calendarDays)`
- `getIofRateByDays(calendarDays)`
- `compoundByAnnualRate(capital, annualRate, calendarDays)`
- `compoundByDailyRate(capital, dailyRate, businessDays)`
- `compoundChain(capital, periods)`
- `buildTaxBreakdown(input)`

### Fixed rate

- `calculateFixedRateInvestment(input)`
- `calculateFixedRateEarlyRedemption(input)`
- `calculateFixedRateCdbInvestment(input)`
- `calculateFixedRateLciInvestment(input)`
- `calculateFixedRateLcaInvestment(input)`
- `calculateFixedRateCriInvestment(input)`
- `calculateFixedRateCraInvestment(input)`
- `calculateTreasuryFixedRateInvestment(input)`

### CDI / Selic

- `calculateCdiInvestment(input)`
- `calculateSelicInvestment(input)`
- `calculateVariableCdiSelicInvestment(input)`
- `calculateCdbFromCdiInvestment(input)`
- `calculateLciFromCdiInvestment(input)`
- `calculateLcaFromCdiInvestment(input)`
- `calculateCriFromCdiInvestment(input)`
- `calculateCraFromCdiInvestment(input)`
- `calculateTreasurySelicInvestment(input)`

### IPCA / IGPM

- `calculateIpcaPlusInvestment(input)`
- `calculateIgpmPlusInvestment(input)`
- `calculateVariableIpcaInvestment(input)`
- `calculateCdbFromIpcaInvestment(input)`
- `calculateLciFromIpcaInvestment(input)`
- `calculateLcaFromIpcaInvestment(input)`
- `calculateCriFromIpcaInvestment(input)`
- `calculateCraFromIpcaInvestment(input)`
- `calculateCraFromIgpmInvestment(input)`
- `calculateTreasuryIpcaInvestment(input)`
- `calculateTreasuryIncomeAAccumulation(input)`
- `calculateTreasuryEducationAccumulation(input)`

### Mark-to-market

- `calculateTreasuryFixedRateMtm(input)`
- `calculateTreasuryIpcaMtm(input)`

## Default return shape

Functions return objects with fields such as:

- `grossAmount`
- `grossProfit`
- `iof`
- `ir`
- `netAmount`
- `netProfit`
- `grossRate`
- `netRate`

Some functions also return:

- `purchasePrice`
- `marketPrice`
- `units`
- `vnaFinal`
- `daysRemaining`
- `taxBreakdown`

## Tax rules

- income tax applies to profit, not principal
- IOF applies only before 30 calendar days
- tax-exempt products return `ir = 0`
- mark-to-market losses do not generate income tax

## Examples

```ts
import { calculateTreasurySelicInvestment } from '#/lib/renda-fixa'

const result = calculateTreasurySelicInvestment({
  capital: 1000,
  annualSelicRate: 0.105,
  businessDays: 252,
  calendarDays: 365,
})

console.log(result.netAmount)
```

```ts
import { calculateIpcaPlusInvestment } from '#/lib/renda-fixa'

const result = calculateIpcaPlusInvestment({
  capital: 1000,
  indexRate: 0.0483,
  realAnnualRate: 0.06,
  businessDays: 252,
  calendarDays: 365,
  hasIof: true,
  isTaxExempt: false,
})
```

## Tests

Coverage lives in:

- `core.test.ts`
- `fixed-rate.test.ts`
- `cdi-selic.test.ts`
- `ipca.test.ts`
- `market.test.ts`
