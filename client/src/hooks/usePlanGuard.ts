import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "./use-toast";
import { apiRequest } from "@/lib/queryClient";

export interface PlanGuardState {
  canGenerate: boolean;
  canSynthesize: boolean;
  canAccessAnalytics: boolean;
  quotaUsed: number;
  quotaLimit: number;
  planTier: string;
  isLoading: boolean;
  error: string | null;
}

export interface QuotaCheckResponse {
  allowed: boolean;
  reason?: string;
  quotaUsed: number;
  quotaLimit: number;
  planTier: string;
  daysUntilReset?: number;
}

/**
 * Hook to guard plan-restricted features with real-time validation
 * Following AI_INSTRUCTIONS.md security patterns
 */
export function usePlanGuard() {
  const { user, isAuthenticated } = useAuth();
  const { data: subscription } = useQuery({
    queryKey: ["/api/subscription/info"],
    enabled: isAuthenticated,
  });
  const { toast } = useToast();
  
  const [state, setState] = useState<PlanGuardState>({
    canGenerate: false,
    canSynthesize: false,
    canAccessAnalytics: false,
    quotaUsed: 0,
    quotaLimit: 0,
    planTier: 'free',
    isLoading: true,
    error: null
  });

  // Check quota in real-time - Fixed JSON parsing issue following AI_INSTRUCTIONS.md patterns
  const checkQuota = async (): Promise<QuotaCheckResponse | null> => {
    if (!isAuthenticated || !user) return null;
    
    try {
      // apiRequest already returns parsed JSON, no need to call .json() again
      const data = await apiRequest("/api/quota/check", { method: "GET" });
      
      console.log('✅ Quota check successful:', {
        allowed: data.allowed,
        devMode: data.devMode,
        planTier: data.planTier,
        quotaUsed: data.quotaUsed,
        quotaLimit: data.quotaLimit,
        unlimitedGenerations: data.unlimitedGenerations,
        reason: data.reason
      });
      
      return data;
    } catch (error) {
      console.error('❌ Failed to check quota:', error);
      return null;
    }
  };

  // Update plan guard state based on quota check
  useEffect(() => {
    const updatePlanState = async () => {
      if (!isAuthenticated) {
        setState({
          canGenerate: false,
          canSynthesize: false,
          canAccessAnalytics: false,
          quotaUsed: 0,
          quotaLimit: 0,
          planTier: 'none',
          isLoading: false,
          error: null
        });
        return;
      }

      setState(prev => ({ ...prev, isLoading: true }));

      const quotaCheck = await checkQuota();
      
      if (!quotaCheck) {
        setState({
          canGenerate: false,
          canSynthesize: false,
          canAccessAnalytics: false,
          quotaUsed: 0,
          quotaLimit: 0,
          planTier: 'error',
          isLoading: false,
          error: 'Unable to verify subscription status'
        });
        return;
      }

      const planTier = quotaCheck.planTier;
      
      // Following AI_INSTRUCTIONS.md: Dev mode overrides for frontend
      const isDevMode = quotaCheck.devMode || quotaCheck.planTier === 'development';
      
      // Enhanced dev mode detection following AI_INSTRUCTIONS.md patterns
      const devModeActive = isDevMode || quotaCheck.unlimitedGenerations || quotaCheck.quotaLimit === 999;
      
      setState({
        canGenerate: quotaCheck.allowed || devModeActive,
        canSynthesize: planTier === 'pro' || planTier === 'team' || devModeActive,
        canAccessAnalytics: planTier === 'pro' || planTier === 'team' || devModeActive,
        quotaUsed: quotaCheck.quotaUsed || 0,
        quotaLimit: devModeActive ? -1 : (quotaCheck.quotaLimit || 3),
        planTier: devModeActive ? 'development' : planTier,
        isLoading: false,
        error: null
      });
      
      console.log('✅ Plan Guard State Updated:', {
        canGenerate: quotaCheck.allowed || isDevMode || quotaCheck.unlimitedGenerations,
        isDevMode,
        unlimitedGenerations: quotaCheck.unlimitedGenerations,
        planTier: isDevMode ? 'development' : planTier
      });
    };

    updatePlanState();
  }, [isAuthenticated, user, subscription]);

  // Handle generation attempt with error handling
  const attemptGeneration = async (generationFn: () => Promise<any>) => {
    // Pre-check quota with dev mode support
    const quotaCheck = await checkQuota();
    
    console.log('Attempt Generation - Quota Check:', quotaCheck);
    
    // Critical dev mode bypass - following AI_INSTRUCTIONS.md patterns  
    const isDevModeActive = quotaCheck?.devMode || quotaCheck?.planTier === 'development' || quotaCheck?.unlimitedGenerations || quotaCheck?.quotaLimit === 999;
    
    if (isDevModeActive) {
      console.log('✅ Dev mode DETECTED - bypassing ALL quota restrictions in attemptGeneration:', {
        devMode: quotaCheck?.devMode,
        planTier: quotaCheck?.planTier,
        unlimitedGenerations: quotaCheck?.unlimitedGenerations,
        quotaLimit: quotaCheck?.quotaLimit,
        bypassReason: 'dev_mode_unlimited_access'
      });
      try {
        const result = await generationFn();
        return { success: true, data: result };
      } catch (error) {
        console.error('Generation failed in dev mode:', error);
        return { success: false, error: String(error) };
      }
    }
    
    if (!quotaCheck?.allowed) {
      const message = quotaCheck?.reason === 'quota_exceeded' 
        ? 'Your daily generation quota has been reached.'
        : 'Unable to generate code at this time.';
      
      toast({
        title: "Generation Blocked",
        description: message,
        variant: "destructive",
      });
      
      return { success: false, reason: 'quota_exceeded', error: message };
    }

    try {
      const result = await generationFn();
      
      // Update quota state after successful generation
      setState(prev => ({
        ...prev,
        quotaUsed: prev.quotaUsed + 1,
        canGenerate: prev.quotaUsed + 1 < prev.quotaLimit || prev.quotaLimit === -1
      }));
      
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Generation error:', error);
      
      // Handle specific error types from server
      if (error.message?.includes('403')) {
        const errorData = JSON.parse(error.message.split('403: ')[1] || '{}');
        
        let userMessage = 'Access restricted.';
        if (errorData.symbolic) {
          userMessage = errorData.symbolic;
        } else if (errorData.upgradeRequired) {
          userMessage = 'Upgrade to continue generating code.';
        }
        
        toast({
          title: "Access Restricted",
          description: userMessage,
          variant: "destructive",
        });
        
        // Update state to reflect restriction
        setState(prev => ({
          ...prev,
          canGenerate: false,
          error: userMessage
        }));
        
        return { success: false, error: userMessage };
      }
      
      // Extract meaningful error messages from server responses
      let errorMessage = 'Generation failed. Please try again.';
      
      if (error.message?.includes('401')) {
        errorMessage = 'OpenAI API configuration issue. Please check API key.';
      } else if (error.message?.includes('429')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
      } else if (error.message?.includes('500')) {
        // Try to extract the actual error message from server
        const serverError = error.message.split('500: ')[1];
        if (serverError) {
          try {
            const errorData = JSON.parse(serverError);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // If not JSON, use the raw server error message
            errorMessage = serverError.length > 0 ? serverError : errorMessage;
          }
        }
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message && !error.message.includes('fetch')) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive",
      });
      
      return { success: false, error: errorMessage };
    }
  };

  // Handle synthesis attempt
  const attemptSynthesis = async (synthesisFn: () => Promise<any>) => {
    if (!state.canSynthesize) {
      const message = 'Synthesis feature requires Pro or Team subscription.';
      toast({
        title: "Feature Restricted",
        description: message,
        variant: "destructive",
      });
      return { success: false, error: message };
    }

    try {
      const result = await synthesisFn();
      return { success: true, data: result };
    } catch (error: any) {
      if (error.message?.includes('403')) {
        const errorData = JSON.parse(error.message.split('403: ')[1] || '{}');
        const userMessage = errorData.symbolic || 'Upgrade to continue using synthesis.';
        
        toast({
          title: "Feature Restricted",
          description: userMessage,
          variant: "destructive",
        });
        
        return { success: false, error: userMessage };
      }
      
      const genericError = 'Synthesis failed. Please try again.';
      toast({
        title: "Synthesis Failed",
        description: genericError,
        variant: "destructive",
      });
      
      return { success: false, error: genericError };
    }
  };

  return {
    ...state,
    checkQuota,
    attemptGeneration,
    attemptSynthesis,
    refreshState: () => {
      // Trigger re-check
      setState(prev => ({ ...prev, isLoading: true }));
    }
  };
}