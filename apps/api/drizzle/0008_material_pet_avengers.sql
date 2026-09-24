CREATE TYPE "public"."event_type" AS ENUM('exposure', 'conversion');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'paused', 'finished');--> statement-breakpoint
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
	"anti_flicker_enabled" boolean DEFAULT true NOT NULL,
	"anti_flicker_timeout_ms" integer DEFAULT 1000 NOT NULL,
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
ALTER TABLE "experiment_events" ADD CONSTRAINT "experiment_events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "experiment_events_unique_visitor" ON "experiment_events" USING btree ("experiment_id","visitor_id","type","goal_id");--> statement-breakpoint
CREATE INDEX "experiment_events_experiment_created_idx" ON "experiment_events" USING btree ("experiment_id","created_at");