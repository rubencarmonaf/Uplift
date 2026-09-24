import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type CreateVariantInput,
  createVariantSchema,
  generateVariantsSchema,
  type UpdateVariantInput,
  updateVariantSchema,
} from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { GenerationService } from './generation.service.js';
import { VariantsService } from './variants.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller()
export class VariantsController {
  constructor(
    private readonly variants: VariantsService,
    private readonly generation: GenerationService,
  ) {}

  @Get('projects/:projectId/variants')
  list(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.variants.listForProject(user.id, projectId);
  }

  @Post('elements/:elementId/variants')
  create(
    @CurrentUser() user: AuthUser,
    @Param('elementId', uuid) elementId: string,
    @Body(new ZodValidationPipe(createVariantSchema)) body: CreateVariantInput,
  ) {
    return this.variants.createManual(user.id, elementId, body);
  }

  @Patch('variants/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(updateVariantSchema)) body: UpdateVariantInput,
  ) {
    return this.variants.update(user.id, id, body);
  }

  // Each run calls a paid model; keep it well below anything abusive.
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post('projects/:projectId/generations')
  generate(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(generateVariantsSchema))
    body: z.output<typeof generateVariantsSchema>,
  ) {
    return this.generation.start(user.id, projectId, body);
  }

  @Get('projects/:projectId/generations/latest')
  latestGeneration(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.generation.latest(user.id, projectId);
  }
}
