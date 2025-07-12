import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useSubscriptionInfo() {
  return useQuery({
    queryKey: ["/api/subscription/info"],
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });
}

export function useQuotaCheck() {
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["/api/quota/check"],
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
    onSuccess: (data: any) => {
      const usagePercentage = (data.dailyUsage / data.dailyLimit) * 100;
      
      // Warning at 80% usage
      if (usagePercentage >= 80 && usagePercentage < 95) {
        toast({
          title: "Usage Warning",
          description: `You've used ${Math.round(usagePercentage)}% of your daily limit.`,
          variant: "default",
        });
      }
      
      // Critical warning at 95% usage
      if (usagePercentage >= 95) {
        toast({
          title: "Usage Critical",
          description: `You've used ${Math.round(usagePercentage)}% of your daily limit. Consider upgrading.`,
          variant: "destructive",
        });
      }
    },
  });

  return {
    ...query,
    usagePercentage: query.data ? (query.data.dailyUsage / query.data.dailyLimit) * 100 : 0,
    isNearLimit: query.data ? (query.data.dailyUsage / query.data.dailyLimit) >= 0.8 : false,
  };
}

export function useUpgradeSubscription() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (plan: string) => {
      window.location.href = `/subscribe?plan=${plan}`;
    },
    onError: (error: Error) => {
      toast({
        title: "Upgrade Failed",
        description: error.message || "Failed to initiate subscription upgrade.",
        variant: "destructive",
      });
    },
  });
}

export function useFeatureAccess() {
  const subscriptionInfo = useSubscriptionInfo();
  
  return {
    hasFeature: (feature: string) => {
      if (!subscriptionInfo.data) return false;
      
      const tier = subscriptionInfo.data.tier?.name || 'free';
      
      // Feature access matrix
      const featureMatrix: Record<string, string[]> = {
        custom_voices: ['pro', 'team', 'enterprise'],
        advanced_synthesis: ['pro', 'team', 'enterprise'],
        team_collaboration: ['team', 'enterprise'],
        analytics_dashboard: ['pro', 'team', 'enterprise'],
        unlimited_generations: ['pro', 'team', 'enterprise'],
        priority_support: ['team', 'enterprise'],
        custom_training: ['enterprise'],
      };
      
      return featureMatrix[feature]?.includes(tier) || false;
    },
    tier: subscriptionInfo.data?.tier?.name || 'free',
    isLoading: subscriptionInfo.isLoading,
  };
}