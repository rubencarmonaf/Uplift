import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import { type Brief, briefSchema } from '@uplift/shared';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { BriefsService } from './briefs.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('projects/:projectId/brief')
export class BriefsController {
  constructor(private readonly briefs: BriefsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.briefs.get(user.id, projectId);
  }

  @Put()
  save(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(briefSchema)) body: Brief,
  ) {
    return this.briefs.save(user.id, projectId, body);
  }
}
