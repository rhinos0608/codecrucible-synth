import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useFeatureAccess } from "./api/useSubscription";

interface CustomVoiceProfile {
  id: string;
  name: string;
  description: string;
  specializations: string[];
  personality: string;
  ethicalStance: string;
  effectiveness: number;
  consistency: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface VoiceCreationData {
  name: string;
  description: string;
  specializations: string[];
  personality: string;
  ethicalStance: string;
  communicationStyle: string;
  codeExamples: Array<{
    prompt: string;
    expectedOutput: string;
  }>;
}

export function useCustomVoices() {
  const { hasFeature } = useFeatureAccess();

  return useQuery({
    queryKey: ["/api/voice-profiles/custom"],
    enabled: hasFeature('custom_voices'),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateCustomVoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasFeature } = useFeatureAccess();

  return useMutation({
    mutationFn: async (voiceData: VoiceCreationData) => {
      if (!hasFeature('custom_voices')) {
        throw new Error('Custom voices require Pro subscription');
      }

      const response = await apiRequest("POST", "/api/voice-profiles/custom", voiceData);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles/custom"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      
      toast({
        title: "Custom Voice Created",
        description: `${data.name} has been created and tested successfully.`,
      });
      
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create custom voice profile.",
        variant: "destructive",
      });
    },
  });
}

export function useTestCustomVoice() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ voiceData, testPrompts }: {
      voiceData: Partial<VoiceCreationData>;
      testPrompts: string[];
    }) => {
      const response = await apiRequest("POST", "/api/voice-profiles/test", {
        voiceData,
        testPrompts,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Voice Test Complete",
        description: `Effectiveness: ${Math.round(data.effectiveness)}%`,
      });
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message || "Failed to test voice profile.",
        variant: "destructive",
      });
    },
  });
}

export function useVoiceEffectivenessTracking(voiceId: string) {
  return useQuery({
    queryKey: ["/api/voice-profiles/effectiveness", voiceId],
    enabled: !!voiceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data: any) => ({
      effectiveness: data.effectiveness || 0,
      consistency: data.consistency || 0,
      specialization: data.specializationAccuracy || 0,
      userSatisfaction: data.userSatisfaction || 0,
      usageCount: data.usageCount || 0,
      successRate: data.successRate || 0,
      improvementSuggestions: data.improvementSuggestions || [],
    }),
  });
}

export function useUpdateCustomVoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      voiceId, 
      updates 
    }: { 
      voiceId: string; 
      updates: Partial<VoiceCreationData> 
    }) => {
      const response = await apiRequest("PATCH", `/api/voice-profiles/custom/${voiceId}`, updates);
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles/custom"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles/effectiveness", variables.voiceId] });
      
      toast({
        title: "Voice Updated",
        description: "Custom voice profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update voice profile.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCustomVoice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (voiceId: string) => {
      return apiRequest("DELETE", `/api/voice-profiles/custom/${voiceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles/custom"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      
      toast({
        title: "Voice Deleted",
        description: "Custom voice profile has been deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message || "Failed to delete voice profile.",
        variant: "destructive",
      });
    },
  });
}

export function useVoiceProfileWorkflow() {
  const createMutation = useCreateCustomVoice();
  const testMutation = useTestCustomVoice();
  const updateMutation = useUpdateCustomVoice();
  
  const createAndTestVoice = async (voiceData: VoiceCreationData, testPrompts: string[]) => {
    try {
      // First test the voice configuration
      const testResults = await testMutation.mutateAsync({ voiceData, testPrompts });
      
      if (testResults.effectiveness < 70) {
        throw new Error(`Voice effectiveness too low: ${testResults.effectiveness}%`);
      }
      
      // If test passes, create the voice
      return await createMutation.mutateAsync(voiceData);
    } catch (error) {
      throw error;
    }
  };

  return {
    createAndTestVoice,
    isProcessing: createMutation.isPending || testMutation.isPending,
    error: createMutation.error || testMutation.error,
  };
}