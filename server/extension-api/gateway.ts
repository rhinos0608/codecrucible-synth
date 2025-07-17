// Extension API Gateway - Centralized endpoint for all IDE/editor extensions
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../logger';
import { storage } from '../storage';
import { realOpenAIService } from '../openai-service';
import { getSubscriptionTier } from '../subscription-service';

// Extension authentication schema
export const extensionAuthSchema = z.object({
  platform: z.enum(['vscode', 'github', 'jetbrains', 'sublime', 'vim', 'emacs']),
  version: z.string().min(1).max(50),
  userId: z.string().min(1),
  clientId: z.string().min(1).max(100)
});

// Code generation request schema
export const extensionGenerateSchema = z.object({
  prompt: z.string().min(1).max(15000),
  context: z.object({
    language: z.string().optional(),
    filePath: z.string().optional(),
    projectType: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    surroundingCode: z.string().optional()
  }).optional(),
  voices: z.object({
    perspectives: z.array(z.string()).default([]),
    roles: z.array(z.string()).default([])
  }),
  synthesisMode: z.enum(['consensus', 'competitive', 'collaborative']).default('collaborative'),
  maxSolutions: z.number().int().min(1).max(10).default(3)
});

// Synthesis request schema
export const extensionSynthesisSchema = z.object({
  solutions: z.array(z.object({
    code: z.string(),
    explanation: z.string(),
    voiceType: z.string(),
    confidence: z.number().min(0).max(1)
  })).min(2).max(10),
  synthesisGoal: z.enum(['best_practices', 'performance', 'readability', 'maintainability']).default('best_practices')
});

// Extension API key management
export class ExtensionApiKeyManager {
  private static apiKeys = new Map<string, {
    userId: string;
    platform: string;
    createdAt: Date;
    lastUsed: Date;
    requestCount: number;
  }>();

