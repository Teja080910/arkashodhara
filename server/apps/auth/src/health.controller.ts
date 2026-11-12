import { Controller, Get, Inject } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '@platform/authz';

@Controller('health')
export class HealthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {}

  @Public()
  @Get()
  async health(): Promise<unknown> {
    const db = await this.authService.ping();
    return {
      status: db ? 'ok' : 'degraded',
      service: 'auth',
      checks: { database: db ? 'up' : 'down' },
    };
  }
}
