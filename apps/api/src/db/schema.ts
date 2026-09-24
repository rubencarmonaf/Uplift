import {
  type Brief,
  ELEMENT_TYPES,
  INDUSTRIES,
  PAGE_TYPES,
  PROJECT_STATUSES,
  type ComplianceIssue,
  type GoalTarget,
  GENERATION_STATUSES,
  VARIANT_ANGLES,
  VARIANT_SOURCES,
  VARIANT_STATUSES,
} from '@uplift/shared';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const localeEnum = pgEnum('locale', ['es', 'en']);
export const roleEnum = pgEnum('role', ['admin', 'editor', 'viewer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  locale: localeEnum('locale').notNull().default('es'),
  ...timestamps,
});

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  ...timestamps,
});

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('editor'),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.organizationId] })],
);

// Only a SHA-256 hash of the session token is stored, so a database leak does not leak live sessions.
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const industryEnum = pgEnum('industry', INDUSTRIES);
export const pageTypeEnum = pgEnum('page_type', PAGE_TYPES);
export const projectStatusEnum = pgEnum('project_status', PROJECT_STATUSES);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    url: text('url').notNull(),
    industry: industryEnum('industry').notNull(),
    pageType: pageTypeEnum('page_type').notNull(),
    locale: text('locale').notNull(),
    status: projectStatusEnum('status').notNull().default('draft'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('projects_org_updated_idx').on(t.organizationId, t.updatedAt)],
);

export const elementTypeEnum = pgEnum('element_type', ELEMENT_TYPES);

/** A piece of copy on the project's page that Uplift optimizes. */
export const pageElements = pgTable(
  'page_elements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: elementTypeEnum('type').notNull(),
    selector: text('selector').notNull(),
    originalText: text('original_text').notNull(),
    minLength: integer('min_length'),
    maxLength: integer('max_length'),
    notes: text('notes').notNull().default(''),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (t) => [index('page_elements_project_position_idx').on(t.projectId, t.position)],
);

/** Latest rendered copy of a project's page (one per project), shown in the visual element picker. */
export const pageSnapshots = pgTable('page_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .unique()
    .references(() => projects.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  finalUrl: text('final_url').notNull(),
  title: text('title').notNull(),
  html: text('html').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** The project's brief (one per project). Stored as JSON and validated with the shared schema. */
export const projectBriefs = pgTable('project_briefs', {
  projectId: uuid('project_id')
    .primaryKey()
    .references(() => projects.id, { onDelete: 'cascade' }),
  data: jsonb('data').$type<Brief>().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const variantStatusEnum = pgEnum('variant_status', VARIANT_STATUSES);
export const variantSourceEnum = pgEnum('variant_source', VARIANT_SOURCES);
export const variantAngleEnum = pgEnum('variant_angle', VARIANT_ANGLES);
export const generationStatusEnum = pgEnum('generation_status', GENERATION_STATUSES);

/** A background run that generates variants for some of a project's elements. */
export const generationJobs = pgTable(
  'generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    status: generationStatusEnum('status').notNull().default('queued'),
    provider: text('provider').$type<'anthropic' | 'mock'>().notNull(),
    model: text('model'),
    totalElements: integer('total_elements').notNull(),
    completedElements: integer('completed_elements').notNull().default(0),
    failedElements: integer('failed_elements').notNull().default(0),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    error: text('error'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [index('generation_jobs_project_created_idx').on(t.projectId, t.createdAt)],
);

export const variants = pgTable(
  'variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    elementId: uuid('element_id')
      .notNull()
      .references(() => pageElements.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => generationJobs.id, { onDelete: 'set null' }),
    text: text('text').notNull(),
    angle: variantAngleEnum('angle'),
    rationale: text('rationale').notNull().default(''),
    complianceScore: integer('compliance_score').notNull(),
    qualityScore: integer('quality_score'),
    issues: jsonb('issues').$type<ComplianceIssue[]>().notNull().default([]),
    status: variantStatusEnum('status').notNull().default('active'),
    source: variantSourceEnum('source').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index('variants_element_created_idx').on(t.elementId, t.createdAt)],
);

/** A conversion goal. Exactly one per project is primary: the metric experiments are decided on. */
export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    target: jsonb('target').$type<GoalTarget>().notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index('goals_project_idx').on(t.projectId),
    uniqueIndex('goals_one_primary_per_project')
      .on(t.projectId)
      .where(sql`${t.isPrimary}`),
  ],
);
