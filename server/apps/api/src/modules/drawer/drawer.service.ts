import { Inject, Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { ConflictError, ForbiddenError, LimitReachedError, NotFoundError } from '@platform/common';
import { DB, type Database } from '../../core.module';
import {
  flowActivity,
  flowMembers,
  flows,
  teamActivity,
  teamMembers,
  teams,
} from '../../schema/drawer';

export type TeamRole = 'owner' | 'admin' | 'editor' | 'viewer' | 'none';
export type FlowRole = 'owner' | 'editor' | 'viewer' | 'none';

export const MAX_TEAMS_PER_USER = 5;
export const MAX_MEMBERS_PER_TEAM = 25;

@Injectable()
export class DrawerAccessService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async teamRole(teamId: string, user: AuthUser): Promise<TeamRole> {
    const rows = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    const team = rows[0];
    if (!team) return 'none';
    if (team.ownerId === user.id) return 'owner';
    if (!user.email) return 'none';

    const membership = await this.db
      .select({ role: teamMembers.role })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), sql`lower(${teamMembers.email}) = lower(${user.email})`))
      .limit(1);

    const role = membership[0]?.role as TeamRole | undefined;
    return role ?? 'none';
  }

  async flowTeamRole(flowId: string, user: AuthUser): Promise<TeamRole> {
    const rows = await this.db.select({ teamId: flows.teamId }).from(flows).where(eq(flows.id, flowId)).limit(1);
    const teamId = rows[0]?.teamId;
    if (!teamId) return 'none';
    return this.teamRole(teamId, user);
  }

  async flowRole(flowId: string, user: AuthUser): Promise<FlowRole> {
    const rows = await this.db.select().from(flows).where(eq(flows.id, flowId)).limit(1);
    const flow = rows[0];
    if (!flow) return 'none';
    if (flow.ownerId === user.id) return 'owner';

    if (user.email) {
      const membership = await this.db
        .select({ role: flowMembers.role })
        .from(flowMembers)
        .where(and(eq(flowMembers.flowId, flowId), sql`lower(${flowMembers.email}) = lower(${user.email})`))
        .limit(1);
      const role = membership[0]?.role;
      if (role === 'editor' || role === 'viewer') return role;
    }

    const teamRole = flow.teamId ? await this.teamRole(flow.teamId, user) : 'none';
    switch (teamRole) {
      case 'owner':
      case 'admin':
      case 'editor':
        return 'editor';
      case 'viewer':
        return 'viewer';
      default:
        return 'none';
    }
  }

  async assertTeamRole(teamId: string, user: AuthUser, allowed: TeamRole[]): Promise<TeamRole> {
    const role = await this.teamRole(teamId, user);
    if (!allowed.includes(role)) throw new ForbiddenError('Insufficient team role');
    return role;
  }

  async assertFlowRole(flowId: string, user: AuthUser, allowed: FlowRole[]): Promise<FlowRole> {
    const role = await this.flowRole(flowId, user);
    if (!allowed.includes(role)) throw new ForbiddenError('Insufficient flow role');
    return role;
  }
}

