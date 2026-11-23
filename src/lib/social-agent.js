const BASE_URL = (process.env.SOCIAL_AGENT_URL || 'https://social.arkasodhara.tech').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.SOCIAL_AGENT_ADMIN_TOKEN || '';
const PUBLIC_BASE_URL = (process.env.SOCIAL_AGENT_PUBLIC_URL || BASE_URL).replace(/\/$/, '');

export class SocialAgentError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'SocialAgentError';
    this.status = status;
  }
}

export function socialAgentBaseUrl() {
  return PUBLIC_BASE_URL;
}

export function socialAgentConnectUrl(platform = 'meta') {
  return `${BASE_URL}/auth/${platform}`;
}

export async function socialAgentFetch(path, options = {}) {
  if (!ADMIN_TOKEN) {
    throw new SocialAgentError(
      'SOCIAL_AGENT_ADMIN_TOKEN is not configured on the Arkasodhara server.',
      500,
    );
  }

  const headers = {
    'x-admin-token': ADMIN_TOKEN,
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
    throw new SocialAgentError('Could not reach the social agent.', 502);
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    const message =
      (body && typeof body === 'object' && (body.error || body.message)) ||
      (typeof body === 'string' && body) ||
      `Social agent returned HTTP ${response.status}`;
    throw new SocialAgentError(message, response.status);
  }

  return body;
}
