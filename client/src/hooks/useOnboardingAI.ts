import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuthContext } from "@/components/auth/AuthProvider";

// Following AI_INSTRUCTIONS.md: Strict TypeScript and security patterns
interface OnboardingProgress {
  userId: string;
  currentPhase: 'quick-start' | 'council-initiation' | 'spiral-mastery' | 'living-patterns' | 'consciousness-integration';
  completedModules: string[];
  spiralCycles: number;
  qwanAssessments: number;
  councilExperiences: number;
  masteryLevel: number;
  insights: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface OnboardingAnalysis {
  userReadiness: number;
  recommendedPath: string;
  nextSteps: string[];
  personalizedGuidance: string;
  voiceAffinities: Record<string, number>;
}

// Following CodingPhilosophy.md: Consciousness evolution tracking
interface ConsciousnessMetrics {
  singleVoiceToCouncil: number;
  linearToSpiral: number;
  reactiveToProactive: number;
  individualToCollective: number;
  mechanicalToLiving: number;
  overall: number;
}

export function useOnboardingAI() {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get current onboarding progress
  const progressQuery = useQuery({
    queryKey: ["/api/onboarding/progress", user?.id],
    enabled: !!user,
    staleTime: 30000, // 30 seconds
  });

  // Get AI-powered personalized onboarding analysis
  const analysisQuery = useQuery({
    queryKey: ["/api/onboarding/analysis", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data: any): OnboardingAnalysis => ({
      userReadiness: data.userReadiness || 0,
      recommendedPath: data.recommendedPath || 'quick-start',
      nextSteps: data.nextSteps || [],
      personalizedGuidance: data.personalizedGuidance || '',
      voiceAffinities: data.voiceAffinities || {},
    }),
  });

  // Track consciousness evolution metrics
  const consciousnessQuery = useQuery({
    queryKey: ["/api/onboarding/consciousness-metrics", user?.id],
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data: any): ConsciousnessMetrics => ({
      singleVoiceToCouncil: data.singleVoiceToCouncil || 0,
      linearToSpiral: data.linearToSpiral || 0,
      reactiveToProactive: data.reactiveToProactive || 0,
      individualToCollective: data.individualToCollective || 0,
      mechanicalToLiving: data.mechanicalToLiving || 0,
      overall: data.overall || 0,
    }),
  });

  // Update onboarding progress with AI analysis
  const updateProgress = useMutation({
    mutationFn: async (update: {
      phase?: string;
      completedModule?: string;
      spiralCycle?: boolean;
      qwanAssessment?: boolean;
      councilExperience?: boolean;
      insight?: string;
    }) => {
      return apiRequest("POST", "/api/onboarding/progress", {
        userId: user?.id,
        ...update,
        timestamp: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/analysis"] });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/consciousness-metrics"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Progress Update Failed",
        description: error.message || "Failed to update onboarding progress",
        variant: "destructive",
      });
    },
  });

  // AI-powered voice recommendation for onboarding
  const getVoiceRecommendation = useMutation({
    mutationFn: async (context: {
      currentPhase: string;
      userQuestion: string;
      previousExperiences: string[];
    }) => {
      const response = await apiRequest("POST", "/api/onboarding/voice-recommendation", {
        ...context,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Voice Guidance Ready",
        description: `${data.recommendedVoice} voice is ready to guide you`,
      });
    },
  });

  // Generate personalized onboarding path
  const generatePersonalizedPath = useMutation({
    mutationFn: async (preferences: {
      learningStyle: 'visual' | 'hands-on' | 'theoretical' | 'collaborative';
      timeCommitment: 'quick' | 'thorough' | 'deep-dive';
      primaryGoals: string[];
      experience: 'beginner' | 'intermediate' | 'advanced';
    }) => {
      const response = await apiRequest("POST", "/api/onboarding/personalized-path", {
        ...preferences,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/analysis"] });
      toast({
        title: "Personal Learning Path Created",
        description: `Customized ${data.pathType} journey ready`,
      });
    },
  });

  // Submit spiral practice reflection for AI analysis
  const submitSpiralReflection = useMutation({
    mutationFn: async (reflection: {
      phase: 'collapse' | 'council' | 'synthesis' | 'rebirth';
      scenario: string;
      userResponse: string;
      insights: string[];
    }) => {
      const response = await apiRequest("POST", "/api/onboarding/spiral-reflection", {
        ...reflection,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      updateProgress.mutate({ 
        spiralCycle: true, 
        insight: data.aiInsight 
      });
      toast({
        title: "Spiral Reflection Processed",
        description: "AI analysis added to your learning journey",
      });
    },
  });

  // Submit QWAN assessment for consciousness tracking
  const submitQWANAssessment = useMutation({
    mutationFn: async (assessment: {
      codeId: string;
      userMetrics: Record<string, number>;
      improvements: string[];
      insights: string[];
    }) => {
      const response = await apiRequest("POST", "/api/onboarding/qwan-assessment", {
        ...assessment,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      updateProgress.mutate({ 
        qwanAssessment: true,
        insight: data.qualityInsight 
      });
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding/consciousness-metrics"] });
      toast({
        title: "QWAN Assessment Recorded",
        description: "Your quality consciousness is evolving",
      });
    },
  });

  // Complete council experience with AI debrief
  const completeCouncilExperience = useMutation({
    mutationFn: async (experience: {
      selectedVoices: string[];
      scenario: string;
      synthesis: string;
      satisfaction: number;
      learnings: string[];
    }) => {
      const response = await apiRequest("POST", "/api/onboarding/council-experience", {
        ...experience,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      });
      return response.json();
    },
    onSuccess: (data) => {
      updateProgress.mutate({ 
        councilExperience: true,
        insight: data.councilInsight 
      });
      toast({
        title: "Council Experience Complete",
        description: "Multi-voice wisdom integrated into your practice",
      });
    },
  });

  return {
    // Data
    progress: progressQuery.data as OnboardingProgress | undefined,
    analysis: analysisQuery.data,
    consciousness: consciousnessQuery.data,
    
    // Loading states
    isLoading: progressQuery.isLoading || analysisQuery.isLoading,
    isAnalyzing: analysisQuery.isFetching,
    
    // Actions
    updateProgress,
    getVoiceRecommendation,
    generatePersonalizedPath,
    submitSpiralReflection,
    submitQWANAssessment,
    completeCouncilExperience,
    
    // Status
    isUpdating: updateProgress.isPending,
    isGeneratingPath: generatePersonalizedPath.isPending,
  };
}