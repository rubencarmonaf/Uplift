import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  type Member,
  type UpdateOrganizationInput,
  updateOrganizationSchema,
} from '@uplift/shared';
import { asc, eq } from 'drizzle-orm';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { memberships, organizations, users } from '../db/schema.js';
import { OrgAccessService } from './org-access.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('organizations/:orgId')
export class OrganizationsController {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly access: OrgAccessService,
  ) {}

  @Patch()
  async rename(
    @CurrentUser() user: AuthUser,
    @Param('orgId', uuid) orgId: string,
    @Body(new ZodValidationPipe(updateOrganizationSchema)) body: UpdateOrganizationInput,
  ) {
    await this.access.assertRole(user.id, orgId, 'admin');
    const [org] = await this.db
      .update(organizations)
      .set({ name: body.name })
      .where(eq(organizations.id, orgId))
      .returning({ id: organizations.id, name: organizations.name });
    return org;
  }

  @Get('members')
  async members(
    @CurrentUser() user: AuthUser,
    @Param('orgId', uuid) orgId: string,
  ): Promise<Member[]> {
    await this.access.assertRole(user.id, orgId, 'viewer');
    const rows = await this.db
      .select({ userId: users.id, name: users.name, email: users.email, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id))
      .where(eq(memberships.organizationId, orgId))
      .orderBy(asc(memberships.createdAt));
    return rows.map((r) => ({ ...r, isYou: r.userId === user.id }));
  }
}
