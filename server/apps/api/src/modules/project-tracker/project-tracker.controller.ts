import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, Public, Roles, type AuthUser } from '@platform/authz';
import { TrackerAuthGuard } from './tracker-auth.guard';
import { z } from 'zod';
import { ProjectTrackerService } from './project-tracker.service';

const projectCreate = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(4000).optional(),
  clientName: z.string().max(160).optional(),
});

const projectPatch = z.object({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(4000).nullable().optional(),
  clientName: z.string().max(160).nullable().optional(),
  status: z.enum(['active', 'completed', 'archived']).optional(),
});

const taskCreate = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(20000).optional(),
  type: z.enum(['task', 'bug', 'story', 'issue']).default('task'),
  status: z.enum(['open', 'in_progress', 'testing', 'test_release', 'released', 'completed', 'cancelled']).default('open'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  versionId: z.string().uuid().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

const taskPatch = taskCreate.partial().omit({ projectId: true });

const commentCreate = z.object({
  message: z.string().min(1).max(20000),
  imagePath: z.string().max(1024).optional(),
  fileType: z.string().max(128).optional(),
  fileName: z.string().max(255).optional(),
});

const reactionToggle = z.object({ emoji: z.string().min(1).max(16) });

const docCreate = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(200000).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const docPatch = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(200000).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const pushSubscription = z.object({
  endpoint: z.string().min(1).max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(512).optional(),
});

const rolePatch = z.object({ role: z.string().min(1).max(64) });
const disabledPatch = z.object({ disabled: z.boolean() });
const trackerBucket = z.enum(['apks', 'avatars', 'task-screenshots', 'docs']);
const uploadPresign = z.object({
  bucket: trackerBucket,
  objectPath: z.string().max(1024).optional(),
  fileName: z.string().max(255).optional(),
  contentType: z.string().max(128).optional(),
  projectId: z.string().uuid().optional(),
});
const uploadRemove = z.object({ bucket: trackerBucket, objectKey: z.string().min(1).max(1024) });
const apkRegister = z.object({
  fileName: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  storagePath: z.string().min(1).max(1024),
});
const profilePatch = z.object({
  fullName: z.string().max(200).nullable().optional(),
  avatarUrl: z.string().max(2048).nullable().optional(),
  githubId: z.string().max(120).nullable().optional(),
});
const userCreate = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  fullName: z.string().min(1).max(200),
  role: z.string().min(1).max(64).default('viewer'),
});

@Public()
@Controller('pt')
@UseGuards(TrackerAuthGuard)
export class ProjectTrackerController {
  constructor(private readonly service: ProjectTrackerService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.service.me(user);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.updateMe(user, profilePatch.parse(body));
  }

  @Get('roles')
  async roles(): Promise<unknown> {
    return { roles: await this.service.listRoles() };
  }

  @Post('uploads/presign')
  async presignUpload(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.presignTrackerUpload(user, uploadPresign.parse(body));
  }

  @Post('uploads/remove')
  async removeUpload(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const input = uploadRemove.parse(body);
    await this.service.removeTrackerUpload(user, input);
    return { ok: true };
  }

  @Get('uploads/list')
  async listUploads(
    @CurrentUser() user: AuthUser,
    @Query('bucket') bucket?: string,
    @Query('prefix') prefix?: string,
  ): Promise<unknown> {
    const parsed = trackerBucket.parse(bucket);
    return { files: await this.service.listTrackerUploads(user, { bucket: parsed, prefix }) };
  }

  @Get('profiles')
  async profiles(): Promise<unknown> {
    return { profiles: await this.service.listProfiles() };
  }

  @Post('users')
  async createUser(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.createTrackerUser(user, userCreate.parse(body));
  }

  @Patch('profiles/:id/role')
  async setRole(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { role } = rolePatch.parse(body);
    await this.service.setUserRole(user, id, role);
    return { ok: true };
  }

  @Patch('profiles/:id/disabled')
  async setDisabled(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { disabled } = disabledPatch.parse(body);
    await this.service.setUserDisabled(user, id, disabled);
    return { ok: true };
  }

  @Get('stats')
  async stats(): Promise<unknown> {
    return this.service.stats();
  }

  @Get('projects')
  async projects(): Promise<unknown> {
    return { projects: await this.service.listProjects() };
  }

