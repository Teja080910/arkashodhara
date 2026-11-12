import { Body, Controller, Get, Headers, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard, CurrentUser, Public, Roles, type AuthUser } from '@platform/authz';
import { z } from 'zod';
import { ArkasodharaService } from './arkasodhara.service';

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  message: z.string().min(1).max(4000),
});

@Controller('contact')
export class ContactController {
  constructor(private readonly service: ArkasodharaService) {}

  @Public()
  @Post()
  async submit(
    @Body() body: unknown,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<unknown> {
    const input = contactSchema.parse(body);
    await this.service.recordContact({ ...input, ip, userAgent });
    return { ok: true };
  }
}

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('admin')
export class ArkasodharaAdminController {
  constructor(private readonly service: ArkasodharaService) {}

  @Get('contact')
  async list(@Query('limit') limit?: string): Promise<unknown> {
    return { messages: await this.service.listContact(limit ? Number(limit) : 100) };
  }

  @Get('servers')
  async servers(): Promise<unknown> {
    return { servers: await this.service.servers() };
  }

  @Get('metrics/:serverId')
  async metrics(@Param('serverId') serverId: string, @CurrentUser() user: AuthUser): Promise<unknown> {
    return this.service.collectMetrics(serverId, user);
  }

  @Get('metrics')
  async metricsDefault(@CurrentUser() user: AuthUser): Promise<unknown> {
    return this.service.collectMetrics('local', user);
  }

  @Get('metrics-audit')
  async audit(): Promise<unknown> {
    return { audit: await this.service.metricsAudit() };
  }
}
