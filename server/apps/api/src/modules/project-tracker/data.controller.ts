import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalAuthService, type AuthUser, type AuthedRequest } from '@platform/authz';
import { ForbiddenError, NotFoundError } from '@platform/common';
import { and, asc, count, desc, eq, getTableColumns, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Database } from '../../core.module';
import { ProjectTrackerService } from './project-tracker.service';
import {
  activityLogs,
  commentReactions,
  comments,
  notifications,
  personalAccessTokens,
  profiles,
  projectApks,
  projectDocs,
  projectMembers,
  projects,
  pushSubscriptions,
  roles,
  tags,
  taskImages,
  taskTags,
  tasks,
  versions,
} from '../../schema/project-tracker';

const TABLES = {
  profiles,
  projects,
  project_members: projectMembers,
  versions,
  tasks,
  tags,
  task_tags: taskTags,
  task_images: taskImages,
  comments,
  comment_reactions: commentReactions,
  notifications,
  activity_logs: activityLogs,
  personal_access_tokens: personalAccessTokens,
  project_apks: projectApks,
  push_subscriptions: pushSubscriptions,
  project_docs: projectDocs,
  roles,
} as const;

type TableName = keyof typeof TABLES;

const querySchema = z.object({
  eq: z.string().optional(),
  neq: z.string().optional(),
  in: z.string().optional(),
  order: z.string().optional(),
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
  single: z.enum(['true', 'maybe']).optional(),
  count: z.enum(['true']).optional(),
  head: z.enum(['true']).optional(),
});

function toCamel(column: string): string {
  return column.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function parsePairs(raw?: string): Array<[string, string]> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => {
      const index = pair.indexOf(':');
      if (index < 0) return null;
      return [pair.slice(0, index), pair.slice(index + 1)] as [string, string];
    })
    .filter((pair): pair is [string, string] => pair !== null);
}

