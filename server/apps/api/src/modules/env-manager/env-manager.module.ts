import { Module } from '@nestjs/common';
import { EnvManagerController, PublicEnvController } from './env-manager.controller';
import { EnvManagerService } from './env-manager.service';
import { CryptoService } from './crypto.service';
import { ENV } from '../../core.module';
import type { Env } from '../../env';

@Module({
  controllers: [EnvManagerController, PublicEnvController],
  providers: [
    EnvManagerService,
    {
      provide: CryptoService,
      inject: [ENV],
      useFactory: (env: Env) => new CryptoService(env.APP_SECRET ?? env.S3_SECRET_KEY),
    },
  ],
})
export class EnvManagerModule {}
