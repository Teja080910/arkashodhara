import { Body, Controller, Get, Headers, Inject, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Public } from '@platform/authz';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { INTERNAL_SERVICE_TOKEN } from './tokens';

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(200),
});

@Controller('internal')
export class InternalController {
  constructor(
    private readonly authService: AuthService,
    @Inject(INTERNAL_SERVICE_TOKEN) private readonly serviceToken: string | null,
  ) {}

  @Public()
  @Get('users/by-email')
  async byEmail(@Headers('x-service-token') token: string | undefined, @Query('email') email?: string): Promise<unknown> {
    if (!this.serviceToken || token !== this.serviceToken) {
      throw new UnauthorizedException('Invalid service token');
    }
    if (!email) return { user: null };
    const user = await this.authService.findUserByEmail(email);
    return { user };
  }

  @Public()
  @Post('users')
  async createUser(
    @Headers('x-service-token') token: string | undefined,
    @Body() body: unknown,
  ): Promise<unknown> {
    if (!this.serviceToken || token !== this.serviceToken) {
      throw new UnauthorizedException('Invalid service token');
    }
    const input = createUserSchema.parse(body);
    const user = await this.authService.createUser(input);
    return { user };
  }

  @Public()
  @Get('health')
  health(): unknown {
    return { status: 'ok' };
  }
}
