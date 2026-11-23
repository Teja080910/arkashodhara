const BASE_URL = (process.env.SOCIAL_PLANNER_API_URL || 'http://127.0.0.1:4106').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.SOCIAL_PLANNER_ADMIN_TOKEN || '';

export class SocialPlannerError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'SocialPlannerError';
    this.status = status;
  }
}

export async function socialPlannerFetch(path, options = {}) {
  if (!ADMIN_TOKEN) {
    throw new SocialPlannerError('SOCIAL_PLANNER_ADMIN_TOKEN is not configured', 500);
  }

  const headers = {
    'x-social-admin-token': ADMIN_TOKEN,
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new SocialPlannerError('Could not reach the social planner API', 502);
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = body && typeof body === 'object' ? body.error : null;
    const message =
      (typeof detail === 'string' && detail) ||
      (detail && typeof detail === 'object' && detail.message) ||
      (body && typeof body === 'object' && body.message) ||
      (typeof body === 'string' && body) ||
      `Social planner returned HTTP ${response.status}`;
    throw new SocialPlannerError(message, response.status);
  }

  return body;
}
