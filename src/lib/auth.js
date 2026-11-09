import crypto from 'node:crypto';

export const ADMIN_COOKIE = 'ark_admin_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function authSecret() {
  const value = process.env.ADMIN_AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error('ADMIN_AUTH_SECRET must be set and at least 32 characters long');
  }
  return value;
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  // ':' separator (not '$') so dotenv loaders never treat segments as variables.
  return `scrypt:16384:8:1:${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored || '').split(':');
    if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;

    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function sign(value) {
  return crypto.createHmac('sha256', authSecret()).update(value).digest('base64url');
}

export function createSessionToken(email) {
  const payload = Buffer.from(
    JSON.stringify({ e: email.toLowerCase(), x: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token) {
  if (!token) return null;

  const [payload, signature] = String(token).split('.');
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  ) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.e || !data?.x || Date.now() > data.x) return null;
    return String(data.e);
  } catch {
    return null;
  }
}

export function readRequestSession(request) {
  const email = readSessionToken(request.cookies.get(ADMIN_COOKIE)?.value);
  if (!email) return null;
  return getAdminEmails().includes(email) ? email : null;
}

const attempts = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function isRateLimited(key) {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || now - entry.startedAt > WINDOW_MS) {
    attempts.set(key, { count: 1, startedAt: now });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export function clearRateLimit(key) {
  attempts.delete(key);
}
