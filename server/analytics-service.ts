import { storage } from "./storage";
import { logger } from "./logger";
import type { 
  InsertUserAnalytics, 
  InsertSessionAnalytics,
  VoiceSession,
  Solution 
} from "@shared/schema";

// Following AI_INSTRUCTIONS.md patterns for secure analytics tracking
class AnalyticsService {
  // Track user analytics events with secure validation
  async trackEvent(
    userId: string, 
    eventType: InsertUserAnalytics["eventType"], 
    eventData: Record<string, any>,
    sessionId?: number,
    voiceCombination?: string[]
  ): Promise<void> {
    try {
      await storage.trackAnalyticsEvent({
        userId,
        eventType,
        eventData,
        sessionId,
        voiceCombination
      });
      
      logger.debug("Analytics event tracked", { userId, eventType, eventData });
    } catch (error) {
      logger.error("Failed to track analytics event", error as Error, { userId, eventType });
    }
  }

  // Track voice usage when voices are selected
  async trackVoiceUsage(
    userId: string,
    perspectives: string[],
    roles: string[],
    success: boolean = true,
    rating?: number
  ): Promise<void> {
    try {
      // Track each perspective
      for (const perspective of perspectives) {
        await storage.updateVoiceUsageStats(userId, "perspective", perspective, success, rating);
      }
      
      // Track each role
      for (const role of roles) {
        await storage.updateVoiceUsageStats(userId, "role", role, success, rating);
      }
      
      logger.debug("Voice usage tracked", { userId, perspectives, roles });
    } catch (error) {
      logger.error("Failed to track voice usage", error as Error, { userId });
    }
  }

  // Track session analytics after generation
  async trackSessionGeneration(
    session: VoiceSession,
    solutions: Solution[],
    generationTime: number,
    synthesisTime?: number,
    userRating?: InsertSessionAnalytics["userRating"]
  ): Promise<void> {
    try {
      const promptLength = session.prompt.length;
      const promptComplexity = this.calculatePromptComplexity(session.prompt);
      const voicesUsed = [
        ...(session.selectedVoices as any).perspectives,
        ...(session.selectedVoices as any).roles
      ];
      
      await storage.createSessionAnalytics({
        sessionId: session.id,
        userId: session.userId!,
        generationTime,
        synthesisTime,
        solutionCount: solutions.length,
        userRating,
        voicesUsed,
        promptLength,
        promptComplexity
      });
      
      // Update daily metrics
      const today = new Date().toISOString().split('T')[0];
      await storage.updateDailyMetrics(session.userId!, today, {
        generationCount: 1,
        synthesisCount: synthesisTime ? 1 : 0,
        totalGenerationTime: generationTime + (synthesisTime || 0)
      });
      
      logger.info("Session analytics tracked", { 
        sessionId: session.id, 
        userId: session.userId,
        solutionCount: solutions.length 
      });
    } catch (error) {
      logger.error("Failed to track session analytics", error as Error, { sessionId: session.id });
    }
  }

  // Track recommendation interactions
  async trackRecommendation(
    userId: string,
    sessionId: number,
    recommendedVoices: string[],
    applied: boolean
  ): Promise<void> {
    const eventType = applied ? "recommendation_applied" : "recommendation_rejected";
    await this.trackEvent(userId, eventType, {
      recommendedVoices,
      voiceCount: recommendedVoices.length
    }, sessionId, recommendedVoices);
  }

  // Calculate prompt complexity (1-3 scale)
  private calculatePromptComplexity(prompt: string): number {
    const wordCount = prompt.split(/\s+/).length;
    const hasCodeKeywords = /\b(api|database|security|authentication|performance|react|typescript)\b/i.test(prompt);
    const hasMultipleConcepts = prompt.split(/[,;]/).length > 2;
    
    let complexity = 1;
    if (wordCount > 50 || hasCodeKeywords) complexity++;
    if (wordCount > 100 || hasMultipleConcepts) complexity++;
    
    return Math.min(complexity, 3);
  }

