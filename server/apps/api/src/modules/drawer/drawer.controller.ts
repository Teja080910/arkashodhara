import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public, type AuthUser } from '@platform/authz';
import { z } from 'zod';
import { FlowsService, TeamsService } from './drawer.service';

const flowCreate = z.object({
  name: z.string().min(1).max(120).default('Untitled flow'),
  teamId: z.string().uuid().nullish(),
});

const flowUpdate = z.object({
  name: z.string().min(1).max(120).optional(),
  graph: z.object({ nodes: z.array(z.unknown()), relations: z.array(z.unknown()) }).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  teamId: z.string().uuid().nullable().optional(),
});

const memberCreate = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'editor', 'admin']).default('viewer'),
});

const memberUpdate = z.object({ role: z.enum(['admin', 'editor', 'viewer']) });

@Controller('flows')
@UseGuards(AuthGuard)
export class FlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { flows: await this.flows.list(user) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    return this.flows.create(user, flowCreate.parse(body));
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.flows.get(user, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    return this.flows.update(user, id, flowUpdate.parse(body));
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.flows.remove(user, id);
    return { ok: true };
  }

  @Get(':id/members')
  async members(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { members: await this.flows.members(user, id) };
  }

  @Post(':id/members')
  async addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const input = memberCreate.parse(body);
    return this.flows.addMember(user, id, input.email, input.role);
  }

  @Put(':id/members/:memberId')
  async updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { role } = z.object({ role: z.enum(['viewer', 'editor']) }).parse(body);
    return this.flows.updateMember(user, id, memberId, role);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ): Promise<unknown> {
    await this.flows.removeMember(user, id, memberId);
    return { ok: true };
  }

  @Get(':id/activity')
  async activity(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { activity: await this.flows.activity(user, id) };
  }
}

@Controller('members')
@UseGuards(AuthGuard)
export class FlowMembersController {
  constructor(
    private readonly flows: FlowsService,
    private readonly teams: TeamsService,
  ) {}

  @Put('flow/:memberId')
  async updateFlowMember(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { role } = z.object({ role: z.enum(['viewer', 'editor']) }).parse(body);
    return this.flows.updateMemberById(user, memberId, role);
  }

  @Delete('flow/:memberId')
  async removeFlowMember(@CurrentUser() user: AuthUser, @Param('memberId') memberId: string): Promise<unknown> {
    await this.flows.removeMemberById(user, memberId);
    return { ok: true };
  }

  @Put('team/:memberId')
  async updateTeamMember(
    @CurrentUser() user: AuthUser,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const { role } = z.object({ role: z.enum(['admin', 'editor', 'viewer']) }).parse(body);
    return this.teams.updateMemberById(user, memberId, role);
  }

  @Delete('team/:memberId')
  async removeTeamMember(@CurrentUser() user: AuthUser, @Param('memberId') memberId: string): Promise<unknown> {
    await this.teams.removeMemberById(user, memberId);
    return { ok: true };
  }
}

@Controller('public/flows')
export class PublicFlowsController {
  constructor(private readonly flows: FlowsService) {}

  @Public()
  @Get(':shareToken')
  async get(@Param('shareToken') shareToken: string): Promise<unknown> {
    return this.flows.getPublic(shareToken);
  }
}

@Controller('teams')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<unknown> {
    return { teams: await this.teams.list(user) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<unknown> {
    const { name } = z.object({ name: z.string().min(1).max(120).default('Untitled team') }).parse(body);
    return this.teams.create(user, name);
  }

  @Get(':id')
  async detail(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return this.teams.detail(user, id);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { name } = z.object({ name: z.string().min(1).max(120) }).parse(body);
    return this.teams.update(user, id, name);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.teams.remove(user, id);
    return { ok: true };
  }

  @Get(':id/members')
  async members(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { members: await this.teams.members(user, id) };
  }

  @Post(':id/members')
  async addMember(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const input = memberCreate.parse(body);
    return this.teams.addMember(user, id, input.email, input.role);
  }

  @Put(':id/members/:memberId')
  async updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: unknown,
  ): Promise<unknown> {
    const input = memberUpdate.parse(body);
    return this.teams.updateMember(user, id, memberId, input.role);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ): Promise<unknown> {
    await this.teams.removeMember(user, id, memberId);
    return { ok: true };
  }

  @Post(':id/transfer')
  async transfer(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<unknown> {
    const { newOwnerEmail } = z.object({ newOwnerEmail: z.string().email() }).parse(body);
    const authUrl = process.env.AUTH_URL ?? 'http://auth:4100';
    const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
    if (!serviceToken) throw new Error('INTERNAL_SERVICE_TOKEN is not configured');

    const lookup = await fetch(`${authUrl}/internal/users/by-email?email=${encodeURIComponent(newOwnerEmail)}`, {
      headers: { 'x-service-token': serviceToken },
    });
    if (!lookup.ok) throw new Error('Could not resolve that user');
    const { user: target } = (await lookup.json()) as { user: { id: string } | null };
    if (!target) throw new Error('That person needs to sign in once before you can transfer');

    await this.teams.transfer(user, id, newOwnerEmail, target.id);
    return { ok: true };
  }

  @Post(':id/leave')
  async leave(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    await this.teams.leave(user, id);
    return { ok: true };
  }

  @Get(':id/activity')
  async activity(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<unknown> {
    return { activity: await this.teams.activity(user, id) };
  }
}
