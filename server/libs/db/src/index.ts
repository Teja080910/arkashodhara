import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';

export type Database = NodePgDatabase<Record<string, never>>;

let pool: Pool | undefined;
let db: Database | undefined;

export interface DatabaseOptions {
  url: string;
  max?: number;
  ssl?: boolean;
}

export function createDatabase(options: DatabaseOptions): { db: Database; pool: Pool } {
  const poolInstance = new Pool({
    connectionString: options.url,
    max: options.max ?? 10,
    ssl: options.ssl ? { rejectUnauthorized: false } : undefined,
  });
  const database = drizzle(poolInstance);
  return { db: database, pool: poolInstance };
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database has not been initialised');
  return db;
}

export function getPool(): Pool {
  if (!pool) throw new Error('Database pool has not been initialised');
  return pool;
}

export function initDatabase(options: DatabaseOptions): Database {
  const created = createDatabase(options);
  db = created.db;
  pool = created.pool;
  return db;
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
    db = undefined;
  }
}

export {
  sql,
  eq,
  and,
  or,
  ne,
  gt,
  gte,
  lt,
  lte,
  desc,
  asc,
  ilike,
  inArray,
  notInArray,
  isNull,
  isNotNull,
  count,
  exists,
  getTableColumns,
} from 'drizzle-orm';
