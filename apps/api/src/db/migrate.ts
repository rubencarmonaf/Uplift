import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { env } from '../config/env.js';
import { createDb } from './client.js';

const { db, sql } = createDb(env.DATABASE_URL);
await migrate(db, { migrationsFolder: './drizzle' });
await sql.end();
console.log('Migrations applied');
