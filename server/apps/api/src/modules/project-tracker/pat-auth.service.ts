import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { AuthUser } from '@platform/authz';
import { DB, type Database } from '../../core.module';
import { personalAccessTokens, profiles } from '../../schema/project-tracker';

@Injectable()
export class TrackerPatService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async resolve(rawToken: string): Promise<AuthUser | null> {
    if (!rawToken.startsWith('tf_')) return null;
    const hash = createHash('sha256').update(rawToken).digest('hex');
    const rows = await this.db
      .select({
        id: profiles.id,
        email: profiles.email,
        name: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
        role: profiles.role,
        disabled: profiles.disabled,
      })
      .from(personalAccessTokens)
      .innerJoin(profiles, eq(profiles.id, personalAccessTokens.userId))
      .where(eq(personalAccessTokens.tokenHash, hash))
      .limit(1);

    const profile = rows[0];
    if (!profile || profile.disabled) return null;

    await this.db
      .update(personalAccessTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(personalAccessTokens.tokenHash, hash));

    return {
      id: profile.id,
      email: profile.email,
      name: profile.name ?? profile.email,
      picture: profile.avatarUrl ?? undefined,
      role: profile.role === 'super_admin' || profile.role === 'admin' ? 'admin' : 'user',
      claims: {
        sub: profile.id,
        email: profile.email,
        role: profile.role,
        apps: { 'project-tracker': profile.role },
      },
    };
  }
}
