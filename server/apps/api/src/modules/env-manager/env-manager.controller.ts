import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public, type AuthUser } from '@platform/authz';
import { z } from 'zod';
import { EnvManagerService } from './env-manager.service';

const projectCreate = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  description: z.string().max(2000).optional(),
});

const projectUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
});

const memberCreate = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).default('viewer'),
});

const envCreate = z.object({ name: z.string().min(1).max(64) });

const variablesSave = z.object({
  variables: z.array(
    z.object({
      key: z.string().min(1).max(256),
      value: z.string().default(''),
      isSecret: z.boolean().optional(),
    }),
  ),
});

const tokenCreate = z.object({ name: z.string().min(1).max(120) });

@Controller('env-manager')
@UseGuards(AuthGuard)
export class EnvManagerController {
  constructor(private readonly service: EnvManagerService) {}

  @Get('projects')
  async listProjects(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { projects: await this.service.listProjects(user) };
  }

  @Post('projects')
  async createProject(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.createProject(user, projectCreate.parse(body));
  }

  @Patch('projects/:id')
  async updateProject(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.updateProject(user, id, projectUpdate.parse(body));
  }

  @Delete('projects/:id')
  async deleteProject(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteProject(user, id);
    return { ok: true };
  }

  @Get('projects/:id/members')
  async members(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { members: await this.service.listMembers(user, id) };
  }

  @Post('projects/:id/members')
  async addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const input = memberCreate.parse(body);
    return this.service.addMember(user, id, input.email, input.role);
  }

  @Delete('projects/:id/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    await this.service.removeMember(user, id, userId);
    return { ok: true };
  }

  @Get('projects/:id/environments')
  async environments(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { environments: await this.service.listEnvironments(user, id) };
  }

  @Post('projects/:id/environments')
  async createEnvironment(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { name } = envCreate.parse(body);
    return this.service.createEnvironment(user, id, name);
  }

  @Delete('projects/:id/environments/:envId')
  async deleteEnvironment(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('envId') envId: string,
  ): Promise<unknown> {
    await this.service.deleteEnvironment(user, id, envId);
    return { ok: true };
  }

  @Get('projects/:id/environments/:envId/variables')
  async variables(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('envId') envId: string,
    @Query('reveal') reveal?: string,
  ): Promise<unknown> {
    return { variables: await this.service.listVariables(user, id, envId, reveal === 'true') };
  }

  @Put('projects/:id/environments/:envId/variables')
  async saveVariables(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('envId') envId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { variables } = variablesSave.parse(body);
    await this.service.saveVariables(user, id, envId, variables);
    return { ok: true };
  }

  @Get('projects/:id/tokens')
  async tokens(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { tokens: await this.service.listTokens(user, id) };
  }

  @Post('projects/:id/tokens')
  async createToken(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { name } = tokenCreate.parse(body);
    return this.service.createToken(user, id, name);
  }

  @Delete('projects/:id/tokens/:tokenId')
  async revokeToken(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('tokenId') tokenId: string,
  ): Promise<unknown> {
    await this.service.revokeToken(user, id, tokenId);
    return { ok: true };
  }

  @Get('audit')
  async audit(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { audit: await this.service.audit(user) };
  }
}

@Controller('public/env-manager')
export class PublicEnvController {
  constructor(private readonly service: EnvManagerService) {}

  @Public()
  @Get(':projectId/:envName')
  async variables(
    @Param('projectId') projectId: string,
    @Param('envName') envName: string,
    @Headers('authorization') authorization?: string,
  ): Promise<unknown> {
    const token = authorization?.replace(/^Bearer\s+/i, '') ?? '';
    return { variables: await this.service.publicVariables(projectId, envName, token) };
  }
}
