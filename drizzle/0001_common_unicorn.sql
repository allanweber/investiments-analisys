CREATE TABLE "market_quote" (
	"symbol" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"market" text,
	"currency" text,
	"price" numeric(24, 8),
	"as_of" timestamp with time zone,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_holding" (
	"user_id" text NOT NULL,
	"investment_id" uuid NOT NULL,
	"ticker" text,
	"quantity" numeric(24, 8) NOT NULL,
	"avg_cost" numeric(24, 8) NOT NULL,
	"currency" text NOT NULL,
	"broker" text,
	"last_operation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_holding_user_id_investment_id_pk" PRIMARY KEY("user_id","investment_id")
);
--> statement-breakpoint
CREATE TABLE "user_allocation_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"targets" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "portfolio_holding" ADD CONSTRAINT "portfolio_holding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_holding" ADD CONSTRAINT "portfolio_holding_investment_id_investment_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_allocation_profile" ADD CONSTRAINT "user_allocation_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;