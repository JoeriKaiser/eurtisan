CREATE TABLE IF NOT EXISTS "email_suppression" (
	"email" text PRIMARY KEY NOT NULL,
	"reason" text NOT NULL,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
