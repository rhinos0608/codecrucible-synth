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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Quota check successful:', {
          allowed: data.allowed,
          planTier: data.planTier,
          unlimitedGenerations: data.unlimitedGenerations
        });
      }
      
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

      // PRODUCTION ENFORCEMENT: Force all users to free tier behavior
      // Following AI_INSTRUCTIONS.md: Proper paywall enforcement for testing
      const planTier = 'free'; // Force free tier for all users
      
      setState({
        canGenerate: quotaCheck.allowed,
        canSynthesize: false, // Free tier cannot access synthesis
        canAccessAnalytics: false, // Free tier cannot access analytics
        quotaUsed: quotaCheck.quotaUsed || 0,
        quotaLimit: 3, // Strict free tier limit
        planTier: 'free', // Force free tier display
        isLoading: false,
        error: null
      });
      
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Plan Guard State Updated:', {
          canGenerate: quotaCheck.allowed,
          planTier: actualPlanTier
        });
      }
    };

    updatePlanState();
  }, [isAuthenticated, user, subscription]);

  // Handle generation attempt with error handling
  const attemptGeneration = async (generationFn: () => Promise<any>) => {
    // Pre-check quota following CodingPhilosophy.md consciousness principles
    const quotaCheck = await checkQuota();
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Attempt Generation - Quota Check:', quotaCheck?.allowed);
    }
    
    // Following AI_INSTRUCTIONS.md: Check actual plan permissions, not dev mode
    const actualPlanTier = subscription?.tier || quotaCheck?.planTier;
    const hasUnlimitedGenerations = quotaCheck?.unlimitedGenerations || actualPlanTier === 'pro' || actualPlanTier === 'team' || actualPlanTier === 'enterprise';
    
    if (hasUnlimitedGenerations && quotaCheck?.allowed) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Pro tier unlimited access enabled');
      }
      try {
        const result = await generationFn();
        return { success: true, data: result };
      } catch (error) {
        console.error('Generation failed for Pro tier:', error);
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