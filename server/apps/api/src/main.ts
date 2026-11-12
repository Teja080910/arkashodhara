import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { WsAdapter } from '@nestjs/platform-ws';
import { loadEnv, csv } from './env';
import { runMigrations } from './migrate';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const logger = new Logger(`api:${env.PROJECT}`);

  if (env.RUN_MIGRATIONS) {
    await runMigrations(env.DATABASE_URL, env.PROJECT, join(__dirname, '..', 'migrations'));
    logger.log('Database schema ensured');
  }

  const app = await NestFactory.create(AppModule.forRoot(env), {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableCors({
    origin: csv(env.CORS_ORIGINS).length > 0 ? csv(env.CORS_ORIGINS) : false,
    credentials: true,
  });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.log(`${env.PROJECT} API listening on ${env.PORT}`);
}

bootstrap().catch((error) => {
  console.error('API bootstrap failed', error);
  process.exit(1);
});
