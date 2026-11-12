import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';
import type { Auth } from './auth.config';
import { createAuth } from './auth.config';

export interface AuthRuntimeOptions {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
  smtp?: { host: string; port: number; user?: string; pass?: string; from: string };
  disableJwksEncryption?: boolean;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string | null;
  createdAt: string;
  [key: string]: unknown;
}

@Injectable()
export class AuthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthService.name);
  readonly pool: Pool;
  readonly auth: Auth;

  constructor(private readonly options: AuthRuntimeOptions) {
    const runtime = createAuth({
      databaseUrl: options.databaseUrl,
      secret: options.secret,
      baseUrl: options.baseUrl,
      trustedOrigins: options.trustedOrigins,
      google: options.google,
      smtp: options.smtp,
      disableJwksEncryption: options.disableJwksEncryption,
    });
    this.pool = runtime.pool;
    this.auth = runtime.auth;
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query('select 1');
    this.logger.log('Auth connected to database');
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('select 1');
      return true;
    } catch {
      return false;
    }
  }

  async query<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(text, values);
    return result.rows as T[];
  }

  async findUserByEmail(email: string): Promise<{ id: string; email: string; name: string } | null> {
    const rows = await this.query<{ id: string; email: string; name: string }>(
      'select id, email, name from "user" where lower(email) = lower($1) limit 1',
      [email],
    );
    return rows[0] ?? null;
  }

  async createUser(input: { email: string; password: string; name: string }): Promise<{ id: string; email: string; name: string }> {
    const result = await this.auth.api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
      },
    });
    return { id: result.user.id, email: result.user.email, name: result.user.name };
  }

  async listUsers(input: { limit: number; offset: number; query?: string }): Promise<{ total: number; users: UserRow[] }> {
    const where = input.query ? 'where lower(email) like lower($3) or lower(name) like lower($3)' : '';
    const params: unknown[] = [input.limit, input.offset];
    if (input.query) params.push(`%${input.query}%`);

    const users = await this.query<UserRow>(
      `select id, email, name, role, created_at as "createdAt"
         from "user" ${where}
        order by created_at desc
        limit $1 offset $2`,
      params,
    );
    const totalRows = await this.query<{ count: string }>(
      `select count(*)::text as count from "user" ${input.query ? where.replace('$3', '$1') : ''}`,
      input.query ? [`%${input.query}%`] : [],
    );
    return { total: Number(totalRows[0]?.count ?? 0), users };
  }

  async appMemberships(project: string): Promise<Array<{ userId: string; email: string; role: string }>> {
    return this.query(
      `select m.user_id as "userId", u.email as email, m.role as role
         from app_membership m
         join "user" u on u.id = m.user_id
        where m.app = $1
        order by u.email`,
      [project],
    );
  }

  async setAppMembership(userId: string, project: string, role: string): Promise<void> {
    await this.query(
      `insert into app_membership (user_id, app, role, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (user_id, app) do update set role = excluded.role, updated_at = now()`,
      [userId, project, role],
    );
  }

  async removeAppMembership(userId: string, project: string): Promise<void> {
    await this.query('delete from app_membership where user_id = $1 and app = $2', [userId, project]);
  }
}
