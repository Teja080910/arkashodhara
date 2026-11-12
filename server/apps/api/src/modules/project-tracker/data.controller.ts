import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalAuthService, Public, type AuthUser, type AuthedRequest } from '@platform/authz';
import { ForbiddenError, NotFoundError } from '@platform/common';
import { and, asc, count, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Database } from '../../core.module';
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
  ) {}

  private async viewer(request: Request): Promise<AuthUser | null> {
    return this.optionalAuth.userFromRequest(request as AuthedRequest);
  }

  private async requireActive(request: Request): Promise<AuthUser> {
    const user = await this.viewer(request);
    if (!user) throw new ForbiddenError('Sign in first');
    const rows = await this.db.select({ disabled: profiles.disabled }).from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (rows[0]?.disabled) throw new ForbiddenError('Account disabled');
    return user;
  }

  private table(name: string): any {
    if (!(name in TABLES)) throw new NotFoundError(`Unknown table ${name}`);
    return TABLES[name as TableName];
  }

  @Public()
  @Get(':table')
  async select(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const query = querySchema.parse(rawQuery);
    const user = await this.viewer(request);

    if (name === 'profiles') {
      if (!user) return query.single ? null : [];
    }

    const col = (name: string): unknown => table[name] ?? table[toCamel(name)];
    const conditions = parsePairs(query.eq)
      .filter(([column]) => col(column))
      .map(([column, value]) => sql`${col(column)}::text = ${value}`);
    for (const [column, list] of parsePairs(query.neq)) {
      if (!col(column)) continue;
      conditions.push(sql`${col(column)}::text <> ${list}`);
    }
    for (const [column, list] of parsePairs(query.in)) {
      if (!col(column)) continue;
      conditions.push(sql`${col(column)}::text = any(${list.split('|')})`);
    }

    if (name === 'notifications' || name === 'push_subscriptions' || name === 'personal_access_tokens') {
      if (!user) throw new ForbiddenError('Sign in first');
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
    if (query.single === 'true') {
      if (rows.length !== 1) throw new NotFoundError('Expected one row');
      return rows[0];
    }
    if (query.single === 'maybe') return rows[0] ?? null;
    return rows;
  }

  @Public()
  @Post(':table')
  async insert(
    @Param('table') name: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const user = await this.requireActive(request);
    const payload = this.prepare(name as TableName, z.record(z.string(), z.unknown()).parse(body), user, 'insert');

    if (name === 'projects') {
      payload.slug = String(payload.slug ?? slugify(String(payload.name)));
    }
    const inserted = (await this.db.insert(table).values(payload as any).returning()) as unknown[];
    return inserted[0];
  }

  @Public()
  @Post(':table/upsert')
  async upsert(
    @Param('table') name: string,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const user = await this.requireActive(request);
    const input = z.object({ value: z.record(z.string(), z.unknown()) }).parse(body);
    if (name !== 'push_subscriptions') throw new ForbiddenError('Upsert not supported');
    const payload = this.prepare(name, input.value, user, 'insert');
    const rows = (await this.db
      .insert(pushSubscriptions)
      .values(payload as never)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: payload as never,
      })
      .returning()) as unknown[];
    return rows;
  }

  @Public()
  @Patch(':table')
  async update(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Body() body: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const user = await this.requireActive(request);
    const query = querySchema.parse(rawQuery);
    const patch = this.prepare(name as TableName, z.record(z.string(), z.unknown()).parse(body), user, 'update');

    const col = (column: string): unknown => table[column] ?? table[toCamel(column)];
    const conditions = parsePairs(query.eq)
      .filter(([column]) => col(column))
      .map(([column, value]) => sql`${col(column)}::text = ${value}`);
    if (name === 'profiles') {
      // Users may edit their own row; role/disabled changes need super_admin and
      // are rejected here so they go through /api/pt/profiles/:id/role.
      conditions.push(eq(profiles.id, user.id));
      delete patch.role;
      delete patch.disabled;
    }
    if (name === 'notifications') conditions.push(eq(notifications.userId, user.id));
    if (name === 'personal_access_tokens') conditions.push(eq(personalAccessTokens.userId, user.id));

    const updated = (await this.db
      .update(table)
      .set(patch as any)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning()) as unknown[];
    return updated;
  }

  @Public()
  @Delete(':table')
  async remove(
    @Param('table') name: string,
    @Query() rawQuery: unknown,
    @Req() request: Request,
  ): Promise<unknown> {
    const table = this.table(name);
    const user = await this.requireActive(request);
    const query = querySchema.parse(rawQuery);

    const col = (column: string): unknown => table[column] ?? table[toCamel(column)];
    const conditions = parsePairs(query.eq)
      .filter(([column]) => col(column))
      .map(([column, value]) => sql`${col(column)}::text = ${value}`);
    for (const [column, list] of parsePairs(query.in)) {
      if (!col(column)) continue;
      conditions.push(sql`${col(column)}::text = any(${list.split('|')})`);
    }
    if (name === 'notifications') conditions.push(eq(notifications.userId, user.id));
    if (name === 'personal_access_tokens') conditions.push(eq(personalAccessTokens.userId, user.id));
    if (name === 'comment_reactions') conditions.push(eq(commentReactions.userId, user.id));

    const removed = (await this.db
      .delete(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning()) as unknown[];
    return removed;
  }

  private prepare(
    name: TableName,
    payload: Record<string, unknown>,
    user: AuthUser,
    _action: string,
  ): Record<string, unknown> {
    if (name === 'profiles') payload.id = user.id;
    if (name === 'comments') payload.user_id = user.id;
    if (name === 'comment_reactions') payload.user_id = user.id;
    if (name === 'notifications') payload.user_id = payload.user_id ?? user.id;
    if (name === 'projects') payload.owner_id = payload.owner_id ?? user.id;
    if (name === 'project_members' && !payload.user_id) payload.user_id = user.id;
    if (name === 'personal_access_tokens') payload.user_id = user.id;
    if (name === 'push_subscriptions') payload.user_id = user.id;
    if (name === 'activity_logs') payload.user_id = payload.user_id ?? user.id;
    if (name === 'tasks' && !payload.reporter_id) payload.reporter_id = user.id;
    if (name === 'task_images') payload.uploaded_by = payload.uploaded_by ?? user.id;
    return payload;
  }
}

void or;
void inArray;
void roles;
void versions;
void tags;
void taskTags;
void taskImages;
void projectDocs;
void projectApks;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}


