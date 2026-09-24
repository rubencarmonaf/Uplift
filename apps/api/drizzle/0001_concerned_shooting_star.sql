CREATE TYPE "public"."industry" AS ENUM('saas', 'ecommerce', 'finance', 'insurance', 'health', 'education', 'travel', 'real_estate', 'media', 'other');--> statement-breakpoint
CREATE TYPE "public"."page_type" AS ENUM('landing', 'home', 'product', 'category', 'pricing', 'signup', 'checkout', 'other');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'ready', 'running', 'finished');--> statement-breakpoint
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
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_org_updated_idx" ON "projects" USING btree ("organization_id","updated_at");