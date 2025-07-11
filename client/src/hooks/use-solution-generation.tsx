import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { VoiceSession, Solution, Synthesis } from "@shared/schema";

interface GenerateSessionRequest {
  prompt: string;
  selectedVoices: string[];
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
      const response = await apiRequest("POST", "/api/sessions", request);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
    }
  });

  const createSynthesis = useMutation({
    mutationFn: async ({ 
      sessionId, 
      combinedCode, 
      synthesisSteps, 
      qualityScore, 
      ethicalScore 
    }: {
      sessionId: number;
      combinedCode: string;
      synthesisSteps: any[];
      qualityScore: number;
      ethicalScore: number;
    }): Promise<Synthesis> => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/synthesis`, {
        combinedCode,
        synthesisSteps,
        qualityScore,
        ethicalScore
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phantom-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
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

export function usePhantomLedger() {
  return useQuery({
    queryKey: ["/api/phantom-ledger"],
    staleTime: 30000, // 30 seconds
  });
}
