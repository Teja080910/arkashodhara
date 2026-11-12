import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { admin } from 'better-auth/plugins/admin';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';

export interface AuthConfigOptions {
  databaseUrl: string;
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
  google?: { clientId: string; clientSecret: string };
  smtp?: { host: string; port: number; user?: string; pass?: string; from: string };
  disableJwksEncryption?: boolean;
}

export interface AuthRuntime {
  auth: ReturnType<typeof buildAuth>;
  pool: Pool;
}

export function buildAuth(pool: Pool, options: AuthConfigOptions) {
  const domain = cookieDomain(options.baseUrl);
  const secure = options.baseUrl.startsWith('https://');

  const mailer = options.smtp
    ? nodemailer.createTransport({
        host: options.smtp.host,
        port: options.smtp.port,
        secure: options.smtp.port === 465,
        auth: options.smtp.user ? { user: options.smtp.user, pass: options.smtp.pass } : undefined,
      })
    : undefined;

  return betterAuth({
    database: pool,
    secret: options.secret,
    baseURL: options.baseUrl,
    basePath: '/api/auth',
    trustedOrigins: options.trustedOrigins,
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      ipAddress: {
        ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
      },
      crossSubDomainCookies: domain
        ? { enabled: true, domain }
        : { enabled: false },
      defaultCookieAttributes: {
        httpOnly: true,
        secure,
        sameSite: 'lax',
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: false,
      autoSignIn: true,
      sendResetPassword: mailer
        ? async ({ user, url }) => {
            await mailer.sendMail({
              from: options.smtp!.from,
              to: user.email,
              subject: 'Reset your password',
              text: `Open this link to reset your password: ${url}`,
            });
          }
        : undefined,
    },
    socialProviders: options.google
      ? {
          google: {
            clientId: options.google.clientId,
            clientSecret: options.google.clientSecret,
            prompt: 'select_account',
          },
        }
      : undefined,
    plugins: [
      jwt({
        jwt: {
          issuer: options.baseUrl,
          audience: 'platform',
          expirationTime: '15m',
          definePayload: async ({ user }) => {
            const memberships = await pool.query<{ app: string; role: string }>(
              'select app, role from app_membership where user_id = $1',
              [user.id],
            );
            const apps: Record<string, string> = {};
            for (const row of memberships.rows) apps[row.app] = row.role;
            const role = (user as { role?: string }).role ?? 'user';
            return {
              email: user.email,
              name: user.name,
              picture: user.image ?? undefined,
              role,
              apps,
            };
          },
        },
        jwks: {
          jwksPath: '/.well-known/jwks.json',
          rotationInterval: 60 * 60 * 24 * 30,
          gracePeriod: 60 * 60 * 24 * 7,
          disablePrivateKeyEncryption: options.disableJwksEncryption ?? false,
        },
      }),
      admin({
        defaultRole: 'user',
        adminRoles: ['admin'],
      }),
    ],
  });
}

export function createAuth(options: AuthConfigOptions): AuthRuntime {
  const pool = new Pool({ connectionString: options.databaseUrl, max: 10 });
  return { auth: buildAuth(pool, options), pool };
}

export function cookieDomain(baseUrl: string): string | undefined {
  try {
    const host = new URL(baseUrl).hostname;
    if (host === 'localhost' || host === '::1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
    const parts = host.split('.');
    if (parts.length < 2) return undefined;
    return `.${parts.slice(-2).join('.')}`;
  } catch {
    return undefined;
  }
}

export type Auth = ReturnType<typeof buildAuth>;
