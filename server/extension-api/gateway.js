// Extension API Gateway - Platform-agnostic API layer
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

const { z } = require('zod');
const rateLimit = require('express-rate-limit');

// Extension authentication schema
const extensionAuthSchema = z.object({
  platform: z.enum(['vscode', 'jetbrains', 'github', 'vim', 'emacs']),
  version: z.string().min(1),
  userId: z.string().min(1),
  clientId: z.string().min(1)
});

// Generation request schema for extensions
const extensionGenerationSchema = z.object({
  prompt: z.string().min(1).max(15000),
  context: z.object({
    language: z.string().optional(),
    filePath: z.string().optional(),
    projectType: z.string().optional(),
    dependencies: z.array(z.string()).optional(),
    surroundingCode: z.string().optional()
  }).optional(),
  voices: z.object({
    perspectives: z.array(z.string()),
    roles: z.array(z.string())
  }),
  synthesisMode: z.enum(['consensus', 'competitive', 'collaborative']).optional(),
  maxSolutions: z.number().min(1).max(6).optional()
});

// Synthesis request schema for extensions
const extensionSynthesisSchema = z.object({
  solutions: z.array(z.object({
    code: z.string(),
    explanation: z.string(),
    voiceType: z.string(),
    confidence: z.number().min(0).max(1)
  })),
  synthesisGoal: z.enum(['best_practices', 'performance', 'readability', 'maintainability'])
});

// Rate limiting for extensions
const extensionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each extension to 100 requests per windowMs
  message: {
    error: 'Too many requests from this extension, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Extension authentication middleware
async function authenticateExtension(req, res, next) {
  try {
    const apiKey = req.headers['x-codecrucible-api-key'];
    
    if (!apiKey) {
      return res.status(401).json({
        error: 'API key required',
        message: 'Please provide x-codecrucible-api-key header'
      });
    }

    // In production, this would validate against database
    // For now, we'll create a mock extension object
    req.extension = {
      id: `ext-${Date.now()}`,
      platform: req.headers['user-agent']?.includes('VSCode') ? 'vscode' : 'unknown',
      apiKey: apiKey,
      userId: 'extension-user',
      authenticated: true
    };

    next();
  } catch (error) {
    console.error('Extension authentication error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid API key'
    });
  }
}

// Extension API Gateway class
class ExtensionApiGateway {
  
  static async authenticate(req, res) {
    try {
      console.log('🔐 Extension authentication request:', {
        platform: req.body.platform,
        userId: req.body.userId?.substring(0, 8) + '...'
      });

      const validatedData = extensionAuthSchema.parse(req.body);
      
      // Generate API key for the extension
      const apiKey = `xt-${Date.now()}-${Math.random().toString(36).substr(2, 12)}`;
      
      // Available features for extensions
      const features = {
        generation: true,
        synthesis: true,
        recommendations: true,
        analytics: true
      };

      res.json({
        success: true,
        apiKey,
        features,
        platform: validatedData.platform,
        expiresIn: '30 days'
      });

      console.log('✅ Extension authenticated successfully:', {
        platform: validatedData.platform,
        apiKey: apiKey.substring(0, 12) + '...'
      });

    } catch (error) {
      console.error('Extension authentication failed:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request data',
          details: error.errors
        });
      }
      
