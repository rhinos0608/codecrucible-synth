import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useVoiceSelection } from "@/contexts/voice-selection-context";
import { useDebouncedCallback } from "use-debounce";

export function useIntegratedVoiceRecommendations(prompt: string) {
  const { actions } = useVoiceSelection();
  const { toast } = useToast();

  // Debounce prompt analysis to avoid excessive API calls
  const debouncedPrompt = useDebouncedCallback((value: string) => value, 500);

  const recommendationsQuery = useQuery({
    queryKey: ["/api/preferences/recommendations", debouncedPrompt(prompt)],
    enabled: prompt.length > 10,
    staleTime: 30000,
    select: (data: any) => ({
      perspectives: data.recommendedPerspectives || [],
      roles: data.recommendedRoles || [],
      confidence: data.confidence || 0,
      reasoning: data.reasoning || '',
      alternatives: data.alternatives || [],
      combinationScore: data.combinationScore || 0,
    }),
  });

  const applyRecommendations = useMutation({
    mutationFn: async ({ perspectives, roles }: { perspectives: string[]; roles: string[] }) => {
      // Apply recommendations to voice selection context
      if (actions.setPerspectives) {
        actions.setPerspectives(perspectives);
      }
      if (actions.setRoles) {
        actions.setRoles(roles);
      }
      
      // Track recommendation application
      return apiRequest("POST", "/api/preferences/feedback", {
        prompt,
        recommendedVoices: [...perspectives, ...roles],
        selectedVoices: [...perspectives, ...roles],
        feedback: 'accepted',
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "Recommendations Applied",
        description: "Voice selection updated based on AI analysis",
      });
    },
  });

  return {
    ...recommendationsQuery,
    applyRecommendations,
    isApplying: applyRecommendations.isPending,
  };
}