@Injectable()
export class TeamsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly access: DrawerAccessService,
  ) {}

  async detail(user: AuthUser, teamId: string): Promise<unknown> {
    const role = await this.access.teamRole(teamId, user);
    if (role === 'none') throw new NotFoundError('Team not found');
    const rows = await this.db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
    const team = rows[0];
    if (!team) throw new NotFoundError('Team not found');
    return { ...serializeTeam(team), role, memberCount: await this.memberCount(teamId) };
  }

  async list(user: AuthUser): Promise<unknown[]> {
    const owned = await this.db.select().from(teams).where(eq(teams.ownerId, user.id));
    const invited = user.email
      ? await this.db
          .select({ team: teams, role: teamMembers.role })
          .from(teamMembers)
          .innerJoin(teams, eq(teams.id, teamMembers.teamId))
          .where(sql`lower(${teamMembers.email}) = lower(${user.email})`)
      : [];

    const byId = new Map<string, { team: typeof teams.$inferSelect; role: TeamRole }>();
    for (const team of owned) byId.set(team.id, { team, role: 'owner' });
    for (const row of invited) {
      if (!byId.has(row.team.id)) byId.set(row.team.id, { team: row.team, role: row.role as TeamRole });
    }

    return Promise.all(
      [...byId.values()].map(async ({ team, role }) => ({
        ...serializeTeam(team),
        role,
        memberCount: await this.memberCount(team.id),
      })),
    );
  }

  async memberCount(teamId: string): Promise<number> {
    const result = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    return result[0]?.value ?? 0;
  }

  async create(user: AuthUser, name: string): Promise<unknown> {
    const clean = name.trim() || 'Untitled team';
    const existing = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.ownerId, user.id));
    if ((existing[0]?.value ?? 0) >= MAX_TEAMS_PER_USER) {
      throw new LimitReachedError(`Team limit reached (max ${MAX_TEAMS_PER_USER} per user)`);
    }

    const inserted = await this.db
      .insert(teams)
      .values({ name: clean, ownerId: user.id })
      .returning();
    const team = inserted[0];
    if (!team) throw new ConflictError('Could not create team');

    await this.logTeamActivity(team.id, user, 'team.created', { name: clean });
    return serializeTeam(team);
  }

  async update(user: AuthUser, teamId: string, name: string): Promise<unknown> {
    await this.access.assertTeamRole(teamId, user, ['owner']);
    const clean = name.trim();
    if (!clean) throw new ConflictError("Name can't be empty");

    const updated = await this.db
      .update(teams)
      .set({ name: clean })
      .where(and(eq(teams.id, teamId), eq(teams.ownerId, user.id)))
      .returning();
    if (!updated[0]) throw new NotFoundError('Team not found');

    await this.logTeamActivity(teamId, user, 'team.renamed', { to: clean });
    return serializeTeam(updated[0]);
  }

  async remove(user: AuthUser, teamId: string): Promise<void> {
    await this.access.assertTeamRole(teamId, user, ['owner']);
    await this.db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.ownerId, user.id)));
  }

  async members(user: AuthUser, teamId: string): Promise<unknown[]> {
    await this.access.assertTeamRole(teamId, user, ['owner', 'admin', 'editor', 'viewer']);
    const rows = await this.db
      .select()
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId))
      .orderBy(asc(teamMembers.createdAt));
    return rows.map(serializeTeamMember);
  }

  async addMember(user: AuthUser, teamId: string, email: string, role: string): Promise<unknown> {
    await this.access.assertTeamRole(teamId, user, ['owner', 'admin']);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ConflictError('Invalid email');
    if (!['admin', 'editor', 'viewer'].includes(role)) throw new ConflictError('Invalid role');

    const count = await this.memberCount(teamId);
    if (count >= MAX_MEMBERS_PER_TEAM) {
      throw new LimitReachedError(`Team member limit reached (max ${MAX_MEMBERS_PER_TEAM} per team)`);
    }

    const existing = await this.db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), sql`lower(${teamMembers.email}) = lower(${email})`))
      .limit(1);
    if (existing[0]) throw new ConflictError('That email is already on the team');

    const inserted = await this.db
      .insert(teamMembers)
      .values({ teamId, email: email.toLowerCase(), role, invitedBy: user.id })
      .returning();
    const member = inserted[0];
    if (!member) throw new ConflictError('Could not add member');

    await this.logTeamActivity(teamId, user, 'team.member.added', { email, role });
    return serializeTeamMember(member);
  }

  async updateMember(user: AuthUser, teamId: string, memberId: string, role: string): Promise<unknown> {
    await this.access.assertTeamRole(teamId, user, ['owner', 'admin']);
    if (!['admin', 'editor', 'viewer'].includes(role)) throw new ConflictError('Invalid role');

    const target = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!target[0]) throw new NotFoundError('Member not found');

    const updated = await this.db
      .update(teamMembers)
      .set({ role })
      .where(eq(teamMembers.id, memberId))
      .returning();
    await this.logTeamActivity(teamId, user, 'team.member.role', { email: target[0].email, role });
    return serializeTeamMember(updated[0]!);
  }

  async removeMember(user: AuthUser, teamId: string, memberId: string): Promise<void> {
    const target = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)))
      .limit(1);
    if (!target[0]) throw new NotFoundError('Member not found');

    const isSelf = user.email && target[0].email.toLowerCase() === user.email.toLowerCase();
    if (!isSelf) await this.access.assertTeamRole(teamId, user, ['owner', 'admin']);

    await this.db.delete(teamMembers).where(eq(teamMembers.id, memberId));
    await this.logTeamActivity(teamId, user, 'team.member.removed', { email: target[0].email });
  }

  async leave(user: AuthUser, teamId: string): Promise<void> {
    const role = await this.access.teamRole(teamId, user);
    if (role === 'owner') throw new ForbiddenError('Transfer or delete the team instead');
    if (role === 'none') throw new NotFoundError('You are not a member of this team');
    if (!user.email) throw new ConflictError('Your account has no email');

    await this.db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), sql`lower(${teamMembers.email}) = lower(${user.email})`));
    await this.logTeamActivity(teamId, user, 'member.left', { email: user.email });
  }

  async updateMemberById(user: AuthUser, memberId: string, role: string): Promise<unknown> {
    const rows = await this.db.select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Member not found');
    return this.updateMember(user, rows[0].teamId, memberId, role);
  }

  async removeMemberById(user: AuthUser, memberId: string): Promise<void> {
    const rows = await this.db.select().from(teamMembers).where(eq(teamMembers.id, memberId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Member not found');
    await this.removeMember(user, rows[0].teamId, memberId);
  }

  async transfer(user: AuthUser, teamId: string, newOwnerEmail: string, newOwnerId: string): Promise<void> {
    await this.access.assertTeamRole(teamId, user, ['owner']);
    const member = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.teamId, teamId),
          sql`lower(${teamMembers.email}) = lower(${newOwnerEmail})`,
          eq(teamMembers.role, 'admin'),
        ),
      )
      .limit(1);
    if (!member[0]) throw new ForbiddenError('Make them a team admin first');

    await this.db
      .update(teams)
      .set({ ownerId: newOwnerId })
      .where(and(eq(teams.id, teamId), eq(teams.ownerId, user.id)));

    await this.logTeamActivity(teamId, user, 'team.transferred', { email: newOwnerEmail });
  }

  async activity(user: AuthUser, teamId: string): Promise<unknown[]> {
    await this.access.assertTeamRole(teamId, user, ['owner', 'admin', 'editor', 'viewer']);
    const rows = await this.db
      .select()
      .from(teamActivity)
      .where(eq(teamActivity.teamId, teamId))
      .orderBy(desc(teamActivity.createdAt))
      .limit(100);
    return rows.map(serializeActivity);
  }

  async logTeamActivity(
    teamId: string,
    user: AuthUser,
    action: string,
    detail: Record<string, unknown> = {},
  ): Promise<void> {
    await this.db.insert(teamActivity).values({
      teamId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action,
      detail,
    });
  }
}

