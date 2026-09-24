import { Controller, Get, Header, Param, ParseUUIDPipe, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { type AuthUser, CurrentUser } from '../auth/current-user.decorator.js';
import { env } from '../config/env.js';
import { SnapshotsService } from './snapshots.service.js';

const uuid = new ParseUUIDPipe({ version: '4' });

/**
 * The snapshot is third-party HTML, so it is locked down:
 * - `sandbox allow-scripts` gives it an opaque origin even if opened directly, so it can never
 *   read the app's cookies or storage, and only our nonce'd picker script may run;
 * - no network access from scripts, no forms, and it can only be framed by the app.
 */
function snapshotCsp(nonce: string) {
  return [
    'sandbox allow-scripts',
    "default-src 'none'",
    `script-src 'nonce-${nonce}'`,
    "style-src * data: 'unsafe-inline'",
    'img-src * data: blob:',
    'font-src * data:',
    "connect-src 'none'",
    "form-action 'none'",
    'base-uri *',
    `frame-ancestors 'self' ${env.WEB_ORIGIN}`,
  ].join('; ');
}

@Controller()
export class SnapshotsController {
  constructor(private readonly snapshots: SnapshotsService) {}

  @Get('projects/:projectId/snapshot')
  latest(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.snapshots.latest(user.id, projectId);
  }

  // Rendering a page is expensive: keep it rare per user.
  @Throttle({ default: { ttl: 60_000, limit: 6 } })
  @Post('projects/:projectId/snapshot')
  capture(@CurrentUser() user: AuthUser, @Param('projectId', uuid) projectId: string) {
    return this.snapshots.capture(user.id, projectId);
  }

  @Get('snapshots/:id/document')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Cache-Control', 'private, no-store')
  @Header('Referrer-Policy', 'no-referrer')
  async document(
    @CurrentUser() user: AuthUser,
    @Param('id', uuid) id: string,
    @Res() res: Response,
  ) {
    const { html, nonce } = await this.snapshots.document(user.id, id);
    res.setHeader('Content-Security-Policy', snapshotCsp(nonce));
    res.type('html').send(html);
  }
}
