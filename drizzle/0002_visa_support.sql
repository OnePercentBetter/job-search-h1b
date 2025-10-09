CREATE TABLE IF NOT EXISTS "visa_sponsors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"aliases" text[],
	"sponsorship_types" text[],
	"last_year_sponsored" integer,
	"sponsorship_confidence" integer DEFAULT 50,
	"notes" text,
	"source" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "visa_sponsors_normalized_idx" ON "visa_sponsors" ("normalized_name");
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "posted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "link_checked_at" timestamp;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "is_link_active" boolean DEFAULT true;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_status" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "sponsorship_confidence" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_notes" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_sponsor_id" uuid;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_requirements" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "salary_currency" text;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "manual_review" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "visa_priority_score" integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_visa_status_idx" ON "jobs" ("visa_status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_last_seen_idx" ON "jobs" ("last_seen_at");
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_visa_sponsor_id_visa_sponsors_id_fk" FOREIGN KEY ("visa_sponsor_id") REFERENCES "visa_sponsors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

