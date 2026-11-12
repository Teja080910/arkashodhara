import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { type AuthUser, TokenVerifier, TOKEN_VERIFIER } from '@platform/authz';
import { UnauthorizedError } from '@platform/common';
import { TrackerPatService } from './pat-auth.service';

type AuthedRequest = Request & { user?: AuthUser };

@Injectable()
export class TrackerAuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly pats: TrackerPatService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    if (!header) throw new UnauthorizedError('Missing bearer token');
    const [, token] = header.split(' ');
    if (!token) throw new UnauthorizedError('Missing bearer token');

    if (token.startsWith('tf_')) {
      const user = await this.pats.resolve(token);
      if (!user) throw new UnauthorizedError('Invalid personal access token');
      request.user = user;
      return true;
    }

    try {
      request.user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
    return true;
  }
}
