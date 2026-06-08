CREATE TABLE "renda_fixa_detail" (
	"user_id" varchar(255) NOT NULL,
	"investment_id" uuid NOT NULL,
	"product_type" varchar(50) NOT NULL,
	"indexer" varchar(30) NOT NULL,
	"capital" numeric(24, 8) NOT NULL,
	"annual_rate" numeric(24, 8) NOT NULL,
	"purchase_date" timestamp with time zone NOT NULL,
	"maturity_date" timestamp with time zone,
	"multiplier" numeric(10, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renda_fixa_detail_user_id_investment_id_pk" PRIMARY KEY("user_id","investment_id")
);
--> statement-breakpoint
CREATE TABLE "renda_fixa_valuation" (
	"user_id" varchar(255) NOT NULL,
	"investment_id" uuid NOT NULL,
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
	"liquidity_reason" varchar(100),
	"indexer_annual" numeric(24, 8),
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "renda_fixa_valuation_user_id_investment_id_pk" PRIMARY KEY("user_id","investment_id")
);
--> statement-breakpoint
ALTER TABLE "investment" DROP CONSTRAINT "investment_investment_type_id_investment_type_id_fk";
--> statement-breakpoint
ALTER TABLE "investment_answer" DROP CONSTRAINT "investment_answer_question_id_question_id_fk";
--> statement-breakpoint
ALTER TABLE "question" DROP CONSTRAINT "question_investment_type_id_investment_type_id_fk";
--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "account_id" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "provider_id" SET DATA TYPE varchar(64);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "access_token" SET DATA TYPE varchar(4096);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "refresh_token" SET DATA TYPE varchar(4096);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "id_token" SET DATA TYPE varchar(4096);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "scope" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "password" SET DATA TYPE varchar(256);--> statement-breakpoint
ALTER TABLE "fx_rate" ALTER COLUMN "base_currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "fx_rate" ALTER COLUMN "quote_currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "fx_rate" ALTER COLUMN "provider" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "fx_rate" ALTER COLUMN "yahoo_symbol" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "investment" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "investment" ALTER COLUMN "name" SET DATA TYPE varchar(200);--> statement-breakpoint
ALTER TABLE "investment_type" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "investment_type" ALTER COLUMN "name" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "market_quote" ALTER COLUMN "symbol" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "market_quote" ALTER COLUMN "provider" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "market_quote" ALTER COLUMN "market" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "market_quote" ALTER COLUMN "currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "market_quote" ALTER COLUMN "logo_url" SET DATA TYPE varchar(2048);--> statement-breakpoint
ALTER TABLE "market_rate" ALTER COLUMN "series" SET DATA TYPE varchar(30);--> statement-breakpoint
ALTER TABLE "market_rate" ALTER COLUMN "provider" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "portfolio_holding" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "portfolio_holding" ALTER COLUMN "ticker" SET DATA TYPE varchar(20);--> statement-breakpoint
ALTER TABLE "portfolio_holding" ALTER COLUMN "currency" SET DATA TYPE varchar(3);--> statement-breakpoint
ALTER TABLE "portfolio_holding" ALTER COLUMN "broker" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "question" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "question" ALTER COLUMN "prompt" SET DATA TYPE varchar(500);--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "token" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "ip_address" SET DATA TYPE varchar(45);--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_agent" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "name" SET DATA TYPE varchar(100);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "email" SET DATA TYPE varchar(320);--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "image" SET DATA TYPE varchar(2048);--> statement-breakpoint
ALTER TABLE "user_allocation_profile" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "identifier" SET DATA TYPE varchar(320);--> statement-breakpoint
ALTER TABLE "verification" ALTER COLUMN "value" SET DATA TYPE varchar(512);--> statement-breakpoint
ALTER TABLE "renda_fixa_detail" ADD CONSTRAINT "renda_fixa_detail_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renda_fixa_detail" ADD CONSTRAINT "renda_fixa_detail_investment_id_investment_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renda_fixa_valuation" ADD CONSTRAINT "renda_fixa_valuation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "renda_fixa_valuation" ADD CONSTRAINT "renda_fixa_valuation_investment_id_investment_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment" ADD CONSTRAINT "investment_investment_type_id_investment_type_id_fk" FOREIGN KEY ("investment_type_id") REFERENCES "public"."investment_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investment_answer" ADD CONSTRAINT "investment_answer_question_id_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question" ADD CONSTRAINT "question_investment_type_id_investment_type_id_fk" FOREIGN KEY ("investment_type_id") REFERENCES "public"."investment_type"("id") ON DELETE cascade ON UPDATE no action;