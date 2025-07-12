import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";

// Following AI_INSTRUCTIONS.md: Strict TypeScript and input validation
interface UserOnboardingStatus {
  userId: string;
  hasCompletedTour: boolean;
  hasGeneratedFirstSolution: boolean;
  hasUsedVoiceProfiles: boolean;
  hasAccessedTeams: boolean;
  hasUsedSynthesis: boolean;
  tourCompletedAt?: Date;
  firstLoginAt: Date;
  lastActiveAt: Date;
}

// Following CodingPhilosophy.md: Consciousness evolution tracking
interface NewUserMetrics {
  isNewUser: boolean;
  needsGuidance: boolean;
  completionPercentage: number;
  nextSuggestedAction: string;
  consciousnessLevel: 'beginner' | 'initiated' | 'practicing' | 'mastering';
}

export function useNewUserDetection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [shouldShowTour, setShouldShowTour] = useState(false);

  // Get user onboarding status - Following AI_INSTRUCTIONS.md error handling patterns
  const onboardingStatusQuery = useQuery({
    queryKey: ["/api/user/onboarding-status", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1, // Limit retries to prevent excessive requests
    select: (data: any): UserOnboardingStatus => ({
      userId: data.userId || user?.id || '',
      hasCompletedTour: data.hasCompletedTour || false,
      hasGeneratedFirstSolution: data.hasGeneratedFirstSolution || false,
      hasUsedVoiceProfiles: data.hasUsedVoiceProfiles || false,
      hasAccessedTeams: data.hasAccessedTeams || false,
      hasUsedSynthesis: data.hasUsedSynthesis || false,
      tourCompletedAt: data.tourCompletedAt ? new Date(data.tourCompletedAt) : undefined,
      firstLoginAt: new Date(data.firstLoginAt || Date.now()),
      lastActiveAt: new Date(data.lastActiveAt || Date.now()),
    }),
    onError: (error) => {
      console.error('Failed to load onboarding status:', error);
    },
  });

  // Calculate new user metrics
  const calculateNewUserMetrics = (status: UserOnboardingStatus): NewUserMetrics => {
    const daysSinceFirstLogin = Math.floor(
      (Date.now() - status.firstLoginAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // User is considered new if they haven't completed the tour and it's been less than 7 days
    const isNewUser = !status.hasCompletedTour && daysSinceFirstLogin < 7;
    
    // Calculate completion percentage based on key milestones
    const milestones = [
      status.hasCompletedTour,
      status.hasGeneratedFirstSolution,
      status.hasUsedVoiceProfiles,
      status.hasAccessedTeams,
      status.hasUsedSynthesis,
    ];
    const completionPercentage = (milestones.filter(Boolean).length / milestones.length) * 100;

    // Determine consciousness level following CodingPhilosophy.md patterns
    let consciousnessLevel: NewUserMetrics['consciousnessLevel'] = 'beginner';
    if (status.hasCompletedTour && status.hasGeneratedFirstSolution) {
      consciousnessLevel = 'initiated';
    }
    if (status.hasUsedSynthesis && status.hasUsedVoiceProfiles) {
      consciousnessLevel = 'practicing';
    }
    if (completionPercentage >= 80) {
      consciousnessLevel = 'mastering';
    }

    // Determine next suggested action
    let nextSuggestedAction = 'Complete the guided tour';
    if (status.hasCompletedTour && !status.hasGeneratedFirstSolution) {
      nextSuggestedAction = 'Generate your first solution';
    } else if (status.hasGeneratedFirstSolution && !status.hasUsedSynthesis) {
      nextSuggestedAction = 'Try synthesizing multiple solutions';
    } else if (status.hasUsedSynthesis && !status.hasUsedVoiceProfiles) {
      nextSuggestedAction = 'Create custom voice profiles';
    } else if (status.hasUsedVoiceProfiles && !status.hasAccessedTeams) {
      nextSuggestedAction = 'Explore team collaboration';
    } else {
      nextSuggestedAction = 'Master advanced council techniques';
    }

    return {
      isNewUser,
      needsGuidance: isNewUser || completionPercentage < 60,
      completionPercentage,
      nextSuggestedAction,
      consciousnessLevel,
    };
  };

  // Mark tour as completed
  const completeTour = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/complete-tour", {
        userId: user?.id,
        completedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding-status"] });
      setShouldShowTour(false);
    },
  });

  // Track milestone completion
  const trackMilestone = useMutation({
    mutationFn: async (milestone: {
      type: 'first_solution' | 'voice_profiles' | 'teams_access' | 'synthesis_used';
      metadata?: Record<string, any>;
    }) => {
      return apiRequest("POST", "/api/user/track-milestone", {
        userId: user?.id,
        milestoneType: milestone.type,
        completedAt: new Date().toISOString(),
        metadata: milestone.metadata || {},
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding-status"] });
    },
  });

  // Skip tour (for users who want to explore independently)
  const skipTour = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/skip-tour", {
        userId: user?.id,
        skippedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding-status"] });
      setShouldShowTour(false);
    },
  });

  // Update last active timestamp - throttled to prevent excessive requests
  const updateLastActive = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/user/update-activity", {
        userId: user?.id,
        lastActiveAt: new Date().toISOString(),
      });
    },
  });

  // Determine if tour should be shown
  useEffect(() => {
    if (onboardingStatusQuery.data) {
      const metrics = calculateNewUserMetrics(onboardingStatusQuery.data);
      setShouldShowTour(metrics.isNewUser && metrics.needsGuidance);
      
      // Temporarily disable activity tracking to fix unhandled promise rejections
      // Only update activity once per session to reduce API calls
      // if (metrics.isNewUser && !localStorage.getItem('activity_updated_this_session')) {
      //   updateLastActive.mutate();
      //   localStorage.setItem('activity_updated_this_session', 'true');
      // }
    }
  }, [onboardingStatusQuery.data]);

  // Reset tour for testing (dev mode only)
  const resetTourForTesting = useMutation({
    mutationFn: async () => {
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Tour reset only available in development');
      }
      return apiRequest("POST", "/api/user/reset-onboarding", {
        userId: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/onboarding-status"] });
      setShouldShowTour(true);
    },
  });

  const onboardingStatus = onboardingStatusQuery.data;
  const newUserMetrics = onboardingStatus ? calculateNewUserMetrics(onboardingStatus) : null;

  return {
    // Status data
    onboardingStatus,
    newUserMetrics,
    shouldShowTour,
    
    // Loading states
    isLoading: onboardingStatusQuery.isLoading,
    
    // Actions
    completeTour,
    skipTour,
    trackMilestone,
    resetTourForTesting,
    
    // Helper functions
    setShouldShowTour,
    
    // Status checks
    isCompletingTour: completeTour.isPending,
    isTrackingMilestone: trackMilestone.isPending,
  };
}