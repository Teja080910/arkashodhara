import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import { getAdminSession } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const AUTH_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://127.0.0.1:4100';

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const response = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    return NextResponse.json({ error: detail?.message || 'Invalid email or password' }, { status: 401 });
  }

  const setCookie = response.headers.getSetCookie?.() ?? [];
  const next = NextResponse.json({ ok: true, email });
  for (const cookie of setCookie) next.headers.append('set-cookie', cookie);
  return next;
}

export async function GET() {
  const session = await getAdminSession();
  const store = await cookies();
  void store;
  return NextResponse.json({ email: session?.email ?? null });
}

export async function DELETE() {
  const store = await cookies();
  const header = store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  const response = NextResponse.json({ ok: true });
  const signOut = await fetch(`${AUTH_URL}/api/auth/sign-out`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: header },
    body: JSON.stringify({}),
  }).catch(() => null);

  if (signOut) {
    for (const cookie of signOut.headers.getSetCookie?.() ?? []) {
      response.headers.append('set-cookie', cookie);
    }
  }
  return response;
}
