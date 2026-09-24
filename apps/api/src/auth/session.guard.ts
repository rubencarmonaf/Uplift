import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC } from './public.decorator.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

/** Loads the user from the session cookie and rejects anonymous requests to non-public routes. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const http = ctx.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (token) {
      const result = await this.sessions.validate(token);
      if (result) {
        req.user = result.user;
        if (result.renewed) this.sessions.setCookie(res, token, result.expiresAt);
      } else {
        this.sessions.clearCookie(res);
      }
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!isPublic && !req.user) throw new UnauthorizedException();
    return true;
  }
}
