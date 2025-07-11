import { db } from "./db";
import {
  voicePreferences,
  voiceUsageStats,
  sessionAnalytics,
  userAnalytics,
  voiceSessions,
  type VoicePreference,
  type InsertVoicePreference,
  type VoiceSession,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { logger } from "./logger";

interface PromptPattern {
  type: string;
  keywords: string[];
  complexity: number;
}

interface VoiceRecommendation {
  perspectives: string[];
  roles: string[];
  confidence: number;
  reasoning: string;
}

class PreferenceLearningService {
  private promptPatterns: PromptPattern[] = [
    {
      type: "react_component",
      keywords: ["react", "component", "jsx", "hooks", "state", "props"],
      complexity: 2,
    },
    {
      type: "api_endpoint",
      keywords: ["api", "endpoint", "rest", "http", "request", "response"],
      complexity: 2,
    },
    {
      type: "database_query",
      keywords: ["database", "sql", "query", "table", "schema", "migration"],
      complexity: 3,
    },
    {
      type: "frontend_ui",
      keywords: ["ui", "design", "css", "style", "layout", "responsive"],
      complexity: 1,
    },
    {
      type: "algorithm",
      keywords: ["algorithm", "optimize", "performance", "complexity", "data structure"],
      complexity: 3,
    },
    {
      type: "security",
      keywords: ["security", "auth", "authentication", "authorization", "encrypt", "secure"],
      complexity: 3,
    },
    {
      type: "testing",
      keywords: ["test", "jest", "unit", "integration", "mock", "coverage"],
      complexity: 2,
    },
    {
      type: "deployment",
      keywords: ["deploy", "docker", "kubernetes", "ci/cd", "pipeline", "production"],
      complexity: 3,
    },
  ];

  async trackRecommendationOutcome(
    userId: string,
    sessionId: number,
    recommended: VoiceRecommendation,
    accepted: boolean,
    actualSelection?: { perspectives: string[], roles: string[] }
  ) {
    try {
      // Detect prompt pattern from session
      const [session] = await db.select()
        .from(voiceSessions)
        .where(eq(voiceSessions.id, sessionId));
      
      if (!session) return;

      const pattern = this.detectPromptPattern(session.prompt);
      
      // Get or create preference record
      let [preference] = await db.select()
        .from(voicePreferences)
        .where(and(
          eq(voicePreferences.userId, userId),
          eq(voicePreferences.promptPattern, pattern.type)
        ));

      if (!preference) {
        // Create new preference record
        [preference] = await db.insert(voicePreferences).values({
          userId,
          promptPattern: pattern.type,
          preferredPerspectives: actualSelection?.perspectives || recommended.perspectives,
          preferredRoles: actualSelection?.roles || recommended.roles,
          acceptanceRate: accepted ? 1 : 0,
          successRate: 0,
          sampleCount: 1,
        }).returning();
      } else {
        // Update existing preference
        const newAcceptanceRate = 
          (preference.acceptanceRate * preference.sampleCount + (accepted ? 1 : 0)) / 
          (preference.sampleCount + 1);

        await db.update(voicePreferences)
          .set({
            preferredPerspectives: actualSelection?.perspectives || preference.preferredPerspectives,
            preferredRoles: actualSelection?.roles || preference.preferredRoles,
            acceptanceRate: newAcceptanceRate,
            sampleCount: preference.sampleCount + 1,
            lastUpdated: new Date(),
          })
          .where(eq(voicePreferences.id, preference.id));
      }

      // Track analytics event
      await db.insert(userAnalytics).values({
        userId,
        eventType: accepted ? "recommendation_applied" : "recommendation_rejected",
        eventData: {
          sessionId,
          pattern: pattern.type,
          recommended,
          actualSelection,
        },
        sessionId,
      });

      logger.info("Tracked recommendation outcome", {
        userId,
        pattern: pattern.type,
        accepted,
      });
    } catch (error) {
      logger.error("Error tracking recommendation outcome", error as Error);
    }
  }

  async trackSessionSuccess(sessionId: number, rating: "excellent" | "good" | "bad") {
    try {
      const [session] = await db.select()
        .from(sessionAnalytics)
        .where(eq(sessionAnalytics.sessionId, sessionId));

      if (!session || !session.userId) return;

      const pattern = this.detectPromptPattern(session.promptLength?.toString() || "");
      
      // Update preference success rate
      const [preference] = await db.select()
        .from(voicePreferences)
        .where(and(
          eq(voicePreferences.userId, session.userId),
          eq(voicePreferences.promptPattern, pattern.type)
        ));

      if (preference) {
        const successValue = rating === "excellent" ? 1 : rating === "good" ? 0.7 : 0.3;
        const newSuccessRate = 
          (preference.successRate * preference.sampleCount + successValue) / 
          (preference.sampleCount + 1);

        await db.update(voicePreferences)
          .set({
            successRate: newSuccessRate,
            lastUpdated: new Date(),
          })
          .where(eq(voicePreferences.id, preference.id));
      }

      // Update voice usage stats
      if (session.voicesUsed) {
        for (const voice of session.voicesUsed) {
          const [type, name] = voice.split(":");
          if (type && name) {
            await this.updateVoiceStats(session.userId, type as "perspective" | "role", name, rating);
          }
        }
      }
    } catch (error) {
      logger.error("Error tracking session success", error as Error);
    }
  }

  async getImprovedRecommendations(userId: string, prompt: string): Promise<VoiceRecommendation> {
    try {
      const pattern = this.detectPromptPattern(prompt);
      
      // Get user's preferences for this pattern
      const [preference] = await db.select()
        .from(voicePreferences)
        .where(and(
          eq(voicePreferences.userId, userId),
          eq(voicePreferences.promptPattern, pattern.type)
        ));

      // Get user's overall voice usage stats
      const stats = await db.select()
        .from(voiceUsageStats)
        .where(eq(voiceUsageStats.userId, userId))
        .orderBy(desc(voiceUsageStats.successCount));

      // Build recommendation based on learned preferences
      if (preference && preference.sampleCount > 3) {
        // User has established preferences for this pattern
        return {
          perspectives: preference.preferredPerspectives || [],
          roles: preference.preferredRoles || [],
          confidence: Math.min(0.9, preference.acceptanceRate * preference.successRate),
          reasoning: `Based on your ${preference.sampleCount} previous ${pattern.type} sessions with ${Math.round(preference.successRate * 100)}% success rate`,
        };
      }

      // Fall back to general usage patterns
      const topPerspectives = stats
        .filter(s => s.voiceType === "perspective")
        .slice(0, 2)
        .map(s => s.voiceName);

      const topRoles = stats
        .filter(s => s.voiceType === "role")
        .slice(0, 2)
        .map(s => s.voiceName);

      if (topPerspectives.length > 0 || topRoles.length > 0) {
        return {
          perspectives: topPerspectives,
          roles: topRoles,
          confidence: 0.6,
          reasoning: "Based on your most frequently used successful voice combinations",
        };
      }

      // Default recommendation for new users
      return this.getDefaultRecommendation(pattern);
    } catch (error) {
      logger.error("Error getting improved recommendations", error as Error);
      return this.getDefaultRecommendation(this.detectPromptPattern(prompt));
    }
  }

  private detectPromptPattern(prompt: string): PromptPattern {
    const lowerPrompt = prompt.toLowerCase();
    
    // Find best matching pattern
    let bestMatch = this.promptPatterns[0];
    let bestScore = 0;

    for (const pattern of this.promptPatterns) {
      let score = 0;
      for (const keyword of pattern.keywords) {
        if (lowerPrompt.includes(keyword)) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatch = pattern;
      }
    }

    return bestMatch;
  }

  private async updateVoiceStats(
    userId: string,
    voiceType: "perspective" | "role",
    voiceName: string,
    rating: "excellent" | "good" | "bad"
  ) {
    try {
      let [stat] = await db.select()
        .from(voiceUsageStats)
        .where(and(
          eq(voiceUsageStats.userId, userId),
          eq(voiceUsageStats.voiceType, voiceType),
          eq(voiceUsageStats.voiceName, voiceName)
        ));

      const ratingValue = rating === "excellent" ? 5 : rating === "good" ? 4 : 2;
      
      if (!stat) {
        await db.insert(voiceUsageStats).values({
          userId,
          voiceType,
          voiceName,
          usageCount: 1,
          successCount: rating !== "bad" ? 1 : 0,
          averageRating: ratingValue,
        });
      } else {
        const newAvgRating = stat.averageRating
          ? (stat.averageRating * stat.usageCount + ratingValue) / (stat.usageCount + 1)
          : ratingValue;

        await db.update(voiceUsageStats)
          .set({
            usageCount: stat.usageCount + 1,
            successCount: stat.successCount + (rating !== "bad" ? 1 : 0),
            averageRating: newAvgRating,
            lastUsed: new Date(),
          })
          .where(eq(voiceUsageStats.id, stat.id));
      }
    } catch (error) {
      logger.error("Error updating voice stats", error as Error);
    }
  }

  private getDefaultRecommendation(pattern: PromptPattern): VoiceRecommendation {
    // Default recommendations based on pattern type
    const recommendations: Record<string, VoiceRecommendation> = {
      react_component: {
        perspectives: ["Developer", "Analyzer"],
        roles: ["UI/UX Engineer", "Systems Architect"],
        confidence: 0.5,
        reasoning: "React components benefit from UI/UX expertise and architectural analysis",
      },
      api_endpoint: {
        perspectives: ["Implementor", "Analyzer"],
        roles: ["Systems Architect", "Security Engineer"],
        confidence: 0.5,
        reasoning: "API endpoints require implementation focus and security considerations",
      },
      database_query: {
        perspectives: ["Analyzer", "Implementor"],
        roles: ["Systems Architect", "Performance Engineer"],
        confidence: 0.5,
        reasoning: "Database work needs analytical thinking and performance optimization",
      },
      frontend_ui: {
        perspectives: ["Developer", "Explorer"],
        roles: ["UI/UX Engineer", "Performance Engineer"],
        confidence: 0.5,
        reasoning: "UI development requires creativity and performance awareness",
      },
      algorithm: {
        perspectives: ["Analyzer", "Implementor"],
        roles: ["Performance Engineer", "Systems Architect"],
        confidence: 0.5,
        reasoning: "Algorithms need deep analysis and efficient implementation",
      },
      security: {
        perspectives: ["Maintainer", "Analyzer"],
        roles: ["Security Engineer", "Systems Architect"],
        confidence: 0.5,
        reasoning: "Security requires careful maintenance and thorough analysis",
      },
      testing: {
        perspectives: ["Analyzer", "Maintainer"],
        roles: ["Systems Architect", "Security Engineer"],
        confidence: 0.5,
        reasoning: "Testing needs analytical thinking and maintenance perspective",
      },
      deployment: {
        perspectives: ["Implementor", "Maintainer"],
        roles: ["Systems Architect", "Security Engineer"],
        confidence: 0.5,
        reasoning: "Deployment requires implementation skills and maintenance focus",
      },
    };

    return recommendations[pattern.type] || recommendations.react_component;
  }

  async getUserLearningProfile(userId: string) {
    try {
      // Get all preferences
      const preferences = await db.select()
        .from(voicePreferences)
        .where(eq(voicePreferences.userId, userId))
        .orderBy(desc(voicePreferences.sampleCount));

      // Get voice usage stats
      const stats = await db.select()
        .from(voiceUsageStats)
        .where(eq(voiceUsageStats.userId, userId))
        .orderBy(desc(voiceUsageStats.usageCount));

      // Calculate learning insights
      const totalSamples = preferences.reduce((sum, p) => sum + p.sampleCount, 0);
      const avgAcceptance = preferences.length > 0
        ? preferences.reduce((sum, p) => sum + p.acceptanceRate, 0) / preferences.length
        : 0;
      const avgSuccess = preferences.length > 0
        ? preferences.reduce((sum, p) => sum + p.successRate, 0) / preferences.length
        : 0;

      return {
        preferences,
        voiceStats: stats,
        insights: {
          totalPatterns: preferences.length,
          totalSamples,
          averageAcceptanceRate: avgAcceptance,
          averageSuccessRate: avgSuccess,
          topPatterns: preferences.slice(0, 3).map(p => ({
            pattern: p.promptPattern,
            samples: p.sampleCount,
            success: p.successRate,
          })),
          topVoices: stats.slice(0, 5).map(s => ({
            type: s.voiceType,
            name: s.voiceName,
            usage: s.usageCount,
            rating: s.averageRating,
          })),
        },
      };
    } catch (error) {
      logger.error("Error getting user learning profile", error as Error);
      throw error;
    }
  }
}

export const preferenceLearningService = new PreferenceLearningService();