import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  joinedAt: Date;
  lastActive: Date;
  isActive: boolean;
}

export interface TeamInvite {
  email: string;
  role: 'member' | 'admin';
  message?: string;
}

export function useTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: ['/api/teams', teamId, 'members'],
    enabled: !!teamId,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, invite }: { teamId: string; invite: TeamInvite }) => {
      const response = await apiRequest('POST', `/api/teams/${teamId}/invites`, invite);
      return response.json();
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, memberId }: { teamId: string; memberId: string }) => {
      const response = await apiRequest('DELETE', `/api/teams/${teamId}/members/${memberId}`, {});
      return response.json();
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, memberId, role }: { 
      teamId: string; 
      memberId: string; 
      role: string; 
    }) => {
      const response = await apiRequest('PATCH', `/api/teams/${teamId}/members/${memberId}`, { role });
      return response.json();
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'members'] });
    },
  });
}