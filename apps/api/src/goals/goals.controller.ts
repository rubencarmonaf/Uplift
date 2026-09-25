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
} from '@nestjs/common';
import { createGoalSchema, type UpdateGoalInput, updateGoalSchema } from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { GoalsService } from './goals.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get('projects/:projectId/goals')
  list(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.goals.list(user.id, projectId);
  }

  @Post('projects/:projectId/goals')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(createGoalSchema)) body: z.output<typeof createGoalSchema>,
  ) {
    return this.goals.create(user.id, projectId, body);
  }

  @Patch('goals/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateGoalSchema)) body: UpdateGoalInput,
  ) {
    return this.goals.update(user.id, id, body);
  }

  @Delete('goals/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.goals.remove(user.id, id);
  }
}
