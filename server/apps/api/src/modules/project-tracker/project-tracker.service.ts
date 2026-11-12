import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { ConflictError, ForbiddenError, NotFoundError } from '@platform/common';
import { DB, type Database } from '../../core.module';
import {
  activityLogs,
  commentReactions,
  comments,
  notifications,
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
import { profiles } from '../../schema/project-tracker';

export const PT_EVENTS = {
  commentCreated: 'pt.comment.created',
  commentDeleted: 'pt.comment.deleted',
  reactionAdded: 'pt.reaction.added',
  reactionRemoved: 'pt.reaction.removed',
  notificationCreated: 'pt.notification.created',
  taskChanged: 'pt.task.changed',
} as const;

@Injectable()
export class ProjectTrackerService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly events: EventEmitter2,
  ) {}

  async ensureProfile(user: AuthUser): Promise<typeof profiles.$inferSelect> {
    const existing = await this.db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    if (existing[0]) return existing[0];

    const inserted = await this.db
      .insert(profiles)
      .values({
        id: user.id,
        email: user.email || `${user.id}@unknown`,
        fullName: user.name || user.email,
        avatarUrl: user.picture ?? null,
        role: user.role === 'admin' ? 'super_admin' : 'viewer',
      })
      .onConflictDoNothing()
      .returning();

    const profile =
      inserted[0] ?? (await this.db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1))[0];
    if (!profile) throw new ConflictError('Could not create profile');
    return profile;
  }

  private async assertActive(user: AuthUser): Promise<typeof profiles.$inferSelect> {
    const profile = await this.ensureProfile(user);
    if (profile.disabled) throw new ForbiddenError('Account disabled');
    return profile;
  }

  async listRoles(): Promise<unknown[]> {
    return this.db.select().from(roles).orderBy(asc(roles.id));
  }

  async me(user: AuthUser): Promise<unknown> {
    return this.ensureProfile(user);
  }

  async updateMe(user: AuthUser, patch: Record<string, unknown>): Promise<unknown> {
    await this.ensureProfile(user);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['fullName', 'avatarUrl', 'githubId'] as const) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    const updated = await this.db.update(profiles).set(values).where(eq(profiles.id, user.id)).returning();
    return updated[0];
  }

  async listProfiles(): Promise<unknown[]> {
    return this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
        role: profiles.role,
        disabled: profiles.disabled,
      })
      .from(profiles)
      .orderBy(asc(profiles.email));
  }

  async setUserRole(actor: AuthUser, targetId: string, role: string): Promise<void> {
    const actorProfile = await this.assertActive(actor);
    if (targetId === actor.id) throw new ForbiddenError('You cannot change your own role');
    if (actorProfile.role !== 'super_admin') throw new ForbiddenError('Only super admins can change roles');
    const roleRow = await this.db.select({ id: roles.id }).from(roles).where(eq(roles.id, role)).limit(1);
    if (!roleRow[0]) throw new ConflictError('Unknown role');
    await this.db.update(profiles).set({ role, updatedAt: new Date() }).where(eq(profiles.id, targetId));
  }

  async setUserDisabled(actor: AuthUser, targetId: string, disabled: boolean): Promise<void> {
    const actorProfile = await this.assertActive(actor);
    if (actorProfile.role !== 'super_admin' && actorProfile.role !== 'admin') {
      throw new ForbiddenError('Only admins can disable users');
    }
    if (targetId === actor.id) throw new ForbiddenError('You cannot disable yourself');
    await this.db.update(profiles).set({ disabled, updatedAt: new Date() }).where(eq(profiles.id, targetId));
  }

  async listProjects(): Promise<unknown[]> {
    return this.db
      .select({
        project: projects,
        taskCount: sql<number>`(select count(*)::int from tasks t where t.project_id = ${projects.id} and t.deleted_at is null)`,
      })
      .from(projects)
      .orderBy(asc(projects.name))
      .then((rows) => rows.map((row) => ({ ...row.project, taskCount: row.taskCount })));
  }

  async getProject(idOrSlug: string): Promise<unknown> {
    const rows = await this.db
      .select()
      .from(projects)
      .where(sql`${projects.id}::text = ${idOrSlug} or ${projects.slug} = ${idOrSlug}`)
      .limit(1);
    if (!rows[0]) throw new NotFoundError('Project not found');
    const members = await this.db
      .select({ member: projectMembers, profile: profiles })
      .from(projectMembers)
      .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, rows[0].id));
    return {
      ...rows[0],
      members: members.map((row) => ({ ...row.member, profile: row.profile })),
    };
  }

  async createProject(user: AuthUser, input: { name: string; description?: string; clientName?: string }): Promise<unknown> {
    const profile = await this.assertActive(user);
    if (!['super_admin', 'admin', 'project_admin'].includes(profile.role)) {
      throw new ForbiddenError('Only admins can create projects');
    }
    const existing = await this.db.select({ id: projects.id }).from(projects).where(eq(projects.name, input.name)).limit(1);
    if (existing[0]) throw new ConflictError('Project name already exists');

    const inserted = await this.db
      .insert(projects)
      .values({
        name: input.name,
        slug: slugify(input.name),
        description: input.description ?? null,
        clientName: input.clientName ?? null,
        ownerId: profile.id,
      })
      .returning();
    const project = inserted[0]!;
    await this.db.insert(projectMembers).values({ projectId: project.id, userId: profile.id, role: 'project_admin' });
    await this.logActivity({ projectId: project.id, userId: profile.id, action: 'project.created' });
    return project;
  }

  async updateProject(user: AuthUser, projectId: string, patch: Record<string, unknown>): Promise<unknown> {
    await this.assertActive(user);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['name', 'description', 'clientName', 'status'] as const) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    if (values.name) values.slug = slugify(String(values.name));
    const updated = await this.db.update(projects).set(values).where(eq(projects.id, projectId)).returning();
    if (!updated[0]) throw new NotFoundError('Project not found');
    return updated[0];
  }

  async deleteProject(user: AuthUser, projectId: string): Promise<void> {
    const profile = await this.assertActive(user);
    const rows = await this.db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
    const project = rows[0];
    if (!project) throw new NotFoundError('Project not found');
    if (project.ownerId !== profile.id && profile.role !== 'super_admin') {
      throw new ForbiddenError('Only the owner or a super admin can delete');
    }
    await this.db.delete(projects).where(eq(projects.id, projectId));
  }

  async listTasks(projectId: string, filters: { status?: string; type?: string; assigneeId?: string; includeDeleted?: boolean }): Promise<unknown[]> {
    const where = [eq(tasks.projectId, projectId)];
    if (!filters.includeDeleted) where.push(isNull(tasks.deletedAt));
    if (filters.status) where.push(eq(tasks.status, filters.status));
    if (filters.type) where.push(eq(tasks.type, filters.type));
    if (filters.assigneeId) where.push(eq(tasks.assigneeId, filters.assigneeId));

    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(...where))
      .orderBy(desc(tasks.createdAt));
    return rows;
  }

  async getTask(idOrNumber: string): Promise<unknown> {
    const numeric = Number(idOrNumber);
    const rows = Number.isFinite(numeric)
      ? await this.db.select().from(tasks).where(eq(tasks.number, numeric)).limit(1)
      : await this.db.select().from(tasks).where(sql`${tasks.id}::text = ${idOrNumber}`).limit(1);
    const task = rows[0];
    if (!task) throw new NotFoundError('Task not found');

    const [taskComments, taskTagRows, images] = await Promise.all([
      this.db.select({ comment: comments, profile: profiles }).from(comments)
        .innerJoin(profiles, eq(profiles.id, comments.userId))
        .where(eq(comments.taskId, task.id))
        .orderBy(asc(comments.createdAt)),
      this.db.select({ tag: tags }).from(taskTags)
        .innerJoin(tags, eq(tags.id, taskTags.tagId))
        .where(eq(taskTags.taskId, task.id)),
      this.db.select().from(taskImages).where(eq(taskImages.taskId, task.id)),
    ]);

    return {
      ...task,
      comments: taskComments.map((row) => ({ ...row.comment, user: row.profile })),
      tags: taskTagRows.map((row) => row.tag),
      images,
    };
  }

  async createTask(user: AuthUser, input: Record<string, unknown>): Promise<unknown> {
    const profile = await this.assertActive(user);
    const projectId = String(input.projectId);
    const project = await this.db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
    if (!project[0]) throw new NotFoundError('Project not found');

    const inserted = await this.db
      .insert(tasks)
      .values({
        projectId,
        versionId: input.versionId ? String(input.versionId) : null,
        title: String(input.title),
        description: input.description ? String(input.description) : null,
        type: String(input.type ?? 'task'),
        status: String(input.status ?? 'open'),
        priority: String(input.priority ?? 'medium'),
        assigneeId: input.assigneeId ? String(input.assigneeId) : null,
        reporterId: profile.id,
        dueDate: input.dueDate ? String(input.dueDate) : null,
        number: await this.nextTaskNumber(),
      })
      .returning();
    const task = inserted[0]!;
    await this.logActivity({ projectId, taskId: task.id, userId: profile.id, action: 'task.created' });
    this.events.emit(PT_EVENTS.taskChanged, { projectId, taskId: task.id, action: 'created' });
    return task;
  }

  async updateTask(user: AuthUser, taskId: string, patch: Record<string, unknown>): Promise<unknown> {
    const profile = await this.assertActive(user);
    const values: Record<string, unknown> = { updatedAt: new Date() };
    for (const key of ['title', 'description', 'type', 'status', 'priority', 'versionId', 'assigneeId', 'dueDate'] as const) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    const updated = await this.db.update(tasks).set(values).where(eq(tasks.id, taskId)).returning();
    if (!updated[0]) throw new NotFoundError('Task not found');
    await this.logActivity({
      projectId: updated[0].projectId,
      taskId,
      userId: profile.id,
      action: 'task.updated',
      metadata: { fields: Object.keys(values) },
    });
    this.events.emit(PT_EVENTS.taskChanged, { projectId: updated[0].projectId, taskId, action: 'updated' });
    return updated[0];
  }

  async deleteTask(user: AuthUser, taskId: string): Promise<void> {
    const profile = await this.assertActive(user);
    const rows = await this.db.select({ projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Task not found');
    await this.db
      .update(tasks)
      .set({ deletedAt: new Date(), deletedBy: profile.id })
      .where(eq(tasks.id, taskId));
    await this.logActivity({ projectId: rows[0].projectId, taskId, userId: profile.id, action: 'task.deleted' });
  }

  async addComment(user: AuthUser, taskId: string, input: { message: string; imagePath?: string; fileType?: string; fileName?: string }): Promise<unknown> {
    const profile = await this.assertActive(user);
    const taskRows = await this.db.select({ id: tasks.id, projectId: tasks.projectId }).from(tasks).where(eq(tasks.id, taskId)).limit(1);
    if (!taskRows[0]) throw new NotFoundError('Task not found');

    const inserted = await this.db
      .insert(comments)
      .values({
        taskId,
        userId: profile.id,
        message: input.message,
        imagePath: input.imagePath ?? null,
        fileType: input.fileType ?? null,
        fileName: input.fileName ?? null,
      })
      .returning();
    const comment = inserted[0]!;

    this.events.emit(PT_EVENTS.commentCreated, { taskId, comment: { ...comment, user: profile } });
    await this.logActivity({ projectId: taskRows[0].projectId, taskId, userId: profile.id, action: 'comment.created' });
    return { ...comment, user: profile };
  }

  async deleteComment(user: AuthUser, commentId: string): Promise<void> {
    const profile = await this.assertActive(user);
    const rows = await this.db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!rows[0]) throw new NotFoundError('Comment not found');
    if (rows[0].userId !== profile.id && profile.role !== 'super_admin') {
      throw new ForbiddenError('Only the author or a super admin can delete');
    }
    await this.db.delete(comments).where(eq(comments.id, commentId));
    this.events.emit(PT_EVENTS.commentDeleted, { taskId: rows[0].taskId, commentId });
  }

  async toggleReaction(user: AuthUser, commentId: string, emoji: string): Promise<unknown> {
    const profile = await this.assertActive(user);
    const existing = await this.db
      .select({ id: commentReactions.id })
      .from(commentReactions)
      .where(
        and(
          eq(commentReactions.commentId, commentId),
          eq(commentReactions.userId, profile.id),
          eq(commentReactions.emoji, emoji),
        ),
      )
      .limit(1);

    if (existing[0]) {
      await this.db.delete(commentReactions).where(eq(commentReactions.id, existing[0].id));
      this.events.emit(PT_EVENTS.reactionRemoved, { commentId, emoji, userId: profile.id });
      return { active: false };
    }

    const inserted = await this.db
      .insert(commentReactions)
      .values({ commentId, userId: profile.id, emoji })
      .returning();
    this.events.emit(PT_EVENTS.reactionAdded, { commentId, reaction: inserted[0] });
    return { active: true, reaction: inserted[0] };
  }

  async listNotifications(user: AuthUser): Promise<unknown[]> {
    const profile = await this.ensureProfile(user);
    return this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, profile.id))
      .orderBy(desc(notifications.createdAt))
      .limit(100);
  }

  async markNotificationsRead(user: AuthUser, ids?: string[]): Promise<void> {
    const profile = await this.ensureProfile(user);
    const where = ids?.length
      ? and(eq(notifications.userId, profile.id), inArray(notifications.id, ids))
      : eq(notifications.userId, profile.id);
    await this.db.update(notifications).set({ read: true }).where(where);
  }

  async createNotification(input: {
    userId: string;
    actorId?: string | null;
    projectId?: string | null;
    type: string;
    title: string;
    body?: string;
    link?: string;
    priority?: string;
  }): Promise<unknown> {
    const inserted = await this.db
      .insert(notifications)
      .values({
        userId: input.userId,
        actorId: input.actorId ?? null,
        projectId: input.projectId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        priority: input.priority ?? null,
      })
      .returning();
    this.events.emit(PT_EVENTS.notificationCreated, { notification: inserted[0] });
    return inserted[0];
  }

  async listDocs(projectId: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(projectDocs)
      .where(eq(projectDocs.projectId, projectId))
      .orderBy(asc(projectDocs.title));
  }

  async createDoc(user: AuthUser, projectId: string, input: { title?: string; content?: string; parentId?: string | null }): Promise<unknown> {
    const profile = await this.assertActive(user);
    const inserted = await this.db
      .insert(projectDocs)
      .values({
        projectId,
        parentId: input.parentId ?? null,
        title: input.title ?? 'Untitled',
        content: input.content ?? '',
        createdBy: profile.id,
      })
      .returning();
    return inserted[0];
  }

  async updateDoc(user: AuthUser, docId: string, patch: Record<string, unknown>): Promise<unknown> {
    const profile = await this.assertActive(user);
    const values: Record<string, unknown> = { updatedAt: new Date(), updatedBy: profile.id };
    for (const key of ['title', 'content', 'parentId'] as const) {
      if (patch[key] !== undefined) values[key] = patch[key];
    }
    const updated = await this.db.update(projectDocs).set(values).where(eq(projectDocs.id, docId)).returning();
    if (!updated[0]) throw new NotFoundError('Doc not found');
    return updated[0];
  }

  async deleteDoc(docId: string): Promise<void> {
    await this.db.delete(projectDocs).where(eq(projectDocs.id, docId));
  }

  async listApks(projectId: string): Promise<unknown[]> {
    return this.db
      .select()
      .from(projectApks)
      .where(eq(projectApks.projectId, projectId))
      .orderBy(desc(projectApks.createdAt));
  }

  async findApkBySlugAndName(projectSlug: string, fileName: string): Promise<unknown | null> {
    const rows = await this.db
      .select({ apk: projectApks, project: projects })
      .from(projectApks)
      .innerJoin(projects, eq(projects.id, projectApks.projectId))
      .where(and(eq(projects.slug, projectSlug), eq(projectApks.fileName, fileName)))
      .limit(1);
    return rows[0] ?? null;
  }

  async registerApk(user: AuthUser, input: { projectId: string; fileName: string; sizeBytes: number; storagePath: string }): Promise<unknown> {
    const profile = await this.assertActive(user);
    const next = await this.db
      .select({ max: sql<number>`coalesce(max(${projectApks.number}), 0)::int` })
      .from(projectApks)
      .where(eq(projectApks.projectId, input.projectId));
    const inserted = await this.db
      .insert(projectApks)
      .values({
        projectId: input.projectId,
        uploadedBy: profile.id,
        number: (next[0]?.max ?? 0) + 1,
        fileName: input.fileName,
        sizeBytes: input.sizeBytes,
        storagePath: input.storagePath,
      })
      .returning();
    return inserted[0];
  }

  async deleteApk(apkId: string): Promise<void> {
    await this.db.delete(projectApks).where(eq(projectApks.id, apkId));
  }

  async listPushSubscriptions(user: AuthUser): Promise<unknown[]> {
    const profile = await this.ensureProfile(user);
    return this.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, profile.id));
  }

  async savePushSubscription(
    user: AuthUser,
    input: { endpoint: string; p256dh: string; auth: string; userAgent?: string },
  ): Promise<void> {
    const profile = await this.assertActive(user);
    await this.db
      .insert(pushSubscriptions)
      .values({
        userId: profile.id,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: profile.id, p256dh: input.p256dh, auth: input.auth, userAgent: input.userAgent ?? null },
      });
  }

  async deletePushSubscription(user: AuthUser, endpoint: string): Promise<void> {
    const profile = await this.ensureProfile(user);
    await this.db
      .delete(pushSubscriptions)
      .where(and(eq(pushSubscriptions.userId, profile.id), eq(pushSubscriptions.endpoint, endpoint)));
  }

  async listActivity(projectId: string): Promise<unknown[]> {
    return this.db
      .select({ log: activityLogs, profile: profiles })
      .from(activityLogs)
      .leftJoin(profiles, eq(profiles.id, activityLogs.userId))
      .where(eq(activityLogs.projectId, projectId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(100);
  }

  async stats(): Promise<unknown> {
    const [projectCount, taskCount, userCount, commentCount] = await Promise.all([
      this.db.select({ value: count() }).from(projects),
      this.db.select({ value: count() }).from(tasks).where(isNull(tasks.deletedAt)),
      this.db.select({ value: count() }).from(profiles),
      this.db.select({ value: count() }).from(comments),
    ]);
    return {
      projects: projectCount[0]?.value ?? 0,
      tasks: taskCount[0]?.value ?? 0,
      users: userCount[0]?.value ?? 0,
      comments: commentCount[0]?.value ?? 0,
    };
  }

  private async nextTaskNumber(): Promise<number> {
    const result = await this.db.select({ max: sql<number>`coalesce(max(${tasks.number}), 0)::int` }).from(tasks);
    return (result[0]?.max ?? 0) + 1;
  }

  private async logActivity(input: {
    projectId?: string | null;
    taskId?: string | null;
    userId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(activityLogs).values({
      projectId: input.projectId ?? null,
      taskId: input.taskId ?? null,
      userId: input.userId,
      action: input.action,
      metadata: input.metadata ?? null,
    });
  }
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
