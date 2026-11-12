import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { loadEnv, type Env } from './env';

export const DB = 'PLATFORM_DB';
export const PG_POOL = 'PLATFORM_PG_POOL';
export const ENV = 'PLATFORM_ENV';

export type Database = NodePgDatabase<Record<string, never>>;

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): Env => loadEnv(),
    },
    {
      provide: PG_POOL,
      inject: [ENV],
      useFactory: (env: Env): Pool =>
        new Pool({
          connectionString: env.DATABASE_URL,
          max: env.DATABASE_POOL_MAX,
          ssl: env.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
        }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      useFactory: (pool: Pool): Database => drizzle(pool),
    },
  ],
  exports: [DB, PG_POOL, ENV],
})
export class CoreModule implements OnApplicationShutdown {
  constructor() {}

  async onApplicationShutdown(): Promise<void> {}
}
