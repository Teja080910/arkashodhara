export interface ApiClientOptions {
  baseUrl: string;
  authUrl: string;
  fetchImpl?: typeof fetch;
  getAccessToken?: () => Promise<string | null> | string | null;
  onUnauthorized?: () => void;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private refreshing: Promise<string | null> | null = null;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.resolveToken();
    const headers = new Headers(init.headers);
    if (token) headers.set('authorization', `Bearer ${token}`);
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

    const response = await this.fetchImpl(`${this.options.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });

    if (response.status === 401 && retry) {
      const refreshed = await this.refreshToken();
      if (refreshed) return this.request<T>(path, init, false);
      this.options.onUnauthorized?.();
    }

    if (!response.ok) {
      const body = await safeJson(response);
      const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(response.status, error?.code ?? 'http_error', error?.message ?? response.statusText);
    }

    if (response.status === 204) return undefined as T;
    return (await safeJson(response)) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });
  }

  put<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
  }

  delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, { method: 'DELETE', body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async uploadFile(presignedUrl: string, file: Blob, headers: Record<string, string> = {}): Promise<void> {
    const response = await this.fetchImpl(presignedUrl, { method: 'PUT', body: file, headers });
    if (!response.ok) throw new ApiError(response.status, 'upload_failed', 'Upload failed');
  }

  private async resolveToken(): Promise<string | null> {
    if (this.options.getAccessToken) return this.options.getAccessToken();
    return this.readTokenEndpoint();
  }

  private async readTokenEndpoint(): Promise<string | null> {
    try {
      const response = await this.fetchImpl(`${this.options.authUrl}/api/auth/token`, {
        method: 'GET',
        credentials: 'include',
        headers: { accept: 'application/json' },
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { token?: string };
      return data.token ?? null;
    } catch {
      return null;
    }
  }

  private refreshToken(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.readTokenEndpoint().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }
}

async function safeJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
