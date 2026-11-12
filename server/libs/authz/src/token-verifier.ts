import { createRemoteJWKSet, jwtVerify, decodeJwt, type JWTPayload } from 'jose';

export interface AuthClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  role?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: 'user' | 'admin';
  claims: AuthClaims;
}

export interface TokenVerifierOptions {
  jwksUrl: string;
  issuer: string;
  audience: string;
  cacheTtlSeconds?: number;
}

export class TokenVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly options: TokenVerifierOptions) {
    this.jwks = createRemoteJWKSet(new URL(options.jwksUrl), {
      cacheMaxAge: (options.cacheTtlSeconds ?? 300) * 1000,
      cooldownDuration: 30_000,
    });
  }

  async verify(token: string): Promise<AuthUser> {
    const { payload } = await jwtVerify(token, this.jwks, {
      issuer: this.options.issuer,
      audience: this.options.audience,
      clockTolerance: 5,
    });

    if (!payload.sub) throw new Error('JWT has no subject');

    const claims = payload as AuthClaims;
    const roleRaw = typeof claims.role === 'string' ? claims.role : 'user';
    return {
      id: claims.sub,
      email: typeof claims.email === 'string' ? claims.email : '',
      name: typeof claims.name === 'string' ? claims.name : '',
      picture: typeof claims.picture === 'string' ? claims.picture : undefined,
      role: roleRaw === 'admin' ? 'admin' : 'user',
      claims,
    };
  }

  decodeUnsafe(token: string): AuthClaims | null {
    try {
      return decodeJwt(token) as AuthClaims;
    } catch {
      return null;
    }
  }
}
