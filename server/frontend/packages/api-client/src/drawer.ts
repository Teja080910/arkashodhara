import type { ApiClient } from './api-client';

export type DrawerFlow = {
  id: string;
  ownerId: string;
  teamId: string | null;
  name: string;
  graph: { nodes: unknown[]; relations: unknown[] };
  visibility: 'private' | 'public';
  shareToken?: string | null;
  role: 'owner' | 'editor' | 'viewer';
  createdAt: string;
  updatedAt: string;
};

export type DrawerTeam = {
  id: string;
  name: string;
  ownerId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type DrawerMember = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  teamId?: string;
  flowId?: string;
};

export function createDrawerApi(client: ApiClient) {
  return {
    flows: {
      list: () => client.get<{ flows: DrawerFlow[] }>('/api/flows'),
      get: (id: string) => client.get<DrawerFlow>(`/api/flows/${id}`),
      create: (input: { name: string; teamId?: string | null }) => client.post<DrawerFlow>('/api/flows', input),
      update: (id: string, input: Partial<Pick<DrawerFlow, 'name' | 'graph' | 'visibility'>>) =>
        client.patch<DrawerFlow>(`/api/flows/${id}`, input),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/flows/${id}`),
      members: (id: string) => client.get<{ members: DrawerMember[] }>(`/api/flows/${id}/members`),
      addMember: (id: string, input: { email: string; role: 'viewer' | 'editor' }) =>
        client.post<DrawerMember>(`/api/flows/${id}/members`, input),
      removeMember: (id: string, memberId: string) =>
        client.delete<{ ok: true }>(`/api/flows/${id}/members/${memberId}`),
      activity: (id: string) => client.get<{ activity: unknown[] }>(`/api/flows/${id}/activity`),
      publicGet: (shareToken: string) => client.get<DrawerFlow>(`/api/public/flows/${shareToken}`),
    },
    teams: {
      list: () => client.get<{ teams: DrawerTeam[] }>('/api/teams'),
      create: (name: string) => client.post<DrawerTeam>('/api/teams', { name }),
      rename: (id: string, name: string) => client.patch<DrawerTeam>(`/api/teams/${id}`, { name }),
      remove: (id: string) => client.delete<{ ok: true }>(`/api/teams/${id}`),
      members: (id: string) => client.get<{ members: DrawerMember[] }>(`/api/teams/${id}/members`),
      addMember: (id: string, input: { email: string; role: 'admin' | 'editor' | 'viewer' }) =>
        client.post<DrawerMember>(`/api/teams/${id}/members`, input),
      updateMember: (id: string, memberId: string, role: string) =>
        client.put<DrawerMember>(`/api/teams/${id}/members/${memberId}`, { role }),
      removeMember: (id: string, memberId: string) =>
        client.delete<{ ok: true }>(`/api/teams/${id}/members/${memberId}`),
      activity: (id: string) => client.get<{ activity: unknown[] }>(`/api/teams/${id}/activity`),
    },
    uploads: {
      presign: (fileName: string, contentType?: string) =>
        client.post<{
          uploadUrl: string;
          objectKey: string;
          publicUrl?: string;
          expiresAt: string;
          headers: Record<string, string>;
        }>('/api/uploads/presign', { fileName, contentType }),
      signedUrl: (objectKey: string) =>
        client.get<{ url: string; publicUrl?: string }>(`/api/uploads/object?key=${encodeURIComponent(objectKey)}`),
      remove: (objectKey: string) =>
        client.delete<{ ok: true }>(`/api/uploads/object?key=${encodeURIComponent(objectKey)}`),
    },
  };
}
