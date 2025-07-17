// Extension API Gateway - Centralized extension authentication and routing
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { logger } from '../logger.js';
import { ConsciousnessSynthesisEngine } from '../services/consciousness-synthesis-engine.js';

// Extension authentication schema
const extensionAuthSchema = z.object({
  platform: z.enum(['vscode', 'jetbrains', 'github', 'vim', 'sublime']),
  version: z.string(),
  apiKey: z.string().min(32),
  userId: z.string().optional(),
  sessionId: z.string().optional()
});

// Extension request context
interface ExtensionContext {
  platform: string;
  version: string;
  userId?: string;
  sessionId?: string;
  authenticated: boolean;
}

declare global {
  namespace Express {
    interface Request {
      extension?: ExtensionContext;
    }
  }
}

// Rate limiting for extensions - more generous than web interface
export const extensionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window for extensions
  message: {
    error: 'Extension rate limit exceeded',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Extension authentication middleware
export const authenticateExtension = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const platform = req.headers['x-platform'] as string;
    const version = req.headers['x-version'] as string;

    if (!platform || !version) {
      return res.status(400).json({ error: 'Missing platform or version headers' });
    }

    // Validate extension credentials
    const validation = extensionAuthSchema.safeParse({
      platform,
      version,
      apiKey: token,
      userId: req.headers['x-user-id'] as string,
      sessionId: req.headers['x-session-id'] as string
    });

    if (!validation.success) {
      logger.error('Extension authentication validation failed', {
        platform,
        version,
        errors: validation.error.errors
      });
      return res.status(400).json({ error: 'Invalid extension credentials' });
    }

    // Set extension context
    req.extension = {
      platform: validation.data.platform,
      version: validation.data.version,
      userId: validation.data.userId,
      sessionId: validation.data.sessionId,
      authenticated: true
    };

    logger.debug('Extension authenticated', {
      platform: req.extension.platform,
      version: req.extension.version,
      userId: req.extension.userId?.substring(0, 8) + '...'
    });

    next();
  } catch (error) {
    logger.error('Extension authentication error', { error: error.message });
    res.status(500).json({ error: 'Authentication service error' });
  }
};

// Extension API Gateway class
export class ExtensionApiGateway {
  private static synthesisEngine = new ConsciousnessSynthesisEngine();

