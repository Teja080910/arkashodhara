import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const flows = pgTable(
  'flows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    name: text('name').notNull().default('Untitled flow'),
    graph: jsonb('graph')
      .$type<{ nodes: unknown[]; relations: unknown[] }>()
      .notNull()
      .default(sql`'{"nodes":[],"relations":[]}'::jsonb`),
    visibility: text('visibility').notNull().default('private'),
    shareToken: text('share_token'),
    teamId: uuid('team_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('flows_owner_updated_idx').on(table.ownerId, table.updatedAt.desc()),
    index('flows_team_updated_idx').on(table.teamId, table.updatedAt.desc()),
    uniqueIndex('flows_share_token_key').on(table.shareToken).where(sql`${table.shareToken} is not null`),
  ],
);

export const flowMembers = pgTable(
  'flow_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    flowId: uuid('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    invitedBy: text('invited_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('flow_members_flow_email_key').on(table.flowId, sql`lower(${table.email})`),
    index('flow_members_email_idx').on(sql`lower(${table.email})`),
  ],
);

export const flowActivity = pgTable(
  'flow_activity',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    flowId: uuid('flow_id')
      .notNull()
      .references(() => flows.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('flow_activity_flow_created_idx').on(table.flowId, table.createdAt.desc())],
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull().default('Untitled team'),
    ownerId: text('owner_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('teams_owner_idx').on(table.ownerId)],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role').notNull().default('viewer'),
    invitedBy: text('invited_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('team_members_team_email_key').on(table.teamId, sql`lower(${table.email})`),
    index('team_members_email_idx').on(sql`lower(${table.email})`),
  ],
);

export const teamActivity = pgTable(
  'team_activity',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    actorId: text('actor_id'),
    actorEmail: text('actor_email'),
    action: text('action').notNull(),
    detail: jsonb('detail').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('team_activity_team_created_idx').on(table.teamId, table.createdAt.desc())],
);

export const imageObjects = pgTable(
  'image_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id').notNull(),
    bucket: text('bucket').notNull(),
    objectKey: text('object_key').notNull(),
    contentType: text('content_type'),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('image_objects_bucket_key_key').on(table.bucket, table.objectKey),
    index('image_objects_owner_idx').on(table.ownerId),
  ],
);

export type Flow = typeof flows.$inferSelect;
export type NewFlow = typeof flows.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type FlowMember = typeof flowMembers.$inferSelect;
