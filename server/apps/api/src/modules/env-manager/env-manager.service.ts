import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { ConflictError, ForbiddenError, NotFoundError } from '@platform/common';
import { DB, type Database } from '../../core.module';
import {
  audit,
  environments,
  projectMembers,
  projects,
  settings,
  tokens,
  users,
  variables,
} from '../../schema/env-manager';
import { CryptoService, newApiToken, sha256 } from './crypto.service';

export type EnvRole = 'admin' | 'editor' | 'viewer';
const ROLE_RANK: Record<EnvRole, number> = { viewer: 1, editor: 2, admin: 3 };

@Injectable()
export class EnvManagerService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly crypto: CryptoService,
  ) {}

  async ensureUser(user: AuthUser): Promise<void> {
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.id, user.id)).limit(1);
    if (existing[0]) return;
    await this.db
      .insert(users)
      .values({
        id: user.id,
        email: user.email || `${user.id}@unknown`,
        name: user.name || (user.email ? user.email.split('@')[0]! : 'User'),
        isSuperAdmin: user.role === 'admin',
      })
      .onConflictDoNothing();
  }

  async userRole(user: AuthUser, projectId: string): Promise<EnvRole | 'super'> {
    await this.ensureUser(user);
    const superRow = await this.db.select({ isSuper: users.isSuperAdmin }).from(users).where(eq(users.id, user.id)).limit(1);
    if (superRow[0]?.isSuper) return 'super';
    const membership = await this.db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
      .limit(1);
    const role = membership[0]?.role as EnvRole | undefined;
    return role ?? 'viewer';
  }

  async assertRole(user: AuthUser, projectId: string, required: EnvRole): Promise<void> {
    const role = await this.userRole(user, projectId);
    if (role === 'super') return;
    if (ROLE_RANK[role] < ROLE_RANK[required]) throw new ForbiddenError('Insufficient project role');
  }

  async listProjects(user: AuthUser): Promise<unknown[]> {
    await this.ensureUser(user);
    const superRow = await this.db.select({ isSuper: users.isSuperAdmin }).from(users).where(eq(users.id, user.id)).limit(1);
    const isSuper = superRow[0]?.isSuper ?? false;

    if (isSuper) {
      return this.db.select().from(projects).orderBy(asc(projects.name));
    }
    return this.db
      .select({ project: projects, role: projectMembers.role })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projectMembers.userId, user.id))
      .orderBy(asc(projects.name))
      .then((rows) => rows.map((row) => ({ ...row.project, role: row.role })));
  }

  async createProject(user: AuthUser, input: { name: string; slug: string; description?: string }): Promise<unknown> {
    await this.ensureUser(user);
    const existing = await this.db.select({ id: projects.id }).from(projects).where(eq(projects.slug, input.slug)).limit(1);
    if (existing[0]) throw new ConflictError('Slug already exists');

    const inserted = await this.db
      .insert(projects)
      .values({ name: input.name, slug: input.slug, description: input.description ?? '' })
      .returning();
    const project = inserted[0]!;
    await this.db.insert(projectMembers).values({ projectId: project.id, userId: user.id, role: 'admin' });
    await this.logAudit({ action: 'project.created', actor: user.email, project: project.slug });
    return project;
  }

  async updateProject(user: AuthUser, projectId: string, input: { name?: string; description?: string }): Promise<unknown> {
    await this.assertRole(user, projectId, 'admin');
    const updated = await this.db
      .update(projects)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(projects.id, projectId))
      .returning();
    if (!updated[0]) throw new NotFoundError('Project not found');
    await this.logAudit({ action: 'project.updated', actor: user.email, project: updated[0].slug });
    return updated[0];
  }

  async deleteProject(user: AuthUser, projectId: string): Promise<void> {
    const role = await this.userRole(user, projectId);
    if (role !== 'super' && role !== 'admin') throw new ForbiddenError('Only project admins can delete');
    await this.db.delete(projects).where(eq(projects.id, projectId));
  }

  async listMembers(user: AuthUser, projectId: string): Promise<unknown[]> {
    await this.assertRole(user, projectId, 'viewer');
    return this.db
      .select({
        userId: projectMembers.userId,
        email: users.email,
        name: users.name,
        role: projectMembers.role,
        createdAt: projectMembers.createdAt,
      })
      .from(projectMembers)
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(asc(users.email));
  }

  async addMember(user: AuthUser, projectId: string, email: string, role: EnvRole): Promise<unknown> {
    await this.assertRole(user, projectId, 'admin');
    const target = await this.db.select().from(users).where(sql`lower(${users.email}) = lower(${email})`).limit(1);
    if (!target[0]) throw new NotFoundError('User must sign in at least once before being added');

    await this.db
      .insert(projectMembers)
      .values({ projectId, userId: target[0].id, role })
      .onConflictDoUpdate({
        target: [projectMembers.projectId, projectMembers.userId],
        set: { role },
      });
    await this.logAudit({ action: 'member.added', actor: user.email, project: projectId, detail: `${email}:${role}` });
    return { ok: true };
  }

  async removeMember(user: AuthUser, projectId: string, userId: string): Promise<void> {
    await this.assertRole(user, projectId, 'admin');
    await this.db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  }

  async listEnvironments(user: AuthUser, projectId: string): Promise<unknown[]> {
    await this.assertRole(user, projectId, 'viewer');
    return this.db
      .select({
        id: environments.id,
        projectId: environments.projectId,
        name: environments.name,
        createdAt: environments.createdAt,
        updatedAt: environments.updatedAt,
        variableCount: sql<number>`(select count(*)::int from variables v where v.environment_id = ${environments.id})`,
      })
      .from(environments)
      .where(eq(environments.projectId, projectId))
      .orderBy(asc(environments.name));
  }

  async createEnvironment(user: AuthUser, projectId: string, name: string): Promise<unknown> {
    await this.assertRole(user, projectId, 'editor');
    const existing = await this.db
      .select({ id: environments.id })
      .from(environments)
      .where(and(eq(environments.projectId, projectId), eq(environments.name, name)))
      .limit(1);
    if (existing[0]) throw new ConflictError('Environment already exists');

    const inserted = await this.db.insert(environments).values({ projectId, name }).returning();
    await this.logAudit({ action: 'env.created', actor: user.email, env: name });
    return inserted[0];
  }

  async deleteEnvironment(user: AuthUser, projectId: string, envId: string): Promise<void> {
    await this.assertRole(user, projectId, 'editor');
    await this.db.delete(environments).where(and(eq(environments.id, envId), eq(environments.projectId, projectId)));
  }

  async listVariables(user: AuthUser, projectId: string, envId: string, revealSecrets = false): Promise<unknown[]> {
    await this.assertRole(user, projectId, 'viewer');
    const rows = await this.db
      .select()
      .from(variables)
      .where(eq(variables.environmentId, envId))
      .orderBy(asc(variables.key));

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.isSecret && !revealSecrets ? null : this.crypto.decrypt(row.value),
      isSecret: row.isSecret,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async saveVariables(
    user: AuthUser,
    projectId: string,
    envId: string,
    entries: Array<{ key: string; value: string; isSecret?: boolean }>,
  ): Promise<void> {
    await this.assertRole(user, projectId, 'editor');
    const existing = await this.db.select().from(variables).where(eq(variables.environmentId, envId));
    const incomingKeys = new Set(entries.map((entry) => entry.key));

    for (const row of existing) {
      if (!incomingKeys.has(row.key)) {
        await this.db.delete(variables).where(eq(variables.id, row.id));
        continue;
      }
      const next = entries.find((entry) => entry.key === row.key)!;
      if (next.value === '' && row.isSecret) {
        continue;
      }
      await this.db
        .update(variables)
        .set({
          value: this.crypto.encrypt(next.value),
          isSecret: next.isSecret ?? row.isSecret,
          updatedAt: new Date(),
        })
        .where(eq(variables.id, row.id));
    }

    const existingKeys = new Set(existing.map((row) => row.key));
    for (const entry of entries) {
      if (existingKeys.has(entry.key)) continue;
      await this.db.insert(variables).values({
        environmentId: envId,
        key: entry.key,
        value: this.crypto.encrypt(entry.value),
        isSecret: entry.isSecret ?? false,
      });
    }

    await this.db.update(environments).set({ updatedAt: new Date() }).where(eq(environments.id, envId));
    await this.logAudit({
      action: 'env.saved',
      actor: user.email,
      detail: `env:${envId};keys:${entries.length}`,
    });
  }

  async listTokens(user: AuthUser, projectId: string): Promise<unknown[]> {
    await this.assertRole(user, projectId, 'admin');
    return this.db
      .select({
        id: tokens.id,
        name: tokens.name,
        prefix: tokens.prefix,
        createdAt: tokens.createdAt,
        lastUsedAt: tokens.lastUsedAt,
        revokedAt: tokens.revokedAt,
      })
      .from(tokens)
      .where(eq(tokens.projectId, projectId))
      .orderBy(desc(tokens.createdAt));
  }

  async createToken(user: AuthUser, projectId: string, name: string): Promise<unknown> {
    await this.assertRole(user, projectId, 'admin');
    const plaintext = newApiToken();
    const inserted = await this.db
      .insert(tokens)
      .values({
        projectId,
        name,
        prefix: plaintext.slice(0, 10),
        tokenHash: sha256(plaintext),
      })
      .returning();
    await this.logAudit({ action: 'token.created', actor: user.email, project: projectId });
    return { ...inserted[0], token: plaintext };
  }

  async revokeToken(user: AuthUser, projectId: string, tokenId: string): Promise<void> {
    await this.assertRole(user, projectId, 'admin');
    await this.db.update(tokens).set({ revokedAt: new Date() }).where(eq(tokens.id, tokenId));
    await this.logAudit({ action: 'token.revoked', actor: user.email, project: projectId });
  }

  async resolveToken(plaintext: string): Promise<{ projectId: string; tokenId: string } | null> {
    const hash = sha256(plaintext);
    const rows = await this.db
      .select({ id: tokens.id, projectId: tokens.projectId, revokedAt: tokens.revokedAt })
      .from(tokens)
      .where(eq(tokens.tokenHash, hash))
      .limit(1);
    const row = rows[0];
    if (!row || row.revokedAt) return null;
    await this.db.update(tokens).set({ lastUsedAt: new Date() }).where(eq(tokens.id, row.id));
    return { projectId: row.projectId, tokenId: row.id };
  }

  async publicVariables(projectId: string, envName: string, token: string): Promise<Record<string, string>> {
    const resolved = await this.resolveToken(token);
    if (!resolved || resolved.projectId !== projectId) throw new ForbiddenError('Invalid token');

    const envRow = await this.db
      .select()
      .from(environments)
      .where(and(eq(environments.projectId, projectId), eq(environments.name, envName)))
      .limit(1);
    if (!envRow[0]) throw new NotFoundError('Environment not found');

    const rows = await this.db
      .select()
      .from(variables)
      .where(and(eq(variables.environmentId, envRow[0].id), eq(variables.isSecret, false)));

    return Object.fromEntries(rows.map((row) => [row.key, this.crypto.decrypt(row.value)]));
  }

  async audit(user: AuthUser, limit = 100): Promise<unknown[]> {
    await this.ensureUser(user);
    return this.db.select().from(audit).orderBy(desc(audit.createdAt)).limit(limit);
  }

  async getSetting(key: string): Promise<string | null> {
    const rows = await this.db.select().from(settings).where(eq(settings.key, key)).limit(1);
    return rows[0]?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } });
  }

  private async logAudit(input: { action: string; actor: string; project?: string; env?: string; detail?: string }): Promise<void> {
    await this.db.insert(audit).values({
      action: input.action,
      actor: input.actor,
      project: input.project ?? null,
      env: input.env ?? null,
      detail: input.detail ?? null,
    });
  }
}
