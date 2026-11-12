import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from './token-verifier';
import { TokenVerifier } from './token-verifier';
import { TOKEN_VERIFIER } from './auth.guard';
import { extractBearerToken, type AuthedRequest } from './auth.guard';

@Injectable()
export class OptionalAuthService {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async userFromRequest(request: AuthedRequest): Promise<AuthUser | null> {
    const token = extractBearerToken(request);
    if (!token) return null;
    try {
      return await this.verifier.verify(token);
    } catch {
      return null;
    }
  }
}
