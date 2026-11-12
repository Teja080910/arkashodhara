import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadEnv } from './env';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger('Auth');

  if (env.AUTH_RUN_MIGRATIONS) {
    const { runMigrations } = await import('./migrate');
    await runMigrations({ databaseUrl: env.DATABASE_URL, secret: env.AUTH_SECRET, baseUrl: env.AUTH_BASE_URL });
    logger.log('Auth schema ensured');
  }

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] });
  app.enableCors({
    origin: env.AUTH_TRUSTED_ORIGINS ? env.AUTH_TRUSTED_ORIGINS.split(',').map((s) => s.trim()) : true,
    credentials: true,
  });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
  logger.log(`Auth service listening on ${env.PORT}`);
}

bootstrap().catch((error) => {
  console.error('Auth bootstrap failed', error);
  process.exit(1);
});
