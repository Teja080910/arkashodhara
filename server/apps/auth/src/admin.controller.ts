import { Body, Controller, Delete, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, Roles } from '@platform/authz';
import { z } from 'zod';
import { NotFoundError } from '@platform/common';
import { AuthService } from './auth.service';

export const APP_NAMES = ['arkasodhara', 'drawer', 'env-manager', 'portfolio', 'project-tracker'] as const;
const appSchema = z.enum(APP_NAMES);

const membershipSchema = z.object({
  app: appSchema,
  userId: z.string().min(1),
  role: z.enum(['admin', 'owner', 'editor', 'viewer', 'member']),
});

const appQuerySchema = z.object({ app: appSchema });

const userListSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
  q: z.string().optional(),
});

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly authService: AuthService) {}

  @Get('memberships')
  async list(@Query() query: unknown): Promise<unknown> {
    const { app } = appQuerySchema.parse(query);
    return { app, members: await this.authService.appMemberships(app) };
  }

  @Put('memberships')
  async set(@Body() body: unknown): Promise<unknown> {
    const { app, userId, role } = membershipSchema.parse(body);
    await this.authService.setAppMembership(userId, app, role);
    return { ok: true };
  }

  @Delete('memberships/:app/:userId')
  async remove(@Param('app') appRaw: string, @Param('userId') userId: string): Promise<unknown> {
    const app = appSchema.parse(appRaw);
    await this.authService.removeAppMembership(userId, app);
    return { ok: true };
  }

  @Get('users')
  async users(@Query() query: unknown): Promise<unknown> {
    const { limit, offset, q } = userListSchema.parse(query);
    return this.authService.listUsers({ limit, offset, query: q });
  }

  @Get('users/by-email')
  async byEmail(@Query('email') email?: string): Promise<unknown> {
    if (!email) throw new NotFoundError('email query parameter required');
    const user = await this.authService.findUserByEmail(email);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }
}
