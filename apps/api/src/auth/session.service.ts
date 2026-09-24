import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import type { Response } from 'express';
import { isProd } from '../config/env.js';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { sessions, users } from '../db/schema.js';

export const SESSION_COOKIE = 'uplift_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Sessions are extended when they are used past half of their lifetime.
const RENEW_THRESHOLD_MS = SESSION_TTL_MS / 2;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class SessionService {
  constructor(@InjectDb() private readonly db: Db) {}

  async create(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
    return { token, expiresAt };
  }

  async validate(token: string) {
    const id = hashToken(token);
    const [row] = await this.db
      .select({ session: sessions, user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(eq(sessions.id, id));
    if (!row) return null;

    const { session, user } = row;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.db.delete(sessions).where(eq(sessions.id, id));
      return null;
    }

    let expiresAt = session.expiresAt;
    let renewed = false;
    if (expiresAt.getTime() - Date.now() < RENEW_THRESHOLD_MS) {
      expiresAt = new Date(Date.now() + SESSION_TTL_MS);
      await this.db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id));
      renewed = true;
    }
    return { user, expiresAt, renewed };
  }

  /** Signs the user out everywhere except the session holding `keepToken`. */
  async invalidateOthers(userId: string, keepToken: string) {
    await this.db
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.id, hashToken(keepToken))));
  }

  async invalidate(token: string) {
    await this.db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  setCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}
