import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function useRealTimeAnalytics() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  // Dashboard analytics with real-time updates
  const dashboardQuery = useQuery({
    queryKey: ["/api/analytics/dashboard"],
    enabled: !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    select: (data: any) => ({
      summary: {
        totalSessions: data.summary?.totalSessions || 0,
        totalGenerations: data.summary?.totalGenerations || 0,
        averageRating: data.summary?.averageRating || 0,
        topVoice: data.summary?.topVoice || 'Explorer',
      },
      voiceUsage: data.voiceUsage?.map((voice: any) => ({
        name: voice.voiceName,
        usage: voice.usageCount,
        effectiveness: voice.averageRating * 20,
        trend: voice.usageTrend || 0,
      })) || [],
      dailyActivity: data.dailyMetrics?.map((day: any) => ({
        date: day.date,
        sessions: day.sessionCount,
        generations: day.generationCount,
        synthesis: day.synthesisCount,
      })) || [],
      recentActivity: data.recentEvents?.slice(0, 10) || [],
    }),
  });

  // VFSP Analytics for advanced users
  const vfspQuery = useQuery({
    queryKey: ["/api/analytics/vfsp"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data: any) => ({
      volatilityMetrics: {
        current: data.volatility?.current || 0,
        trend: data.volatility?.trend || 0,
        stability: data.volatility?.stability || 0,
      },
      forecastData: data.forecast?.map((point: any) => ({
        timestamp: point.timestamp,
        predicted: point.predictedValue,
        confidence: point.confidence,
        actual: point.actualValue,
      })) || [],
      symbolicPatterns: data.patterns?.map((pattern: any) => ({
        id: pattern.id,
        name: pattern.name,
        strength: pattern.strength,
        evolution: pattern.evolutionPath,
      })) || [],
      convergencePoints: data.convergence || [],
    }),
  });

  // Set up real-time invalidation on events
  useEffect(() => {
    const handleVoiceUsage = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
    };

    const handleSessionComplete = () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/vfsp"] });
    };

    // Listen for custom events from voice sessions
    window.addEventListener('voice-usage-event', handleVoiceUsage);
    window.addEventListener('session-complete-event', handleSessionComplete);

    return () => {
      window.removeEventListener('voice-usage-event', handleVoiceUsage);
      window.removeEventListener('session-complete-event', handleSessionComplete);
    };
  }, [queryClient]);

  return {
    dashboard: dashboardQuery,
    vfsp: vfspQuery,
    isLoading: dashboardQuery.isLoading || vfspQuery.isLoading,
    error: dashboardQuery.error || vfspQuery.error,
  };
}