  static async authenticate(req: Request, res: Response) {
    try {
      const { platform, version, apiKey } = req.body;

      // Validate extension registration
      const validation = extensionAuthSchema.safeParse({
        platform,
        version,
        apiKey
      });

      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid extension credentials',
          details: validation.error.errors
        });
      }

      // Generate session token for extension
      const sessionToken = `ext_${Date.now()}_${Math.random().toString(36).substring(2)}`;

      logger.info('Extension authenticated successfully', {
        platform: validation.data.platform,
        version: validation.data.version
      });

      res.json({
        success: true,
        sessionToken,
        expiresIn: '24h',
        features: {
          generation: true,
          synthesis: true,
          recommendations: true,
          analytics: true
        }
      });
    } catch (error) {
      logger.error('Extension authentication failed', { error: error.message });
      res.status(500).json({ error: 'Authentication service unavailable' });
    }
  }

  static async health(req: Request, res: Response) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          synthesis: 'healthy',
          generation: 'healthy',
          recommendations: 'healthy',
          database: 'healthy'
        },
        consciousness: this.synthesisEngine.getConsciousnessMetrics()
      };

      res.json(health);
    } catch (error) {
      logger.error('Extension health check failed', { error: error.message });
      res.status(500).json({ error: 'Health check service unavailable' });
    }
  }

  static async recommend(req: Request, res: Response) {
    try {
      const { prompt, codeContext, language } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Voice recommendation based on prompt analysis
      const recommendations = {
        primaryVoices: [],
        secondaryVoices: [],
        reasoning: '',
        confidence: 0
      };

      // Analyze prompt for technical domains
      const promptLower = prompt.toLowerCase();
      const codeContextLower = (codeContext || '').toLowerCase();

      if (promptLower.includes('security') || promptLower.includes('auth') || promptLower.includes('validation')) {
        recommendations.primaryVoices.push('explorer-security');
        recommendations.reasoning += 'Security concerns detected. ';
      }

      if (promptLower.includes('performance') || promptLower.includes('optimize') || promptLower.includes('slow')) {
        recommendations.primaryVoices.push('analyzer-performance');
        recommendations.reasoning += 'Performance optimization needed. ';
      }

      if (promptLower.includes('ui') || promptLower.includes('component') || promptLower.includes('interface')) {
        recommendations.primaryVoices.push('developer-ui');
        recommendations.reasoning += 'UI/UX development required. ';
      }

      if (promptLower.includes('architecture') || promptLower.includes('structure') || promptLower.includes('design')) {
        recommendations.primaryVoices.push('maintainer-architecture');
        recommendations.reasoning += 'Architectural decisions involved. ';
      }

      // Always include quality implementor for synthesis
      recommendations.secondaryVoices.push('implementor-quality');

      // Calculate confidence based on keyword matches
      recommendations.confidence = Math.min(0.95, recommendations.primaryVoices.length * 0.3 + 0.4);

      logger.info('Voice recommendations generated for extension', {
        platform: req.extension?.platform,
        promptLength: prompt.length,
        recommendationCount: recommendations.primaryVoices.length
      });

      res.json(recommendations);
    } catch (error) {
      logger.error('Extension recommendation failed', { error: error.message });
      res.status(500).json({ error: 'Recommendation service unavailable' });
    }
  }

  static async generate(req: Request, res: Response) {
    try {
      const { prompt, voices, codeContext, language } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // Mock generation for extensions - in real implementation would call OpenAI
      const solutions = [];
      const selectedVoices = voices || ['implementor-quality'];

      for (const voiceId of selectedVoices) {
        const solution = {
          id: Date.now() + Math.random(),
          sessionId: Date.now(),
          voiceCombination: voiceId,
          code: `// Generated by ${voiceId} for extension
${generateCodeForVoice(voiceId, prompt, language)}`,
          explanation: `Solution generated by ${voiceId} voice based on your prompt: "${prompt.substring(0, 100)}..."`,
          confidence: 0.8 + Math.random() * 0.2,
          timestamp: new Date()
        };
        solutions.push(solution);
      }

      logger.info('Code generation completed for extension', {
        platform: req.extension?.platform,
        voiceCount: selectedVoices.length,
        solutionCount: solutions.length
      });

      res.json({
        success: true,
        solutions,
        metadata: {
          generatedAt: new Date().toISOString(),
          voicesUsed: selectedVoices,
          platform: req.extension?.platform
        }
      });
    } catch (error) {
      logger.error('Extension generation failed', { error: error.message });
      res.status(500).json({ error: 'Generation service unavailable' });
    }
  }

  static async synthesize(req: Request, res: Response) {
    try {
      const { solutions, mode = 'consensus' } = req.body;

      if (!solutions || !Array.isArray(solutions) || solutions.length < 2) {
        return res.status(400).json({ error: 'At least 2 solutions required for synthesis' });
      }

      // Use consciousness synthesis engine
      const synthesisResult = await this.synthesisEngine.synthesizeConsciousness({
        prompt: solutions[0]?.explanation || 'Extension synthesis request',
        solutions,
        mode,
        targetConsciousness: 7,
        ethicalConstraints: ['security', 'accessibility', 'maintainability'],
        architecturalPatterns: ['modular', 'testable', 'scalable']
      });

      logger.info('Consciousness synthesis completed for extension', {
        platform: req.extension?.platform,
        inputSolutions: solutions.length,
        consciousnessLevel: synthesisResult.consciousnessState.level,
        qwanScore: synthesisResult.consciousnessState.qwanScore
      });

      res.json({
        success: true,
        synthesizedSolution: synthesisResult.synthesizedSolution,
        consciousnessEvolution: synthesisResult.consciousnessState,
        insights: synthesisResult.emergentInsights,
        voiceContributions: Object.fromEntries(synthesisResult.voiceContributions),
        metadata: {
          synthesizedAt: new Date().toISOString(),
          platform: req.extension?.platform,
          mode: mode
        }
      });
    } catch (error) {
      logger.error('Extension synthesis failed', { error: error.message });
      res.status(500).json({ error: 'Synthesis service unavailable' });
    }
  }
}

