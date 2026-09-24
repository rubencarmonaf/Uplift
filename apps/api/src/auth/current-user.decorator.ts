import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { users } from '../db/schema.js';

export type AuthUser = typeof users.$inferSelect;

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<Request>().user,
);
