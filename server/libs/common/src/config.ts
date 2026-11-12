import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === 'true' || value === '1');

export const baseEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4100),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  DATABASE_SSL: booleanish.default(false),
});

export const authEnvSchema = z.object({
  AUTH_ISSUER: z.string().url(),
  AUTH_JWKS_URL: z.string().url(),
  AUTH_AUDIENCE: z.string().min(1),
  AUTH_JWKS_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
});

export const storageEnvSchema = z.object({
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleanish.default(true),
  S3_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  S3_PUBLIC_BASE_URL: z.string().url().optional(),
});

export const apiEnvSchema = baseEnvSchema
  .merge(databaseEnvSchema)
  .merge(authEnvSchema)
  .merge(storageEnvSchema)
  .extend({
    PROJECT: z.enum(['arkasodhara', 'drawer', 'env-manager', 'portfolio', 'project-tracker']),
    CORS_ORIGINS: z.string().default(''),
    FEATURE_TEAMS: booleanish.default(true),
    FEATURE_REALTIME: booleanish.default(false),
    FEATURE_PUSH: booleanish.default(false),
    FEATURE_APK_UPLOAD: booleanish.default(false),
    FEATURE_METRICS: booleanish.default(false),
    METRICS_ALLOWED_HOSTS: z.string().default(''),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    VAPID_PUBLIC_KEY: z.string().optional(),
    VAPID_PRIVATE_KEY: z.string().optional(),
    VAPID_SUBJECT: z.string().optional(),
  });

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type BaseEnv = z.infer<typeof baseEnvSchema>;

export function loadEnv<T extends z.ZodTypeAny>(schema: T, source: NodeJS.ProcessEnv = process.env): z.infer<T> {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return parsed.data;
}

export function csv(value: string): string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}
