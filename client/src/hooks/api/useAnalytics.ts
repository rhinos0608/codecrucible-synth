import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/components/auth/AuthProvider";

export function useAnalyticsDashboard() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ["/api/analytics/dashboard"],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data: any) => {
      // Transform data for chart visualization
      return {
        summary: data.summary || {},
        voiceUsage: data.voiceUsage?.map((voice: any) => ({
          name: voice.voiceName,
          usage: voice.usageCount,
          effectiveness: voice.averageRating * 20, // Convert to percentage
          trend: voice.usageTrend || 0,
        })) || [],
        dailyActivity: data.dailyMetrics?.map((day: any) => ({
          date: day.date,
          sessions: day.sessionCount,
          generations: day.generationCount,
          synthesis: day.synthesisCount,
        })) || [],
        recentActivity: data.recentEvents || [],
      };
    },
  });
}

export function useVFSPAnalytics() {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ["/api/analytics/vfsp"],
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes
    select: (data: any) => {
      // Transform complex VFSP analytics for visualization
      return {
        volatilityMetrics: data.volatility || {},
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
      };
    },
  });
}

export function useVoiceEffectiveness() {
  return useQuery({
    queryKey: ["/api/analytics/voice-effectiveness"],
    staleTime: 5 * 60 * 1000,
    select: (data: any) => {
      return data?.map((voice: any) => ({
        name: voice.voiceName,
        effectiveness: voice.effectiveness,
        consistency: voice.consistency,
        specialization: voice.specializationAccuracy,
        recommendations: voice.recommendationCount,
        successRate: voice.successRate,
      })) || [];
    },
  });
}

export function useRecommendationMetrics() {
  return useQuery({
    queryKey: ["/api/analytics/recommendations"],
    staleTime: 5 * 60 * 1000,
    select: (data: any) => {
      return {
        acceptanceRate: data.acceptanceRate || 0,
        averageConfidence: data.averageConfidence || 0,
        topRecommendations: data.topRecommendations || [],
        userFeedback: data.userFeedback || [],
      };
    },
  });
}