@Controller('pt/data')
export class ProjectTrackerDataController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly optionalAuth: OptionalAuthService,
    private readonly tracker: ProjectTrackerService,
  ) {}

  private async viewer(request: Request): Promise<AuthUser | null> {
    return this.optionalAuth.userFromRequest(request as AuthedRequest);
  }

  private async requireActive(request: Request): Promise<AuthUser> {
    const user = await this.viewer(request);
    if (!user) throw new ForbiddenError('Sign in first');
    const profile = await this.tracker.ensureProfile(user);
    if (profile.disabled) throw new ForbiddenError('Account disabled');
    return user;
  }

  private table(name: string): any {
    if (!(name in TABLES)) throw new NotFoundError(`Unknown table ${name}`);
    return TABLES[name as TableName];
  }

  @Get(':table')
  async select(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const query = querySchema.parse(rawQuery);
    const user = await this.requireActive(request);

    const col = (column: string): unknown => table[column] ?? table[toCamel(column)];
    const conditions = parsePairs(query.eq)
      .filter(([column]) => col(column))
      .map(([column, value]) =>
        value === '' ? sql`${col(column)} is null` : sql`${col(column)}::text = ${value}`,
      );
    for (const [column, list] of parsePairs(query.neq)) {
      if (!col(column)) continue;
      conditions.push(list === 'null' ? sql`${col(column)} is not null` : sql`${col(column)}::text <> ${list}`);
    }
    for (const [column, list] of parsePairs(query.in)) {
      if (!col(column)) continue;
      conditions.push(inArray(col(column) as any, list.split('|')));
    }

    if (name === 'notifications' || name === 'push_subscriptions' || name === 'personal_access_tokens') {
      conditions.push(eq((table as typeof notifications).userId, user.id));
    }
    if (name === 'tasks') {
      conditions.push(isNull(tasks.deletedAt));
    }

    const orderParts = query.order ? query.order.split(':') : [];
    const orderColumn = orderParts[0];
    const direction = orderParts[1] === 'desc' ? desc : asc;

    if (query.count === 'true' && query.head === 'true') {
      const result = await this.db
        .select({ value: count() })
        .from(table)
        .where(conditions.length ? and(...conditions) : undefined);
      return result[0]?.value ?? 0;
    }

    let statement = this.db
      .select()
      .from(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    const orderCol = orderColumn ? (table[orderColumn] ?? table[toCamel(orderColumn)]) : undefined;
    if (orderCol) {
      statement = statement.orderBy(direction(orderCol));
    }
    if (query.limit) statement = statement.limit(query.limit);
    if (query.offset) statement = statement.offset(query.offset);

    const rows = (await statement) as unknown[];
    const serialized = rows.map((row) => serializeRow(table, row));
    if (query.single === 'true') {
      if (rows.length !== 1) throw new NotFoundError('Expected one row');
      return serialized[0];
    }
    if (query.single === 'maybe') return serialized[0] ?? null;
    return serialized;
  }

  @Post(':table')
  async insert(
    @Param('table') name: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const user = await this.requireActive(request);
    const payload = this.prepare(name as TableName, z.record(z.string(), z.unknown()).parse(body));
    await this.authorizeInsert(name as TableName, payload, user);

    if (name === 'projects') {
      payload.slug = String(payload.slug ?? slugify(String(payload.name)));
    }
    if (name === 'versions') {
      payload.slug = String(payload.slug ?? slugify(String(payload.name)));
    }
    const inserted = (await this.db.insert(table).values(payload as any).returning()) as unknown[];
    return serializeRow(table, inserted[0]);
  }

  @Post(':table/upsert')
  async upsert(
    @Param('table') name: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const user = await this.requireActive(request);
    const input = z.object({ value: z.record(z.string(), z.unknown()) }).parse(body);
    if (name !== 'push_subscriptions') throw new ForbiddenError('Upsert not supported');
    const payload = this.prepare(name, input.value);
    await this.authorizeInsert(name, payload, user);
    const rows = (await this.db
      .insert(pushSubscriptions)
      .values(payload as never)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: payload as never,
      })
      .returning()) as unknown[];
    return rows.map((row) => serializeRow(pushSubscriptions, row));
  }

  @Patch(':table')
  async update(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    if (name === 'roles' || name === 'activity_logs') throw new ForbiddenError('Table is read-only through this API');
    const user = await this.requireActive(request);
    const query = querySchema.parse(rawQuery);
    const patch = this.prepare(name as TableName, z.record(z.string(), z.unknown()).parse(body));
    delete patch.id;
    delete patch.createdAt;
    if (['tasks', 'versions', 'tags', 'project_apks', 'project_docs', 'project_members'].includes(name)) {
      delete patch.projectId;
    }
    if (name === 'project_members') delete patch.userId;
    if (name === 'comments' || name === 'task_images') delete patch.taskId;
    if (name === 'comments') delete patch.userId;
    if (name === 'task_images') delete patch.uploadedBy;
    if (name === 'notifications' || name === 'push_subscriptions' || name === 'personal_access_tokens') {
      delete patch.userId;
    }
    if (name === 'profiles') {
      const access = await this.tracker.accessFor(user);
      if (!access.globalAdmin) {
        delete patch.role;
        delete patch.disabled;
      }
    }
    if ((table as any).updatedAt && patch.updatedAt === undefined) patch.updatedAt = new Date();

    const conditions = this.conditions(table, query);
    await this.authorizeUpdate(name as TableName, user, conditions, patch);

    const updated = (await this.db
      .update(table)
      .set(patch as any)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning()) as unknown[];
    return updated.map((row) => serializeRow(table, row));
  }

  @Delete(':table')
  async remove(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    if (name === 'roles' || name === 'activity_logs') throw new ForbiddenError('Table is read-only through this API');
    const user = await this.requireActive(request);
    const query = querySchema.parse(rawQuery);

    const conditions = this.conditions(table, query);
    await this.authorizeDelete(name as TableName, user, conditions);

    const removed = (await this.db
      .delete(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning()) as unknown[];
    return removed.map((row) => serializeRow(table, row));
  }

  private conditions(table: any, query: z.infer<typeof querySchema>): ReturnType<typeof sql>[] {
    const col = (column: string): unknown => table[column] ?? table[toCamel(column)];
    const conditions = parsePairs(query.eq)
      .filter(([column]) => col(column))
      .map(([column, value]) =>
        value === '' ? sql`${col(column)} is null` : sql`${col(column)}::text = ${value}`,
      );
    for (const [column, list] of parsePairs(query.in)) {
      if (!col(column)) continue;
      conditions.push(inArray(col(column) as any, list.split('|')));
    }
    return conditions;
  }

  private async authorizeInsert(name: TableName, payload: Record<string, unknown>, user: AuthUser): Promise<void> {
    const access = await this.tracker.accessFor(user);

    if (name === 'roles') throw new ForbiddenError('Roles are managed by admins');
    if (name === 'profiles') {
      payload.id = user.id;
      if (!access.globalAdmin) {
        payload.role = 'viewer';
        payload.disabled = false;
      }
      return;
    }
    if (name === 'projects') {
      if (!access.globalAdmin && access.profile.role !== 'project_admin') {
        throw new ForbiddenError('Only admins can create projects');
      }
      payload.ownerId = user.id;
      return;
    }
    if (name === 'personal_access_tokens' || name === 'push_subscriptions') {
      payload.userId = user.id;
      return;
    }
    if (name === 'project_members' || name === 'versions' || name === 'tags') {
      await this.tracker.assertProjectRole(user, String(payload.projectId), 'admin');
      return;
    }
    if (name === 'project_apks') {
      await this.tracker.assertProjectRole(user, String(payload.projectId), 'developer');
      payload.uploadedBy = user.id;
      if (payload.number === undefined) {
        payload.number = sql`(select coalesce(max(${projectApks.number}), 0) + 1 from ${projectApks} where ${projectApks.projectId} = ${payload.projectId})`;
      }
      return;
    }
    if (name === 'tasks' || name === 'project_docs') {
      await this.tracker.assertProjectRole(user, String(payload.projectId), 'member');
      if (name === 'tasks') payload.reporterId = user.id;
      if (name === 'project_docs') {
        payload.createdBy = user.id;
        payload.updatedBy = user.id;
      }
      return;
    }
    if (name === 'task_tags' || name === 'task_images' || name === 'comments') {
      await this.tracker.assertTaskRole(user, String(payload.taskId), 'member');
      if (name === 'comments') payload.userId = user.id;
      if (name === 'task_images') payload.uploadedBy = user.id;
      return;
    }
    if (name === 'comment_reactions') {
      await this.tracker.assertCommentRole(user, String(payload.commentId), 'member');
      payload.userId = user.id;
      return;
    }
    if (name === 'activity_logs') {
      if (!payload.projectId) throw new ForbiddenError('Project is required');
      await this.tracker.assertProjectRole(user, String(payload.projectId), 'member');
      payload.userId = user.id;
      return;
    }
    if (name === 'notifications') {
      if (payload.projectId) {
        await this.tracker.assertProjectRole(user, String(payload.projectId), 'member');
      } else {
        payload.userId = user.id;
      }
      payload.userId = payload.userId ?? user.id;
      payload.actorId = payload.actorId ?? user.id;
    }
  }

  private async authorizeUpdate(
    name: TableName,
    user: AuthUser,
    conditions: ReturnType<typeof sql>[],
    patch: Record<string, unknown>,
  ): Promise<void> {
    if (name === 'profiles') {
      const access = await this.tracker.accessFor(user);
      if (!access.globalAdmin) {
        conditions.push(eq(profiles.id, user.id));
      } else if (patch.role !== undefined || patch.disabled !== undefined) {
        conditions.push(sql`${profiles.id} <> ${user.id}`);
      }
      return;
    }
    if (name === 'notifications') {
      conditions.push(eq(notifications.userId, user.id));
      return;
    }
    if (name === 'personal_access_tokens') {
      conditions.push(eq(personalAccessTokens.userId, user.id));
      return;
    }
    if (name === 'push_subscriptions') {
      conditions.push(eq(pushSubscriptions.userId, user.id));
      return;
    }
    if (name === 'comments') {
      conditions.push(eq(comments.userId, user.id));
      return;
    }
    if (name === 'comment_reactions') {
      conditions.push(eq(commentReactions.userId, user.id));
      return;
    }
    if (name === 'tasks') {
      await this.scopeProjects(name, user, conditions, 'member');
      return;
    }
    if (name === 'projects' || name === 'project_members' || name === 'versions' || name === 'tags' || name === 'project_apks') {
      await this.scopeProjects(name, user, conditions, 'admin');
      return;
    }
    if (name === 'task_tags' || name === 'task_images' || name === 'project_docs') {
      await this.scopeProjects(name, user, conditions, 'member');
    }
  }

  private async authorizeDelete(
    name: TableName,
    user: AuthUser,
    conditions: ReturnType<typeof sql>[],
  ): Promise<void> {
    if (name === 'profiles') {
      const access = await this.tracker.accessFor(user);
      if (!access.globalAdmin) throw new ForbiddenError('Only admins can delete profiles');
      conditions.push(sql`${profiles.id} <> ${user.id}`);
      return;
    }
    if (name === 'notifications') {
      conditions.push(eq(notifications.userId, user.id));
      return;
    }
    if (name === 'personal_access_tokens') {
      conditions.push(eq(personalAccessTokens.userId, user.id));
      return;
    }
    if (name === 'push_subscriptions') {
      conditions.push(eq(pushSubscriptions.userId, user.id));
      return;
    }
    if (name === 'comments') {
      conditions.push(eq(comments.userId, user.id));
      return;
    }
    if (name === 'comment_reactions') {
      conditions.push(eq(commentReactions.userId, user.id));
      return;
    }
    if (name === 'tasks' || name === 'projects' || name === 'project_members' || name === 'versions' || name === 'tags' || name === 'project_apks') {
      await this.scopeProjects(name, user, conditions, 'admin');
      return;
    }
    if (name === 'task_tags' || name === 'task_images' || name === 'project_docs') {
      await this.scopeProjects(name, user, conditions, 'member');
    }
  }

  private async scopeProjects(
    name: TableName,
    user: AuthUser,
    conditions: ReturnType<typeof sql>[],
    level: 'member' | 'admin',
  ): Promise<void> {
    const access = await this.tracker.accessFor(user);
    if (access.globalAdmin) return;
    const ids = level === 'admin' ? access.adminProjectIds : access.projectIds;
    const none = ids.length === 0;

    switch (name) {
      case 'projects':
        conditions.push(none ? sql`false` : inArray(projects.id, ids));
        return;
      case 'project_members':
        conditions.push(none ? sql`false` : inArray(projectMembers.projectId, ids));
        return;
      case 'versions':
        conditions.push(none ? sql`false` : inArray(versions.projectId, ids));
        return;
      case 'tags':
        conditions.push(none ? sql`false` : inArray(tags.projectId, ids));
        return;
      case 'tasks':
        conditions.push(none ? sql`false` : inArray(tasks.projectId, ids));
        return;
      case 'project_apks':
        conditions.push(none ? sql`false` : inArray(projectApks.projectId, ids));
        return;
      case 'project_docs':
        conditions.push(none ? sql`false` : inArray(projectDocs.projectId, ids));
        return;
      case 'task_tags': {
        const taskIds = this.db.select({ id: tasks.id }).from(tasks).where(none ? sql`false` : inArray(tasks.projectId, ids));
        conditions.push(inArray(taskTags.taskId, taskIds));
        return;
      }
      case 'task_images': {
        const taskIds = this.db.select({ id: tasks.id }).from(tasks).where(none ? sql`false` : inArray(tasks.projectId, ids));
        conditions.push(inArray(taskImages.taskId, taskIds));
        return;
      }
      default:
        return;
    }
  }

  private prepare(name: TableName, payload: Record<string, unknown>): Record<string, unknown> {
    void name;
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) values[toCamel(key)] = value;
    return values;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function serializeRow(table: any, row: unknown): Record<string, unknown> {
  if (!row || typeof row !== 'object') return row as Record<string, unknown>;
  const columns = getTableColumns(table) as Record<string, { name: string }>;
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    output[columns[key]?.name ?? key] = value;
  }
  return output;
}
