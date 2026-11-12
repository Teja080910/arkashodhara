import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  createParamDecorator,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { TokenVerifier, type AuthUser } from './token-verifier';
import { UnauthorizedError, ForbiddenError } from '@platform/common';

export const TOKEN_VERIFIER = 'PLATFORM_TOKEN_VERIFIER';
export const IS_PUBLIC_KEY = 'platform:isPublic';
export const ROLES_KEY = 'platform:roles';

export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: Array<'user' | 'admin'>): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedError('Missing bearer token');

    try {
      request.user = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }

    const requiredRoles = this.reflector.getAllAndOverride<Array<'user' | 'admin'>>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles?.length) {
      const role = request.user?.role ?? 'user';
      if (!requiredRoles.includes(role)) throw new ForbiddenError('Insufficient role');
    }

    return true;
  }
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser | undefined => {
  const request = context.switchToHttp().getRequest<AuthedRequest>();
  return request.user;
});
