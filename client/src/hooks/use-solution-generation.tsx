import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VoiceSession, Solution, Synthesis } from "@shared/schema";
import { useErrorTracking } from "./use-error-tracking";

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
  const { trackApiError } = useErrorTracking();

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
      console.log('Session generation completed:', data);
      // Enhanced defensive programming following AI_INSTRUCTIONS.md patterns
      const sessionId = data?.session?.id || data?.id || 'unknown';
      console.log('Extracted session ID:', sessionId);
      
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
      if (sessionId !== 'unknown') {
        queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "solutions"] });
      }
    },
    onError: (error) => {
      console.error('Session generation failed:', error);
      trackApiError(error, '/api/sessions', 'POST');
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
      trackApiError(error, '/api/sessions/synthesis', 'POST');
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
  const { trackApiError } = useErrorTracking();
  
  return useQuery({
    queryKey: ["/api/analytics"],
    staleTime: 30000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404s or auth errors
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      trackApiError(error, '/api/analytics', 'GET');
    }
  });
}

export function useDecisionHistory() {
  const { trackApiError } = useErrorTracking();
  
  return useQuery({
    queryKey: ["/api/decision-history"],
    staleTime: 30000, // 30 seconds
    retry: (failureCount, error: any) => {
      // Don't retry on 404s or auth errors
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      trackApiError(error, '/api/decision-history', 'GET');
    }
  });
}

// New hook for error logs
export function useErrorLogs(level?: string, limit?: number) {
  return useQuery({
    queryKey: ["/api/logs", { level, limit }],
    staleTime: 10000, // 10 seconds for logs
    retry: (failureCount, error: any) => {
      // Don't retry on 404s or auth errors
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        console.warn('Logs endpoint not available:', error?.message);
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      console.warn('Error logs unavailable:', error);
    }
  });
}

// Hook for session-specific logs
export function useSessionLogs(sessionId: string) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "logs"],
    staleTime: 10000, // 10 seconds for logs
    enabled: !!sessionId,
    retry: (failureCount, error: any) => {
      // Don't retry on 404s or auth errors
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        console.warn('Session logs endpoint not available:', error?.message);
        return false;
      }
      return failureCount < 2;
    },
    onError: (error) => {
      console.warn('Session logs unavailable for session:', sessionId, error);
    }
  });
}
