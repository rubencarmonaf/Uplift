CREATE TYPE "public"."generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."variant_angle" AS ENUM('clarity', 'benefit', 'social_proof', 'urgency', 'risk_reversal', 'curiosity', 'specificity', 'objection_handling', 'emotional');--> statement-breakpoint
CREATE TYPE "public"."variant_source" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."variant_status" AS ENUM('active', 'discarded');--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"status" "generation_status" DEFAULT 'queued' NOT NULL,
	"provider" text NOT NULL,
	"model" text,
	"total_elements" integer NOT NULL,
	"completed_elements" integer DEFAULT 0 NOT NULL,
	"failed_elements" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" uuid NOT NULL,
	"job_id" uuid,
	"text" text NOT NULL,
	"angle" "variant_angle",
	"rationale" text DEFAULT '' NOT NULL,
	"compliance_score" integer NOT NULL,
	"quality_score" integer,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "variant_status" DEFAULT 'active' NOT NULL,
	"source" "variant_source" NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_element_id_page_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "public"."page_elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_job_id_generation_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "generation_jobs_project_created_idx" ON "generation_jobs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "variants_element_created_idx" ON "variants" USING btree ("element_id","created_at");