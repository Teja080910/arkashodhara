import { Controller, Get, Headers, Inject, Query, UnauthorizedException } from '@nestjs/common';
import { Public } from '@platform/authz';
import { AuthService } from './auth.service';
import { INTERNAL_SERVICE_TOKEN } from './tokens';

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
  @Get('health')
  health(): unknown {
    return { status: 'ok' };
  }
}
