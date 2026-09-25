import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { simulateTrafficSchema } from '@uplift/shared';
import type { z } from 'zod';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ResultsService } from './results.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

@Controller('projects/:projectId/results')
export class ResultsController {
  constructor(private readonly results: ResultsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.results.results(user.id, projectId);
  }

  // Demo mode: fills the experiment with simulated, reproducible traffic.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('simulation')
  @HttpCode(200)
  simulate(
    @CurrentUser() user: AuthUser,
    @Param('projectId', uuid) projectId: string,
    @Body(new ZodValidationPipe(simulateTrafficSchema))
    body: z.output<typeof simulateTrafficSchema>,
  ) {
    return this.results.simulate(user.id, projectId, body);
  }

  @Delete('simulation')
  @HttpCode(204)
  clear(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.results.clearSimulation(user.id, projectId);
  }
}
