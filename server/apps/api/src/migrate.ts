import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { Pool } from 'pg';

const logger = new Logger('Migrator');

export async function runMigrations(databaseUrl: string, project: string, migrationsDir: string): Promise<void> {
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  try {
    await pool.query(`
      create table if not exists platform_migrations (
        project text not null,
        version text not null,
        applied_at timestamptz not null default now(),
        primary key (project, version)
      );
    `);

    const directory = join(migrationsDir, project);
    let files: string[] = [];
    try {
      files = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
    } catch {
      logger.warn(`No migrations directory for project ${project} (${directory})`);
      return;
    }

    const applied = new Set(
      (
        await pool.query<{ version: string }>('select version from platform_migrations where project = $1', [
          project,
        ])
      ).rows.map((row) => row.version),
    );

    for (const file of files) {
      if (applied.has(file)) continue;
      const sqlText = await readFile(join(directory, file), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(sqlText);
        await client.query('insert into platform_migrations (project, version) values ($1, $2)', [project, file]);
        await client.query('commit');
        logger.log(`Applied ${project}/${file}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}
