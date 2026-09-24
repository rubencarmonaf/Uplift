import {
  type Brief,
  ELEMENT_TYPES,
  INDUSTRIES,
  PAGE_TYPES,
  PROJECT_STATUSES,
} from '@uplift/shared';
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

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
