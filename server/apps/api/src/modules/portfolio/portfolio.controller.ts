import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public, type AuthUser } from '@platform/authz';
import { Inject } from '@nestjs/common';
import { ObjectStorage, objectKeyFor } from '@platform/storage';
import { STORAGE } from '../../infrastructure.module';
import { z } from 'zod';
import { PortfolioService, slugify } from './portfolio.service';

const profilePatch = z.object({
  firstname: z.string().max(120).optional(),
  lastname: z.string().max(120).optional(),
  role: z.string().max(120).optional(),
  phone: z.string().max(64).optional(),
  photo: z.string().max(2048).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  gitlink: z.string().max(2048).nullable().optional(),
  linkedin: z.string().max(2048).nullable().optional(),
  resumelink: z.string().max(2048).nullable().optional(),
  show: z.boolean().optional(),
  type: z.enum(['user', 'team', 'business']).optional(),
  username: z.string().min(3).max(32).regex(/^[a-z0-9_]+$/).optional(),
});

const contentPatch = z.object({
  about: z.record(z.string(), z.unknown()).optional(),
  skills: z.array(z.unknown()).optional(),
  projects: z.array(z.unknown()).optional(),
  experience: z.array(z.unknown()).optional(),
  education: z.array(z.unknown()).optional(),
  certificates: z.array(z.unknown()).optional(),
  contentChannels: z.array(z.unknown()).optional(),
  contentWorks: z.array(z.unknown()).optional(),
  collaborations: z.array(z.unknown()).optional(),
  creatorTools: z.array(z.unknown()).optional(),
  template: z.string().max(64).optional(),
});

const teamCreate = z.object({
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/).optional(),
  tagline: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
});

const teamPatch = z.object({
  name: z.string().min(1).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  logo: z.string().max(2048).nullable().optional(),
  show: z.boolean().optional(),
});

const inviteCreate = z.object({ email: z.string().email().optional() });
const titlePatch = z.object({ title: z.string().max(120).nullable() });
const shareBody = z.object({ section: z.string().min(1), itemId: z.string().min(1) });
const tokenCreate = z.object({ name: z.string().min(1).max(120).default('token') });

@Controller('portfolio')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.service.me(user);
  }

  @Patch('me/profile')
  async updateProfile(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.updateProfile(user, profilePatch.parse(body));
  }

  @Put('me/content')
  async saveContent(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.saveContent(user, contentPatch.parse(body));
  }

  @Get('me/tokens')
  async tokens(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { tokens: await this.service.listApiTokens(user) };
  }

  @Post('me/tokens')
  async createToken(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const { name } = tokenCreate.parse(body);
    return this.service.createApiToken(user, name);
  }

  @Delete('me/tokens/:id')
  async revokeToken(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.revokeApiToken(user, id);
    return { ok: true };
  }

  @Get('teams')
  async teams(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { teams: await this.service.listTeams(user) };
  }

  @Post('teams')
  async createTeam(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.service.createTeam(user, teamCreate.parse(body));
  }

  @Patch('teams/:id')
  async updateTeam(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.service.updateTeam(user, id, teamPatch.parse(body));
  }

  @Delete('teams/:id')
  async deleteTeam(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.service.deleteTeam(user, id);
    return { ok: true };
  }

  @Get('teams/:id/members')
  async members(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { members: await this.service.teamMembers(user, id) };
  }

  @Patch('teams/:id/members/:userId')
  async setTitle(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { title } = titlePatch.parse(body);
    await this.service.setMemberTitle(user, id, userId, title);
    return { ok: true };
  }

  @Delete('teams/:id/members/:userId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ): Promise<unknown> {
    await this.service.removeTeamMember(user, id, userId);
    return { ok: true };
  }

  @Get('teams/:id/invites')
  async invites(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { invites: await this.service.listInvites(user, id) };
  }

  @Post('teams/:id/invites')
  async createInvite(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { email } = inviteCreate.parse(body ?? {});
    return this.service.createInvite(user, id, email);
  }

  @Delete('teams/:id/invites/:inviteId')
  async revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ): Promise<unknown> {
    await this.service.revokeInvite(user, id, inviteId);
    return { ok: true };
  }

  @Get('teams/:id/shares')
  async shares(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { shares: await this.service.listShares(user, id) };
  }

  @Post('teams/:id/shares')
  async share(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { section, itemId } = shareBody.parse(body);
    await this.service.shareContent(user, id, section, itemId);
    return { ok: true };
  }

  @Delete('teams/:id/shares')
  async unshare(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { section, itemId } = shareBody.parse(body);
    await this.service.unshareContent(user, id, section, itemId);
    return { ok: true };
  }
}

@Controller('portfolio/uploads')
@UseGuards(AuthGuard)
export class PortfolioUploadsController {
  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  @Post('presign')
  async presign(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const { fileName, contentType } = z
      .object({ fileName: z.string().min(1).max(255), contentType: z.string().max(128).optional() })
      .parse(body);
    const objectKey = objectKeyFor(user.id, fileName);
    return this.storage.presignUpload(objectKey, contentType);
  }

  @Delete()
  async remove(@CurrentUser() user: AuthUser, @Query('key') key: string): Promise<unknown> {
    if (!key || !key.startsWith(`${user.id}/`)) throw new Error('Not your object');
    await this.storage.removeObject(key);
    return { ok: true };
  }
}

@Controller('public/portfolio')
export class PublicPortfolioController {
  constructor(private readonly service: PortfolioService) {}

  @Public()
  @Get('profiles')
  async search(@Query('q') query?: string, @Query('limit') limit?: string): Promise<unknown> {
    return { profiles: await this.service.searchProfiles(query ?? '', limit ? Number(limit) : 24) };
  }

  @Public()
  @Get('profiles/:username')
  async profile(@Param('username') username: string): Promise<unknown> {
    return this.service.publicProfile(username);
  }

  @Public()
  @Get('guide')
  async guide(): Promise<unknown> {
    return { sections: await this.service.guide() };
  }

  @Public()
  @Get('teams')
  async teams(): Promise<unknown> {
    return { teams: await this.service.publicTeams() };
  }

  @Public()
  @Get('teams/:slug')
  async team(@Param('slug') slug: string): Promise<unknown> {
    return this.service.publicTeamPortfolio(slug);
  }

  @Public()
  @Get('invites/pending')
  @UseGuards(AuthGuard)
  async pending(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { invites: await this.service.pendingInvites(user) };
  }

  @Public()
  @Get('invites/:token')
  async invite(@Param('token') token: string): Promise<unknown> {
    return this.service.inviteByToken(token);
  }

  @Public()
  @Post('invites/:token/accept')
  @UseGuards(AuthGuard)
  async accept(@CurrentUser() user: AuthUser, @Param('token') token: string): Promise<unknown> {
    return this.service.acceptInvite(user, token);
  }

}

void slugify;
