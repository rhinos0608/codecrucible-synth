/**
 * Natural Language Command Interface
 * 
 * Implements industry-standard patterns from leading AI CLI tools:
 * - Qwen CLI: Natural language parsing with intent recognition
 * - Gemini CLI: Smart command routing based on user intent  
 * - Claude Code: Context-aware command interpretation
 * 
 * Eliminates the need for users to learn complex command syntax.
 * Users can speak naturally: "analyze this code", "create a component", etc.
 */

import { logger } from '../../infrastructure/logging/unified-logger.js';

export type CommandIntent = 
  | 'analyze' 
  | 'generate' 
  | 'refactor' 
  | 'fix' 
  | 'explain' 
  | 'optimize' 
  | 'test' 
  | 'document' 
  | 'help'
  | 'chat'
  | 'unknown';

export interface ParsedCommand {
  intent: CommandIntent;
  confidence: number; // 0-1
  target?: string; // What to operate on (file, component, function)
  action?: string; // Specific action within intent
  modifiers?: string[]; // Additional context (verbose, quick, etc.)
  originalInput: string;
  enhancedQuery: string; // Cleaned and enhanced version for AI
}

export interface CommandPattern {
  intent: CommandIntent;
  keywords: string[];
  patterns: RegExp[];
  examples: string[];
  weight: number; // For prioritizing when multiple intents match
}

/**
 * Natural Language Command Interface for AI CLI
 */
export class NaturalLanguageInterface {
  private commandPatterns: CommandPattern[];

  constructor() {
    this.commandPatterns = this.initializeCommandPatterns();
  }

  /**
   * Parse natural language input into structured command
   */
  parseCommand(input: string): ParsedCommand {
    const normalizedInput = input.toLowerCase().trim();
    
    // Handle empty input
    if (!normalizedInput) {
      return {
        intent: 'help',
        confidence: 1.0,
        originalInput: input,
        enhancedQuery: 'help'
      };
    }

    // Score each intent pattern
    const intentScores = this.calculateIntentScores(normalizedInput);
    
    // Find best matching intent
    const bestMatch = intentScores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Extract additional details
    const target = this.extractTarget(normalizedInput);
    const action = this.extractAction(normalizedInput, bestMatch.intent);
    const modifiers = this.extractModifiers(normalizedInput);

    // Build enhanced query for AI processing
    const enhancedQuery = this.buildEnhancedQuery(input, bestMatch.intent, target, action);

    logger.info(`💬 Parsed command: "${input}" → ${bestMatch.intent} (${(bestMatch.score * 100).toFixed(0)}% confidence)`);

    return {
      intent: bestMatch.intent,
      confidence: bestMatch.score,
      target,
      action,
      modifiers,
      originalInput: input,
      enhancedQuery
    };
  }

