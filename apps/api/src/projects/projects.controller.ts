import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type CreateProjectInput,
  createProjectSchema,
  type DuplicateProjectInput,
  duplicateProjectSchema,
  listProjectsQuerySchema,
  type UpdateProjectInput,
  updateProjectSchema,
} from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ProjectsService } from './projects.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get('organizations/:orgId/projects')
  list(
    @CurrentUser() user: AuthUser,
    @Param('orgId', uuid) orgId: string,
    @Query(new ZodValidationPipe(listProjectsQuerySchema))
    query: z.output<typeof listProjectsQuerySchema>,
  ) {
    return this.projects.list(user.id, orgId, query);
  }

  @Post('organizations/:orgId/projects')
  create(
    @CurrentUser() user: AuthUser,
    @Param('orgId', uuid) orgId: string,
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projects.create(user.id, orgId, body);
  }

  @Get('projects/:id')
  get(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.projects.get(user.id, id);
  }

  @Patch('projects/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projects.update(user.id, id, body);
  }

  @Post('projects/:id/duplicate')
  duplicate(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(duplicateProjectSchema)) body: DuplicateProjectInput,
  ) {
    return this.projects.duplicate(user.id, id, body);
  }

  @Delete('projects/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.projects.remove(user.id, id);
  }
}
