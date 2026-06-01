CREATE TABLE "market_rate" (
	"series" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"annual" numeric(24, 8),
	"monthly" jsonb,
	"accumulated_12m" numeric(24, 8),
	"as_of" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
