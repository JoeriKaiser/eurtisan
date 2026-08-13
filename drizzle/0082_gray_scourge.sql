CREATE TYPE "public"."trader_status" AS ENUM('trader', 'non_trader');--> statement-breakpoint
ALTER TABLE "shop" ADD COLUMN "trader_status" "trader_status";