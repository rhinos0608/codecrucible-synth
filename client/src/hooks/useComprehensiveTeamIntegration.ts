import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useVoiceSelection } from "@/contexts/voice-selection-context";

// Comprehensive team integration following CodeCrucible Protocol
export function useComprehensiveTeamIntegration() {
  const { user } = useAuthContext();
  const { actions } = useVoiceSelection();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Team voice profiles with real-time synchronization
  const teamVoiceProfiles = useQuery({
    queryKey: ["/api/teams/voice-profiles/shared", user?.id],
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    select: (data: any) => data.sharedProfiles || [],
  });

  // Team collaborative sessions
  const teamSessions = useQuery({
    queryKey: ["/api/teams/sessions"],
    enabled: !!user,
    staleTime: 30000,
    refetchInterval: 30000, // Refresh every 30 seconds for active sessions
  });

  // Team members and their activity
  const teamMembers = useQuery({
    queryKey: ["/api/teams/members"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Create team voice profile with automatic synchronization
  const createTeamVoiceProfile = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest("POST", "/api/teams/voice-profiles", {
        ...profileData,
        createdBy: user?.id,
        isShared: true,
        teamId: profileData.teamId,
      });
      return response.json();
    },
    onSuccess: (data) => {
      // Invalidate all related queries for real-time sync
      queryClient.invalidateQueries({ queryKey: ["/api/teams/voice-profiles/shared"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/teams"] });
      
      toast({
        title: "Team Voice Profile Created",
        description: `${data.name} is now available to all team members`,
      });

      // Emit custom event for real-time updates
      window.dispatchEvent(new CustomEvent('team-voice-profile-created', { detail: data }));
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create team voice profile",
        variant: "destructive",
      });
    },
  });

  // Apply team voice profile to current selection
  const applyTeamVoiceProfile = useMutation({
    mutationFn: async (profile: any) => {
      // Update voice selection context
      if (actions.setPerspectives && profile.selectedPerspectives) {
        actions.setPerspectives(profile.selectedPerspectives);
      }
      if (actions.setRoles && profile.selectedRoles) {
        actions.setRoles(profile.selectedRoles);
      }

      // Track usage for analytics
      return apiRequest("POST", "/api/analytics/voice-usage", {
        voiceProfileId: profile.id,
        teamId: profile.teamId,
        action: 'applied',
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: (_, profile) => {
      toast({
        title: "Team Profile Applied",
        description: `Applied ${profile.name} voice configuration`,
      });

      // Emit usage event for real-time analytics
      window.dispatchEvent(new CustomEvent('voice-usage-event', { 
        detail: { profileId: profile.id, action: 'applied' }
      }));
    },
  });

  // Join collaborative session
  const joinCollaborativeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/teams/sessions/${sessionId}/join`, {
        userId: user?.id,
        role: 'collaborator',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/sessions"] });
      toast({
        title: "Joined Session",
        description: "You're now collaborating in real-time",
      });
    },
  });

  // Create collaborative session
  const createCollaborativeSession = useMutation({
    mutationFn: async (sessionData: any) => {
      return apiRequest("POST", "/api/teams/sessions", {
        ...sessionData,
        initiatorId: user?.id,
        status: 'active',
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/teams/sessions"] });
      toast({
        title: "Session Created",
        description: "Collaborative coding session is now active",
      });
      return response;
    },
  });

  return {
    // Data
    teamVoiceProfiles,
    teamSessions,
    teamMembers,
    
    // Actions
    createTeamVoiceProfile,
    applyTeamVoiceProfile,
    joinCollaborativeSession,
    createCollaborativeSession,
    
    // Status
    isLoading: teamVoiceProfiles.isLoading || teamSessions.isLoading || teamMembers.isLoading,
    error: teamVoiceProfiles.error || teamSessions.error || teamMembers.error,
  };
}