CREATE TABLE "renda_fixa_detail" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "investment_id" uuid NOT NULL REFERENCES "investment"("id") ON DELETE CASCADE,
  "product_type" text NOT NULL,
  "indexer" text NOT NULL,
  "capital" numeric(24, 8) NOT NULL,
  "annual_rate" numeric(24, 8) NOT NULL,
  "purchase_date" timestamptz NOT NULL,
  "maturity_date" timestamptz NOT NULL,
  "multiplier" numeric(10, 6),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "investment_id")
);

CREATE TABLE "renda_fixa_valuation" (
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "investment_id" uuid NOT NULL REFERENCES "investment"("id") ON DELETE CASCADE,
  "gross_amount" numeric(24, 8) NOT NULL,
  "gross_profit" numeric(24, 8) NOT NULL,
  "iof" numeric(24, 8) NOT NULL,
  "ir" numeric(24, 8) NOT NULL,
  "net_amount" numeric(24, 8) NOT NULL,
  "net_profit" numeric(24, 8) NOT NULL,
  "net_rate" numeric(24, 8) NOT NULL,
  "calendar_days" integer NOT NULL,
  "liquidity_blocked" boolean NOT NULL,
  "carencia_days" integer,
  "liquidity_reason" text,
  "indexer_annual" numeric(24, 8),
  "computed_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "investment_id")
);
