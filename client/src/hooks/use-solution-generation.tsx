import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VoiceSession, Solution, Synthesis } from "@shared/schema";

interface GenerateSessionRequest {
  prompt: string;
  selectedVoices: {
    perspectives: string[];
    roles: string[];
  };
  recursionDepth: number;
  synthesisMode: string;
  ethicalFiltering: boolean;
}

interface GenerateSessionResponse {
  session: VoiceSession;
  solutions: Solution[];
}

export function useSolutionGeneration() {
  const queryClient = useQueryClient();

  const generateSession = useMutation({
    mutationFn: async (request: GenerateSessionRequest): Promise<GenerateSessionResponse> => {
      console.log('Generating session with real OpenAI integration:', request);
      const response = await apiRequest("POST", "/api/sessions", request);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate solutions');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Session generation completed:', data.session.id);
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", data.session.id, "solutions"] });
    },
    onError: (error) => {
      console.error('Session generation failed:', error);
    }
  });

  const createSynthesis = useMutation({
    mutationFn: async (sessionId: number): Promise<Synthesis> => {
      console.log('Starting real OpenAI synthesis for session:', sessionId);
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/synthesis`, {});
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to synthesize solutions');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      console.log('OpenAI synthesis completed:', data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      queryClient.invalidateQueries({ queryKey: ["/api/decision-history"] });
    },
    onError: (error) => {
      console.error('Synthesis failed:', error);
    }
  });

  return {
    generateSession,
    createSynthesis,
    isGenerating: generateSession.isPending,
    isSynthesizing: createSynthesis.isPending,
  };
}

export function useAnalytics() {
  return useQuery({
    queryKey: ["/api/analytics"],
    staleTime: 30000, // 30 seconds
  });
}

export function useDecisionHistory() {
  return useQuery({
    queryKey: ["/api/decision-history"],
    staleTime: 30000, // 30 seconds
  });
}

// New hook for error logs
export function useErrorLogs(level?: string, limit?: number) {
  return useQuery({
    queryKey: ["/api/logs", { level, limit }],
    staleTime: 10000, // 10 seconds for logs
  });
}

// Hook for session-specific logs
export function useSessionLogs(sessionId: string) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "logs"],
    staleTime: 10000, // 10 seconds for logs
    enabled: !!sessionId
  });
}
