import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface NewUserMetrics {
  accountAge: number; // days since registration
  sessionsCreated: number;
  tourCompleted: boolean;
  lastLoginDays: number;
  synthesisUsed: boolean;
  voiceProfilesCreated: number;
  collaborationParticipated: boolean;
}

interface MilestoneEvent {
  type: 'first_voice_selection' | 'first_generation' | 'first_synthesis' | 'first_project_save' | 'first_solution';
  timestamp: Date;
  context?: Record<string, any>;
}

/**
 * Hook for detecting new users and managing onboarding flow
 * Following AI_INSTRUCTIONS.md patterns for user state management
 */
export function useNewUserDetection() {
  const { user, isAuthenticated } = useAuth();
  const [shouldShowTour, setShouldShowTour] = useState(false);

  // Fetch user onboarding status
  const { data: newUserMetrics, isLoading } = useQuery({
    queryKey: ['/api/onboarding/status'],
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Complete tour mutation
  const completeTour = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/onboarding/complete-tour', {});
      return response.json();
    },
    onSuccess: () => {
      setShouldShowTour(false);
    },
    onError: (error) => {
      console.error('Failed to complete tour:', error);
    }
  });

  // Skip tour mutation
  const skipTour = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/onboarding/skip-tour', {});
      return response.json();
    },
    onSuccess: () => {
      setShouldShowTour(false);
    },
    onError: (error) => {
      console.error('Failed to skip tour:', error);
    }
  });

  // Track milestone events
  const trackMilestone = useMutation({
    mutationFn: async (milestone: MilestoneEvent) => {
      const response = await apiRequest('POST', '/api/onboarding/milestone', milestone);
      return response.json();
    },
    onError: (error) => {
      console.error('Failed to track milestone:', error);
    }
  });

  // Determine if user should see onboarding tour
  useEffect(() => {
    if (!isAuthenticated || !newUserMetrics || isLoading) {
      setShouldShowTour(false);
      return;
    }

    const metrics = newUserMetrics as NewUserMetrics;
    
    // Show tour for new users who haven't completed it
    const isNewUser = (
      metrics.accountAge <= 7 && // Account less than 7 days old
      !metrics.tourCompleted && // Haven't completed tour
      metrics.sessionsCreated < 3 // Haven't created many sessions
    );

    // TEMPORARY: Force show tour for testing - remove after implementation
    // Set to true to force show tour regardless of completion status
    const forceShowTour = true;

    setShouldShowTour(forceShowTour);
    
    console.log('New User Detection:', {
      isNewUser,
      tourCompleted: metrics.tourCompleted,
      shouldShowTour: forceShowTour
    });
  }, [newUserMetrics, isAuthenticated, isLoading]);

  // Helper functions for tour progression
  const trackFirstVoiceSelection = () => {
    trackMilestone.mutate({
      type: 'first_voice_selection',
      timestamp: new Date()
    });
  };

  const trackFirstGeneration = () => {
    trackMilestone.mutate({
      type: 'first_generation',
      timestamp: new Date()
    });
  };

  const trackFirstSynthesis = () => {
    trackMilestone.mutate({
      type: 'first_synthesis',
      timestamp: new Date()
    });
  };

  const trackFirstProjectSave = () => {
    trackMilestone.mutate({
      type: 'first_project_save',
      timestamp: new Date()
    });
  };

  return {
    shouldShowTour,
    newUserMetrics: newUserMetrics as NewUserMetrics,
    isLoading,
    completeTour,
    skipTour,
    trackMilestone,
    // Helper tracking functions
    trackFirstVoiceSelection,
    trackFirstGeneration,
    trackFirstSynthesis,
    trackFirstProjectSave
  };
}