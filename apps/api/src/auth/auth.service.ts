import { hash, verify } from '@node-rs/argon2';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { LoginInput, MeResponse, RegisterInput } from '@uplift/shared';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client.js';
import { InjectDb } from '../db/db.module.js';
import { memberships, organizations, users } from '../db/schema.js';
import type { AuthUser } from './current-user.decorator.js';

// Verified against when the email does not exist, so both paths take the same time.
const DUMMY_HASH = await hash('uplift-timing-safe-dummy-password');

@Injectable()
export class AuthService {
  constructor(@InjectDb() private readonly db: Db) {}

  async register({ name, email, password }: RegisterInput): Promise<AuthUser> {
    const [existing] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await hash(password);
    return this.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ name, email, passwordHash }).returning();
      const [org] = await tx
        .insert(organizations)
        .values({ name: `${name}'s workspace` })
        .returning();
      await tx
        .insert(memberships)
        .values({ userId: user!.id, organizationId: org!.id, role: 'admin' });
      return user!;
    });
  }

  async login({ email, password }: LoginInput): Promise<AuthUser> {
    const [user] = await this.db.select().from(users).where(eq(users.email, email));
    const valid = await verify(user?.passwordHash ?? DUMMY_HASH, password);
    if (!user || !valid) throw new UnauthorizedException('Invalid email or password');
    return user;
  }

  async me(user: AuthUser): Promise<MeResponse> {
    const orgs = await this.db
      .select({ id: organizations.id, name: organizations.name, role: memberships.role })
      .from(memberships)
      .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
      .where(eq(memberships.userId, user.id));
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        locale: user.locale,
        isDemo: user.isDemo,
      },
      organizations: orgs,
    };
  }
}
