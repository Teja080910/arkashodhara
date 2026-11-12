import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { AuthService } from './auth.service';
import { Public } from '@platform/authz';

@Controller()
export class AuthController {
  private readonly handler: (req: Request, res: Response) => Promise<void>;

  constructor(private readonly authService: AuthService) {
    const handler = toNodeHandler(this.authService.auth);
    this.handler = handler as unknown as (req: Request, res: Response) => Promise<void>;
  }

  @Public()
  @All('api/auth/*splat')
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.handler(req, res);
  }
}