  @Post('projects')
  async createProject(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.createProject(user, projectCreate.parse(body));
  }

  @Get('projects/:id')
  async project(@Param('id') id: string): Promise<unknown> {
    return this.service.getProject(id);
  }

  @Patch('projects/:id')
  async updateProject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.updateProject(user, id, projectPatch.parse(body));
  }

  @Delete('projects/:id')
  async deleteProject(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteProject(user, id);
    return { ok: true };
  }

  @Get('projects/:id/tasks')
  async tasks(
    @Param('id') id: string,
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('assigneeId') assigneeId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ): Promise<unknown> {
    return {
      tasks: await this.service.listTasks(id, {
        status,
        type,
        assigneeId,
        includeDeleted: includeDeleted === 'true',
      }),
    };
  }

  @Post('tasks')
  async createTask(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.createTask(user, taskCreate.parse(body));
  }

  @Get('tasks/:id')
  async task(@Param('id') id: string): Promise<unknown> {
    return this.service.getTask(id);
  }

  @Patch('tasks/:id')
  async updateTask(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.updateTask(user, id, taskPatch.parse(body));
  }

  @Delete('tasks/:id')
  async deleteTask(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteTask(user, id);
    return { ok: true };
  }

  @Post('tasks/:id/comments')
  async addComment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.addComment(user, id, commentCreate.parse(body));
  }

  @Delete('comments/:id')
  async deleteComment(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteComment(user, id);
    return { ok: true };
  }

  @Post('comments/:id/reactions')
  async toggleReaction(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { emoji } = reactionToggle.parse(body);
    return this.service.toggleReaction(user, id, emoji);
  }

  @Get('notifications')
  async notifications(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { notifications: await this.service.listNotifications(user) };
  }

  @Put('notifications/read')
  async markRead(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const { ids } = z.object({ ids: z.array(z.string().uuid()).optional() }).parse(body ?? {});
    await this.service.markNotificationsRead(user, ids);
    return { ok: true };
  }

  @Get('projects/:id/docs')
  async docs(@Param('id') id: string): Promise<unknown> {
    return { docs: await this.service.listDocs(id) };
  }

  @Post('projects/:id/docs')
  async createDoc(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.createDoc(user, id, docCreate.parse(body ?? {}));
  }

  @Patch('docs/:id')
  async updateDoc(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.updateDoc(user, id, docPatch.parse(body));
  }

  @Delete('docs/:id')
  async deleteDoc(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteDoc(user, id);
    return { ok: true };
  }

  @Get('projects/:id/apks')
  async apks(@Param('id') id: string): Promise<unknown> {
    return { apks: await this.service.listApks(id) };
  }

  @Post('projects/:id/apks')
  async registerApk(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    return this.service.registerApk(user, { projectId: id, ...apkRegister.parse(body) });
  }

  @Delete('apks/:id')
  async deleteApk(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteApk(user, id);
    return { ok: true };
  }

  @Get('push/subscriptions')
  async pushSubscriptions(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { subscriptions: await this.service.listPushSubscriptions(user) };
  }

  @Get('push/subscriptions/:userId')
  async pushSubscriptionsFor(@CurrentUser() user: AuthUser, @Param('userId') userId: string): Promise<unknown> {
    return { subscriptions: await this.service.listPushSubscriptionsFor(user, userId) };
  }

  @Post('push/subscriptions')
  async savePush(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    await this.service.savePushSubscription(user, pushSubscription.parse(body));
    return { ok: true };
  }

  @Delete('push/subscriptions')
  async deletePush(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const { endpoint } = z.object({ endpoint: z.string().min(1) }).parse(body);
    await this.service.deletePushSubscription(user, endpoint);
    return { ok: true };
  }

  @Get('projects/:id/activity')
  async activity(@Param('id') id: string): Promise<unknown> {
    return { activity: await this.service.listActivity(id) };
  }
}

@Controller('public/pt')
export class PublicProjectTrackerController {
  constructor(private readonly service: ProjectTrackerService) {}

  @Public()
  @Get('apk/:slug/:identifier')
  async apk(@Param('slug') slug: string, @Param('identifier') identifier: string): Promise<unknown> {
    const result = await this.service.findApkBySlugAndName(slug, identifier);
    if (!result) return null;
    return result;
  }
}

void Roles;
