export { calculateDailyRateInvestment, calculateVariableDailyRateInvestment, type DailyRateInvestmentInput, type VariableDailyRateInvestmentInput } from './cdi-selic'
export { calculateFixedRateInvestment, type FixedRateInvestmentInput } from './fixed-rate'
export { calculateIndexedInvestment, type IndexedInvestmentInput, type IndexedMtmInput } from './ipca'
export { calculateTreasuryMtm, type TreasuryMtmInput } from './market'
export {
  calculateInvestment,
  PRODUCT_RULES,
  type CalculateInvestmentInput,
  type InvestmentResult,
  type Indexer,
  type LiquidityInfo,
  type MtmMarketData,
  type ProductRule,
  type ProductType,
} from './products'
