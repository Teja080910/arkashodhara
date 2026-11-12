import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from '@platform/common';
import { TokenVerifier, TOKEN_VERIFIER } from '@platform/authz';
import { AuthController } from './auth.controller';
import { AdminController } from './admin.controller';
import { HealthController } from './health.controller';
import { AuthService } from './auth.service';
import { InternalController } from './internal.controller';
import { INTERNAL_SERVICE_TOKEN } from './tokens';
import { buildAuthRuntimeOptions, loadEnv } from './env';

@Module({
  controllers: [AuthController, AdminController, HealthController, InternalController],
  providers: [
    {
      provide: AuthService,
      useFactory: () => new AuthService(buildAuthRuntimeOptions(loadEnv())),
    },
    {
      provide: INTERNAL_SERVICE_TOKEN,
      useFactory: () => loadEnv().INTERNAL_SERVICE_TOKEN ?? null,
    },
    {
      provide: TOKEN_VERIFIER,
      useFactory: (): TokenVerifier => {
        const env = loadEnv();
        return new TokenVerifier({
          jwksUrl: `${env.AUTH_BASE_URL.replace(/\/$/, '')}/api/auth/.well-known/jwks.json`,
          issuer: env.AUTH_BASE_URL,
          audience: 'platform',
          cacheTtlSeconds: 300,
        });
      },
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
