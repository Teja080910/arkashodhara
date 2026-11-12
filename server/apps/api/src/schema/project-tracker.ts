import {
  bigint,
  boolean,
  date,
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

export const roles = pgTable('roles', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
});

export const profiles = pgTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    role: text('role').notNull().default('viewer'),
    disabled: boolean('disabled').notNull().default(false),
    githubId: text('github_id'),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('profiles_email_key').on(sql`lower(${table.email})`)],
);

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    clientName: text('client_name'),
    status: text('status').notNull().default('active'),
    ownerId: text('owner_id')
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_name_key').on(table.name),
    uniqueIndex('projects_slug_key').on(table.slug),
  ],
);

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('developer'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_members_project_user_key').on(table.projectId, table.userId),
    index('idx_project_members_project_id').on(table.projectId),
    index('idx_project_members_user_id').on(table.userId),
  ],
);

export const versions = pgTable(
  'versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    releaseDate: date('release_date'),
    status: text('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('versions_project_name_key').on(table.projectId, table.name),
    uniqueIndex('versions_project_slug_key').on(table.projectId, table.slug),
    index('idx_versions_project_id').on(table.projectId),
  ],
);

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').default('gray'),
  },
  (table) => [uniqueIndex('tags_project_name_key').on(table.projectId, table.name)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    number: integer('number').notNull().unique(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    versionId: uuid('version_id').references(() => versions.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull().default('task'),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('medium'),
    assigneeId: text('assignee_id').references(() => profiles.id, { onDelete: 'set null' }),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => profiles.id),
    dueDate: date('due_date'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: text('deleted_by').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_tasks_project_id').on(table.projectId),
    index('idx_tasks_version_id').on(table.versionId),
    index('idx_tasks_assignee_id').on(table.assigneeId),
    index('idx_tasks_status').on(table.status),
    index('idx_tasks_type').on(table.type),
  ],
);

export const taskTags = pgTable(
  'task_tags',
  {
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [uniqueIndex('task_tags_pkey').on(table.taskId, table.tagId)],
);

export const taskImages = pgTable(
  'task_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    storagePath: text('storage_path').notNull(),
    fileName: text('file_name'),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_task_images_task_id').on(table.taskId)],
);

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    imagePath: text('image_path'),
    fileType: text('file_type'),
    fileName: text('file_name'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    editedAt: timestamp('edited_at', { withTimezone: true }),
  },
  (table) => [index('idx_comments_task_id').on(table.taskId)],
);

export const commentReactions = pgTable(
  'comment_reactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    commentId: uuid('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    emoji: text('emoji').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('comment_reactions_comment_user_emoji_key').on(table.commentId, table.userId, table.emoji),
    index('idx_comment_reactions_comment_id').on(table.commentId),
    index('idx_comment_reactions_user_id').on(table.userId),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').references(() => profiles.id, { onDelete: 'set null' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    priority: text('priority'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('idx_notifications_user_id').on(table.userId)],
);

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => profiles.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_activity_logs_project_id').on(table.projectId),
    index('idx_activity_logs_task_id').on(table.taskId),
  ],
);

export const personalAccessTokens = pgTable(
  'personal_access_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('token'),
    tokenHash: text('token_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('personal_access_tokens_hash_key').on(table.tokenHash),
    index('idx_pats_user').on(table.userId),
  ],
);

export const projectApks = pgTable(
  'project_apks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    uploadedBy: text('uploaded_by').references(() => profiles.id),
    number: integer('number').notNull(),
    fileName: text('file_name').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    storagePath: text('storage_path').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('project_apks_storage_path_key').on(table.storagePath),
    index('idx_apks_project').on(table.projectId, table.createdAt.desc()),
  ],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('push_subscriptions_endpoint_key').on(table.endpoint),
    index('idx_push_subscriptions_user').on(table.userId),
  ],
);

export const projectDocs = pgTable(
  'project_docs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    title: text('title').notNull().default('Untitled'),
    content: text('content').notNull().default(''),
    createdBy: text('created_by').references(() => profiles.id, { onDelete: 'set null' }),
    updatedBy: text('updated_by').references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_project_docs_project_id').on(table.projectId),
    index('idx_project_docs_parent_id').on(table.parentId),
  ],
);

export type PtProfile = typeof profiles.$inferSelect;
export type PtProject = typeof projects.$inferSelect;
export type PtTask = typeof tasks.$inferSelect;
export type PtComment = typeof comments.$inferSelect;
export type PtNotification = typeof notifications.$inferSelect;
export type PtDoc = typeof projectDocs.$inferSelect;
export type PtApk = typeof projectApks.$inferSelect;
