import { z } from 'zod';

export const INDUSTRIES = [
  'saas',
  'ecommerce',
  'finance',
  'insurance',
  'health',
  'education',
  'travel',
  'real_estate',
  'media',
  'other',
] as const;
export const industrySchema = z.enum(INDUSTRIES);
export type Industry = z.infer<typeof industrySchema>;

export const PAGE_TYPES = [
  'landing',
  'home',
  'product',
  'category',
  'pricing',
  'signup',
  'checkout',
  'other',
] as const;
export const pageTypeSchema = z.enum(PAGE_TYPES);
export type PageType = z.infer<typeof pageTypeSchema>;

export const PROJECT_STATUSES = ['draft', 'ready', 'running', 'finished'] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

/** BCP 47 language tag such as `es-ES` or `en`. */
export const localeTagSchema = z.string().regex(/^[a-z]{2,3}(-[A-Z]{2})?$/);

const pageUrlSchema = z.url({ protocol: /^https?$/, hostname: z.regexes.domain }).max(2048);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  url: pageUrlSchema,
  industry: industrySchema,
  pageType: pageTypeSchema,
  locale: localeTagSchema,
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = createProjectSchema
  .extend({ status: projectStatusSchema, archived: z.boolean() })
  .partial();
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export const duplicateProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export type DuplicateProjectInput = z.infer<typeof duplicateProjectSchema>;

export const PROJECT_SORTS = ['updated', 'created', 'name'] as const;

export const listProjectsQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: projectStatusSchema.optional(),
  archived: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: z.enum(PROJECT_SORTS).default('updated'),
});
export type ListProjectsQuery = z.input<typeof listProjectsQuerySchema>;

export const projectSchema = z.object({
  id: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  url: z.string(),
  industry: industrySchema,
  pageType: pageTypeSchema,
  locale: z.string(),
  status: projectStatusSchema,
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;
