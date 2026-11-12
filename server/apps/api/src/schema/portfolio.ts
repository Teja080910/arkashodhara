import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    firstname: text('firstname').notNull().default(''),
    lastname: text('lastname').notNull().default(''),
    role: text('role').notNull().default(''),
    phone: text('phone').notNull().default(''),
    photo: text('photo'),
    description: text('description'),
    gitlink: text('gitlink'),
    linkedin: text('linkedin'),
    resumelink: text('resumelink'),
    show: boolean('show').notNull().default(true),
    type: text('type').notNull().default('user'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('profiles_username_key').on(table.username),
    uniqueIndex('profiles_email_key').on(sql`lower(${table.email})`),
  ],
);

export const portfolioContents = pgTable('portfolio_contents', {
  userId: text('user_id')
    .primaryKey()
    .references(() => profiles.id, { onDelete: 'cascade' }),
  about: jsonb('about').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  skills: jsonb('skills').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  projects: jsonb('projects').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  experience: jsonb('experience').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  education: jsonb('education').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  certificates: jsonb('certificates').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  contentChannels: jsonb('content_channels').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  contentWorks: jsonb('content_works').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  collaborations: jsonb('collaborations').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  creatorTools: jsonb('creator_tools').$type<unknown[]>().notNull().default(sql`'[]'::jsonb`),
  template: text('template').notNull().default('software'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const guideContent = pgTable(
  'guide_content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    section: text('section').notNull(),
    title: text('title'),
    subtitle: text('subtitle'),
    content: jsonb('content').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    sortOrder: integer('sort_order').notNull().default(0),
    show: boolean('show').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('guide_content_section_key').on(table.section)],
);

export const apiTokens = pgTable(
  'api_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    name: text('name').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revoked: boolean('revoked').notNull().default(false),
  },
  (table) => [
    uniqueIndex('api_tokens_hash_key').on(table.tokenHash),
    index('api_tokens_user_idx').on(table.userId),
  ],
);

export const folioTeams = pgTable(
  'folio_teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull().default(''),
    tagline: text('tagline'),
    description: text('description'),
    logo: text('logo'),
    show: boolean('show').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('folio_teams_slug_key').on(table.slug)],
);

export const folioTeamMembers = pgTable(
  'folio_team_members',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => folioTeams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    title: text('title'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('folio_team_members_pkey').on(table.teamId, table.userId),
    index('folio_team_members_user_idx').on(table.userId),
  ],
);

export const folioTeamInvites = pgTable(
  'folio_team_invites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => folioTeams.id, { onDelete: 'cascade' }),
    email: text('email'),
    tokenHash: text('token_hash').notNull(),
    invitedBy: text('invited_by').references(() => profiles.id, { onDelete: 'set null' }),
    expiresAt: timestamp('expires_at', { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '7 days'`),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revoked: boolean('revoked').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('folio_team_invites_token_key').on(table.tokenHash),
    index('folio_team_invites_team_idx').on(table.teamId),
    index('folio_team_invites_email_idx').on(sql`lower(${table.email})`),
  ],
);

export const folioTeamContentShares = pgTable(
  'folio_team_content_shares',
  {
    teamId: uuid('team_id')
      .notNull()
      .references(() => folioTeams.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    section: text('section').notNull(),
    itemId: text('item_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('folio_team_content_shares_pkey').on(table.teamId, table.userId, table.section, table.itemId),
    index('folio_team_content_shares_team_idx').on(table.teamId),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type FolioTeam = typeof folioTeams.$inferSelect;
export type FolioTeamMember = typeof folioTeamMembers.$inferSelect;
