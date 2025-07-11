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
  async getAnalyticsDashboard(userId: string) {
    try {
      // Get date range for last 30 days
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      
      const [
        voiceStats,
        dailyMetrics,
        recentEvents
      ] = await Promise.all([
        storage.getVoiceUsageStats(userId),
        storage.getDailyMetrics(
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
        summary: this.calculateSummaryStats(voiceStats, dailyMetrics)
      };
    } catch (error) {
      logger.error("Failed to get analytics dashboard", error as Error, { userId });
      throw error;
    }
  }

  private calculateSummaryStats(voiceStats: any[], dailyMetrics: any[]) {
    const totalGenerations = dailyMetrics.reduce((sum, day) => sum + day.generationCount, 0);
    const totalSyntheses = dailyMetrics.reduce((sum, day) => sum + day.synthesisCount, 0);
    const avgGenerationTime = dailyMetrics.reduce((sum, day) => sum + day.totalGenerationTime, 0) / totalGenerations || 0;
    const mostUsedVoice = voiceStats.sort((a, b) => b.usageCount - a.usageCount)[0];
    
    return {
      totalGenerations,
      totalSyntheses,
      avgGenerationTime,
      mostUsedVoice: mostUsedVoice?.voiceName || 'None',
      successRate: voiceStats.length > 0 
        ? voiceStats.reduce((sum, v) => sum + (v.successCount / v.usageCount), 0) / voiceStats.length 
        : 0
    };
  }
}

export const analyticsService = new AnalyticsService();