CREATE TABLE "fx_rate" (
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"provider" text NOT NULL,
	"yahoo_symbol" text NOT NULL,
	"rate" numeric(24, 8) NOT NULL,
	"as_of" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rate_base_currency_quote_currency_pk" PRIMARY KEY("base_currency","quote_currency")
);
