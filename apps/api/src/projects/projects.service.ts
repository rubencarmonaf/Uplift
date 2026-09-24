import { Injectable } from '@nestjs/common';
import type {
  CreateProjectInput,
  DuplicateProjectInput,
  Project,
  UpdateProjectInput,
} from '@uplift/shared';
import { listProjectsQuerySchema } from '@uplift/shared';
import { and, asc, desc, eq, ilike, isNotNull, isNull, or, type SQL } from 'drizzle-orm';
import type { z } from 'zod';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { pageElements, projects } from '../db/schema.js';
import { OrgAccessService } from '../organizations/org-access.service.js';
import { ProjectAccessService } from './project-access.service.js';

type ProjectRow = typeof projects.$inferSelect;
type ListQuery = z.output<typeof listProjectsQuerySchema>;

export function toProjectDto(row: ProjectRow): Project {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    url: row.url,
    industry: row.industry,
    pageType: row.pageType,
    locale: row.locale,
    status: row.status,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const ORDER = {
  updated: desc(projects.updatedAt),
  created: desc(projects.createdAt),
  name: asc(projects.name),
} as const;

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly orgAccess: OrgAccessService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(userId: string, organizationId: string, query: ListQuery) {
    await this.orgAccess.assertRole(userId, organizationId, 'viewer');

    const filters: (SQL | undefined)[] = [
      eq(projects.organizationId, organizationId),
      query.archived ? isNotNull(projects.archivedAt) : isNull(projects.archivedAt),
      query.status && eq(projects.status, query.status),
    ];
    if (query.q) {
      const pattern = `%${escapeLike(query.q)}%`;
      filters.push(or(ilike(projects.name, pattern), ilike(projects.url, pattern)));
    }

    const rows = await this.db
      .select()
      .from(projects)
      .where(and(...filters))
      .orderBy(ORDER[query.sort]);
    return rows.map(toProjectDto);
  }

  async create(userId: string, organizationId: string, input: CreateProjectInput) {
    await this.orgAccess.assertRole(userId, organizationId, 'editor');
    const [row] = await this.db
      .insert(projects)
      .values({ ...input, organizationId, createdBy: userId })
      .returning();
    return toProjectDto(row!);
  }

  async get(userId: string, id: string) {
    const { project } = await this.projectAccess.load(userId, id, 'viewer');
    return toProjectDto(project);
  }

  async update(userId: string, id: string, input: UpdateProjectInput) {
    await this.projectAccess.load(userId, id, 'editor');
    const { archived, ...fields } = input;
    const [row] = await this.db
      .update(projects)
      .set({
        ...fields,
        ...(archived !== undefined && { archivedAt: archived ? new Date() : null }),
      })
      .where(eq(projects.id, id))
      .returning();
    return toProjectDto(row!);
  }

  /** Copies the project setup (details and elements) into a new draft. Later phases add brief and goals. */
  async duplicate(userId: string, id: string, { name }: DuplicateProjectInput) {
    const { project: source } = await this.projectAccess.load(userId, id, 'editor');
    const row = await this.db.transaction(async (tx) => {
      const [copy] = await tx
        .insert(projects)
        .values({
          organizationId: source.organizationId,
          name,
          url: source.url,
          industry: source.industry,
          pageType: source.pageType,
          locale: source.locale,
          createdBy: userId,
        })
        .returning();
      const elements = await tx
        .select()
        .from(pageElements)
        .where(eq(pageElements.projectId, source.id));
      if (elements.length > 0) {
        await tx.insert(pageElements).values(
          elements.map(({ id: _id, createdAt: _c, updatedAt: _u, ...element }) => ({
            ...element,
            projectId: copy!.id,
          })),
        );
      }
      return copy!;
    });
    return toProjectDto(row);
  }

  async remove(userId: string, id: string) {
    await this.projectAccess.load(userId, id, 'editor');
    await this.db.delete(projects).where(eq(projects.id, id));
  }
}
