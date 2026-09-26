-- Renames concepts to Uplift's own vocabulary and reshapes stored briefs to the new structure.
ALTER TYPE "public"."variant_angle" RENAME TO "variant_approach";--> statement-breakpoint
ALTER TYPE "public"."variant_approach" RENAME VALUE 'objection_handling' TO 'answers_doubt';--> statement-breakpoint
ALTER TYPE "public"."element_type" RENAME TO "element_kind";--> statement-breakpoint
ALTER TABLE "generation_jobs" RENAME TO "generation_runs";--> statement-breakpoint
ALTER INDEX "generation_jobs_project_created_idx" RENAME TO "generation_runs_project_created_idx";--> statement-breakpoint
ALTER TABLE "generation_runs" RENAME CONSTRAINT "generation_jobs_pkey" TO "generation_runs_pkey";--> statement-breakpoint
ALTER TABLE "generation_runs" RENAME CONSTRAINT "generation_jobs_created_by_users_id_fk" TO "generation_runs_created_by_users_id_fk";--> statement-breakpoint
ALTER TABLE "generation_runs" RENAME CONSTRAINT "generation_jobs_project_id_projects_id_fk" TO "generation_runs_project_id_projects_id_fk";--> statement-breakpoint
ALTER TABLE "variants" RENAME COLUMN "job_id" TO "run_id";--> statement-breakpoint
ALTER TABLE "variants" RENAME CONSTRAINT "variants_job_id_generation_jobs_id_fk" TO "variants_run_id_generation_runs_id_fk";--> statement-breakpoint
ALTER TABLE "variants" RENAME COLUMN "compliance_score" TO "rules_score";--> statement-breakpoint
ALTER TABLE "variants" RENAME COLUMN "angle" TO "approach";--> statement-breakpoint
ALTER TABLE "experiments" RENAME COLUMN "anti_flicker_enabled" TO "hide_page_enabled";--> statement-breakpoint
ALTER TABLE "experiments" RENAME COLUMN "anti_flicker_timeout_ms" TO "hide_page_timeout_ms";--> statement-breakpoint
UPDATE "variants" SET "issues" = replace("issues"::text, '"forbidden_claim"', '"off_limits_promise"')::jsonb
  WHERE "issues"::text LIKE '%forbidden_claim%';--> statement-breakpoint
UPDATE "project_briefs" SET "data" = jsonb_build_object(
  'offer', jsonb_build_object(
    'product', coalesce("data"->'business'->'offering', '""'::jsonb),
    'pageGoal', coalesce("data"->'business'->'pageGoal', '""'::jsonb),
    'benefits', coalesce("data"->'business'->'valueProps', '[]'::jsonb)),
  'reader', jsonb_build_object(
    'audience', coalesce("data"->'business'->'audience', '""'::jsonb),
    'stage', CASE "data"->'business'->>'funnelStage'
      WHEN 'awareness' THEN '"exploring"'::jsonb
      WHEN 'consideration' THEN '"comparing"'::jsonb
      WHEN 'decision' THEN '"deciding"'::jsonb
      WHEN 'retention' THEN '"customer"'::jsonb
      ELSE 'null'::jsonb END,
    'doubts', coalesce("data"->'business'->'objections', '[]'::jsonb)),
  'evidence', jsonb_build_object(
    'proofPoints', coalesce("data"->'truth'->'facts', '[]'::jsonb),
    'offLimits', coalesce("data"->'truth'->'forbiddenClaims', '[]'::jsonb)),
  'style', coalesce("data"->'voice', '{"tones":[],"formality":null,"readingLevel":null,"notes":""}'::jsonb),
  'rules', jsonb_build_object(
    'sensitivity', coalesce("data"->'guardrails'->'riskLevel', 'null'::jsonb),
    'bannedWords', coalesce("data"->'guardrails'->'bannedWords', '[]'::jsonb),
    'requiredMentions', coalesce("data"->'guardrails'->'requiredMentions', '[]'::jsonb),
    'legalNotes', coalesce("data"->'guardrails'->'disclaimers', '[]'::jsonb),
    'avoidStyles', coalesce("data"->'guardrails'->'avoidStyles', '[]'::jsonb)))
  WHERE "data" ? 'business';
