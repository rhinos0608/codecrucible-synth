/**
 * Natural Language Processor - Modularized NLP Capabilities
 *
 * Extracted from UnifiedCLICoordinator to handle natural language understanding:
 * - Command intent detection and analysis
 * - Request complexity determination
 * - Simple question identification
 * - Code generation request detection
 * - Natural language to operation type mapping
 *
 * This module encapsulates all natural language processing logic for CLI commands.
 */

import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ParsedCommand {
  intent: string;
  confidence: number;
  operationType?: 'analyze' | 'diagnose' | 'prompt' | 'execute' | 'navigate' | 'suggest';
  parameters?: Record<string, unknown>;
  isCodeGeneration?: boolean;
  complexity?: 'simple' | 'medium' | 'complex';
}

export interface NLPOptions {
  enableDeepAnalysis?: boolean;
  confidenceThreshold?: number;
  complexityAnalysis?: boolean;
}

/**
 * Natural Language Processor for CLI commands
 */
export class NaturalLanguageProcessor {
  private readonly options: Required<NLPOptions>;

  public constructor(options: Readonly<NLPOptions> = {}) {
    this.options = {
      enableDeepAnalysis: options.enableDeepAnalysis ?? true,
      confidenceThreshold: options.confidenceThreshold ?? 0.7,
      complexityAnalysis: options.complexityAnalysis ?? true,
    };
  }

  /**
   * Parse and analyze a natural language command
   */
  public parseCommand(input: string): ParsedCommand {
    if (!input || typeof input !== 'string') {
      return {
        intent: 'unknown',
        confidence: 0,
        complexity: 'simple',
      };
    }

    const trimmed = input.trim().toLowerCase();

    // Extract basic intent
    const intent = this.extractIntent(trimmed);
    const confidence = this.calculateConfidence(trimmed, intent);

    // Determine complexity if enabled
    const complexity = this.options.complexityAnalysis ? this.determineComplexity(input) : 'medium';

    // Check for special request types
    const isCodeGeneration = this.isCodeGenerationRequest(input);

    // Map intent to operation type
    const operationType = this.mapIntentToOperationType(intent, confidence);

    const result: ParsedCommand = {
      intent,
      confidence,
      operationType,
      isCodeGeneration,
      complexity,
    };

    // Log analysis for debugging
    if (confidence > this.options.confidenceThreshold) {
      logger.info(
        `🎯 NLP Analysis: Intent="${intent}" (${(confidence * 100).toFixed(0)}% confidence), ` +
          `Type=${operationType}, CodeGen=${isCodeGeneration}, ` +
          `Complexity=${complexity}`
      );
    }

    return result;
  }

