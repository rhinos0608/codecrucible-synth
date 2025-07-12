import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface SharedVoiceProfile {
  id: string;
  name: string;
  creator: string;
  creatorId: string;
  specializations: string[];
  usage: number;
  effectiveness: number;
  description?: string;
  isPublic: boolean;
  teamId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export function useSharedVoiceProfiles(teamId?: string) {
  return useQuery({
    queryKey: ['/api/teams', teamId, 'voice-profiles'],
    enabled: !!teamId,
  });
}

export function useTeamVoiceProfiles(userId?: string) {
  return useQuery({
    queryKey: ['/api/teams/voice-profiles/shared', userId],
    enabled: !!userId,
  });
}

export function useShareVoiceProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, voiceProfileId }: { teamId: string; voiceProfileId: string }) => {
      const response = await apiRequest('POST', `/api/teams/${teamId}/voice-profiles/${voiceProfileId}/share`, {});
      return response.json();
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'voice-profiles'] });
    },
  });
}

export function useUnshareVoiceProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ teamId, voiceProfileId }: { teamId: string; voiceProfileId: string }) => {
      const response = await apiRequest('DELETE', `/api/teams/${teamId}/voice-profiles/${voiceProfileId}/share`, {});
      return response.json();
    },
    onSuccess: (_, { teamId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams', teamId, 'voice-profiles'] });
    },
  });
}