import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  varchar,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// —— Better Auth (PostgreSQL) ——
export const user = pgTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: varchar('image', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: varchar('token', { length: 512 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 1024 }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: varchar('id', { length: 255 }).primaryKey(),
  accountId: varchar('account_id', { length: 256 }).notNull(),
  providerId: varchar('provider_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: varchar('access_token', { length: 4096 }),
  refreshToken: varchar('refresh_token', { length: 4096 }),
  idToken: varchar('id_token', { length: 4096 }),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: varchar('scope', { length: 512 }),
  password: varchar('password', { length: 256 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 320 }).notNull(),
  value: varchar('value', { length: 512 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// —— Domain ——
export const investmentType = pgTable('investment_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  /** CDB, LCI, tesouro, etc.: sem cotação de mercado (brapi/yfinance). */
  fixedIncome: boolean('fixed_income').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const question = pgTable('question', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentType.id, { onDelete: 'cascade' }),
  prompt: varchar('prompt', { length: 500 }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const investment = pgTable('investment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentType.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const investmentAnswer = pgTable(
  'investment_answer',
  {
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.id, { onDelete: 'cascade' }),
    valueYes: boolean('value_yes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.investmentId, t.questionId] })],
)

export const portfolioHolding = pgTable(
  'portfolio_holding',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    ticker: varchar('ticker', { length: 20 }),
    quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
    avgCost: numeric('avg_cost', { precision: 24, scale: 8 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull(),
    broker: varchar('broker', { length: 100 }),
    lastOperationAt: timestamp('last_operation_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.investmentId] })],
)

/** Per–investment-type targets for a user (keys = investment_type UUID strings). */
export type UserAllocationTargetsJson = Record<
  string,
  { targetPct: number; minPct?: number | null; maxPct?: number | null }
>

export const userAllocationProfile = pgTable('user_allocation_profile', {
  userId: varchar('user_id', { length: 255 })
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  targets: jsonb('targets').$type<UserAllocationTargetsJson>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketQuote = pgTable(
  'market_quote',
  {
    symbol: varchar('symbol', { length: 30 }).primaryKey(),
    provider: varchar('provider', { length: 50 }).notNull(),
    market: varchar('market', { length: 50 }),
    currency: varchar('currency', { length: 3 }),
    logoUrl: varchar('logo_url', { length: 2048 }),
    price: numeric('price', { precision: 24, scale: 8 }),
    asOf: timestamp('as_of', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
)

/** Global FX cache (no user_id). Worker refreshes; app reads only. */
export const fxRate = pgTable(
  'fx_rate',
  {
    baseCurrency: varchar('base_currency', { length: 3 }).notNull(),
    quoteCurrency: varchar('quote_currency', { length: 3 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    yahooSymbol: varchar('yahoo_symbol', { length: 30 }).notNull(),
    rate: numeric('rate', { precision: 24, scale: 8 }).notNull(),
    asOf: timestamp('as_of', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.baseCurrency, t.quoteCurrency] })],
)

/** Global BCB indexer cache (no user_id). Series: cdi | selic | ipca | igpm. */
export const marketRate = pgTable('market_rate', {
  series: varchar('series', { length: 30 }).primaryKey(),
  provider: varchar('provider', { length: 50 }).notNull(),
  annual: numeric('annual', { precision: 24, scale: 8 }),
  monthly: jsonb('monthly'),
  accumulated12m: numeric('accumulated_12m', { precision: 24, scale: 8 }),
  asOf: timestamp('as_of', { withTimezone: true }),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * Fixed-income contract terms stored at purchase time.
 * Child of portfolio_holding — shares the same (user_id, investment_id) composite key.
 * annualRate meaning depends on indexer:
 *   pre        → contracted fixed annual rate (e.g. 0.14 = 14% a.a.)
 *   cdi/selic  → 0 (unused; BCB rate is used at valuation time); contracted terms live in multiplier
 *   ipca/igpm  → real annual spread (e.g. 0.06 = IPCA + 6%)
 * multiplier is only set for CDI/Selic products (e.g. 1.10 = 110% CDI).
 * carenciaDays = Infinity products store multiplier = null; secondary-market-only is captured in valuation.
 */
export const rendaFixaDetail = pgTable(
  'renda_fixa_detail',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    productType: varchar('product_type', { length: 50 }).notNull(),
    indexer: varchar('indexer', { length: 30 }).notNull(),
    capital: numeric('capital', { precision: 24, scale: 8 }).notNull(),
    annualRate: numeric('annual_rate', { precision: 24, scale: 8 }).notNull(),
    purchaseDate: timestamp('purchase_date', { withTimezone: true }).notNull(),
    maturityDate: timestamp('maturity_date', { withTimezone: true }),
    /** CDI multiplier (e.g. 1.10 = 110% CDI). Null for non-CDI/Selic indexers. */
    multiplier: numeric('multiplier', { precision: 10, scale: 6 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.investmentId] })],
)

/**
 * Latest computed snapshot of a fixed-income position's return and tax breakdown.
 * Overwritten on each valuation run — not an append-only log.
 * carenciaDays = null means secondary-market-only (Infinity in the domain model).
 */
export const rendaFixaValuation = pgTable(
  'renda_fixa_valuation',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    grossAmount: numeric('gross_amount', { precision: 24, scale: 8 }).notNull(),
    grossProfit: numeric('gross_profit', { precision: 24, scale: 8 }).notNull(),
    iof: numeric('iof', { precision: 24, scale: 8 }).notNull(),
    ir: numeric('ir', { precision: 24, scale: 8 }).notNull(),
    netAmount: numeric('net_amount', { precision: 24, scale: 8 }).notNull(),
    netProfit: numeric('net_profit', { precision: 24, scale: 8 }).notNull(),
    netRate: numeric('net_rate', { precision: 24, scale: 8 }).notNull(),
    calendarDays: integer('calendar_days').notNull(),
    liquidityBlocked: boolean('liquidity_blocked').notNull(),
    /** Null means secondary-market-only (carencia = Infinity). */
    carenciaDays: integer('carencia_days'),
    liquidityReason: varchar('liquidity_reason', { length: 100 }),
    /** BCB annual rate used at compute time (CDI, Selic, IPCA-12m, or IGP-M-12m). Null for prefixado. */
    indexerAnnual: numeric('indexer_annual', { precision: 24, scale: 8 }),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.investmentId] })],
)

export const userRelations = relations(user, ({ many, one }) => ({
  sessions: many(session),
  accounts: many(account),
  investmentTypes: many(investmentType),
  questions: many(question),
  investments: many(investment),
  holdings: many(portfolioHolding),
  allocationProfile: one(userAllocationProfile, {
    fields: [user.id],
    references: [userAllocationProfile.userId],
  }),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const investmentTypeRelations = relations(investmentType, ({ one, many }) => ({
  user: one(user, { fields: [investmentType.userId], references: [user.id] }),
  questions: many(question),
  investments: many(investment),
}))

export const questionRelations = relations(question, ({ one, many }) => ({
  user: one(user, { fields: [question.userId], references: [user.id] }),
  investmentType: one(investmentType, {
    fields: [question.investmentTypeId],
    references: [investmentType.id],
  }),
  answers: many(investmentAnswer),
}))

export const investmentRelations = relations(investment, ({ one, many }) => ({
  user: one(user, { fields: [investment.userId], references: [user.id] }),
  investmentType: one(investmentType, {
    fields: [investment.investmentTypeId],
    references: [investmentType.id],
  }),
  answers: many(investmentAnswer),
  holding: many(portfolioHolding),
}))

export const investmentAnswerRelations = relations(investmentAnswer, ({ one }) => ({
  investment: one(investment, {
    fields: [investmentAnswer.investmentId],
    references: [investment.id],
  }),
  question: one(question, {
    fields: [investmentAnswer.questionId],
    references: [question.id],
  }),
}))

export const portfolioHoldingRelations = relations(portfolioHolding, ({ one }) => ({
  user: one(user, { fields: [portfolioHolding.userId], references: [user.id] }),
  investment: one(investment, {
    fields: [portfolioHolding.investmentId],
    references: [investment.id],
  }),
}))

export const rendaFixaDetailRelations = relations(rendaFixaDetail, ({ one }) => ({
  user: one(user, { fields: [rendaFixaDetail.userId], references: [user.id] }),
  investment: one(investment, { fields: [rendaFixaDetail.investmentId], references: [investment.id] }),
}))

export const rendaFixaValuationRelations = relations(rendaFixaValuation, ({ one }) => ({
  user: one(user, { fields: [rendaFixaValuation.userId], references: [user.id] }),
  investment: one(investment, { fields: [rendaFixaValuation.investmentId], references: [investment.id] }),
}))

export const userAllocationProfileRelations = relations(userAllocationProfile, ({ one }) => ({
  user: one(user, { fields: [userAllocationProfile.userId], references: [user.id] }),
}))
