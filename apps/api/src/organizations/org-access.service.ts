import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { memberships, roleEnum } from '../db/schema.js';

export type Role = (typeof roleEnum.enumValues)[number];

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

@Injectable()
export class OrgAccessService {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Ensures the user belongs to the organization with at least `minRole`.
   * Non-members get a 404 so the existence of other organizations' resources is not revealed.
   */
  async assertRole(userId: string, organizationId: string, minRole: Role): Promise<Role> {
    const [membership] = await this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId)));
    if (!membership) throw new NotFoundException();
    if (RANK[membership.role] < RANK[minRole]) throw new ForbiddenException();
    return membership.role;
  }
}
