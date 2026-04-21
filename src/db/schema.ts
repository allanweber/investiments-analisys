import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// —— Better Auth (PostgreSQL) ——
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// —— Domain ——
export const investmentType = pgTable('investment_type', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** CDB, LCI, tesouro, etc.: sem cotação de mercado (brapi/yfinance). */
  fixedIncome: boolean('fixed_income').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const question = pgTable('question', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentType.id, { onDelete: 'restrict' }),
  prompt: text('prompt').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const investment = pgTable('investment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  investmentTypeId: uuid('investment_type_id')
    .notNull()
    .references(() => investmentType.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
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
      .references(() => question.id, { onDelete: 'restrict' }),
    valueYes: boolean('value_yes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.investmentId, t.questionId] })],
)

export const portfolioHolding = pgTable(
  'portfolio_holding',
  {
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    investmentId: uuid('investment_id')
      .notNull()
      .references(() => investment.id, { onDelete: 'cascade' }),
    ticker: text('ticker'),
    quantity: numeric('quantity', { precision: 24, scale: 8 }).notNull(),
    avgCost: numeric('avg_cost', { precision: 24, scale: 8 }).notNull(),
    currency: text('currency').notNull(),
    broker: text('broker'),
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
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  targets: jsonb('targets').$type<UserAllocationTargetsJson>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketQuote = pgTable(
  'market_quote',
  {
    symbol: text('symbol').primaryKey(),
    provider: text('provider').notNull(),
    market: text('market'),
    currency: text('currency'),
    logoUrl: text('logo_url'),
    price: numeric('price', { precision: 24, scale: 8 }),
    asOf: timestamp('as_of', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [],
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

export const userAllocationProfileRelations = relations(userAllocationProfile, ({ one }) => ({
  user: one(user, { fields: [userAllocationProfile.userId], references: [user.id] }),
}))