  /**
   * Initialize command patterns for intent recognition
   */
  private initializeCommandPatterns(): CommandPattern[] {
    return [
      {
        intent: 'analyze',
        keywords: ['analyze', 'review', 'audit', 'check', 'examine', 'inspect', 'look at', 'study'],
        patterns: [
          /analyze\s+(?:this|the|my)?\s*(.*)/i,
          /review\s+(?:this|the|my)?\s*(.*)/i,
          /audit\s+(?:this|the|my)?\s*(.*)/i,
          /(?:what|how)\s+(?:does|is)\s+(?:this|the)\s+(.*?)(?:\s+(?:work|do))?/i
        ],
        examples: [
          'analyze this code',
          'review my component',
          'audit the security',
          'examine this function'
        ],
        weight: 0.9
      },
      {
        intent: 'generate',
        keywords: ['create', 'generate', 'build', 'make', 'write', 'implement', 'add', 'new'],
        patterns: [
          /(?:create|generate|build|make|write)\s+(?:a|an|some)?\s*(.*)/i,
          /implement\s+(?:a|an)?\s*(.*)/i,
          /(?:add|new)\s+(?:a|an)?\s*(.*)/i,
          /i\s+(?:want|need)\s+(?:a|an|to\s+create)?\s*(.*)/i
        ],
        examples: [
          'create a react component',
          'generate tests',
          'build a function',
          'implement authentication'
        ],
        weight: 0.9
      },
      {
        intent: 'refactor',
        keywords: ['refactor', 'restructure', 'reorganize', 'improve', 'clean', 'optimize structure'],
        patterns: [
          /refactor\s+(?:this|the|my)?\s*(.*)/i,
          /(?:restructure|reorganize)\s+(?:this|the)?\s*(.*)/i,
          /clean\s+up\s+(?:this|the)?\s*(.*)/i,
          /improve\s+(?:this|the)?\s*(.*)(?:\s+structure|\s+organization)/i
        ],
        examples: [
          'refactor this component',
          'restructure the code',
          'clean up this function',
          'improve the architecture'
        ],
        weight: 0.8
      },
      {
        intent: 'fix',
        keywords: ['fix', 'debug', 'solve', 'repair', 'correct', 'resolve', 'bug', 'error', 'issue'],
        patterns: [
          /(?:fix|debug|solve|repair)\s+(?:this|the|my)?\s*(.*)/i,
          /(?:correct|resolve)\s+(?:this|the)?\s*(.*)/i,
          /(?:there\'s\s+a\s+|i\s+have\s+a\s+)?(?:bug|error|issue)\s+(?:in|with)\s+(.*)/i,
          /(?:this|it)\s+(?:doesn\'t|isn\'t|won\'t)\s+work/i
        ],
        examples: [
          'fix this bug',
          'debug the error',
          'solve this issue',
          'there\'s a bug in this code'
        ],
        weight: 0.9
      },
      {
        intent: 'explain',
        keywords: ['explain', 'describe', 'what', 'how', 'why', 'tell me', 'show me'],
        patterns: [
          /(?:explain|describe)\s+(?:how|what|why)?\s*(.*)/i,
          /(?:what|how|why)\s+(?:does|is)\s+(.*?)(?:\s+(?:work|do|mean))?/i,
          /(?:tell|show)\s+me\s+(?:about|how|what)\s+(.*)/i,
          /i\s+(?:don\'t\s+understand|need\s+to\s+understand)\s+(.*)/i
        ],
        examples: [
          'explain how this works',
          'what does this function do',
          'describe this pattern',
          'tell me about this code'
        ],
        weight: 0.8
      },
      {
        intent: 'optimize',
        keywords: ['optimize', 'improve performance', 'speed up', 'make faster', 'efficiency'],
        patterns: [
          /optimize\s+(?:this|the)?\s*(.*)/i,
          /(?:improve\s+performance|speed\s+up|make\s+faster)\s+(?:of\s+)?(?:this|the)?\s*(.*)/i,
          /make\s+(?:this|it)\s+more\s+efficient/i
        ],
        examples: [
          'optimize this code',
          'improve performance of this function',
          'make this faster',
          'speed up the algorithm'
        ],
        weight: 0.7
      },
      {
        intent: 'test',
        keywords: ['test', 'unit test', 'integration test', 'coverage', 'spec'],
        patterns: [
          /(?:test|unit\s+test|write\s+tests\s+for)\s+(?:this|the)?\s*(.*)/i,
          /(?:create|generate|write)\s+(?:unit\s+|integration\s+)?tests?\s+for\s+(.*)/i,
          /(?:check|verify)\s+(?:test\s+)?coverage\s+for\s+(.*)/i
        ],
        examples: [
          'test this function',
          'write unit tests',
          'create tests for this component',
          'check test coverage'
        ],
        weight: 0.8
      },
      {
        intent: 'document',
        keywords: ['document', 'docs', 'documentation', 'comments', 'readme'],
        patterns: [
          /(?:document|add\s+docs\s+to|write\s+documentation\s+for)\s+(.*)/i,
          /(?:add|write|create)\s+(?:comments|documentation)\s+(?:for|to)\s+(.*)/i,
          /(?:create|update|write)\s+(?:a\s+)?readme\s+for\s+(.*)/i
        ],
        examples: [
          'document this function',
          'add comments to this code',
          'write documentation',
          'create a readme'
        ],
        weight: 0.7
      },
      {
        intent: 'help',
        keywords: ['help', 'usage', 'how to', 'guide', 'tutorial', 'commands'],
        patterns: [
          /^(?:help|h|\?)$/i,
          /(?:how\s+do\s+i|how\s+to|show\s+me\s+how)\s+(.*)/i,
          /(?:usage|commands|what\s+can\s+you\s+do)/i
        ],
        examples: [
          'help',
          'how do I use this',
          'show me the commands',
          'what can you do'
        ],
        weight: 0.6
      },
      {
        intent: 'chat',
        keywords: ['hello', 'hi', 'thanks', 'thank you', 'goodbye', 'bye'],
        patterns: [
          /^(?:hello|hi|hey|good\s+(?:morning|afternoon|evening))(?:\s+there)?!?$/i,
          /^(?:thanks?|thank\s+you|ty)(?:\s+(?:very\s+)?much)?!?$/i,
          /^(?:goodbye|bye|see\s+you|ttyl)!?$/i
        ],
        examples: [
          'hello',
          'thank you',
          'goodbye'
        ],
        weight: 0.5
      }
    ];
  }

  /**
   * Calculate confidence scores for each intent
   */
  private calculateIntentScores(input: string): Array<{intent: CommandIntent, score: number}> {
    const scores: Array<{intent: CommandIntent, score: number}> = [];

    for (const pattern of this.commandPatterns) {
      let score = 0;

      // Check keyword matches
      const keywordMatches = pattern.keywords.filter(keyword => 
        input.includes(keyword.toLowerCase())
      );
      score += (keywordMatches.length / pattern.keywords.length) * 0.4;

      // Check regex pattern matches
      const patternMatches = pattern.patterns.filter(regex => regex.test(input));
      score += (patternMatches.length > 0 ? 1 : 0) * 0.4;

      // Apply weight multiplier
      score *= pattern.weight;

      // Bonus for exact keyword match at start
      if (pattern.keywords.some(keyword => input.startsWith(keyword.toLowerCase()))) {
        score += 0.2;
      }

      scores.push({
        intent: pattern.intent,
        score: Math.min(score, 1.0)
      });
    }

    // If no good match found, default to unknown
    const maxScore = Math.max(...scores.map(s => s.score));
    if (maxScore < 0.3) {
      scores.push({
        intent: 'unknown',
        score: 0.5
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Extract target from user input (file, component, function, etc.)
   */
  private extractTarget(input: string): string | undefined {
    // Look for common target patterns
    const targetPatterns = [
      /(?:this|the|my)\s+(\w+(?:\s+\w+)?)/i,
      /(\w+\.(?:js|ts|jsx|tsx|py|java|cpp|c|h))/i,
      /(?:file|component|function|method|class)\s+(\w+)/i,
      /in\s+(\w+(?:\/\w+)*)/i
    ];

    for (const pattern of targetPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract specific action within intent
   */
  private extractAction(input: string, intent: CommandIntent): string | undefined {
    const actionPatterns: Record<CommandIntent, RegExp[]> = {
      analyze: [
        /analyze\s+for\s+(\w+(?:\s+\w+)?)/i,
        /check\s+(\w+(?:\s+\w+)?)/i,
        /review\s+(\w+(?:\s+\w+)?)/i
      ],
      generate: [
        /create\s+(?:a|an)\s+(\w+(?:\s+\w+)?)/i,
        /generate\s+(\w+(?:\s+\w+)?)/i,
        /implement\s+(\w+(?:\s+\w+)?)/i
      ],
      fix: [
        /fix\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i,
        /debug\s+(?:the\s+)?(\w+(?:\s+\w+)?)/i
      ],
      optimize: [
        /optimize\s+for\s+(\w+(?:\s+\w+)?)/i,
        /improve\s+(\w+(?:\s+\w+)?)/i
      ],
      test: [
        /(?:unit|integration|e2e)\s+test/i,
        /test\s+coverage/i
      ],
      document: [
        /(?:api\s+docs|readme|comments|jsdoc)/i
      ],
      refactor: [
        /refactor\s+to\s+(\w+(?:\s+\w+)?)/i
      ],
      explain: [
        /explain\s+(\w+(?:\s+\w+)?)/i
      ],
      help: [
        /help\s+with\s+(\w+(?:\s+\w+)?)/i
      ],
      chat: [],
      unknown: []
    };

    const patterns = actionPatterns[intent] || [];
    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract modifiers (verbose, quick, detailed, etc.)
   */
  private extractModifiers(input: string): string[] {
    const modifiers: string[] = [];
    const modifierPatterns = [
      { pattern: /verbose|detailed|comprehensive|thorough/i, modifier: 'verbose' },
      { pattern: /quick|fast|brief|short/i, modifier: 'quick' },
      { pattern: /simple|basic|minimal/i, modifier: 'simple' },
      { pattern: /advanced|complex|deep/i, modifier: 'advanced' },
      { pattern: /with\s+tests?/i, modifier: 'with-tests' },
      { pattern: /with\s+docs?|with\s+documentation/i, modifier: 'with-docs' },
      { pattern: /no\s+tests?/i, modifier: 'no-tests' },
      { pattern: /typescript|ts/i, modifier: 'typescript' },
      { pattern: /javascript|js/i, modifier: 'javascript' }
    ];

    for (const { pattern, modifier } of modifierPatterns) {
      if (pattern.test(input)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  /**
   * Build enhanced query for AI processing
   */
  private buildEnhancedQuery(
    originalInput: string, 
    intent: CommandIntent, 
    target?: string, 
    action?: string
  ): string {
    // For chat/help intents, return original input
    if (intent === 'chat' || intent === 'help') {
      return originalInput;
    }

    // Build enhanced query with clear structure
    const parts: string[] = [];

    // Add intent as action verb
    const intentVerbs: Record<CommandIntent, string> = {
      analyze: 'Analyze and provide insights about',
      generate: 'Create and implement',
      refactor: 'Refactor and improve',
      fix: 'Debug and fix issues in',
      explain: 'Explain how',
      optimize: 'Optimize and improve performance of',
      test: 'Create comprehensive tests for',
      document: 'Document and add comments to',
      help: 'Provide help with',
      chat: originalInput,
      unknown: 'Help with'
    };

    parts.push(intentVerbs[intent]);

    // Add target if specified
    if (target) {
      parts.push(`the ${target}`);
    } else {
      // Extract likely target from original input
      const impliedTarget = this.extractImpliedTarget(originalInput);
      if (impliedTarget) {
        parts.push(impliedTarget);
      }
    }

    // Add action if specified
    if (action) {
      parts.push(`focusing on ${action}`);
    }

    // Build final query
    let enhancedQuery = parts.join(' ');
    
    // If enhancement didn't add much value, use original
    if (enhancedQuery.length < originalInput.length * 0.8) {
      enhancedQuery = originalInput;
    }

    return enhancedQuery;
  }

  /**
   * Extract implied target when not explicitly mentioned
   */
  private extractImpliedTarget(input: string): string {
    if (input.includes('code')) return 'code';
    if (input.includes('function')) return 'function';
    if (input.includes('component')) return 'component';
    if (input.includes('file')) return 'file';
    if (input.includes('project')) return 'project';
    if (input.includes('app')) return 'application';
    if (input.includes('system')) return 'system';
    
    return 'code'; // Default fallback
  }

  /**
   * Get command suggestions based on partial input
   */
  getSuggestions(partialInput: string): string[] {
    const suggestions: string[] = [];
    const inputLower = partialInput.toLowerCase();

    for (const pattern of this.commandPatterns) {
      // Add examples that start with or contain the partial input
      const matchingExamples = pattern.examples.filter(example =>
        example.toLowerCase().includes(inputLower) ||
        pattern.keywords.some(keyword => keyword.includes(inputLower))
      );

      suggestions.push(...matchingExamples);
    }

    // Remove duplicates and limit to 8 suggestions
    return [...new Set(suggestions)].slice(0, 8);
  }

  /**
   * Get usage help for specific intent
   */
  getUsageHelp(intent: CommandIntent): string {
    const pattern = this.commandPatterns.find(p => p.intent === intent);
    if (!pattern) return 'No help available for this command.';

    return `
${intent.toUpperCase()} Command:
Examples:
${pattern.examples.map(ex => `  • ${ex}`).join('\n')}

Keywords: ${pattern.keywords.join(', ')}
    `.trim();
  }
}

// Export singleton instance
export const naturalLanguageInterface = new NaturalLanguageInterface();