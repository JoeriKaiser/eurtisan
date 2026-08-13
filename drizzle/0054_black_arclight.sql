CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint
ALTER TABLE "session" DROP CONSTRAINT "session_token_unique";--> statement-breakpoint
ALTER TABLE "session" ALTER COLUMN "token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "token_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_unique" ON "session" USING btree ("token_hash");--> statement-breakpoint

-- Migrate existing sessions: hash the plaintext token and clear it.
UPDATE "session" SET "token_hash" = encode(digest("token", 'sha256'), 'hex') WHERE "token" IS NOT NULL;--> statement-breakpoint
UPDATE "session" SET "token" = NULL WHERE "token_hash" IS NOT NULL;
