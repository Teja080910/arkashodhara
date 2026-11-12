import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard, OptionalAuthService, Public, type AuthUser, type AuthedRequest } from '@platform/authz';
import { ConflictError, ForbiddenError, NotFoundError } from '@platform/common';
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { DB, type Database } from '../../core.module';
import {
  folioTeamContentShares,
  folioTeamInvites,
  folioTeamMembers,
  folioTeams,
  guideContent,
  portfolioContents,
  profiles,
} from '../../schema/portfolio';

const TABLES = {
  profiles,
  portfolio_contents: portfolioContents,
  folio_teams: folioTeams,
  folio_team_members: folioTeamMembers,
  folio_team_invites: folioTeamInvites,
  folio_team_content_shares: folioTeamContentShares,
  guide_content: guideContent,
} as const;

type TableName = keyof typeof TABLES;

const querySchema = z.object({
  select: z.string().optional(),
  eq: z.string().optional(),
  in: z.string().optional(),
  order: z.string().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
  single: z.enum(['true', 'false', 'maybe']).optional(),
});

function parseKeyValues(raw?: string): Array<[string, string]> {
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.split(':'))
    .filter((parts): parts is [string, string] => parts.length === 2)
    .map(([key, value]) => [key!, value!]);
}

function toCamel(column: string): string {
  return column.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

function columnFor(table: any, column: string): any {
  return table[column] ?? table[toCamel(column)];
}

@Controller('data')
export class PortfolioDataController {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly optionalAuth: OptionalAuthService,
  ) {}

  private async viewer(request: Request): Promise<AuthUser | null> {
    return this.optionalAuth.userFromRequest(request as AuthedRequest);
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

    const conditions: ReturnType<typeof sql>[] = [];
    for (const [column, value] of parseKeyValues(query.eq)) {
      const target = columnFor(table, column);
      if (target) conditions.push(sql`${target}::text = ${value}`);
    }
    for (const [column, list] of parseKeyValues(query.in)) {
      const target = columnFor(table, column);
      if (!target) continue;
      const values = list.split('|');
      conditions.push(sql`${target}::text = any(${values})`);
    }

    if (name === 'profiles') {
      if (!user) conditions.push(eq(profiles.show, true));
    }
    if (name === 'guide_content') {
      if (!user) conditions.push(eq(guideContent.show, true));
    }
    if (name === 'portfolio_contents') {
      // Public profiles expose their published portfolio content. Signed-in
      // users additionally see content shared through their teams, plus their
      // own content.
      const publicProfiles = await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.show, true));
      const visible = new Set(publicProfiles.map((row) => row.id));
      if (user) {
        for (const id of await this.visibleUserIds(user)) visible.add(id);
      }
      conditions.push(inArray(portfolioContents.userId, [...visible]));
    }
    if (name === 'folio_teams') {
      const visible = await this.visibleTeamIds(user);
      conditions.push(
        user
          ? or(eq(folioTeams.show, true), inArray(folioTeams.id, visible))!
          : eq(folioTeams.show, true),
      );
    }
    if (name === 'folio_team_members' || name === 'folio_team_content_shares') {
      if (!user) throw new ForbiddenError('Sign in to read team data');
      const visible = await this.visibleTeamIds(user);
      conditions.push(inArray(folioTeamMembers.teamId, visible));
    }
    if (name === 'folio_team_invites') {
      if (!user) throw new ForbiddenError('Sign in to read invites');
      conditions.push(eq(folioTeamInvites.invitedBy, user.id));
    }

    const orderParts = query.order ? query.order.split(':') : [];
    const orderColumn = orderParts[0];
    const direction = orderParts[1] === 'desc' ? desc : asc;

    let statement = this.db
      .select()
      .from(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    if (orderColumn) {
      const column = columnFor(table, orderColumn);
      if (column) statement = statement.orderBy(direction(column as never));
    }
    if (query.limit) statement = statement.limit(query.limit);

    const rows = (await statement) as unknown[];
    if (query.single === 'true') {
      if (rows.length !== 1) throw new NotFoundError('Expected exactly one row');
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
    const user = await this.requireViewer(request);
    const payload = z.record(z.string(), z.unknown()).parse(body);
    this.assertWrite(name as TableName, payload, user, 'insert');

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
    const user = await this.requireViewer(request);
    const input = z.object({ value: z.record(z.string(), z.unknown()), conflict: z.string() }).parse(body);
    this.assertWrite(name as TableName, input.value, user, 'upsert');

    if (name === 'portfolio_contents') {
      const rows = (await this.db
        .insert(portfolioContents)
        .values({ ...(input.value as Record<string, unknown>), userId: user.id } as any)
        .onConflictDoUpdate({
          target: portfolioContents.userId,
          set: { ...(input.value as Record<string, unknown>), userId: user.id, updatedAt: new Date() } as any,
        })
        .returning()) as unknown[];
      return rows[0];
    }
    if (name === 'folio_team_content_shares') {
      const rows = (await this.db
        .insert(folioTeamContentShares)
        .values(input.value as any)
        .onConflictDoNothing()
        .returning()) as unknown[];
      return rows;
    }
    throw new ForbiddenError('Upsert not supported for this table');
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
    const user = await this.requireViewer(request);
    const query = querySchema.parse(rawQuery);
    const patch = z.record(z.string(), z.unknown()).parse(body);
    this.assertWrite(name as TableName, patch, user, 'update');

    const conditions: ReturnType<typeof sql>[] = [];
    for (const [column, value] of parseKeyValues(query.eq)) {
      const target = columnFor(table, column);
      if (target) conditions.push(sql`${target}::text = ${value}`);
    }
    if (name === 'profiles') conditions.push(eq(profiles.id, user.id));
    if (name === 'portfolio_contents') conditions.push(eq(portfolioContents.userId, user.id));
    if (name === 'folio_teams') conditions.push(eq(folioTeams.ownerId, user.id));
    if (name === 'folio_team_members' || name === 'folio_team_content_shares') {
      conditions.push(eq(folioTeamMembers.userId, user.id));
    }
    if (name === 'folio_team_invites') conditions.push(eq(folioTeamInvites.invitedBy, user.id));

    const updated = await this.db
      .update(table)
      .set(patch as any)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning();
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
    const user = await this.requireViewer(request);
    const query = querySchema.parse(rawQuery);

    const conditions: ReturnType<typeof sql>[] = [];
    for (const [column, value] of parseKeyValues(query.eq)) {
      const target = columnFor(table, column);
      if (target) conditions.push(sql`${target}::text = ${value}`);
    }
    for (const [column, list] of parseKeyValues(query.in)) {
      const target = columnFor(table, column);
      if (!target) continue;
      conditions.push(sql`${target}::text = any(${list.split('|')})`);
    }

    if (name === 'folio_teams') conditions.push(eq(folioTeams.ownerId, user.id));
    if (name === 'folio_team_members') {
      const owned = await this.db
        .select({ id: folioTeams.id })
        .from(folioTeams)
        .where(eq(folioTeams.ownerId, user.id));
      const ownedIds = owned.map((row) => row.id);
      conditions.push(
        or(eq(folioTeamMembers.userId, user.id), inArray(folioTeamMembers.teamId, ownedIds))!,
      );
    }
    if (name === 'folio_team_invites') conditions.push(eq(folioTeamInvites.invitedBy, user.id));
    if (name === 'folio_team_content_shares') conditions.push(eq(folioTeamContentShares.userId, user.id));
    if (name === 'portfolio_contents') conditions.push(eq(portfolioContents.userId, user.id));
    if (name === 'guide_content') conditions.push(eq(guideContent.id, '__never__'));

    const removed = await this.db
      .delete(table)
      .where(conditions.length ? and(...conditions) : undefined)
      .returning();
    return removed;
  }

  private async requireViewer(request: Request): Promise<AuthUser> {
    const user = await this.viewer(request);
    if (!user) throw new ForbiddenError('Sign in first');
    return user;
  }

  private async visibleTeamIds(user: AuthUser | null): Promise<string[]> {
    if (!user) return [];
    const owned = await this.db
      .select({ id: folioTeams.id })
      .from(folioTeams)
      .where(eq(folioTeams.ownerId, user.id));
    const member = await this.db
      .select({ id: folioTeamMembers.teamId })
      .from(folioTeamMembers)
      .where(eq(folioTeamMembers.userId, user.id));
    return [...new Set([...owned, ...member].map((row) => row.id))];
  }

  private async visibleUserIds(user: AuthUser): Promise<string[]> {
    const teamIds = await this.visibleTeamIds(user);
    const members = teamIds.length
      ? await this.db
          .select({ userId: folioTeamMembers.userId })
          .from(folioTeamMembers)
          .where(inArray(folioTeamMembers.teamId, teamIds))
      : [];
    return [...new Set([user.id, ...members.map((row) => row.userId)])];
  }

  private assertWrite(name: TableName, payload: Record<string, unknown>, user: AuthUser, action: string): void {
    if (name === 'profiles') {
      payload.id = user.id;
      return;
    }
    if (name === 'portfolio_contents') {
      payload.user_id = user.id;
      return;
    }
    if (name === 'folio_teams') {
      payload.owner_id = user.id;
      return;
    }
    if (name === 'folio_team_invites') {
      payload.invited_by = user.id;
      return;
    }
    if (name === 'folio_team_content_shares') {
      payload.user_id = user.id;
      return;
    }
    if (name === 'folio_team_members') {
      if (action === 'insert') payload.user_id = payload.user_id ?? user.id;
      return;
    }
    if (name === 'guide_content') {
      throw new ForbiddenError('Guide content is managed by admins');
    }
  }
}
