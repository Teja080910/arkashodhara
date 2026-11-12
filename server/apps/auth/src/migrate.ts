import { Pool } from 'pg';
import { getMigrations } from 'better-auth/db/migration';
import type { BetterAuthOptions } from 'better-auth';
import { buildAuth } from './auth.config';

export const APP_MEMBERSHIP_DDL = `
create table if not exists app_membership (
  user_id text not null references "user" (id) on delete cascade,
  app text not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, app)
);

create index if not exists app_membership_app_idx on app_membership (app);
`;

export interface MigrationOptions {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
}

export async function runMigrations(options: MigrationOptions): Promise<string> {
  const pool = new Pool({ connectionString: options.databaseUrl, max: 1 });
  try {
    const auth = buildAuth(pool, {
      databaseUrl: options.databaseUrl,
      secret: options.secret,
      baseUrl: options.baseUrl,
      trustedOrigins: [],
    });
    const betterAuthOptions = (auth as unknown as { options: BetterAuthOptions }).options;
    const plan = await getMigrations(betterAuthOptions, { throwOnUnsafe: false });
    const preview = await plan.compileMigrations();
    await plan.runMigrations();
    await pool.query(APP_MEMBERSHIP_DDL);
    return preview;
  } finally {
    await pool.end();
  }
}