      res.status(500).json({
        error: 'Authentication service unavailable',
        message: 'Please try again later'
      });
    }
  }

  static async generate(req, res) {
    try {
      console.log('🧠 Extension generation request:', {
        platform: req.extension.platform,
        promptLength: req.body.prompt?.length,
        voices: req.body.voices
      });

      const validatedData = extensionGenerationSchema.parse(req.body);
      
      // Import the real OpenAI service
      const { realOpenAIService } = await import('../services/openai-service.js');
      
      // Create mock session for extension use
      const sessionId = Date.now();
      
      // Generate solutions using real OpenAI service
      const solutions = await realOpenAIService.generateSolutions(
        validatedData.prompt,
        validatedData.voices.perspectives || [],
        validatedData.voices.roles || [],
        validatedData.context
      );

      const response = {
        sessionId,
        solutions,
        synthesisAvailable: solutions.length >= 2,
        timestamp: new Date().toISOString()
      };

      res.json(response);

      console.log('✅ Extension generation completed:', {
        sessionId,
        solutionCount: solutions.length
      });

    } catch (error) {
      console.error('Extension generation failed:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid generation request',
          details: error.errors
        });
      }
      
      res.status(500).json({
        error: 'Generation service unavailable',
        message: 'Please try again later'
      });
    }
  }

  static async synthesize(req, res) {
    try {
      console.log('🔗 Extension synthesis request:', {
        platform: req.extension.platform,
        solutionCount: req.body.solutions?.length,
        goal: req.body.synthesisGoal
      });

      const validatedData = extensionSynthesisSchema.parse(req.body);
      
      // Import the real OpenAI service
      const { realOpenAIService } = await import('../services/openai-service.js');
      
      // Perform synthesis using real OpenAI service
      const synthesis = await realOpenAIService.synthesizeSolutions(
        validatedData.solutions,
        validatedData.synthesisGoal
      );

      const response = {
        synthesizedCode: synthesis.code,
        explanation: synthesis.explanation,
        qualityScore: Math.round(synthesis.confidence * 100),
        improvementSuggestions: synthesis.suggestions || [],
        metadata: {
          synthesisGoal: validatedData.synthesisGoal,
          originalSolutionCount: validatedData.solutions.length,
          timestamp: new Date().toISOString()
        }
      };

      res.json(response);

      console.log('✅ Extension synthesis completed:', {
        qualityScore: response.qualityScore,
        suggestionsCount: response.improvementSuggestions.length
      });

    } catch (error) {
      console.error('Extension synthesis failed:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid synthesis request',
          details: error.errors
        });
      }
      
      res.status(500).json({
        error: 'Synthesis service unavailable',
        message: 'Please try again later'
      });
    }
  }

  static async recommend(req, res) {
    try {
      console.log('💡 Extension recommendation request:', {
        platform: req.extension.platform,
        promptLength: req.body.prompt?.length
      });

      const { prompt, context } = req.body;
      
      if (!prompt || prompt.length < 10) {
        return res.status(400).json({
          error: 'Invalid prompt',
          message: 'Prompt must be at least 10 characters long'
        });
      }

      // Generate voice recommendations based on prompt analysis
      const recommendations = await this.generateVoiceRecommendations(prompt, context);

      res.json({
        recommendations,
        metadata: {
          promptAnalysis: this.analyzePrompt(prompt),
          contextType: context?.projectType || 'unknown',
          timestamp: new Date().toISOString()
        }
      });

      console.log('✅ Extension recommendations generated:', {
        count: recommendations.length
      });

    } catch (error) {
      console.error('Extension recommendations failed:', error);
      
      res.status(500).json({
        error: 'Recommendation service unavailable',
        message: 'Please try again later'
      });
    }
  }

  static async health(req, res) {
    try {
      const health = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        platform: req.extension.platform,
        features: {
          generation: true,
          synthesis: true,
          recommendations: true,
          analytics: true
        }
      };

      res.json(health);

    } catch (error) {
      console.error('Extension health check failed:', error);
      
      res.status(500).json({
        status: 'unhealthy',
        error: 'Health check failed'
      });
    }
  }

  static async generateVoiceRecommendations(prompt, context) {
    const promptLower = prompt.toLowerCase();
    const recommendations = [];

    // Analyze prompt for technical domains
    const domainPatterns = {
      security: ['security', 'auth', 'login', 'encrypt', 'validate', 'sanitize'],
      performance: ['performance', 'optimize', 'speed', 'memory', 'cache', 'efficient'],
      ui: ['ui', 'interface', 'design', 'responsive', 'component', 'styling'],
      architecture: ['architecture', 'pattern', 'design', 'structure', 'organize'],
      testing: ['test', 'unit', 'integration', 'mock', 'spec', 'coverage']
    };

    // Domain-specific voice recommendations
    for (const [domain, keywords] of Object.entries(domainPatterns)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        const voiceMap = {
          security: {
            voiceType: 'Analyzer + Security Engineer',
            confidence: 90,
            reasoning: 'Security-focused analysis requires thorough examination and specialized security expertise'
          },
          performance: {
            voiceType: 'Implementor + Performance Engineer',
            confidence: 88,
            reasoning: 'Performance optimization needs practical implementation skills and performance expertise'
          },
          ui: {
            voiceType: 'Developer + UI/UX Engineer',
            confidence: 85,
            reasoning: 'UI development combines creative development with user experience design'
          },
          architecture: {
            voiceType: 'Maintainer + Systems Architect',
            confidence: 92,
            reasoning: 'Architectural decisions require long-term thinking and systems design expertise'
          },
          testing: {
            voiceType: 'Analyzer + Security Engineer',
            confidence: 80,
            reasoning: 'Testing requires analytical thinking and quality assurance mindset'
          }
        };

        if (voiceMap[domain]) {
          recommendations.push(voiceMap[domain]);
        }
      }
    }

    // Add general recommendations if no specific domain detected
    if (recommendations.length === 0) {
      recommendations.push(
        {
          voiceType: 'Explorer + Systems Architect',
          confidence: 75,
          reasoning: 'Balanced approach combining exploration and architectural thinking'
        },
        {
          voiceType: 'Developer + Performance Engineer',
          confidence: 70,
          reasoning: 'Practical development with performance considerations'
        }
      );
    }

    return recommendations.slice(0, 3); // Return top 3 recommendations
  }

  static analyzePrompt(prompt) {
    return {
      length: prompt.length,
      complexity: prompt.split(' ').length > 20 ? 'high' : 'medium',
      hasCodeKeywords: /\b(function|class|component|api|database)\b/i.test(prompt),
      language: this.detectLanguageFromPrompt(prompt)
    };
  }

  static detectLanguageFromPrompt(prompt) {
    const languageKeywords = {
      javascript: ['javascript', 'js', 'node', 'react', 'vue', 'angular'],
      typescript: ['typescript', 'ts', 'interface', 'type'],
      python: ['python', 'django', 'flask', 'pandas'],
      java: ['java', 'spring', 'maven', 'gradle'],
      go: ['go', 'golang', 'goroutine'],
      rust: ['rust', 'cargo', 'trait'],
      php: ['php', 'laravel', 'symfony'],
      ruby: ['ruby', 'rails', 'gem']
    };

    const promptLower = prompt.toLowerCase();
    for (const [lang, keywords] of Object.entries(languageKeywords)) {
      if (keywords.some(keyword => promptLower.includes(keyword))) {
        return lang;
      }
    }

    return 'unknown';
  }
}

export {
  ExtensionApiGateway,
  authenticateExtension,
  extensionRateLimit
};