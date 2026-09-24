import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import type { Sql } from 'postgres';
import { env } from '../config/env.js';
import { createDb } from './client.js';

export const DB = Symbol('DB');
const SQL = Symbol('SQL');

/** Injects the Drizzle client: `constructor(@InjectDb() private readonly db: Db)`. */
export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    { provide: SQL, useFactory: () => createDb(env.DATABASE_URL) },
    { provide: DB, useFactory: (conn: ReturnType<typeof createDb>) => conn.db, inject: [SQL] },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(SQL) private readonly conn: { sql: Sql }) {}

  async onApplicationShutdown() {
    await this.conn.sql.end();
  }
}
