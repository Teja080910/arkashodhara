import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '@platform/authz';
import type { Pool } from 'pg';
import { PG_POOL, ENV } from './core.module';
import { STORAGE } from './infrastructure.module';
import type { ObjectStorage } from '@platform/storage';
import type { Env } from './env';
import type { HealthResponse } from '@platform/contracts';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Public()
  @Get()
  async health(): Promise<HealthResponse> {
    let database: 'up' | 'down' = 'down';
    try {
      await this.pool.query('select 1');
      database = 'up';
    } catch {
      database = 'down';
    }

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      project: this.env.PROJECT,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      checks: { database, storage: 'unchecked' },
    };
  }
}