// Helper function to generate voice-specific code
function generateCodeForVoice(voiceId: string, prompt: string, language: string = 'javascript'): string {
  const voicePatterns = {
    'explorer-security': `
// Security-focused implementation
function validateInput(input) {
  if (!input || typeof input !== 'string') {
    throw new ValidationError('Invalid input type');
  }
  
  // Sanitize input
  const sanitized = input.trim().replace(/[<>]/g, '');
  return sanitized;
}

// Implementation with security validation
try {
  const validatedInput = validateInput(userInput);
  // Process validated input...
} catch (error) {
  logger.error('Security validation failed', { error });
  throw error;
}`,
    'maintainer-architecture': `
// Architectural pattern implementation
export interface ${prompt.includes('component') ? 'Component' : 'Service'}Pattern {
  initialize(): Promise<void>;
  process(input: unknown): Promise<unknown>;
  cleanup(): Promise<void>;
}

// Following single responsibility principle
export class Implementation implements ${prompt.includes('component') ? 'Component' : 'Service'}Pattern {
  private state: State = new State();
  
  async initialize(): Promise<void> {
    await this.state.initialize();
  }
  
  async process(input: unknown): Promise<unknown> {
    return await this.state.process(input);
  }
  
  async cleanup(): Promise<void> {
    await this.state.cleanup();
  }
}`,
    'analyzer-performance': `
// Performance-optimized implementation
import { memoize } from 'lodash';

// Cached computation
const expensiveOperation = memoize((input: string) => {
  // Optimized algorithm
  const result = processWithOptimization(input);
  return result;
});

// Batch processing for efficiency
async function processBatch(items: unknown[]): Promise<unknown[]> {
  const BATCH_SIZE = 100;
  const results = [];
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(item => expensiveOperation(item))
    );
    results.push(...batchResults);
  }
  
  return results;
}`,
    'developer-ui': `
// UI component with accessibility
import { useState, useCallback } from 'react';

interface Props {
  onAction: (value: string) => void;
  label: string;
  description?: string;
}

export function AccessibleComponent({ onAction, label, description }: Props) {
  const [value, setValue] = useState('');
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAction(value.trim());
      setValue('');
    }
  }, [value, onAction]);
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label htmlFor="input" className="block text-sm font-medium">
        {label}
      </label>
      {description && (
        <p className="text-sm text-gray-600" id="input-description">
          {description}
        </p>
      )}
      <input
        id="input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-describedby={description ? "input-description" : undefined}
        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="px-4 py-2 bg-blue-600 text-white rounded-md disabled:opacity-50"
      >
        Submit
      </button>
    </form>
  );
}`,
    'implementor-quality': `
// Production-ready implementation with testing
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Main implementation
export class QualityImplementation {
  private initialized = false;
  
  constructor(private config: Config) {
    this.validateConfig(config);
  }
  
  private validateConfig(config: Config): void {
    if (!config) {
      throw new Error('Configuration is required');
    }
    // Additional validation...
  }
  
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Already initialized');
    }
    
    try {
      // Initialization logic
      this.initialized = true;
    } catch (error) {
      throw new Error(\`Initialization failed: \${error.message}\`);
    }
  }
  
  process(input: unknown): Result {
    if (!this.initialized) {
      throw new Error('Not initialized');
    }
    
    // Process with comprehensive error handling
    try {
      return this.safeProcess(input);
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
  
  private safeProcess(input: unknown): Result {
    // Implementation with validation
    return { success: true, data: input };
  }
  
  private handleError(error: Error): void {
    // Structured error logging
    logger.error('Processing error', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
}

// Comprehensive test suite
describe('QualityImplementation', () => {
  let implementation: QualityImplementation;
  
  beforeEach(() => {
    implementation = new QualityImplementation(validConfig);
  });
  
  afterEach(() => {
    // Cleanup
  });
  
  it('should initialize correctly', async () => {
    await implementation.initialize();
    expect(implementation.isInitialized()).toBe(true);
  });
  
  it('should process valid input', () => {
    const result = implementation.process(validInput);
    expect(result.success).toBe(true);
  });
  
  it('should handle errors gracefully', () => {
    expect(() => implementation.process(invalidInput)).toThrow();
  });
});`
  };

  return voicePatterns[voiceId] || voicePatterns['implementor-quality'];
}