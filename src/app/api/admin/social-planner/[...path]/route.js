import { NextResponse } from 'next/server';

import { readRequestSession } from '@/lib/auth';
import { socialPlannerFetch, SocialPlannerError } from '@/lib/social-planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request, { params }) {
  const session = await readRequestSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const segments = params?.path || [];
  const target = `/api/admin/social/${segments.map(encodeURIComponent).join('/')}`;
  const search = new URL(request.url).search;

  try {
    const options = { method: request.method };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const body = await request.text();
      if (body) options.body = body;
    }
    const data = await socialPlannerFetch(`${target}${search}`, options);
    return NextResponse.json(data);
  } catch (error) {
    const status = error instanceof SocialPlannerError ? error.status : 502;
    const message =
      error instanceof SocialPlannerError && error.status === 401
        ? 'Social planner rejected its admin token'
        : error.message;
    return NextResponse.json({ error: message }, { status: status === 401 ? 502 : status });
  }
}

export async function GET(request, context) {
  return handle(request, context);
}

export async function POST(request, context) {
  return handle(request, context);
}
