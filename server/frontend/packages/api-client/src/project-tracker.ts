import type { ApiClient } from './api-client';
import { RealtimeClient } from './realtime';

export type PtTask = {
  id: string;
  number: number;
  projectId: string;
  title: string;
  description: string | null;
  type: 'task' | 'bug' | 'story' | 'issue';
  status: string;
  priority: string;
  assigneeId: string | null;
  reporterId: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export function createProjectTrackerApi(client: ApiClient) {
  return {
    me: () => client.get<Record<string, unknown>>('/api/pt/me'),
    updateMe: (patch: Record<string, unknown>) => client.patch<Record<string, unknown>>('/api/pt/me', patch),
    roles: () => client.get<{ roles: Array<{ id: string; name: string }> }>('/api/pt/roles'),
    profiles: () => client.get<{ profiles: unknown[] }>('/api/pt/profiles'),
    setRole: (id: string, role: string) => client.patch<{ ok: true }>(`/api/pt/profiles/${id}/role`, { role }),
    setDisabled: (id: string, disabled: boolean) =>
      client.patch<{ ok: true }>(`/api/pt/profiles/${id}/disabled`, { disabled }),
    stats: () => client.get<Record<string, number>>('/api/pt/stats'),
    projects: {
      list: () => client.get<{ projects: unknown[] }>('/api/pt/projects'),
      create: (input: { name: string; description?: string; clientName?: string }) =>
        client.post<unknown>('/api/pt/projects', input),
      get: (id: string) => client.get<unknown>(`/api/pt/projects/${id}`),
      update: (id: string, patch: Record<string, unknown>) => client.patch<unknown>(`/api/pt/projects/${id}`, patch),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/pt/projects/${id}`),
      activity: (id: string) => client.get<{ activity: unknown[] }>(`/api/pt/projects/${id}/activity`),
    },
    tasks: {
      list: (projectId: string, filters: Record<string, string> = {}) => {
        const query = new URLSearchParams(filters).toString();
        return client.get<{ tasks: PtTask[] }>(
          `/api/pt/projects/${projectId}/tasks${query ? `?${query}` : ''}`,
        );
      },
      get: (id: string) => client.get<PtTask & Record<string, unknown>>(`/api/pt/tasks/${id}`),
      create: (input: Record<string, unknown>) => client.post<PtTask>('/api/pt/tasks', input),
      update: (id: string, patch: Record<string, unknown>) => client.patch<PtTask>(`/api/pt/tasks/${id}`, patch),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/pt/tasks/${id}`),
      addComment: (id: string, input: Record<string, unknown>) =>
        client.post<Record<string, unknown>>(`/api/pt/tasks/${id}/comments`, input),
    },
    comments: {
      remove: (id: string) => client.delete<{ ok: true }>(`/api/pt/comments/${id}`),
      toggleReaction: (id: string, emoji: string) =>
        client.post<{ active: boolean }>(`/api/pt/comments/${id}/reactions`, { emoji }),
    },
    notifications: {
      list: () => client.get<{ notifications: unknown[] }>('/api/pt/notifications'),
      markRead: (ids?: string[]) => client.put<{ ok: true }>('/api/pt/notifications/read', { ids }),
    },
    docs: {
      list: (projectId: string) => client.get<{ docs: unknown[] }>(`/api/pt/projects/${projectId}/docs`),
      create: (projectId: string, input: Record<string, unknown>) =>
        client.post<unknown>(`/api/pt/projects/${projectId}/docs`, input),
      update: (id: string, patch: Record<string, unknown>) => client.patch<unknown>(`/api/pt/docs/${id}`, patch),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/pt/docs/${id}`),
    },
    apks: {
      list: (projectId: string) => client.get<{ apks: unknown[] }>(`/api/pt/projects/${projectId}/apks`),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/pt/apks/${id}`),
    },
    push: {
      list: () => client.get<{ subscriptions: unknown[] }>('/api/pt/push/subscriptions'),
      save: (input: { endpoint: string; p256dh: string; auth: string; userAgent?: string }) =>
        client.post<{ ok: true }>('/api/pt/push/subscriptions', input),
      remove: (endpoint: string) =>
        client.delete<{ ok: true }>('/api/pt/push/subscriptions', { endpoint }),
    },
  };
}

export function createProjectTrackerRealtime(options: {
  wsUrl: string;
  token: string;
  onEvent: (event: Record<string, unknown>) => void;
  onReady?: () => void;
  onError?: (error: string) => void;
}): RealtimeClient {
  return new RealtimeClient(options);
}
