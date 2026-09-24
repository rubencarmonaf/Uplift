import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { projects } from '../db/schema.js';
import { OrgAccessService, type Role } from '../organizations/org-access.service.js';

/** Loads a project and checks the user's role in its organization. */
@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly orgAccess: OrgAccessService,
  ) {}

  async load(userId: string, projectId: string, minRole: Role) {
    const [project] = await this.db.select().from(projects).where(eq(projects.id, projectId));
    if (!project) throw new NotFoundException();
    const role = await this.orgAccess.assertRole(userId, project.organizationId, minRole);
    return { project, role };
  }
}
