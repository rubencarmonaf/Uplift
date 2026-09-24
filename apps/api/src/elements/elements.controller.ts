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
  Put,
} from '@nestjs/common';
import {
  createElementSchema,
  type ReorderElementsInput,
  reorderElementsSchema,
  type UpdateElementInput,
  updateElementSchema,
} from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ElementsService } from './elements.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class ElementsController {
  constructor(private readonly elements: ElementsService) {}

  @Get('projects/:projectId/elements')
  list(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.elements.list(user.id, projectId);
  }

  @Post('projects/:projectId/elements')
  create(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(createElementSchema))
    body: z.output<typeof createElementSchema>,
  ) {
    return this.elements.create(user.id, projectId, body);
  }

  @Put('projects/:projectId/elements/order')
  reorder(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(reorderElementsSchema)) body: ReorderElementsInput,
  ) {
    return this.elements.reorder(user.id, projectId, body);
  }

  @Patch('elements/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateElementSchema)) body: UpdateElementInput,
  ) {
    return this.elements.update(user.id, id, body);
  }

  @Delete('elements/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Param('id', uuid) id: string) {
    return this.elements.remove(user.id, id);
  }
}
