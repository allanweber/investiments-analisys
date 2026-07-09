ALTER TABLE "investment_answer" ALTER COLUMN "value_yes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "investment_answer" ADD COLUMN "ai_suggested_yes" boolean;--> statement-breakpoint
ALTER TABLE "investment_answer" ADD COLUMN "ai_reasoning" text;--> statement-breakpoint
ALTER TABLE "investment_answer" ADD COLUMN "ai_checked_at" timestamp with time zone;