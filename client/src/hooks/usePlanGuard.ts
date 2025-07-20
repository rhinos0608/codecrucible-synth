import { useState, useEffect } from 'react';
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface QuotaCheckResponse {
  allowed: boolean;
  planTier: 'free' | 'pro' | 'team' | 'enterprise';
  quotaUsed: number;
  quotaLimit: number;
  reason?: string;
  unlimitedGenerations?: boolean;
}

interface PlanGuardState {
  canGenerate: boolean;
  canSynthesize: boolean;
  canAccessAnalytics: boolean;
  quotaUsed: number;
  quotaLimit: number;
  planTier: 'none' | 'free' | 'pro' | 'team' | 'enterprise' | 'error';
  isLoading: boolean;
  error: string | null;
}

export function usePlanGuard() {
  const { user, isAuthenticated } = useAuthContext();
  const { toast } = useToast();
  const subscription = { tier: 'free' }; // Force all users to free tier

  const [state, setState] = useState<PlanGuardState>({
    canGenerate: false,
    canSynthesize: false,
    canAccessAnalytics: false,
    quotaUsed: 0,
    quotaLimit: 3,
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
      // Return a default response instead of null to prevent promise rejection issues
      return {
        allowed: false,
        planTier: 'free' as const,
        quotaUsed: 3,
        quotaLimit: 3,
        reason: 'quota_check_failed'
      };
    }
  };

  // Update plan guard state based on quota check
  useEffect(() => {
    const updatePlanState = async () => {
      try {
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

        const quotaCheck = await checkQuota().catch(error => {
          console.error('Failed to update plan state:', error);
          return null;
        });
        
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
            planTier: 'free'
          });
        }
      } catch (stateUpdateError) {
        console.error('❌ Plan state update failed:', stateUpdateError);
        setState({
          canGenerate: false,
          canSynthesize: false,
          canAccessAnalytics: false,
          quotaUsed: 0,
          quotaLimit: 0,
          planTier: 'error',
          isLoading: false,
          error: 'Failed to update plan state'
        });
      }
    };

    // Wrap async function to prevent unhandled promise rejection
    updatePlanState().catch(updateError => {
      console.error('❌ Unhandled error in plan state update:', updateError);
    });
  }, [isAuthenticated, user, subscription]);

  // Handle generation attempt with error handling
  const attemptGeneration = async (generationFn: () => Promise<any>) => {
    try {
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
          let userMessage = 'Access restricted.';
          try {
            const errorData = JSON.parse(error.message.split('403: ')[1] || '{}');
            if (errorData.symbolic) {
              userMessage = errorData.symbolic;
            } else if (errorData.upgradeRequired) {
              userMessage = 'Upgrade to continue generating code.';
            }
          } catch (parseError) {
            console.warn('Failed to parse 403 error data:', parseError);
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
          
          return { success: false, reason: 'access_restricted', error: userMessage };
        }
        
        return { success: false, error: String(error) };
      }
    } catch (attemptError) {
      console.error('❌ Attempt generation failed:', attemptError);
      return { success: false, error: 'Failed to attempt generation' };
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
        let userMessage = 'Upgrade to continue using synthesis.';
        try {
          const errorData = JSON.parse(error.message.split('403: ')[1] || '{}');
          userMessage = errorData.symbolic || userMessage;
        } catch (parseError) {
          console.warn('Failed to parse synthesis 403 error:', parseError);
        }
        
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