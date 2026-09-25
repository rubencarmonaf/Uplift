import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type ExperimentAction,
  experimentActionSchema,
  type UpdateExperimentInput,
  updateExperimentSchema,
} from '@uplift/shared';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ExperimentsService } from './experiments.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('projects/:projectId/experiment')
export class ExperimentsController {
  constructor(private readonly experiments: ExperimentsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.experiments.get(user.id, projectId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(updateExperimentSchema)) body: UpdateExperimentInput,
  ) {
    return this.experiments.update(user.id, projectId, body);
  }

  @Post('actions')
  @HttpCode(200)
  act(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(experimentActionSchema)) body: ExperimentAction,
  ) {
    return this.experiments.act(user.id, projectId, body);
  }
}
