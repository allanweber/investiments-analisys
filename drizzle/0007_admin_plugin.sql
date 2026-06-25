-- Better Auth admin plugin columns
ALTER TABLE "user" ADD COLUMN "role" varchar(50);
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false;
ALTER TABLE "user" ADD COLUMN "ban_reason" varchar(512);
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp with time zone;
ALTER TABLE "session" ADD COLUMN "impersonated_by" varchar(255);
ALTER TABLE "user" ADD COLUMN "last_login_at" timestamp with time zone;
