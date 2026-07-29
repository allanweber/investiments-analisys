import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  varchar,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

import type {
  ContributionSuggestion,
  TypeProjection,
} from '@/lib/aporte-algorithm'

// —— Better Auth (PostgreSQL) ——
export const user = pgTable('user', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: varchar('image', { length: 2048 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  role: varchar('role', { length: 50 }),
  banned: boolean('banned').default(false),
  banReason: varchar('ban_reason', { length: 512 }),
  banExpires: timestamp('ban_expires', { withTimezone: true }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
})

export const session = pgTable('session', {
  id: varchar('id', { length: 255 }).primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: varchar('token', { length: 512 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: varchar('user_agent', { length: 1024 }),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: varchar('impersonated_by', { length: 255 }),
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
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: varchar('scope', { length: 512 }),
  password: varchar('password', { length: 256 }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = pgTable('verification', {
  id: varchar('id', { length: 255 }).primaryKey(),
  identifier: varchar('identifier', { length: 320 }).notNull(),
  value: varchar('value', { length: 512 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * kind starts `null` and is never chosen by the user — an AI classification step (see
 * `classify-question-server.ts`) fills it in the first time the question is used: 'metric'
 * (answerable deterministically from fetched financial-statement data, see ADR-0001) or
 * 'websearch' (needs the Claude web-search provider, `ai-scoring-server.ts`). Null is treated
 * the same as 'websearch' everywhere until classification succeeds.
 */
export type MetricComparator = 'gt' | 'lt'
export type MetricMode = 'level' | 'growth'
/**
 * Extracted from a question's free-text prompt by the AI classifier — supports any line item a
 * provider exposes, not a fixed list. metricLabel is matched fuzzily against whatever labels are
 * available for the ticker (e.g. "ROE", "Receita Líquida", "Dívida Líquida/Ebitda", "Margem
 * Líquida"). mode 'level' compares the reported value directly; 'growth' compares the year-over-
 * year % change of the value. windowYears null means "all available history".
 */
export type QuestionMetricSpec = {
  metricLabel: string
  mode: MetricMode
  comparator: MetricComparator
  threshold: number
  windowYears: number | null
}

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
  kind: varchar('kind', { length: 20 }),
  metricSpec: jsonb('metric_spec').$type<QuestionMetricSpec>(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const investment = pgTable(
  'investment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    investmentTypeId: uuid('investment_type_id')
      .notNull()
      .references(() => investmentType.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    /** Market symbol. Required (app-level) for non-fixed-income; optional free text for renda fixa. */
    ticker: varchar('ticker', { length: 20 }),
    /** Quote currency resolved from Yahoo at create time. Null until resolved; 'BRL' for renda fixa. */
    currency: varchar('currency', { length: 3 }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('investment_user_ticker_unique')
      .on(t.userId, t.ticker)
      .where(sql`${t.ticker} is not null`),
  ],
)

export const investmentAnswer = pgTable(
  'investment_answer',
  {
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => question.id, { onDelete: 'cascade' }),
    /** The user's real answer. Null means only an AI suggestion is on file — no answer given yet. */
    valueYes: boolean('value_yes'),
    /** Optional short user note explaining their yes/no answer. Distinct from aiReasoning (AI-generated). */
    note: varchar('note', { length: 500 }),
    /** Latest AI-suggested answer for this question, pending user review/apply. Null = no suggestion, or AI reported "unknown". */
    aiSuggestedYes: boolean('ai_suggested_yes'),
    aiReasoning: text('ai_reasoning'),
    aiCheckedAt: timestamp('ai_checked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
    avgCost: numeric('avg_cost', { precision: 24, scale: 8 }).notNull(),
    broker: varchar('broker', { length: 100 }),
    lastOperationAt: timestamp('last_operation_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
  fetchedAt: timestamp('fetched_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Global per-ticker, per-fiscal-year, per-line-item fundamentals cache (no user_id) — feeds
 * `metric`-kind Question checks. One row per (ticker, fiscalYear, metricLabel); metricLabel is
 * the raw line-item/ratio label as reported by the provider (e.g. "ROE", "Receita Líquida",
 * "Dívida Líquida/Ebitda") — not a fixed enum, so any statement line item a question references
 * can be cached. Overwritten on each refresh — see ADR-0001.
 */
export const companyFundamental = pgTable(
  'company_fundamental',
  {
    ticker: varchar('ticker', { length: 20 }).notNull(),
    fiscalYear: integer('fiscal_year').notNull(),
    metricLabel: varchar('metric_label', { length: 100 }).notNull(),
    provider: varchar('provider', { length: 50 }).notNull(),
    value: numeric('value', { precision: 24, scale: 8 }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.fiscalYear, t.metricLabel] })],
)

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
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
    computedAt: timestamp('computed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
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
  apiKeys: many(userApiKey),
}))

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}))

export const investmentTypeRelations = relations(
  investmentType,
  ({ one, many }) => ({
    user: one(user, { fields: [investmentType.userId], references: [user.id] }),
    questions: many(question),
    investments: many(investment),
  }),
)

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

export const investmentAnswerRelations = relations(
  investmentAnswer,
  ({ one }) => ({
    investment: one(investment, {
      fields: [investmentAnswer.investmentId],
      references: [investment.id],
    }),
    question: one(question, {
      fields: [investmentAnswer.questionId],
      references: [question.id],
    }),
  }),
)

export const portfolioHoldingRelations = relations(
  portfolioHolding,
  ({ one }) => ({
    user: one(user, {
      fields: [portfolioHolding.userId],
      references: [user.id],
    }),
    investment: one(investment, {
      fields: [portfolioHolding.investmentId],
      references: [investment.id],
    }),
  }),
)

export const rendaFixaDetailRelations = relations(
  rendaFixaDetail,
  ({ one }) => ({
    user: one(user, {
      fields: [rendaFixaDetail.userId],
      references: [user.id],
    }),
    investment: one(investment, {
      fields: [rendaFixaDetail.investmentId],
      references: [investment.id],
    }),
  }),
)

export const rendaFixaValuationRelations = relations(
  rendaFixaValuation,
  ({ one }) => ({
    user: one(user, {
      fields: [rendaFixaValuation.userId],
      references: [user.id],
    }),
    investment: one(investment, {
      fields: [rendaFixaValuation.investmentId],
      references: [investment.id],
    }),
  }),
)

export const userAllocationProfileRelations = relations(
  userAllocationProfile,
  ({ one }) => ({
    user: one(user, {
      fields: [userAllocationProfile.userId],
      references: [user.id],
    }),
  }),
)

/** LLM providers a user can store an API key for. Only 'claude' is wired to any real usage today. */
export const aiProvider = ['claude', 'openai', 'gemini'] as const
export type AiProvider = (typeof aiProvider)[number]

export const userApiKey = pgTable(
  'user_api_key',
  {
    userId: varchar('user_id', { length: 255 })
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 20 }).$type<AiProvider>().notNull(),
    /** AES-256-GCM ciphertext, base64: iv + authTag + encrypted key. */
    encryptedKey: varchar('encrypted_key', { length: 2048 }).notNull(),
    /** Last 4 chars of the plaintext key, shown as a masked hint in the UI. */
    lastFour: varchar('last_four', { length: 4 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.provider] })],
)

export const userApiKeyRelations = relations(userApiKey, ({ one }) => ({
  user: one(user, { fields: [userApiKey.userId], references: [user.id] }),
}))

/**
 * Frozen snapshot of a computed aporte simulation, saved for future reference.
 * `snapshot` captures the exact suggestions/projections as shown (prices, units, %),
 * the input (amount/currency/exclusions) and which rows were "Aportado" at save time.
 * It is never recomputed — history is a read-only record.
 */
export type AporteRunSnapshot = {
  input: {
    amount: number
    currency: string
    excludedInvestmentIds: string[]
  }
  suggestions: ContributionSuggestion[]
  typeProjections: TypeProjection[]
  unallocatedAmount: number
  /** investmentIds marked Aportado when the run was saved. */
  appliedInvestmentIds: string[]
}

export const aporteRun = pgTable('aporte_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 })
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  /** User-provided label; defaults (client-side) to "date · amount". */
  name: varchar('name', { length: 200 }).notNull(),
  amount: numeric('amount', { precision: 24, scale: 8 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull(),
  /** When the simulation was run (mirrors createdAt at save time). */
  simulatedAt: timestamp('simulated_at', { withTimezone: true }).notNull(),
  snapshot: jsonb('snapshot').$type<AporteRunSnapshot>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const aporteRunRelations = relations(aporteRun, ({ one }) => ({
  user: one(user, { fields: [aporteRun.userId], references: [user.id] }),
}))
