import { z } from 'zod';

export const ELEMENT_TYPES = [
  'headline',
  'subheadline',
  'cta',
  'body',
  'bullet',
  'label',
  'other',
] as const;
export const elementTypeSchema = z.enum(ELEMENT_TYPES);
export type ElementType = z.infer<typeof elementTypeSchema>;

/** Sensible length ceilings per element type, offered as defaults in the UI. */
export const SUGGESTED_MAX_LENGTH: Record<ElementType, number | undefined> = {
  headline: 70,
  subheadline: 160,
  cta: 25,
  body: 400,
  bullet: 90,
  label: 40,
  other: undefined,
};

const lengthSchema = z.number().int().min(1).max(5000);

const elementFields = z.object({
  name: z.string().trim().min(1).max(80),
  type: elementTypeSchema,
  selector: z.string().trim().min(1).max(500),
  originalText: z.string().trim().min(1).max(5000),
  minLength: lengthSchema.nullable(),
  maxLength: lengthSchema.nullable(),
  notes: z.string().trim().max(1000),
});

const lengthRangeIsValid = (v: { minLength?: number | null; maxLength?: number | null }) =>
  v.minLength == null || v.maxLength == null || v.minLength <= v.maxLength;
const lengthRangeIssue = { message: 'min > max', path: ['maxLength'] };

export const createElementSchema = elementFields
  .extend({
    minLength: elementFields.shape.minLength.default(null),
    maxLength: elementFields.shape.maxLength.default(null),
    notes: elementFields.shape.notes.default(''),
  })
  .refine(lengthRangeIsValid, lengthRangeIssue);
export type CreateElementInput = z.input<typeof createElementSchema>;

export const updateElementSchema = elementFields
  .partial()
  .refine(lengthRangeIsValid, lengthRangeIssue);
export type UpdateElementInput = z.infer<typeof updateElementSchema>;

export const reorderElementsSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(200),
});
export type ReorderElementsInput = z.infer<typeof reorderElementsSchema>;

export const elementSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  name: z.string(),
  type: elementTypeSchema,
  selector: z.string(),
  originalText: z.string(),
  minLength: z.number().nullable(),
  maxLength: z.number().nullable(),
  notes: z.string(),
  position: z.number(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type PageElement = z.infer<typeof elementSchema>;
