import { NextResponse } from 'next/server';

import { readRequestSession } from '@/lib/auth';
import { collectAllServers, collectServerMetrics, listServers } from '@/lib/server-metrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = await readRequestSession(request);

  if (!session) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }
  const email = session.email;

  const { searchParams } = new URL(request.url);
  const serverId = searchParams.get('server');

  if (searchParams.get('all') === '1') {
    const servers = await collectAllServers();
    return NextResponse.json({ servers, viewer: email });
  }

  const data = await collectServerMetrics(serverId || undefined);
  return NextResponse.json({
    ...data,
    servers: listServers().map((server) => ({ id: server.id, label: server.label, host: server.host })),
    viewer: email,
  });
}
