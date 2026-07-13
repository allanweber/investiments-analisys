CREATE TABLE "cap" (
	"ticker" varchar(20) NOT NULL,
	"fiscal_year" integer NOT NULL,
	"metric_label" varchar(100) NOT NULL,
	"provider" varchar(50) NOT NULL,
	"value" numeric(24, 8),
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_fundamental_ticker_fiscal_year_metric_label_pk" PRIMARY KEY("ticker","fiscal_year","metric_label")
);
--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "kind" varchar(20);--> statement-breakpoint
ALTER TABLE "question" ADD COLUMN "metric_spec" jsonb;