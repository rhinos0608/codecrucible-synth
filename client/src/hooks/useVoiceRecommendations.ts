import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useDebouncedCallback } from "use-debounce";

interface VoiceRecommendation {
  perspectives: string[];
  roles: string[];
  confidence: number;
  reasoning: string;
  alternatives: Array<{
    perspectives: string[];
    roles: string[];
    confidence: number;
    reason: string;
  }>;
}

export function useVoiceRecommendations(prompt: string) {
  // Debounce the prompt to avoid excessive API calls
  const debouncedPrompt = useDebouncedCallback((value: string) => value, 500);

  return useQuery({
    queryKey: ["/api/preferences/recommendations", debouncedPrompt(prompt)],
    enabled: prompt.length > 10, // Only analyze prompts longer than 10 characters
    staleTime: 30000, // Cache for 30 seconds
    select: (data: any): VoiceRecommendation => {
      return {
        perspectives: data.recommendedPerspectives || [],
        roles: data.recommendedRoles || [],
        confidence: data.confidence || 0,
        reasoning: data.reasoning || '',
        alternatives: data.alternatives || [],
      };
    },
  });
}

export function useRecommendationFeedback() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      prompt, 
      recommendedVoices, 
      selectedVoices, 
      feedback 
    }: {
      prompt: string;
      recommendedVoices: string[];
      selectedVoices: string[];
      feedback: 'accepted' | 'rejected' | 'modified';
    }) => {
      return apiRequest("POST", "/api/preferences/feedback", {
        prompt,
        recommendedVoices,
        selectedVoices,
        feedback,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      // Invalidate recommendations to improve future suggestions
      queryClient.invalidateQueries({ queryKey: ["/api/preferences/recommendations"] });
    },
    onError: (error: Error) => {
      console.error('Failed to submit recommendation feedback:', error);
      // Silent failure - feedback is nice-to-have
    },
  });
}

export function usePromptAnalysis(prompt: string) {
  return useQuery({
    queryKey: ["/api/analysis/prompt", prompt],
    enabled: prompt.length > 5,
    staleTime: 60000, // Cache for 1 minute
    select: (data: any) => ({
      complexity: data.complexity || 1,
      domains: data.detectedDomains || [],
      keywords: data.keywords || [],
      suggestedApproach: data.suggestedApproach || '',
      estimatedTime: data.estimatedTime || 0,
    }),
  });
}

export function useVoiceEffectivenessScores() {
  return useQuery({
    queryKey: ["/api/preferences/effectiveness"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data: any) => {
      // Transform effectiveness data for display
      const scores: Record<string, number> = {};
      
      data.forEach((voice: any) => {
        scores[voice.voiceName] = voice.effectiveness || 0;
      });
      
      return scores;
    },
  });
}

export function useVoiceLearningMetrics() {
  return useQuery({
    queryKey: ["/api/preferences/learning-metrics"],
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data: any) => ({
      totalRecommendations: data.totalRecommendations || 0,
      acceptanceRate: data.acceptanceRate || 0,
      userSatisfaction: data.userSatisfaction || 0,
      learningProgress: data.learningProgress || 0,
      topPerformingVoices: data.topPerformingVoices || [],
      improvementSuggestions: data.improvementSuggestions || [],
    }),
  });
}