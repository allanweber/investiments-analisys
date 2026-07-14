ALTER TABLE "investment" ADD COLUMN "ticker" varchar(20);--> statement-breakpoint
ALTER TABLE "investment" ADD COLUMN "currency" varchar(3);--> statement-breakpoint
-- Move ticker/currency from portfolio_holding to investment (1:1 per user+investment).
UPDATE "investment" AS i
SET "ticker" = NULLIF(TRIM(h."ticker"), ''),
    "currency" = h."currency"
FROM "portfolio_holding" AS h
WHERE h."investment_id" = i."id" AND h."user_id" = i."user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "investment_user_ticker_unique" ON "investment" USING btree ("user_id","ticker") WHERE "investment"."ticker" is not null;--> statement-breakpoint
ALTER TABLE "portfolio_holding" DROP COLUMN "ticker";--> statement-breakpoint
ALTER TABLE "portfolio_holding" DROP COLUMN "currency";