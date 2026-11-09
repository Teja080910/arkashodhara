import { NextResponse } from 'next/server';

import { readRequestSession } from '@/lib/auth';
import { collectServerMetrics } from '@/lib/server-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const email = readRequestSession(request);

  if (!email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const data = await collectServerMetrics();
  return NextResponse.json({ ...data, viewer: email });
}
