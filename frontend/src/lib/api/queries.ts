import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';
export interface GroupSummary {
  id: string;
  groupId: string;
  name: string;
  creator: string;
  paymentToken: string;
  membersCount: number;
  createdAt: string;
}
export interface GroupListResponse {
  groups: GroupSummary[];
  pagination: { total: number; limit: number; offset: number; hasMore: boolean };
}
export const queryKeys = {
  groups: ['groups'] as const,
  group: (id: string) => ['groups', id] as const,
  currentUser: ['users', 'me'] as const,
};
export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups,
    queryFn: ({ signal }) => apiClient.get<GroupListResponse>('/api/groups', { signal }),
  });
}
export function useGroup(id: string) {
  return useQuery({
    queryKey: queryKeys.group(id),
    queryFn: ({ signal }) =>
      apiClient.get<GroupSummary>(`/api/groups/${encodeURIComponent(id)}`, { signal }),
    enabled: Boolean(id),
  });
}
export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiClient.post<GroupSummary>('/api/groups', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.groups }),
  });
}