  static generateApiKey(userId: string, platform: string): string {
    const key = `ccext_${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
    
    this.apiKeys.set(key, {
      userId,
      platform,
      createdAt: new Date(),
      lastUsed: new Date(),
      requestCount: 0
    });
    
    logger.info('Extension API key generated', {
      userId: userId.substring(0, 8) + '...',
      platform,
      keyPrefix: key.substring(0, 20) + '...'
    });
    
    return key;
  }

  static validateApiKey(apiKey: string): { userId: string; platform: string } | null {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return null;
    }

    // Update usage statistics
    keyData.lastUsed = new Date();
    keyData.requestCount++;

    return {
      userId: keyData.userId,
      platform: keyData.platform
    };
  }

  static revokeApiKey(apiKey: string): boolean {
    return this.apiKeys.delete(apiKey);
  }
}

// Extension authentication middleware
export const authenticateExtension = (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = req.headers['x-codecrucible-api-key'] as string;
    
    if (!apiKey) {
      return res.status(401).json({ 
        error: 'Extension API key required',
        code: 'MISSING_API_KEY' 
      });
    }

    const auth = ExtensionApiKeyManager.validateApiKey(apiKey);
    if (!auth) {
      return res.status(401).json({ 
        error: 'Invalid extension API key',
        code: 'INVALID_API_KEY' 
      });
    }

    // Attach extension context to request
    (req as any).extension = {
      userId: auth.userId,
      platform: auth.platform,
      apiKey: apiKey.substring(0, 20) + '...'
    };

    next();
  } catch (error) {
    logger.error('Extension authentication error', error as Error, {
      headers: req.headers['x-codecrucible-api-key']?.toString().substring(0, 20) + '...'
    });
    
    res.status(500).json({ 
      error: 'Authentication service error',
      code: 'AUTH_SERVICE_ERROR' 
    });
  }
};

// Rate limiting for extensions
export const extensionRateLimit = (req: Request, res: Response, next: NextFunction) => {
  const extension = (req as any).extension;
  
  // Implementation would check rate limits based on subscription tier
  // For now, implement basic rate limiting
  
  next();
};

// Extension API Gateway class
export class ExtensionApiGateway {
  
  // Authentication endpoint - generate API key for extension
  static async authenticate(req: Request, res: Response) {
    try {
      const validatedData = extensionAuthSchema.parse(req.body);
      
      // Verify user exists and has valid subscription
      const subscriptionTier = await getSubscriptionTier(validatedData.userId);
      if (!subscriptionTier || subscriptionTier === 'none') {
        return res.status(403).json({
          error: 'Valid subscription required for extension access',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }

      // Generate API key for extension
      const apiKey = ExtensionApiKeyManager.generateApiKey(
        validatedData.userId, 
        validatedData.platform
      );

      logger.info('Extension authenticated successfully', {
        userId: validatedData.userId.substring(0, 8) + '...',
        platform: validatedData.platform,
        version: validatedData.version,
        subscriptionTier
      });

      res.json({
        apiKey,
        expiresIn: '30d',
        quotaLimit: subscriptionTier === 'pro' ? -1 : 50,
        features: {
          multiVoiceGeneration: true,
          realTimeSynthesis: subscriptionTier !== 'free',
          teamCollaboration: subscriptionTier === 'team' || subscriptionTier === 'enterprise'
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid authentication request',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }

      logger.error('Extension authentication failed', error as Error, {
        requestBody: req.body
      });
      
      res.status(500).json({
        error: 'Authentication service error',
        code: 'AUTH_SERVICE_ERROR'
      });
    }
  }

  // Multi-voice code generation endpoint
  static async generate(req: Request, res: Response) {
    try {
      const extension = (req as any).extension;
      const validatedData = extensionGenerateSchema.parse(req.body);

      // Create voice session for tracking
      const session = await storage.createVoiceSession({
        userId: extension.userId,
        prompt: validatedData.prompt,
        selectedVoices: validatedData.voices,
        recursionDepth: 1,
        synthesisMode: validatedData.synthesisMode,
        ethicalFiltering: true,
        mode: 'production'
      });

      logger.info('Extension generation request', {
        userId: extension.userId.substring(0, 8) + '...',
        platform: extension.platform,
        sessionId: session.id,
        promptLength: validatedData.prompt.length,
        voiceCount: validatedData.voices.perspectives.length + validatedData.voices.roles.length
      });

      // Generate solutions using OpenAI service
      const solutions = await realOpenAIService.generateSolutions(
        validatedData.prompt,
        validatedData.voices,
        {
          context: validatedData.context,
          maxSolutions: validatedData.maxSolutions,
          platform: extension.platform
        }
      );

      // Store solutions in database
      const storedSolutions = await Promise.all(
        solutions.map(solution => 
          storage.createSolution({
            sessionId: session.id,
            voiceCombination: solution.voiceType,
            code: solution.code,
            explanation: solution.explanation,
            confidence: solution.confidence,
            strengths: solution.strengths || [],
            considerations: solution.considerations || []
          })
        )
      );

      res.json({
        sessionId: session.id,
        solutions: storedSolutions.map((solution, index) => ({
          id: solution.id,
          code: solution.code,
          explanation: solution.explanation,
          voiceType: solutions[index].voiceType,
          confidence: solution.confidence,
          metadata: {
            platform: extension.platform,
            generatedAt: new Date().toISOString()
          }
        })),
        synthesisAvailable: storedSolutions.length >= 2
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid generation request',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }

      logger.error('Extension generation failed', error as Error, {
        userId: (req as any).extension?.userId,
        platform: (req as any).extension?.platform
      });
      
      res.status(500).json({
        error: 'Code generation service error',
        code: 'GENERATION_ERROR'
      });
    }
  }

  // Solution synthesis endpoint
  static async synthesize(req: Request, res: Response) {
    try {
      const extension = (req as any).extension;
      const validatedData = extensionSynthesisSchema.parse(req.body);

      logger.info('Extension synthesis request', {
        userId: extension.userId.substring(0, 8) + '...',
        platform: extension.platform,
        solutionCount: validatedData.solutions.length,
        synthesisGoal: validatedData.synthesisGoal
      });

      // Synthesize solutions using OpenAI service
      const synthesizedResult = await realOpenAIService.synthesizeSolutions(
        validatedData.solutions.map(sol => ({
          code: sol.code,
          explanation: sol.explanation,
          voiceType: sol.voiceType,
          confidence: sol.confidence
        })),
        {
          goal: validatedData.synthesisGoal,
          platform: extension.platform
        }
      );

      res.json({
        synthesizedCode: synthesizedResult.combinedCode,
        explanation: synthesizedResult.explanation,
        qualityScore: synthesizedResult.qualityScore,
        improvementSuggestions: synthesizedResult.suggestions || [],
        metadata: {
          platform: extension.platform,
          synthesizedAt: new Date().toISOString(),
          sourceVoices: validatedData.solutions.map(s => s.voiceType)
        }
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid synthesis request',
          details: error.errors,
          code: 'VALIDATION_ERROR'
        });
      }

      logger.error('Extension synthesis failed', error as Error, {
        userId: (req as any).extension?.userId,
        platform: (req as any).extension?.platform
      });
      
      res.status(500).json({
        error: 'Synthesis service error',
        code: 'SYNTHESIS_ERROR'
      });
    }
  }

  // Voice recommendation endpoint
  static async recommend(req: Request, res: Response) {
    try {
      const extension = (req as any).extension;
      const { prompt, context } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
          error: 'Prompt is required for voice recommendations',
          code: 'MISSING_PROMPT'
        });
      }

      logger.info('Extension voice recommendation request', {
        userId: extension.userId.substring(0, 8) + '...',
        platform: extension.platform,
        promptLength: prompt.length
      });

      // Get voice recommendations using existing service
      const recommendations = await realOpenAIService.getVoiceRecommendations(prompt, {
        context,
        platform: extension.platform
      });

      res.json({
        recommendations: recommendations.map(rec => ({
          voiceType: rec.voice,
          confidence: rec.confidence,
          reasoning: rec.reasoning,
          category: rec.category
        })),
        metadata: {
          platform: extension.platform,
          analyzedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Extension recommendation failed', error as Error, {
        userId: (req as any).extension?.userId,
        platform: (req as any).extension?.platform
      });
      
      res.status(500).json({
        error: 'Recommendation service error',
        code: 'RECOMMENDATION_ERROR'
      });
    }
  }

  // Health check endpoint
  static async health(req: Request, res: Response) {
    const extension = (req as any).extension;
    
    res.json({
      status: 'healthy',
      platform: extension.platform,
      timestamp: new Date().toISOString(),
      services: {
        openai: 'operational',
        database: 'operational',
        authentication: 'operational'
      }
    });
  }
}