CREATE TYPE "public"."element_kind" AS ENUM('headline', 'subheadline', 'cta', 'body', 'bullet', 'label', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('exposure', 'conversion');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'paused', 'finished');--> statement-breakpoint
CREATE TYPE "public"."generation_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."industry" AS ENUM('saas', 'ecommerce', 'finance', 'insurance', 'health', 'education', 'travel', 'real_estate', 'media', 'other');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('es', 'en');--> statement-breakpoint
CREATE TYPE "public"."page_type" AS ENUM('landing', 'home', 'product', 'category', 'pricing', 'signup', 'checkout', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'ready', 'running', 'finished');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."variant_approach" AS ENUM('clarity', 'benefit', 'social_proof', 'urgency', 'risk_reversal', 'curiosity', 'specificity', 'answers_doubt', 'emotional');--> statement-breakpoint
CREATE TYPE "public"."variant_source" AS ENUM('ai', 'manual');--> statement-breakpoint
CREATE TYPE "public"."variant_status" AS ENUM('active', 'discarded');--> statement-breakpoint
CREATE TABLE "experiment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"experiment_id" uuid NOT NULL,
	"arm_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"type" "event_type" NOT NULL,
	"goal_id" text DEFAULT '' NOT NULL,
	"simulated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"public_key" text NOT NULL,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"traffic_percent" integer DEFAULT 100 NOT NULL,
	"hide_page_enabled" boolean DEFAULT true NOT NULL,
	"hide_page_timeout_ms" integer DEFAULT 1000 NOT NULL,
	"scope" jsonb NOT NULL,
	"arms" jsonb NOT NULL,
	"winner_arm_id" uuid,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiments_project_id_unique" UNIQUE("project_id"),
	CONSTRAINT "experiments_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
CREATE TABLE "generation_runs" (
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
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"target" jsonb NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" "role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "element_kind" NOT NULL,
	"selector" text NOT NULL,
	"original_text" text NOT NULL,
	"min_length" integer,
	"max_length" integer,
	"notes" text DEFAULT '' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"url" text NOT NULL,
	"final_url" text NOT NULL,
	"title" text NOT NULL,
	"html" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_snapshots_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE "project_briefs" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"industry" "industry" NOT NULL,
	"page_type" "page_type" NOT NULL,
	"locale" text NOT NULL,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"locale" "locale" DEFAULT 'es' NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"element_id" uuid NOT NULL,
	"run_id" uuid,
	"text" text NOT NULL,
	"approach" "variant_approach",
	"rationale" text DEFAULT '' NOT NULL,
	"rules_score" integer NOT NULL,
	"quality_score" integer,
	"issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "variant_status" DEFAULT 'active' NOT NULL,
	"source" "variant_source" NOT NULL,
	"saved_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_runs" ADD CONSTRAINT "generation_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_elements" ADD CONSTRAINT "page_elements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_snapshots" ADD CONSTRAINT "page_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_briefs" ADD CONSTRAINT "project_briefs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_element_id_page_elements_id_fk" FOREIGN KEY ("element_id") REFERENCES "public"."page_elements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_run_id_generation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."generation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_events_unique_visitor" ON "experiment_events" USING btree ("experiment_id","visitor_id","type","goal_id");--> statement-breakpoint
CREATE INDEX "experiment_events_experiment_created_idx" ON "experiment_events" USING btree ("experiment_id","created_at");--> statement-breakpoint
CREATE INDEX "generation_runs_project_created_idx" ON "generation_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "goals_project_idx" ON "goals" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goals_one_primary_per_project" ON "goals" USING btree ("project_id") WHERE "goals"."is_primary";--> statement-breakpoint
CREATE INDEX "page_elements_project_position_idx" ON "page_elements" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "projects_org_updated_idx" ON "projects" USING btree ("organization_id","updated_at");--> statement-breakpoint
CREATE INDEX "variants_element_created_idx" ON "variants" USING btree ("element_id","created_at");