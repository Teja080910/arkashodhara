import { NextResponse } from 'next/server';

import { readRequestSession } from '@/lib/auth';
import { socialAgentFetch, SocialAgentError } from '@/lib/social-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const session = await readRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const appId = String(body?.appId || '').trim();
  const appSecret = String(body?.appSecret || '').trim();
  if (!appId) {
    return NextResponse.json({ error: 'App ID is required' }, { status: 400 });
  }

  try {
    const data = await socialAgentFetch('/admin/settings/meta', {
      method: 'POST',
      body: JSON.stringify({ appId, appSecret }),
    });
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof SocialAgentError ? error.status : 502;
    return NextResponse.json(
      { error: status === 401 ? 'Social agent rejected its admin token.' : error.message },
      { status: status === 401 ? 502 : status },
    );
  }
}