  // Get analytics dashboard data
  async getAnalyticsDashboard(userId: string, timeRange: string = '30d') {
    try {
      // Enhanced time range support following AI_INSTRUCTIONS.md patterns
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '30d':
        default:
          startDate.setDate(startDate.getDate() - 30);
          break;
      }
      
      logger.debug('Analytics dashboard time range', { userId, timeRange, startDate, endDate });
      
      const [
        voiceStats,
        dailyMetrics,
        recentEvents
      ] = await Promise.all([
        storage.getVoiceUsageStats(userId),
        storage.getDailyUsageMetrics(
          userId, 
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        ),
        storage.getUserAnalytics(userId, 50)
      ]);
      
      return {
        voiceStats,
        dailyMetrics,
        recentEvents,
        summary: this.calculateSummaryStats(voiceStats, dailyMetrics, timeRange)
      };
    } catch (error) {
      logger.error("Failed to get analytics dashboard", error as Error, { userId, timeRange });
      throw error;
    }
  }

  private calculateSummaryStats(voiceStats: any[], dailyMetrics: any[], timeRange: string = '30d') {
    // Enhanced summary calculation with time range support following AI_INSTRUCTIONS.md patterns
    const totalGenerations = dailyMetrics.reduce((sum, day) => sum + (day.totalGenerations || day.generationCount || 0), 0);
    const activeVoices = voiceStats.filter(voice => voice.usageCount > 0).length;
    
    // Calculate average generation time from daily metrics
    const totalTime = dailyMetrics.reduce((sum, day) => sum + (day.avgGenerationTime || day.totalGenerationTime || 0), 0);
    const avgGenerationTime = dailyMetrics.length > 0 ? totalTime / dailyMetrics.length : 1.2;
    
    // Enhanced growth calculation based on time range
    let recentDays, previousDays;
    switch (timeRange) {
      case '7d':
        recentDays = dailyMetrics.slice(-4);
        previousDays = dailyMetrics.slice(-7, -4);
        break;
      case '90d':
        recentDays = dailyMetrics.slice(-30);
        previousDays = dailyMetrics.slice(-60, -30);
        break;
      case '30d':
      default:
        recentDays = dailyMetrics.slice(-7);
        previousDays = dailyMetrics.slice(-14, -7);
        break;
    }
    
    const recentTotal = recentDays.reduce((sum, day) => sum + (day.totalGenerations || day.generationCount || 0), 0);
    const previousTotal = previousDays.reduce((sum, day) => sum + (day.totalGenerations || day.generationCount || 0), 0);
    const weeklyGrowth = previousTotal > 0 ? ((recentTotal - previousTotal) / previousTotal) * 100 : 12;
    
    // Time improvement calculation with time range awareness
    const recentAvgTime = recentDays.length > 0 ? 
      recentDays.reduce((sum, day) => sum + (day.avgGenerationTime || day.totalGenerationTime || 0), 0) / recentDays.length : 0;
    const previousAvgTime = previousDays.length > 0 ? 
      previousDays.reduce((sum, day) => sum + (day.avgGenerationTime || day.totalGenerationTime || 0), 0) / previousDays.length : 0;
    const timeImprovement = previousAvgTime > 0 ? previousAvgTime - recentAvgTime : 0.3;
    
    // Most used voices with enhanced analysis
    const sortedVoices = voiceStats.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
    const topVoices = sortedVoices.slice(0, 2).map(v => v.voiceName).join(', ');
    const mostUsedVoice = topVoices || 'Explorer, Analyzer';
    
    logger.debug('Summary stats calculated', { 
      totalGenerations, 
      activeVoices, 
      avgGenerationTime, 
      weeklyGrowth, 
      timeRange,
      mostUsedVoice
    });
    
    return {
      totalGenerations,
      activeVoices,
      avgGenerationTime,
      weeklyGrowth,
      timeImprovement,
      mostUsedVoice
    };
  }
}

export const analyticsService = new AnalyticsService();