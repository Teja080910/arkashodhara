import { NextResponse } from 'next/server';

import { readRequestSession } from '@/lib/auth';
import { socialAgentBaseUrl, socialAgentFetch, SocialAgentError } from '@/lib/social-agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await readRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const data = await socialAgentFetch('/admin/ui/state');
    return NextResponse.json({ ...data, baseUrl: socialAgentBaseUrl() });
  } catch (error) {
    const status = error instanceof SocialAgentError ? error.status : 502;
    return NextResponse.json(
      { error: status === 401 ? 'Social agent rejected its admin token.' : error.message },
      { status: status === 401 ? 502 : status },
    );
  }
}