@Injectable()
export class FlowsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly access: DrawerAccessService,
    private readonly teams: TeamsService,
  ) {}

  async list(user: AuthUser): Promise<unknown[]> {
    const owned = await this.db
      .select()
      .from(flows)
      .where(eq(flows.ownerId, user.id))
      .orderBy(desc(flows.updatedAt));

    const memberRows = user.email
      ? await this.db
          .select({ flow: flows, role: flowMembers.role })
          .from(flowMembers)
          .innerJoin(flows, eq(flows.id, flowMembers.flowId))
          .where(sql`lower(${flowMembers.email}) = lower(${user.email})`)
      : [];

    const teamRows = user.email
      ? await this.db
          .select({ flow: flows, role: teamMembers.role })
          .from(teamMembers)
          .innerJoin(flows, eq(flows.teamId, teamMembers.teamId))
          .where(sql`lower(${teamMembers.email}) = lower(${user.email})`)
      : [];

    const byId = new Map<string, { flow: typeof flows.$inferSelect; role: FlowRole }>();
    for (const flow of owned) byId.set(flow.id, { flow, role: 'owner' });
    for (const row of memberRows) {
      if (!byId.has(row.flow.id)) byId.set(row.flow.id, { flow: row.flow, role: row.role as FlowRole });
    }
    for (const row of teamRows) {
      if (!byId.has(row.flow.id)) {
        const mapped: FlowRole = row.role === 'viewer' ? 'viewer' : 'editor';
        byId.set(row.flow.id, { flow: row.flow, role: mapped });
      }
    }

    return [...byId.values()]
      .sort((a, b) => b.flow.updatedAt.getTime() - a.flow.updatedAt.getTime())
      .map(({ flow, role }) => serializeFlow(flow, role));
  }

  async get(user: AuthUser, flowId: string): Promise<unknown> {
    const role = await this.access.flowRole(flowId, user);
    const rows = await this.db.select().from(flows).where(eq(flows.id, flowId)).limit(1);
    const flow = rows[0];
    if (!flow) throw new NotFoundError('Flow not found');

    if (role === 'none') {
      // Strangers may only learn that a public canvas exists so the UI can
      // redirect them to the read-only share page. Private canvases stay hidden.
      if (flow.visibility === 'public' && flow.shareToken) {
        return {
          id: flow.id,
          ownerId: flow.ownerId,
          teamId: flow.teamId,
          name: flow.name,
          graph: flow.graph,
          visibility: flow.visibility,
          shareToken: flow.shareToken,
          role: 'none',
          createdAt: flow.createdAt.toISOString(),
          updatedAt: flow.updatedAt.toISOString(),
        };
      }
      throw new NotFoundError('Flow not found');
    }

    return serializeFlow(flow, role);
  }

  async getPublic(shareToken: string): Promise<unknown> {
    const rows = await this.db
      .select()
      .from(flows)
      .where(and(eq(flows.shareToken, shareToken), eq(flows.visibility, 'public')))
      .limit(1);
    const flow = rows[0];
    if (!flow) throw new NotFoundError('Flow not found');
    return serializeFlow(flow, 'viewer');
  }

  async create(user: AuthUser, input: { name: string; teamId?: string | null }): Promise<unknown> {
    if (input.teamId) await this.access.assertTeamRole(input.teamId, user, ['owner', 'admin', 'editor']);
    const inserted = await this.db
      .insert(flows)
      .values({
        ownerId: user.id,
        name: input.name,
        teamId: input.teamId ?? null,
      })
      .returning();
    const flow = inserted[0];
    if (!flow) throw new ConflictError('Could not create flow');
    return serializeFlow(flow, 'owner');
  }

  async update(
    user: AuthUser,
    flowId: string,
    input: {
      name?: string;
      graph?: { nodes: unknown[]; relations: unknown[] };
      visibility?: 'private' | 'public';
      teamId?: string | null;
    },
  ): Promise<unknown> {
    const role = await this.access.assertFlowRole(flowId, user, ['owner', 'editor']);
    const rows = await this.db.select().from(flows).where(eq(flows.id, flowId)).limit(1);
    const flow = rows[0];
    if (!flow) throw new NotFoundError('Flow not found');

    if (role !== 'owner' && input.visibility !== undefined) {
      throw new ForbiddenError('Only the owner can change visibility');
    }
    if (role !== 'owner' && input.teamId !== undefined) {
      throw new ForbiddenError('Only the owner can move the canvas');
    }
    if (input.teamId) {
      await this.access.assertTeamRole(input.teamId, user, ['owner', 'admin', 'editor']);
    }

    const patch: Partial<typeof flows.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.graph !== undefined) patch.graph = input.graph;
    if (input.visibility !== undefined) {
      patch.visibility = input.visibility;
      if (input.visibility === 'public' && !flow.shareToken) {
        patch.shareToken = randomToken(24);
      }
    }
    if (input.teamId !== undefined) patch.teamId = input.teamId;

    const updated = await this.db.update(flows).set(patch).where(eq(flows.id, flowId)).returning();
    await this.db.insert(flowActivity).values({
      flowId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'flow.updated',
      detail: { fields: Object.keys(patch) },
    });
    if (input.teamId !== undefined) {
      await this.db.insert(flowActivity).values({
        flowId,
        actorId: user.id,
        actorEmail: user.email ?? null,
        action: 'flow.team_changed',
        detail: { to: input.teamId },
      });
    }
    return serializeFlow(updated[0]!, role);
  }

  async remove(user: AuthUser, flowId: string): Promise<void> {
    await this.access.assertFlowRole(flowId, user, ['owner']);
    await this.db.delete(flows).where(and(eq(flows.id, flowId), eq(flows.ownerId, user.id)));
  }

  async members(user: AuthUser, flowId: string): Promise<unknown[]> {
    await this.access.assertFlowRole(flowId, user, ['owner', 'editor', 'viewer']);
    const rows = await this.db
      .select()
      .from(flowMembers)
      .where(eq(flowMembers.flowId, flowId))
      .orderBy(asc(flowMembers.createdAt));
    return rows.map(serializeFlowMember);
  }

  async addMember(user: AuthUser, flowId: string, email: string, role: string): Promise<unknown> {
    const flowRole = await this.access.flowRole(flowId, user);
    const teamRole = await this.access.flowTeamRole(flowId, user);
    const canManage = flowRole === 'owner' || teamRole === 'owner' || teamRole === 'admin';
    if (!canManage) throw new ForbiddenError('Only the owner or team admins can manage shares');
    if (!['viewer', 'editor'].includes(role)) throw new ConflictError('Invalid role');

    const existing = await this.db
      .select({ id: flowMembers.id })
      .from(flowMembers)
      .where(and(eq(flowMembers.flowId, flowId), sql`lower(${flowMembers.email}) = lower(${email})`))
      .limit(1);
    if (existing[0]) throw new ConflictError('That email already has access');

    const inserted = await this.db
      .insert(flowMembers)
      .values({ flowId, email: email.toLowerCase(), role, invitedBy: user.id })
      .returning();
    await this.db.insert(flowActivity).values({
      flowId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'flow.member.added',
      detail: { email, role },
    });
    return serializeFlowMember(inserted[0]!);
  }

  async updateMember(user: AuthUser, flowId: string, memberId: string, role: string): Promise<unknown> {
    const flowRole = await this.access.flowRole(flowId, user);
    const teamRole = await this.access.flowTeamRole(flowId, user);
    const canManage = flowRole === 'owner' || teamRole === 'owner' || teamRole === 'admin';
    if (!canManage) throw new ForbiddenError('Insufficient role');
    if (!['viewer', 'editor'].includes(role)) throw new ConflictError('Invalid role');

    const updated = await this.db
      .update(flowMembers)
      .set({ role })
      .where(and(eq(flowMembers.id, memberId), eq(flowMembers.flowId, flowId)))
      .returning();
    if (!updated[0]) throw new NotFoundError('Member not found');
    await this.db.insert(flowActivity).values({
      flowId,
      actorId: user.id,
      actorEmail: user.email ?? null,
      action: 'flow.member.role',
      detail: { email: updated[0].email, role },
    });
    return serializeFlowMember(updated[0]);
  }

  async updateMemberById(user: AuthUser, memberId: string, role: string): Promise<unknown> {
    const rows = await this.db.select().from(flowMembers).where(eq(flowMembers.id, memberId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Member not found');
    return this.updateMember(user, rows[0].flowId, memberId, role);
  }

  async removeMemberById(user: AuthUser, memberId: string): Promise<void> {
    const rows = await this.db.select().from(flowMembers).where(eq(flowMembers.id, memberId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Member not found');
    await this.removeMember(user, rows[0].flowId, memberId);
  }

  async removeMember(user: AuthUser, flowId: string, memberId: string): Promise<void> {
    const flowRole = await this.access.flowRole(flowId, user);
    const teamRole = await this.access.flowTeamRole(flowId, user);
    const target = await this.db
      .select()
      .from(flowMembers)
      .where(and(eq(flowMembers.id, memberId), eq(flowMembers.flowId, flowId)))
      .limit(1);
    if (!target[0]) throw new NotFoundError('Member not found');
    const isSelf = user.email && target[0].email.toLowerCase() === user.email.toLowerCase();
    const canManage = flowRole === 'owner' || teamRole === 'owner' || teamRole === 'admin';
    if (!isSelf && !canManage) throw new ForbiddenError('Insufficient role');

    await this.db.delete(flowMembers).where(eq(flowMembers.id, memberId));
  }

  async activity(user: AuthUser, flowId: string): Promise<unknown[]> {
    await this.access.assertFlowRole(flowId, user, ['owner', 'editor', 'viewer']);
    const rows = await this.db
      .select()
      .from(flowActivity)
      .where(eq(flowActivity.flowId, flowId))
      .orderBy(desc(flowActivity.createdAt))
      .limit(100);
    return rows.map(serializeActivity);
  }
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('base64url');
}

export function serializeTeam(team: typeof teams.$inferSelect): Record<string, unknown> {
  return {
    id: team.id,
    name: team.name,
    ownerId: team.ownerId,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

export function serializeTeamMember(member: typeof teamMembers.$inferSelect): Record<string, unknown> {
  return {
    id: member.id,
    teamId: member.teamId,
    email: member.email,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

export function serializeFlow(flow: typeof flows.$inferSelect, role: FlowRole): Record<string, unknown> {
  return {
    id: flow.id,
    ownerId: flow.ownerId,
    teamId: flow.teamId,
    name: flow.name,
    graph: flow.graph,
    visibility: flow.visibility,
    shareToken: role === 'owner' ? flow.shareToken : undefined,
    role,
    createdAt: flow.createdAt.toISOString(),
    updatedAt: flow.updatedAt.toISOString(),
  };
}

function serializeFlowMember(member: typeof flowMembers.$inferSelect): Record<string, unknown> {
  return {
    id: member.id,
    flowId: member.flowId,
    email: member.email,
    role: member.role,
    createdAt: member.createdAt.toISOString(),
  };
}

function serializeActivity(row: typeof flowActivity.$inferSelect | typeof teamActivity.$inferSelect): Record<string, unknown> {
  return {
    id: row.id,
    action: row.action,
    actorId: row.actorId,
    actorEmail: row.actorEmail,
    detail: row.detail,
    createdAt: row.createdAt.toISOString(),
  };
}
