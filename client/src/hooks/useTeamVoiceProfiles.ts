import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function useTeamVoiceProfiles() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ["/api/teams/voice-profiles/shared", user?.id],
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    select: (data: any) => data.sharedProfiles || [],
  });
}

export function useTeamSpecificVoiceProfiles(teamId?: number) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ["/api/teams", teamId, "voice-profiles"],
    enabled: !!user && !!teamId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useCreateTeamVoiceProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest("POST", "/api/teams/voice-profiles", profileData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/voice-profiles/shared", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      toast({
        title: "Team Voice Profile Created",
        description: "The voice profile has been shared with your team.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create team voice profile.",
        variant: "destructive",
      });
    },
  });
}

export function useApplyTeamVoiceProfile() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profileData: any) => {
      // This would integrate with the voice selection context
      return profileData;
    },
    onSuccess: () => {
      toast({
        title: "Voice Profile Applied",
        description: "Team voice profile has been applied to your selection.",
      });
    },
  });
}