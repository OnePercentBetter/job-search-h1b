ALTER TABLE "jobs" DROP CONSTRAINT "jobs_visa_sponsor_id_visa_sponsors_id_fk";
--> statement-breakpoint
DROP INDEX "jobs_visa_status_idx";--> statement-breakpoint
DROP INDEX "jobs_last_seen_idx";--> statement-breakpoint
DROP INDEX "visa_sponsors_normalized_idx";--> statement-breakpoint
ALTER TABLE "jobs" ALTER COLUMN "sponsorship_confidence" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "auth_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "visa_sponsors" ALTER COLUMN "sponsorship_confidence" SET DEFAULT 50;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "visa_requirements" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "salary_currency" text;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "manual_review" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "visa_priority_score" integer;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_visa_sponsor_id_visa_sponsors_id_fk" FOREIGN KEY ("visa_sponsor_id") REFERENCES "public"."visa_sponsors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobsVisaStatusIdx" ON "jobs" USING btree ("visa_status");--> statement-breakpoint
CREATE INDEX "jobsLastSeenIdx" ON "jobs" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "visaSponsorsNormalizedIdx" ON "visa_sponsors" USING btree ("normalized_name");