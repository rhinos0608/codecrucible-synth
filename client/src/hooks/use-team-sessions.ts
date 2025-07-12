import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface TeamSession {
  id: string;
  name: string;
  creatorId: string;
  status: 'active' | 'paused' | 'completed';
  participantCount: number;
  participants: Array<{
    userId: string;
    name: string;
    role: string;
    isActive: boolean;
    assignedVoices: string[];
    joinedAt: Date;
    lastSeenAt: Date;
  }>;
  lastActivity: Date;
  createdAt: Date;
  voicesUsed?: string[];
  shareableLink?: string;
}

export interface CreateSessionRequest {
  name: string;
  prompt: string;
  accessType: 'public' | 'invite_only';
  selectedVoices: string[];
}

export function useTeamSessions(teamId?: string) {
  return useQuery({
    queryKey: ['/api/collaboration/teams', teamId, 'sessions'],
    enabled: !!teamId,
  });
}

export function useSessionDetails(sessionId?: string) {
  return useQuery({
    queryKey: ['/api/collaboration/sessions', sessionId],
    enabled: !!sessionId,
  });
}

export function useCreateSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateSessionRequest) => {
      const response = await apiRequest('POST', '/api/collaboration/sessions', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/teams'] });
    },
  });
}

export function useJoinSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, role = 'collaborator' }: { sessionId: string; role?: string }) => {
      const response = await apiRequest('POST', `/api/collaboration/sessions/${sessionId}/join`, { role });
      return response.json();
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      const response = await apiRequest('POST', `/api/collaboration/sessions/${sessionId}/chat`, { message });
      return response.json();
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
  });
}

export function useAssignVoice() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, voiceType, assignedTo }: { 
      sessionId: string; 
      voiceType: string; 
      assignedTo: string; 
    }) => {
      const response = await apiRequest('POST', `/api/collaboration/sessions/${sessionId}/assign-voice`, {
        voiceType,
        assignedTo,
      });
      return response.json();
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
  });
}