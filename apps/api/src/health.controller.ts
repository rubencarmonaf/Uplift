import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from './auth/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(@Req() req: Request) {
    // TEMPORARY: calibrating TRUST_PROXY_HOPS on the host. Remove after.
    return {
      ok: true,
      xff: req.headers['x-forwarded-for'],
      tci: req.headers['true-client-ip'],
      cf: req.headers['cf-connecting-ip'],
      remote: req.socket.remoteAddress,
    };
  }
}
