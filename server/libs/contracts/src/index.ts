import { z } from 'zod';

export const presetSchema = z.enum(['arkasodhara', 'drawer', 'env-manager', 'portfolio', 'project-tracker']);
export type ProjectPreset = z.infer<typeof presetSchema>;

export const roleSchema = z.enum(['owner', 'admin', 'editor', 'viewer']);
export type Role = z.infer<typeof roleSchema>;

export const visibilitySchema = z.enum(['private', 'public']);

export const presignRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(128).optional(),
  sizeBytes: z.number().int().nonnegative().optional(),
});
export type PresignRequest = z.infer<typeof presignRequestSchema>;

export const presignResponseSchema = z.object({
  uploadUrl: z.string(),
  objectKey: z.string(),
  publicUrl: z.string().optional(),
  expiresAt: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const contactRequestSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(1).max(4000),
});

export const flowCreateSchema = z.object({
  name: z.string().min(1).max(120).default('Untitled flow'),
  teamId: z.string().uuid().nullish(),
});

export const flowUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: z.object({ nodes: z.array(z.unknown()), relations: z.array(z.unknown()) }).optional(),
  visibility: visibilitySchema.optional(),
});

export const teamCreateSchema = z.object({
  name: z.string().min(1).max(120).default('Untitled team'),
});

export const teamUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
});

export const memberAddSchema = z.object({
  email: z.string().email(),
  role: roleSchema.default('viewer'),
});

export const memberUpdateSchema = z.object({
  role: roleSchema,
});

export const transferTeamSchema = z.object({
  newOwnerEmail: z.string().email(),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(200).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;

export interface ApiErrorBody {
  error: { code: string; message: string };
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  project: string;
  uptimeSeconds: number;
  checks: { database: 'up' | 'down'; storage: 'up' | 'down' | 'unchecked' };
}
