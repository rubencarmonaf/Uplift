import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service.js';
import { Public } from '../auth/public.decorator.js';
import { SessionService } from '../auth/session.service.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DemoService } from './demo.service.js';

const demoRequestSchema = z.object({ language: z.enum(['es', 'en']).default('es') });

@Controller('auth')
export class DemoController {
  constructor(
    private readonly demo: DemoService,
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** Creates a throwaway demo account with example data and signs the visitor in. */
  @Public()
  // Each demo seeds a full project; keep it well away from being a cheap way to fill the database.
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @HttpCode(201)
  @Post('demo')
  async start(
    @Body(new ZodValidationPipe(demoRequestSchema)) body: z.output<typeof demoRequestSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, timings } = await this.demo.createAccount(body.language);
    // Standard header, visible in browser dev tools: where the (slow) seeding time goes.
    res.setHeader(
      'Server-Timing',
      `seed;dur=${Math.round(timings.seed)}, traffic;dur=${Math.round(timings.traffic)}`,
    );
    const { token, expiresAt } = await this.sessions.create(user.id);
    this.sessions.setCookie(res, token, expiresAt);
    return this.auth.me(user);
  }
}
