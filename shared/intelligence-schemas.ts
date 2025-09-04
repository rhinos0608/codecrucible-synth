import { z } from 'zod';

// Core Intelligence Schemas for Smart Voice Selection
export const promptAnalysisSchema = z.object({
  domain: z.array(z.string()), // ["react", "typescript", "api"]
  complexity: z.union([z.literal(1), z.literal(2), z.literal(3)]), // Simple/Medium/Complex
  requirements: z.array(z.string()), // ["security", "performance", "ux"]
  keywords: z.array(z.string()), // extracted technical keywords
  projectType: z.string().optional(), // "component", "api", "database", etc.
});

export const voiceCombinationSchema = z.object({
  perspectives: z.array(z.string()),
  roles: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const voiceRecommendationSchema = z.object({
  suggested: voiceCombinationSchema,
  alternatives: z.array(voiceCombinationSchema),
  analysisConfidence: z.number().min(0).max(1),
});

export const conversationMemoryEntrySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  voicesUsed: z.array(z.string()),
  generatedSolutions: z.array(z.string()), // solution IDs
  userFeedback: z.enum(['good', 'bad', 'excellent', 'none']),
  finalChoice: z.string().optional(), // which solution they picked
  timestamp: z.date(),
  sessionId: z.number(),
});

export const voiceAnalyticsSchema = z.object({
  mostUsedVoices: z.array(
    z.object({
      voice: z.string(),
      usageCount: z.number(),
      successRate: z.number(),
    })
  ),
  successfulCombinations: z.array(
    z.object({
      combination: z.array(z.string()),
      successRate: z.number(),
      usageCount: z.number(),
    })
  ),
  projectTypePreferences: z.record(z.array(z.string())),
});

export const qualityMetricsSchema = z.object({
  codeComplexity: z.number().min(0).max(10),
  maintainabilityScore: z.number().min(0).max(100),
  securityScore: z.number().min(0).max(100),
  performanceScore: z.number().min(0).max(100),
});

export const synthesisResultSchema = z.object({
  synthesizedCode: z.string(),
  conflictsResolved: z.array(
    z.object({
      conflict: z.string(),
      chosenApproach: z.string(),
      reasoning: z.string(),
    })
  ),
  patterns: z.object({
    commonApproaches: z.array(z.string()),
    innovativeElements: z.array(z.string()),
    securityConsiderations: z.array(z.string()),
    performanceOptimizations: z.array(z.string()),
  }),
  qualityMetrics: qualityMetricsSchema,
});

// Type exports
export type PromptAnalysis = z.infer<typeof promptAnalysisSchema>;
export type VoiceCombination = z.infer<typeof voiceCombinationSchema>;
export type VoiceRecommendation = z.infer<typeof voiceRecommendationSchema>;
export type ConversationMemoryEntry = z.infer<typeof conversationMemoryEntrySchema>;
export type VoiceAnalytics = z.infer<typeof voiceAnalyticsSchema>;
export type QualityMetrics = z.infer<typeof qualityMetricsSchema>;
export type SynthesisResult = z.infer<typeof synthesisResultSchema>;