  /**
   * Extract primary intent from natural language input
   */
  private extractIntent(input: string): string {
    const intentPatterns = {
      analyze: [
        'analyze',
        'review',
        'examine',
        'inspect',
        'check',
        'look at',
        'understand',
        'what does',
        'explain',
        'show me',
        'tell me about',
      ],
      diagnose: [
        'diagnose',
        'debug',
        'fix',
        'solve',
        'resolve',
        'troubleshoot',
        "what's wrong",
        'why is',
        'error',
        'issue',
        'problem',
        'broken',
      ],
      generate: [
        'create',
        'generate',
        'write',
        'build',
        'implement',
        'make',
        'add',
        'new',
        'develop',
      ],
      refactor: [
        'refactor',
        'optimize',
        'improve',
        'restructure',
        'reorganize',
        'clean up',
        'simplify',
      ],
      test: ['test', 'testing', 'verify', 'validate', 'check if', 'ensure'],
      document: ['document', 'documentation', 'readme', 'comments', 'explain'],
      help: ['help', 'how', 'what', 'when', 'where', 'why', 'guide', 'tutorial'],
      chat: ['chat', 'talk', 'discuss', 'conversation'],
    };

    // Find the intent with the highest match score
    let bestIntent = 'help';
    let bestScore = 0;

    for (const [intent, patterns] of Object.entries(intentPatterns)) {
      const score = patterns.reduce((sum, pattern) => {
        return sum + (input.includes(pattern) ? 1 : 0);
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return bestIntent;
  }

  /**
   * Calculate confidence score for the extracted intent
   */
  private calculateConfidence(input: string, intent: string): number {
    let confidence = 0.5; // Base confidence

    // Increase confidence for specific patterns
    const specificPatterns = {
      analyze: /\b(analyze|review|examine)\s+/i,
      generate: /\b(create|generate|write)\s+(a\s+)?(new\s+)?/i,
      diagnose: /\b(debug|fix|solve|diagnose)\s+/i,
      help: /\b(help|how\s+do\s+i|what\s+is)\b/i,
    };

    if (specificPatterns[intent as keyof typeof specificPatterns].test(input)) {
      confidence += 0.3;
    }

    // Increase confidence for longer, more specific inputs
    if (input.length > 20) confidence += 0.1;
    if (input.length > 50) confidence += 0.1;

    // Decrease confidence for very short or ambiguous inputs
    if (input.length < 10) confidence -= 0.2;

    // Ensure confidence is within bounds
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Determine request complexity based on input analysis
   */
  private determineComplexity(input: string): 'simple' | 'medium' | 'complex' {
    if (!input) return 'simple';

    const complexityIndicators = {
      simple: ['help', 'status', 'version', 'list', 'show', 'what', 'how'],
      medium: ['analyze', 'generate', 'create', 'fix', 'refactor', 'test'],
      complex: [
        'implement',
        'architecture',
        'design',
        'optimize',
        'comprehensive',
        'integration',
        'system',
        'framework',
        'scalable',
        'production',
      ],
    };

    const lowerInput = input.toLowerCase();

    // Check for complex indicators first
    if (complexityIndicators.complex.some(keyword => lowerInput.includes(keyword))) {
      return 'complex';
    }

    // Check for medium complexity
    if (complexityIndicators.medium.some(keyword => lowerInput.includes(keyword))) {
      return 'medium';
    }

    // Consider length as complexity factor
    if (input.length > 200) return 'complex';
    if (input.length > 50) return 'medium';

    return 'simple';
  }

  /**
   * Check if a prompt is requesting code generation
   */
  private isCodeGenerationRequest(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    // EXCLUDE: Help/advice/explanation questions should NEVER generate code files
    const helpPatterns = [
      'how do i',
      'how to',
      'help me',
      'explain',
      'what is',
      'what are',
      'why',
      'when',
      'where',
      'fix',
      'debug',
      'solve',
      'resolve',
      'error',
      'issue',
      'problem',
      'trouble',
      'advice',
      'suggest',
      'recommend',
      'best practice',
      'should i',
      'can you',
      'could you',
    ];

    // If it's a help/advice question, definitely not code generation
    if (helpPatterns.some(pattern => lowerPrompt.includes(pattern))) {
      return false;
    }

    // INCLUDE: Only explicit code creation requests with strong intent
    const strongGenerationKeywords = [
      'create a',
      'generate a',
      'write a',
      'build a',
      'implement a',
      'create class',
      'create function',
      'create component',
      'create module',
      'generate code',
      'write code',
      'build app',
      'implement feature',
    ];

    // Check for strong generation patterns first
    if (strongGenerationKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return true;
    }

    // Weaker keywords only if they appear with creation context
    const weakKeywords = ['function', 'class', 'component', 'module', 'interface'];
    const creationContext = ['new', 'create', 'make', 'add', 'build'];

    return weakKeywords.some(
      keyword =>
        lowerPrompt.includes(keyword) &&
        creationContext.some(context => lowerPrompt.includes(context))
    );
  }

  /**
   * Map natural language intent to CLI operation type
   */
  private mapIntentToOperationType(
    intent: string,
    confidence: number
  ): 'analyze' | 'diagnose' | 'prompt' | 'execute' | 'navigate' | 'suggest' {
    // Only map with high confidence
    if (confidence < this.options.confidenceThreshold) {
      return 'prompt'; // Default fallback
    }

    const intentToOperationMap: Record<
      string,
      'analyze' | 'diagnose' | 'prompt' | 'execute' | 'navigate' | 'suggest'
    > = {
      analyze: 'analyze',
      diagnose: 'diagnose',
      review: 'analyze',
      explain: 'analyze', // Explanation should be analysis, not code generation
      generate: 'prompt', // Code generation goes through prompt system
      create: 'prompt',
      write: 'prompt',
      build: 'prompt',
      implement: 'prompt',
      fix: 'prompt',
      refactor: 'prompt',
      optimize: 'prompt',
      test: 'prompt',
      document: 'prompt',
      help: 'suggest',
      chat: 'prompt',
    };

    return intentToOperationMap[intent];
  }

  /**
   * Extract parameters from natural language input
   */
  public extractParameters(input: string): Record<string, unknown> {
    const parameters: Record<string, unknown> = {};

    // Extract file paths
    const filePathMatch = input.match(
      /([./\w-]+\.(ts|js|tsx|jsx|py|java|cpp|c|h|md|json|yaml|yml|txt))/i
    );
    if (filePathMatch) {
      const [, filePath] = filePathMatch;
      parameters.filePath = filePath;
    }

    // Extract directory references
    const dirMatch = input.match(/(src\/\w+|\.\/\w+|\/\w+)/i);
    if (dirMatch) {
      const [, directory] = dirMatch;
      parameters.directory = directory;
    }

    // Extract language hints
    const languageMatch = input.match(
      /\b(typescript|javascript|python|java|cpp?|rust|go|swift|kotlin)\b/i
    );
    if (languageMatch) {
      parameters.language = languageMatch[1].toLowerCase();
    }

    // Extract framework hints
    const frameworkMatch = input.match(/\b(react|vue|angular|express|fastapi|spring|django)\b/i);
    if (frameworkMatch) {
      parameters.framework = frameworkMatch[1].toLowerCase();
    }

    return parameters;
  }

  /**
   * Get processing statistics
   */
  public getStats(): {
    totalProcessed: number;
    averageConfidence: number;
    intentDistribution: Record<string, number>;
  } {
    // This would be implemented with actual usage tracking
    return {
      totalProcessed: 0,
      averageConfidence: 0,
      intentDistribution: {},
    };
  }
}

// Create a default instance for convenience
export const naturalLanguageProcessor = new NaturalLanguageProcessor();

export default NaturalLanguageProcessor;

