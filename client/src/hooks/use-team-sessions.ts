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
      try {
        const result = await apiRequest('/api/collaboration/sessions', {
          method: 'POST',
          body: data
        });
        return result;
      } catch (error) {
        console.error('Failed to create collaboration session:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/teams'] });
    },
    onError: (error) => {
      console.error('Create session mutation failed:', error);
    }
  });
}

export function useJoinSession() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, role = 'collaborator' }: { sessionId: string; role?: string }) => {
      try {
        const result = await apiRequest(`/api/collaboration/sessions/${sessionId}/join`, {
          method: 'POST',
          body: { role }
        });
        return result;
      } catch (error) {
        console.error('Failed to join collaboration session:', error);
        throw error;
      }
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
    onError: (error) => {
      console.error('Join session mutation failed:', error);
    }
  });
}

export function useSendChatMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ sessionId, message }: { sessionId: string; message: string }) => {
      try {
        const result = await apiRequest(`/api/collaboration/sessions/${sessionId}/chat`, {
          method: 'POST',
          body: { message }
        });
        return result;
      } catch (error) {
        console.error('Failed to send chat message:', error);
        throw error;
      }
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
    onError: (error) => {
      console.error('Send chat message mutation failed:', error);
    }
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
      try {
        const result = await apiRequest(`/api/collaboration/sessions/${sessionId}/assign-voice`, {
          method: 'POST',
          body: { voiceType, assignedTo }
        });
        return result;
      } catch (error) {
        console.error('Failed to assign voice:', error);
        throw error;
      }
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/collaboration/sessions', sessionId] });
    },
    onError: (error) => {
      console.error('Assign voice mutation failed:', error);
    }
  });
}