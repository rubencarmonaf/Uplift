CREATE TYPE "public"."element_type" AS ENUM('headline', 'subheadline', 'cta', 'body', 'bullet', 'label', 'other');--> statement-breakpoint
CREATE TABLE "page_elements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "element_type" NOT NULL,
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
ALTER TABLE "page_elements" ADD CONSTRAINT "page_elements_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_elements_project_position_idx" ON "page_elements" USING btree ("project_id","position");