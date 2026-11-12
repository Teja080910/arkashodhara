import { Global, Module, Inject } from '@nestjs/common';
import { ObjectStorage } from '@platform/storage';
import { OptionalAuthService, TokenVerifier } from '@platform/authz';
import { TOKEN_VERIFIER } from '@platform/authz';
import type { Env } from './env';
import { ENV } from './core.module';

export const STORAGE = 'PLATFORM_STORAGE';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE,
      inject: [ENV],
      useFactory: (env: Env): ObjectStorage =>
        new ObjectStorage({
          endpoint: env.S3_ENDPOINT,
          presignEndpoint: env.S3_PRESIGN_ENDPOINT,
          region: env.S3_REGION,
          bucket: env.S3_BUCKET,
          accessKey: env.S3_ACCESS_KEY,
          secretKey: env.S3_SECRET_KEY,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          signedUrlTtlSeconds: env.S3_SIGNED_URL_TTL_SECONDS,
          publicBaseUrl: env.S3_PUBLIC_BASE_URL,
        }),
    },
    OptionalAuthService,
    {
      provide: TOKEN_VERIFIER,
      inject: [ENV],
      useFactory: (env: Env): TokenVerifier =>
        new TokenVerifier({
          jwksUrl: env.AUTH_JWKS_URL,
          issuer: env.AUTH_ISSUER,
          audience: env.AUTH_AUDIENCE,
          cacheTtlSeconds: env.AUTH_JWKS_CACHE_TTL_SECONDS,
        }),
    },
  ],
  exports: [STORAGE, TOKEN_VERIFIER, OptionalAuthService],
})
export class InfrastructureModule {}
