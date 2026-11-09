import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

import {
  ADMIN_COOKIE,
  SESSION_TTL_SECONDS,
  clearRateLimit,
  createSessionToken,
  getAdminEmails,
  isRateLimited,
  verifyPassword,
} from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function credentials() {
  const table = process.env.ADMIN_CREDENTIALS || '';
  const entries = [];

  for (const pair of table.split(';')) {
    const [email, hash] = pair.split('=');
    if (email && hash) entries.push([email.trim().toLowerCase(), hash.trim()]);
  }

  return entries;
}

export async function POST(request) {
  const body = await request.json().catch(() => null);
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const key = `${email}:${request.headers.get('x-forwarded-for') || 'local'}`;
  if (isRateLimited(key)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const allowed = getAdminEmails();
  const entry = credentials().find(([adminEmail]) => adminEmail === email);
  const valid = Boolean(entry) && allowed.includes(email) && verifyPassword(password, entry[1]);

  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  clearRateLimit(key);

  const response = NextResponse.json({ ok: true, email });
  response.cookies.set({
    name: ADMIN_COOKIE,
    value: createSessionToken(email),
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  const { readSessionToken } = await import('@/lib/auth');
  const email = readSessionToken(token);
  const isAdmin = Boolean(email) && getAdminEmails().includes(email);

  return NextResponse.json({ email: isAdmin ? email : null });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: ADMIN_COOKIE, value: '', path: '/', maxAge: 0 });
  return response;
}
