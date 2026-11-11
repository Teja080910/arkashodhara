import { cookies } from 'next/headers';

const AUTH_URL = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://127.0.0.1:4100';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

/** @typedef {{ email: string, name: string, userId: string }} AdminSession */

/** Reads the Better Auth session cookie and confirms the user is an admin. */
async function sessionFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/get-session`, {
      headers: { cookie: cookieHeader },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body = await response.json();
    const user = body?.user;
    if (!user?.email) return null;

    const email = user.email.toLowerCase();
    const isAdmin = user.role === 'admin' || ADMIN_EMAILS.includes(email);
    if (!isAdmin) return null;

    return { email, name: user.name ?? email, userId: user.id };
  } catch {
    return null;
  }
}

export async function getAdminSession() {
  const store = await cookies();
  const header = store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  return sessionFromCookieHeader(header);
}

export async function readRequestSession(request) {
  return sessionFromCookieHeader(request.headers.get('cookie') ?? '');
}

export function isAdminEmail(email) {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
