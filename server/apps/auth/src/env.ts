import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 chars'),
  AUTH_BASE_URL: z.string().url(),
  AUTH_TRUSTED_ORIGINS: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  AUTH_RUN_MIGRATIONS: booleanish.default(true),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  DISABLE_JWKS_ENCRYPTION: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === 'true' || v === '1')
    .default(false),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid auth environment: ${details}`);
  }
  return parsed.data;
}

export function parseCsv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function buildAuthRuntimeOptions(env: Env) {
  return {
    databaseUrl: env.DATABASE_URL,
    secret: env.AUTH_SECRET,
    baseUrl: env.AUTH_BASE_URL,
    internalServiceToken: env.INTERNAL_SERVICE_TOKEN,
    disableJwksEncryption: env.DISABLE_JWKS_ENCRYPTION,
    trustedOrigins: parseCsv(env.AUTH_TRUSTED_ORIGINS),
    google:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
        : undefined,
    smtp:
      env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM
        ? {
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
            from: env.SMTP_FROM,
          }
        : undefined,
  };
}
