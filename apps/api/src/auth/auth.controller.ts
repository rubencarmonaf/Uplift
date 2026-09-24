import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  type ChangePasswordInput,
  changePasswordSchema,
  type LoginInput,
  loginSchema,
  type RegisterInput,
  registerSchema,
  type UpdateProfileInput,
  updateProfileSchema,
} from '@uplift/shared';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { type AuthUser, CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { SESSION_COOKIE, SessionService } from './session.service.js';

const strictLimit = { default: { ttl: 60_000, limit: 10 } };

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Throttle(strictLimit)
  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.register(body);
    await this.startSession(res, user.id);
    return this.auth.me(user);
  }

  @Public()
  @Throttle(strictLimit)
  @HttpCode(200)
  @Post('login')
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.login(body);
    await this.startSession(res, user.id);
    return this.auth.me(user);
  }

  @Public()
  @HttpCode(204)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (token) await this.sessions.invalidate(token);
    this.sessions.clearCookie(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ) {
    return this.auth.updateProfile(user, body);
  }

  /** Changes the password and signs out every other session. */
  @Throttle(strictLimit)
  @HttpCode(204)
  @Post('me/password')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePasswordInput,
  ) {
    await this.auth.changePassword(user, body);
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (token) await this.sessions.invalidateOthers(user.id, token);
  }

  private async startSession(res: Response, userId: string) {
    const { token, expiresAt } = await this.sessions.create(userId);
    this.sessions.setCookie(res, token, expiresAt);
  }
}
