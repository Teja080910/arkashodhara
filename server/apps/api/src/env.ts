import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === 'true' || v === '1');

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4101),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  PROJECT: z.enum(['arkasodhara', 'drawer', 'env-manager', 'portfolio', 'project-tracker']),

  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: booleanish.default(false),

  AUTH_ISSUER: z.string().url(),
  AUTH_JWKS_URL: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_URL: z.string().url().optional(),
  INTERNAL_SERVICE_TOKEN: z.string().optional(),
  AUTH_JWKS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  S3_ENDPOINT: z.string().url(),
  S3_PRESIGN_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanish.default(true),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),

  CORS_ORIGINS: z.string().default(''),

  FEATURE_TEAMS: booleanish.default(true),
  FEATURE_REALTIME: booleanish.default(false),
  FEATURE_PUSH: booleanish.default(false),
  FEATURE_APK_UPLOAD: booleanish.default(false),
  FEATURE_METRICS: booleanish.default(false),

  APP_SECRET: z.string().min(16).optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  RUN_MIGRATIONS: booleanish.default(true),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
    throw new Error(`Invalid api environment: ${details}`);
  }
  return parsed.data;
}

export function csv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
