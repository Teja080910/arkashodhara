import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'node:crypto';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { ConflictError, ForbiddenError, NotFoundError } from '@platform/common';
import { DB, type Database } from '../../core.module';
import {
  apiTokens,
  folioTeamContentShares,
  folioTeamInvites,
  folioTeamMembers,
  folioTeams,
  guideContent,
  portfolioContents,
  profiles,
} from '../../schema/portfolio';

const CONTENT_SECTIONS = [
  'skills',
  'projects',
  'experience',
  'education',
  'certificates',
  'content_channels',
  'content_works',
  'collaborations',
  'creator_tools',
] as const;

@Injectable()
export class PortfolioService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async ensureProfile(user: AuthUser): Promise<typeof profiles.$inferSelect> {
    const existing = await this.db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (existing[0]) return existing[0];

    const base = (user.email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9_]+/g, '') || 'user';
    let username = base.slice(0, 24);
    if (await this.usernameTaken(username)) {
      username = `${base.slice(0, 18)}${randomBytes(3).toString('hex')}`;
    }

    const inserted = await this.db
      .insert(profiles)
      .values({
        id: user.id,
        username,
        email: user.email || `${user.id}@unknown`,
        firstname: user.name.split(' ')[0] ?? '',
        lastname: user.name.split(' ').slice(1).join(' ') || '',
      })
      .onConflictDoNothing()
      .returning();

    const profile = inserted[0] ?? (await this.db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
    if (!profile) throw new ConflictError('Could not create profile');
    return profile;
  }

  private async usernameTaken(username: string): Promise<boolean> {
    const rows = await this.db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, username)).limit(1);
    return Boolean(rows[0]);
  }

  async me(user: AuthUser): Promise<unknown> {
    const profile = await this.ensureProfile(user);
    const contentRows = await this.db
      .select()
      .from(portfolioContents)
      .where(eq(portfolioContents.userId, user.id))
      .limit(1);
    return { profile: serializeProfile(profile), content: contentRows[0] ? serializeContent(contentRows[0]) : null };
  }

  async updateProfile(user: AuthUser, patch: Record<string, unknown>): Promise<unknown> {
    await this.ensureProfile(user);
    const allowed = [
      'firstname',
      'lastname',
      'role',
      'phone',
      'photo',
      'description',
      'gitlink',
      'linkedin',
      'resumelink',
      'show',
      'type',
      'username',
    ] as const;

    const values: Record<string, unknown> = {};
    for (const key of allowed) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    if (values.username) {
      const taken = await this.db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.username, String(values.username)), sql`${profiles.id} <> ${user.id}`))
        .limit(1);
      if (taken[0]) throw new ConflictError('Username already taken');
    }

    const updated = await this.db.update(profiles).set(values).where(eq(profiles.id, user.id)).returning();
    return serializeProfile(updated[0]!);
  }

  async saveContent(user: AuthUser, patch: Record<string, unknown>): Promise<unknown> {
    await this.ensureProfile(user);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const section of [
      'about',
      'skills',
      'projects',
      'experience',
      'education',
      'certificates',
      'contentChannels',
      'contentWorks',
      'collaborations',
      'creatorTools',
    ] as const) {
      if (patch[section] !== undefined) values[section] = patch[section];
    }
    if (patch.template !== undefined) values.template = patch.template;

    const updated = await this.db
      .insert(portfolioContents)
      .values({ userId: user.id, ...values })
      .onConflictDoUpdate({ target: portfolioContents.userId, set: values })
      .returning();
    return serializeContent(updated[0]!);
  }

  async publicProfile(username: string): Promise<unknown> {
    const rows = await this.db
      .select()
      .from(profiles)
      .where(and(eq(profiles.username, username), eq(profiles.show, true)))
      .limit(1);
    const profile = rows[0];
    if (!profile) throw new NotFoundError('Profile not found');

    const contentRows = await this.db
      .select()
      .from(portfolioContents)
      .where(eq(portfolioContents.userId, profile.id))
      .limit(1);

    return {
      profile: serializeProfile(profile),
      content: contentRows[0] ? serializeContent(contentRows[0]) : null,
    };
  }

  async searchProfiles(query: string, limit = 24): Promise<unknown[]> {
    const pattern = `%${query.toLowerCase()}%`;
    const rows = await this.db
      .select()
      .from(profiles)
      .where(
        and(
          eq(profiles.show, true),
          or(
            sql`lower(${profiles.username}) like ${pattern}`,
            sql`lower(${profiles.firstname}) like ${pattern}`,
            sql`lower(${profiles.lastname}) like ${pattern}`,
            sql`lower(${profiles.role}) like ${pattern}`,
          ),
        ),
      )
      .limit(limit);
    return rows.map(serializeProfile);
  }

  async guide(): Promise<unknown[]> {
    const rows = await this.db
      .select()
      .from(guideContent)
      .where(eq(guideContent.show, true))
      .orderBy(asc(guideContent.sortOrder));
    return rows.map((row) => ({
      id: row.id,
      section: row.section,
      title: row.title,
      subtitle: row.subtitle,
      content: row.content,
      sortOrder: row.sortOrder,
    }));
  }

  async createApiToken(user: AuthUser, name: string): Promise<unknown> {
    await this.ensureProfile(user);
    const plaintext = `folio_${randomBytes(24).toString('base64url')}`;
    const inserted = await this.db
      .insert(apiTokens)
      .values({ userId: user.id, tokenHash: createHash('sha256').update(plaintext).digest('hex'), name })
      .returning();
    return { ...serializeToken(inserted[0]!), token: plaintext };
  }

  async listApiTokens(user: AuthUser): Promise<unknown[]> {
    const rows = await this.db
      .select()
      .from(apiTokens)
      .where(eq(apiTokens.userId, user.id))
      .orderBy(desc(apiTokens.createdAt));
    return rows.map(serializeToken);
  }

  async revokeApiToken(user: AuthUser, tokenId: string): Promise<void> {
    await this.db
      .update(apiTokens)
      .set({ revoked: true })
      .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, user.id)));
  }

  async resolveApiToken(plaintext: string): Promise<AuthUser | null> {
    const hash = createHash('sha256').update(plaintext).digest('hex');
    const rows = await this.db
      .select({ token: apiTokens, profile: profiles })
      .from(apiTokens)
      .innerJoin(profiles, eq(profiles.id, apiTokens.userId))
      .where(eq(apiTokens.tokenHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row || row.token.revoked) return null;
    await this.db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, row.token.id));
    return {
      id: row.profile.id,
      email: row.profile.email,
      name: `${row.profile.firstname} ${row.profile.lastname}`.trim(),
      role: 'user',
      claims: { sub: row.profile.id },
    };
  }

  async listTeams(user: AuthUser): Promise<unknown[]> {
    await this.ensureProfile(user);
    const owned = await this.db.select().from(folioTeams).where(eq(folioTeams.ownerId, user.id));
    const memberOf = await this.db
      .select({ team: folioTeams, role: folioTeamMembers.role, title: folioTeamMembers.title })
      .from(folioTeamMembers)
      .innerJoin(folioTeams, eq(folioTeams.id, folioTeamMembers.teamId))
      .where(eq(folioTeamMembers.userId, user.id));

    const map = new Map<string, { team: typeof folioTeams.$inferSelect; role: string; title: string | null }>();
    for (const team of owned) map.set(team.id, { team, role: 'owner', title: null });
    for (const row of memberOf) {
      if (!map.has(row.team.id)) map.set(row.team.id, { team: row.team, role: row.role, title: row.title });
    }
    return [...map.values()].map((entry) => ({
      ...serializeTeam(entry.team),
      role: entry.role,
      title: entry.title,
    }));
  }

  async createTeam(user: AuthUser, input: { name: string; slug?: string; tagline?: string; description?: string }): Promise<unknown> {
    await this.ensureProfile(user);
    const slug = (input.slug ?? slugify(input.name)) || randomBytes(4).toString('hex');
    const existing = await this.db.select({ id: folioTeams.id }).from(folioTeams).where(eq(folioTeams.slug, slug)).limit(1);
    if (existing[0]) throw new ConflictError('Team slug already exists');

    const inserted = await this.db
      .insert(folioTeams)
      .values({
        ownerId: user.id,
        slug,
        name: input.name,
        tagline: input.tagline ?? null,
        description: input.description ?? null,
      })
      .returning();
    const team = inserted[0]!;
    await this.db
      .insert(folioTeamMembers)
      .values({ teamId: team.id, userId: user.id, role: 'owner' })
      .onConflictDoNothing();
    return serializeTeam(team);
  }

  async updateTeam(user: AuthUser, teamId: string, patch: Record<string, unknown>): Promise<unknown> {
    const team = await this.requireTeamOwner(teamId, user.id);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['name', 'tagline', 'description', 'logo', 'show'] as const) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    const updated = await this.db.update(folioTeams).set(values).where(eq(folioTeams.id, team.id)).returning();
    return serializeTeam(updated[0]!);
  }

  async deleteTeam(user: AuthUser, teamId: string): Promise<void> {
    const team = await this.requireTeamOwner(teamId, user.id);
    await this.db.delete(folioTeams).where(eq(folioTeams.id, team.id));
  }

  async teamMembers(user: AuthUser, teamId: string): Promise<unknown[]> {
    await this.requireTeamMember(teamId, user.id);
    const rows = await this.db
      .select({ member: folioTeamMembers, profile: profiles })
      .from(folioTeamMembers)
      .innerJoin(profiles, eq(profiles.id, folioTeamMembers.userId))
      .where(eq(folioTeamMembers.teamId, teamId))
      .orderBy(asc(folioTeamMembers.joinedAt));
    return rows.map((row) => ({
      id: row.profile.id,
      username: row.profile.username,
      firstname: row.profile.firstname,
      lastname: row.profile.lastname,
      photo: row.profile.photo,
      role: row.member.role,
      title: row.member.title,
      jobRole: row.profile.role,
      type: row.profile.type,
      show: row.profile.show,
      joinedAt: row.member.joinedAt.toISOString(),
    }));
  }

  async setMemberTitle(user: AuthUser, teamId: string, memberUserId: string, title: string | null): Promise<void> {
    await this.requireTeamOwner(teamId, user.id);
    await this.db
      .update(folioTeamMembers)
      .set({ title })
      .where(and(eq(folioTeamMembers.teamId, teamId), eq(folioTeamMembers.userId, memberUserId)));
  }

  async removeTeamMember(user: AuthUser, teamId: string, memberUserId: string): Promise<void> {
    const isOwner = await this.isTeamOwner(teamId, user.id);
    if (!isOwner && memberUserId !== user.id) throw new ForbiddenError('Only the owner or the member can remove');
    const target = await this.db
      .select({ role: folioTeamMembers.role })
      .from(folioTeamMembers)
      .where(and(eq(folioTeamMembers.teamId, teamId), eq(folioTeamMembers.userId, memberUserId)))
      .limit(1);
    if (target[0]?.role === 'owner') throw new ForbiddenError('Cannot remove the owner');
    await this.db
      .delete(folioTeamMembers)
      .where(and(eq(folioTeamMembers.teamId, teamId), eq(folioTeamMembers.userId, memberUserId)));
  }

  async createInvite(user: AuthUser, teamId: string, email?: string): Promise<unknown> {
    await this.requireTeamOwner(teamId, user.id);
    const raw = randomBytes(24).toString('base64url');
    const inserted = await this.db
      .insert(folioTeamInvites)
      .values({
        teamId,
        email: email?.toLowerCase() ?? null,
        tokenHash: createHash('sha256').update(raw).digest('hex'),
        invitedBy: user.id,
      })
      .returning();
    return { ...serializeInvite(inserted[0]!), token: raw };
  }

  async listInvites(user: AuthUser, teamId: string): Promise<unknown[]> {
    await this.requireTeamOwner(teamId, user.id);
    const rows = await this.db
      .select()
      .from(folioTeamInvites)
      .where(eq(folioTeamInvites.teamId, teamId))
      .orderBy(desc(folioTeamInvites.createdAt));
    return rows.map(serializeInvite);
  }

  async revokeInvite(user: AuthUser, teamId: string, inviteId: string): Promise<void> {
    await this.requireTeamOwner(teamId, user.id);
    await this.db
      .update(folioTeamInvites)
      .set({ revoked: true })
      .where(and(eq(folioTeamInvites.id, inviteId), eq(folioTeamInvites.teamId, teamId)));
  }

  async inviteByToken(token: string): Promise<unknown> {
    if (!token || token.length < 16) return null;
    const hash = createHash('sha256').update(token).digest('hex');
    const rows = await this.db
      .select({ invite: folioTeamInvites, team: folioTeams })
      .from(folioTeamInvites)
      .innerJoin(folioTeams, eq(folioTeams.id, folioTeamInvites.teamId))
      .where(eq(folioTeamInvites.tokenHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.invite.id,
      email: row.invite.email,
      expiresAt: row.invite.expiresAt.toISOString(),
      acceptedAt: row.invite.acceptedAt?.toISOString() ?? null,
      revoked: row.invite.revoked,
      valid:
        !row.invite.revoked && !row.invite.acceptedAt && row.invite.expiresAt.getTime() > Date.now(),
      team: { id: row.team.id, slug: row.team.slug, name: row.team.name, logo: row.team.logo },
    };
  }

  async acceptInvite(user: AuthUser, token: string): Promise<unknown> {
    const hash = createHash('sha256').update(token).digest('hex');
    const rows = await this.db.select().from(folioTeamInvites).where(eq(folioTeamInvites.tokenHash, hash)).limit(1);
    const invite = rows[0];
    if (!invite) throw new NotFoundError('Invite not found');
    if (invite.revoked) throw new ConflictError('This invite has been revoked');
    if (invite.acceptedAt) throw new ConflictError('This invite has already been used');
    if (invite.expiresAt.getTime() <= Date.now()) throw new ConflictError('This invite has expired');
    if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new ForbiddenError('This invite was sent to a different email address');
    }

    await this.db
      .insert(folioTeamMembers)
      .values({ teamId: invite.teamId, userId: user.id, role: 'member' })
      .onConflictDoNothing();
    await this.db.update(folioTeamInvites).set({ acceptedAt: new Date() }).where(eq(folioTeamInvites.id, invite.id));

    const teamRows = await this.db.select({ slug: folioTeams.slug }).from(folioTeams).where(eq(folioTeams.id, invite.teamId)).limit(1);
    return { teamId: invite.teamId, slug: teamRows[0]?.slug ?? null };
  }

  async pendingInvites(user: AuthUser): Promise<unknown[]> {
    if (!user.email) return [];
    const rows = await this.db
      .select({ invite: folioTeamInvites, team: folioTeams })
      .from(folioTeamInvites)
      .innerJoin(folioTeams, eq(folioTeams.id, folioTeamInvites.teamId))
      .where(
        and(
          sql`lower(${folioTeamInvites.email}) = lower(${user.email})`,
          eq(folioTeamInvites.revoked, false),
          sql`${folioTeamInvites.acceptedAt} is null`,
          sql`${folioTeamInvites.expiresAt} > now()`,
        ),
      )
      .orderBy(desc(folioTeamInvites.createdAt));

    return rows.map((row) => ({
      id: row.invite.id,
      teamId: row.invite.teamId,
      email: row.invite.email,
      expiresAt: row.invite.expiresAt.toISOString(),
      createdAt: row.invite.createdAt.toISOString(),
      team: { id: row.team.id, slug: row.team.slug, name: row.team.name, logo: row.team.logo },
    }));
  }

  async publicTeams(): Promise<unknown[]> {
    const rows = await this.db
      .select({
        team: folioTeams,
        memberCount: sql<number>`(select count(*)::int from folio_team_members m where m.team_id = ${folioTeams.id})`,
      })
      .from(folioTeams)
      .where(eq(folioTeams.show, true))
      .orderBy(desc(folioTeams.createdAt));
    return rows.map((row) => ({ ...serializeTeam(row.team), memberCount: row.memberCount }));
  }

  async publicTeamPortfolio(slug: string): Promise<unknown> {
    const teamRows = await this.db
      .select()
      .from(folioTeams)
      .where(and(eq(folioTeams.slug, slug.toLowerCase().trim()), eq(folioTeams.show, true)))
      .limit(1);
    const team = teamRows[0];
    if (!team) throw new NotFoundError('Team not found');

    const members = await this.db
      .select({ member: folioTeamMembers, profile: profiles })
      .from(folioTeamMembers)
      .innerJoin(profiles, eq(profiles.id, folioTeamMembers.userId))
      .where(eq(folioTeamMembers.teamId, team.id))
      .orderBy(asc(folioTeamMembers.joinedAt));

    const shares = await this.db
      .select({ share: folioTeamContentShares, content: portfolioContents })
      .from(folioTeamContentShares)
      .innerJoin(portfolioContents, eq(portfolioContents.userId, folioTeamContentShares.userId))
      .where(eq(folioTeamContentShares.teamId, team.id));

    const sections: Record<string, unknown[]> = {};
    for (const row of shares) {
      const column = camelSection(row.share.section);
      const items = (row.content as unknown as Record<string, unknown[]>)[column] ?? [];
      const match = items.find((item) => String((item as Record<string, unknown>).id) === row.share.itemId);
      if (!match) continue;
      (sections[row.share.section] ??= []).push(match);
    }

    return {
      id: team.id,
      slug: team.slug,
      name: team.name,
      tagline: team.tagline,
      description: team.description,
      logo: team.logo,
      ownerId: team.ownerId,
      createdAt: team.createdAt.toISOString(),
      members: members.map((row) => ({
        id: row.profile.id,
        username: row.profile.username,
        firstname: row.profile.firstname,
        lastname: row.profile.lastname,
        photo: row.profile.photo,
        role: row.member.role,
        title: row.member.title,
        jobRole: row.profile.role,
        type: row.profile.type,
        show: row.profile.show,
        joinedAt: row.member.joinedAt.toISOString(),
      })),
      sections,
    };
  }

  async shareContent(user: AuthUser, teamId: string, section: string, itemId: string): Promise<void> {
    if (!CONTENT_SECTIONS.includes(section as (typeof CONTENT_SECTIONS)[number])) {
      throw new ConflictError('Unknown section');
    }
    await this.requireTeamMember(teamId, user.id);
    await this.db
      .insert(folioTeamContentShares)
      .values({ teamId, userId: user.id, section, itemId })
      .onConflictDoNothing();
  }

  async unshareContent(user: AuthUser, teamId: string, section: string, itemId: string): Promise<void> {
    await this.db
      .delete(folioTeamContentShares)
      .where(
        and(
          eq(folioTeamContentShares.teamId, teamId),
          eq(folioTeamContentShares.userId, user.id),
          eq(folioTeamContentShares.section, section),
          eq(folioTeamContentShares.itemId, itemId),
        ),
      );
  }

  async listShares(user: AuthUser, teamId: string): Promise<unknown[]> {
    await this.requireTeamMember(teamId, user.id);
    const rows = await this.db
      .select()
      .from(folioTeamContentShares)
      .where(eq(folioTeamContentShares.teamId, teamId));
    return rows.map((row) => ({
      teamId: row.teamId,
      userId: row.userId,
      section: row.section,
      itemId: row.itemId,
    }));
  }

  private async requireTeamOwner(teamId: string, userId: string): Promise<typeof folioTeams.$inferSelect> {
    const rows = await this.db.select().from(folioTeams).where(eq(folioTeams.id, teamId)).limit(1);
    const team = rows[0];
    if (!team) throw new NotFoundError('Team not found');
    if (team.ownerId !== userId) throw new ForbiddenError('Only the team owner can do that');
    return team;
  }

  private async isTeamOwner(teamId: string, userId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: folioTeams.id })
      .from(folioTeams)
      .where(and(eq(folioTeams.id, teamId), eq(folioTeams.ownerId, userId)))
      .limit(1);
    return Boolean(rows[0]);
  }

  private async requireTeamMember(teamId: string, userId: string): Promise<void> {
    const rows = await this.db
      .select({ teamId: folioTeamMembers.teamId })
      .from(folioTeamMembers)
      .where(and(eq(folioTeamMembers.teamId, teamId), eq(folioTeamMembers.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new ForbiddenError('Not a team member');
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

function camelSection(section: string): string {
  return section.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}

export function serializeProfile(profile: typeof profiles.$inferSelect): Record<string, unknown> {
  return {
    id: profile.id,
    username: profile.username,
    email: profile.email,
    firstname: profile.firstname,
    lastname: profile.lastname,
    role: profile.role,
    phone: profile.phone,
    photo: profile.photo,
    description: profile.description,
    gitlink: profile.gitlink,
    linkedin: profile.linkedin,
    resumelink: profile.resumelink,
    show: profile.show,
    type: profile.type,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function serializeContent(content: typeof portfolioContents.$inferSelect): Record<string, unknown> {
  return {
    userId: content.userId,
    about: content.about,
    skills: content.skills,
    projects: content.projects,
    experience: content.experience,
    education: content.education,
    certificates: content.certificates,
    contentChannels: content.contentChannels,
    contentWorks: content.contentWorks,
    collaborations: content.collaborations,
    creatorTools: content.creatorTools,
    template: content.template,
    updatedAt: content.updatedAt.toISOString(),
  };
}

function serializeTeam(team: typeof folioTeams.$inferSelect): Record<string, unknown> {
  return {
    id: team.id,
    ownerId: team.ownerId,
    slug: team.slug,
    name: team.name,
    tagline: team.tagline,
    description: team.description,
    logo: team.logo,
    show: team.show,
    createdAt: team.createdAt.toISOString(),
    updatedAt: team.updatedAt.toISOString(),
  };
}

function serializeInvite(invite: typeof folioTeamInvites.$inferSelect): Record<string, unknown> {
  return {
    id: invite.id,
    teamId: invite.teamId,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    revoked: invite.revoked,
    createdAt: invite.createdAt.toISOString(),
  };
}

function serializeToken(token: typeof apiTokens.$inferSelect): Record<string, unknown> {
  return {
    id: token.id,
    name: token.name,
    createdAt: token.createdAt.toISOString(),
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    revoked: token.revoked,
  };
}
