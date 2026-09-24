import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

export function createDb(url: string) {
  const sql = postgres(url);
  return { sql, db: drizzle(sql, { schema }) };
}

export type Db = ReturnType<typeof createDb>['db'];
