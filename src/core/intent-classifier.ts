import { LocalModelClient } from './local-model-client.js';
import { logger } from './logger.js';
import { WorkflowContext } from './agent-orchestrator.js';

export interface Intent {
  category: string;
  subcategory?: string;
  confidence: number;
  complexity: 'simple' | 'medium' | 'complex';
  urgency: 'low' | 'medium' | 'high';
  scope: 'single_file' | 'multiple_files' | 'project_wide' | 'external';
  requiredCapabilities: string[];
  estimatedDuration: number; // in seconds
  metadata: any;
}

export interface IntentPattern {
  keywords: string[];
  patterns: RegExp[];
  category: string;
  subcategory?: string;
  weight: number;
}

/**
 * Advanced Intent Classification System
 * 
 * Classifies user intents with high accuracy to enable optimal workflow routing.
 * Uses a combination of:
 * - Pattern matching for fast classification
 * - LLM-based analysis for complex cases
 * - Context-aware decision making
 * - Learning from past classifications
 */
export class IntentClassifier {
  private model: LocalModelClient;
  private intentPatterns: IntentPattern[] = [];

  constructor(model: LocalModelClient) {
    this.model = model;
    this.initializeIntentPatterns();
  }

  /**
   * Initialize predefined intent patterns for fast classification
   */
  private initializeIntentPatterns(): void {
    this.intentPatterns = [
      // Code Analysis Intents
      {
        keywords: ['analyze', 'review', 'check', 'examine', 'inspect', 'evaluate'],
        patterns: [
          /analyz\w+\s+(code|project|file)/i,
          /review\s+(my|this|the)\s+(code|project)/i,
          /check\s+(for|the)\s+(errors|issues|problems)/i,
          /examine\s+(the|this)\s+(codebase|project)/i
        ],
        category: 'code_analysis',
        weight: 1.0
      },
      {
        keywords: ['quality', 'lint', 'errors', 'issues', 'problems', 'bugs'],
        patterns: [
          /code\s+quality/i,
          /find\s+(bugs|errors|issues)/i,
          /lint\s+(check|errors)/i,
          /check\s+for\s+(problems|issues)/i
        ],
        category: 'code_analysis',
        subcategory: 'quality_check',
        weight: 1.2
      },

      // File Operations
      {
        keywords: ['read', 'file', 'open', 'view', 'show', 'display'],
        patterns: [
          /read\s+(file|the\s+file)/i,
          /show\s+(me\s+)?(the\s+)?(contents?\s+of)/i,
          /open\s+(file|document)/i,
          /view\s+\w+\.(js|ts|py|java|cpp)/i
        ],
        category: 'file_operations',
        subcategory: 'read_file',
        weight: 1.0
      },
      {
        keywords: ['list', 'files', 'directory', 'structure', 'explore', 'src'],
        patterns: [
          /list\s+(files|directories)/i,
          /list\s+files\s+in/i,
          /show\s+(project\s+)?structure/i,
          /explore\s+(the\s+)?(project|directory)/i,
          /what\s+files\s+are/i,
          /files\s+in\s+(src|source)/i,
          /list.*src/i
        ],
        category: 'file_operations',
        subcategory: 'explore_structure',
        weight: 1.2
      },

      // Git Operations
      {
        keywords: ['git', 'status', 'commit', 'branch', 'diff', 'history'],
        patterns: [
          /git\s+(status|diff|log|history)/i,
          /check\s+(git\s+)?status/i,
          /show\s+(git\s+)?(changes|diff)/i,
          /commit\s+history/i
        ],
        category: 'git_operations',
        weight: 1.0
      },

      // Research and Documentation
      {
        keywords: ['research', 'search', 'find', 'documentation', 'docs', 'help'],
        patterns: [
          /research\s+(how\s+to|about)/i,
          /search\s+(for|documentation)/i,
          /find\s+(docs|documentation|help)/i,
          /how\s+(do\s+i|to)\s+\w+/i
        ],
        category: 'research',
        weight: 1.0
      },

      // Code Generation
      {
        keywords: ['create', 'generate', 'write', 'build', 'implement', 'make', 'component'],
        patterns: [
          /create\s+(a\s+)?(function|class|component)/i,
          /generate\s+(code|script|file)/i,
          /generate\s+(a\s+)?(new\s+)?(function|class|component)/i,
          /write\s+(a\s+)?(function|method|script)/i,
          /implement\s+(a\s+)?\w+/i,
          /build\s+(a\s+)?\w+/i,
          /(new|add)\s+(component|function|class)/i
        ],
        category: 'code_generation',
        weight: 1.1
      },

      // Problem Solving
      {
        keywords: ['fix', 'solve', 'debug', 'error', 'problem', 'issue', 'broken'],
        patterns: [
          /fix\s+(the\s+)?(error|bug|issue)/i,
          /solve\s+(this\s+)?problem/i,
          /debug\s+(the\s+)?\w+/i,
          /something\s+(is\s+)?(broken|wrong)/i,
          /not\s+working/i
        ],
        category: 'problem_solving',
        weight: 1.2
      },

      // Refactoring
      {
        keywords: ['refactor', 'improve', 'optimize', 'clean', 'restructure'],
        patterns: [
          /refactor\s+(the\s+)?(code|function|class)/i,
          /improve\s+(code|performance)/i,
          /optimize\s+(the\s+)?\w+/i,
          /clean\s+up\s+(the\s+)?code/i,
          /restructure\s+\w+/i
        ],
        category: 'refactoring',
        weight: 1.1
      },

      // Testing
      {
        keywords: ['test', 'testing', 'spec', 'unit', 'integration'],
        patterns: [
          /write\s+(tests|unit\s+tests)/i,
          /create\s+(test\s+)?(cases|specs)/i,
          /test\s+(the\s+)?(function|code)/i,
          /unit\s+testing/i
        ],
        category: 'testing',
        weight: 1.0
      },

      // Project Management
      {
        keywords: ['project', 'setup', 'configure', 'initialize', 'organize'],
        patterns: [
          /project\s+(setup|initialization)/i,
          /configure\s+(the\s+)?project/i,
          /organize\s+(the\s+)?(codebase|project)/i,
          /setup\s+(development|build)/i
        ],
        category: 'project_management',
        weight: 1.0
      },

      // Architecture and Design
      {
        keywords: ['architecture', 'design', 'pattern', 'structure', 'plan'],
        patterns: [
          /design\s+(the\s+)?(architecture|system)/i,
          /architectural\s+(pattern|design)/i,
          /plan\s+(the\s+)?(implementation|structure)/i,
          /system\s+design/i
        ],
        category: 'architecture_design',
        weight: 1.0
      },

      // Performance
      {
        keywords: ['performance', 'speed', 'optimize', 'slow', 'fast', 'benchmark'],
        patterns: [
          /performance\s+(issues|optimization)/i,
          /optimize\s+(for\s+)?(speed|performance)/i,
          /make\s+(it\s+)?(faster|quicker)/i,
          /benchmark\s+\w+/i
        ],
        category: 'performance',
        weight: 1.1
      }
    ];

    logger.info(`🧠 Initialized ${this.intentPatterns.length} intent patterns`);
  }

  /**
   * Classify user intent with high accuracy
   */
  async classifyIntent(userInput: string, context?: WorkflowContext): Promise<Intent> {
    try {
      // First, try fast pattern-based classification
      const patternResult = this.classifyWithPatterns(userInput);
      
      // If pattern matching has high confidence, use it
      if (patternResult.confidence && patternResult.confidence >= 0.8) {
        return this.enrichIntent(patternResult, userInput, context);
      }

      // Otherwise, use LLM for more nuanced classification
      const llmResult = await this.classifyWithLLM(userInput, context);
      
      // Combine pattern and LLM results for best accuracy
      const combinedResult = this.combineClassificationResults(
        patternResult, 
        llmResult, 
        userInput
      );

      return this.enrichIntent(combinedResult, userInput, context);

    } catch (error) {
      logger.error('Intent classification failed:', error);
      
      // Fallback to basic classification
      return this.createFallbackIntent(userInput);
    }
  }

  /**
   * Fast pattern-based classification
   */
  private classifyWithPatterns(userInput: string): Partial<Intent> {
    const inputLower = userInput.toLowerCase();
    const inputWords = inputLower.split(/\s+/);
    
    const categoryScores: Map<string, number> = new Map();
    const subcategoryScores: Map<string, number> = new Map();
    let maxScore = 0;
    let bestCategory = 'general';
    let bestSubcategory: string | undefined;

    // Score against all patterns
    for (const pattern of this.intentPatterns) {
      let score = 0;

      // Keyword matching with exact and partial scoring
      const keywordMatches = pattern.keywords.filter(keyword => 
        inputWords.some(word => word.includes(keyword) || keyword.includes(word))
      ).length;
      
      // Bonus for exact keyword matches
      const exactKeywordMatches = pattern.keywords.filter(keyword => 
        inputWords.includes(keyword)
      ).length;
      
      score += keywordMatches * 0.25 + exactKeywordMatches * 0.15;

      // Pattern matching with stronger scoring
      const patternMatches = pattern.patterns.filter(regex => 
        regex.test(userInput)
      ).length;
      score += patternMatches * 0.6;

      // Apply weight
      score *= pattern.weight;

      // Update category scores
      const currentCategoryScore = categoryScores.get(pattern.category) || 0;
      categoryScores.set(pattern.category, currentCategoryScore + score);

      if (pattern.subcategory) {
        const currentSubcategoryScore = subcategoryScores.get(pattern.subcategory) || 0;
        subcategoryScores.set(pattern.subcategory, currentSubcategoryScore + score);
      }

      // Track best overall score
      if (score > maxScore) {
        maxScore = score;
        bestCategory = pattern.category;
        bestSubcategory = pattern.subcategory;
      }
    }

    // Calculate confidence based on score distribution
    const totalScore = Array.from(categoryScores.values()).reduce((sum, score) => sum + score, 0);
    const topScore = Math.max(...Array.from(categoryScores.values()));
    const confidence = totalScore > 0 ? Math.min(topScore / totalScore, 1.0) : 0.1;

    return {
      category: bestCategory,
      subcategory: bestSubcategory,
      confidence: Math.max(confidence, 0.1) // Minimum confidence
    };
  }

  /**
   * LLM-based classification for complex cases
   */
  private async classifyWithLLM(userInput: string, context?: WorkflowContext): Promise<Partial<Intent>> {
    const classificationPrompt = `Classify the following user request into one of these categories:

CATEGORIES:
- code_analysis: Analyzing, reviewing, or examining existing code
- file_operations: Reading, listing, or exploring files and directories  
- git_operations: Git status, commits, diffs, branches, history
- research: Searching for documentation, examples, or information
- code_generation: Creating new code, functions, classes, or files
- problem_solving: Fixing bugs, debugging, solving errors or issues
- refactoring: Improving, optimizing, or restructuring existing code
- testing: Writing tests, test cases, or testing code
- project_management: Project setup, configuration, organization
- architecture_design: System design, architectural patterns, planning
- performance: Performance optimization, speed improvements, benchmarking
- general: General questions or requests that don't fit other categories

COMPLEXITY LEVELS:
- simple: Single file or straightforward task
- medium: Multiple files or moderate complexity
- complex: Project-wide changes or high complexity

URGENCY LEVELS:
- low: Non-critical, can be done later
- medium: Important but not urgent
- high: Critical or time-sensitive

SCOPE:
- single_file: Affects only one file
- multiple_files: Affects multiple files
- project_wide: Affects entire project
- external: Requires external resources

User Request: "${userInput}"

${context ? `
Context:
- Project Type: ${context.projectType || 'Unknown'}
- Previous Goals: ${context.goals.slice(0, 3).join(', ')}
- Completed Tasks: ${context.completedTasks.length}
` : ''}

Respond with ONLY a JSON object in this format:
{
  "category": "category_name",
  "subcategory": "optional_subcategory",
  "confidence": 0.0-1.0,
  "complexity": "simple|medium|complex",
  "urgency": "low|medium|high", 
  "scope": "single_file|multiple_files|project_wide|external",
  "reasoning": "brief explanation"
}`;

    try {
      const response = await this.model.generate(classificationPrompt);
      const parsed = this.parseClassificationResponse(response);
      
      if (parsed) {
        return parsed;
      }
    } catch (error) {
      logger.warn('LLM classification failed:', error);
    }

    // Fallback
    return {
      category: 'general',
      confidence: 0.3,
      complexity: 'medium',
      urgency: 'medium',
      scope: 'multiple_files'
    };
  }

  /**
   * Parse LLM classification response
   */
  private parseClassificationResponse(response: string): Partial<Intent> | null {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.category || !parsed.confidence) return null;

      return {
        category: parsed.category,
        subcategory: parsed.subcategory,
        confidence: Math.max(0.1, Math.min(1.0, parsed.confidence)),
        complexity: parsed.complexity || 'medium',
        urgency: parsed.urgency || 'medium',
        scope: parsed.scope || 'multiple_files',
        metadata: { reasoning: parsed.reasoning }
      };

    } catch (error) {
      logger.warn('Failed to parse classification response:', error);
      return null;
    }
  }

  /**
   * Combine pattern and LLM classification results
   */
  private combineClassificationResults(
    patternResult: Partial<Intent>,
    llmResult: Partial<Intent>,
    userInput: string
  ): Partial<Intent> {
    // If both agree on category, increase confidence
    if (patternResult.category === llmResult.category) {
      return {
        ...llmResult,
        confidence: Math.min(1.0, (patternResult.confidence || 0.5) + (llmResult.confidence || 0.5)),
        subcategory: patternResult.subcategory || llmResult.subcategory
      };
    }

    // If they disagree, use the one with higher confidence
    const patternConfidence = patternResult.confidence || 0.0;
    const llmConfidence = llmResult.confidence || 0.0;

    if (patternConfidence > llmConfidence) {
      return {
        ...patternResult,
        complexity: llmResult.complexity || 'medium',
        urgency: llmResult.urgency || 'medium',
        scope: llmResult.scope || 'multiple_files'
      };
    } else {
      return llmResult;
    }
  }

  /**
   * Enrich intent with additional metadata and capabilities
   */
  private enrichIntent(intent: Partial<Intent>, userInput: string, context?: WorkflowContext): Intent {
    const enriched: Intent = {
      category: intent.category || 'general',
      subcategory: intent.subcategory,
      confidence: intent.confidence || 0.5,
      complexity: intent.complexity || this.inferComplexity(userInput),
      urgency: intent.urgency || this.inferUrgency(userInput),
      scope: intent.scope || this.inferScope(userInput),
      requiredCapabilities: this.inferRequiredCapabilities(intent.category || 'general'),
      estimatedDuration: this.estimateDuration(intent),
      metadata: {
        ...intent.metadata,
        inputLength: userInput.length,
        wordCount: userInput.split(/\s+/).length,
        hasCodeReferences: /\.(js|ts|py|java|cpp|c|h|cs|php|rb|go|rs)\b/.test(userInput),
        hasGitReferences: /\b(git|commit|branch|diff|merge|pull|push)\b/i.test(userInput),
        hasFileReferences: /\b(file|directory|folder|path)\b/i.test(userInput)
      }
    };

    // Adjust based on context
    if (context) {
      // Increase urgency if there are failed tasks
      if (context.failedTasks.length > 0 && enriched.category === 'problem_solving') {
        enriched.urgency = 'high';
      }

      // Increase complexity if project is large
      if (context.completedTasks.length > 10) {
        enriched.complexity = enriched.complexity === 'simple' ? 'medium' : 'complex';
      }
    }

    return enriched;
  }

  /**
   * Infer complexity from user input
   */
  private inferComplexity(userInput: string): 'simple' | 'medium' | 'complex' {
    const input = userInput.toLowerCase();

    // Simple indicators
    if (input.includes('simple') || input.includes('quick') || input.includes('just') ||
        userInput.length < 30 || userInput.split(/\s+/).length < 6) {
      return 'simple';
    }

    // Complex indicators  
    if (input.includes('complex') || input.includes('comprehensive') || input.includes('full') ||
        input.includes('entire') || input.includes('all') || input.includes('complete') ||
        userInput.length > 150 || userInput.split(/\s+/).length > 25) {
      return 'complex';
    }

    return 'medium';
  }

  /**
   * Infer urgency from user input
   */
  private inferUrgency(userInput: string): 'low' | 'medium' | 'high' {
    const input = userInput.toLowerCase();

    // High urgency indicators
    if (input.includes('urgent') || input.includes('asap') || input.includes('quickly') ||
        input.includes('now') || input.includes('immediately') || input.includes('broken') ||
        input.includes('not working') || input.includes('error') || input.includes('fix')) {
      return 'high';
    }

    // Low urgency indicators
    if (input.includes('later') || input.includes('when') || input.includes('eventually') ||
        input.includes('explore') || input.includes('consider') || input.includes('maybe')) {
      return 'low';
    }

    return 'medium';
  }

  /**
   * Infer scope from user input
   */
  private inferScope(userInput: string): 'single_file' | 'multiple_files' | 'project_wide' | 'external' {
    const input = userInput.toLowerCase();

    // Single file indicators
    if (input.includes('this file') || input.includes('one file') || 
        /\w+\.(js|ts|py|java|cpp|c|h|cs|php|rb|go|rs)\b/.test(input)) {
      return 'single_file';
    }

    // Project wide indicators
    if (input.includes('project') || input.includes('entire') || input.includes('all files') ||
        input.includes('codebase') || input.includes('whole') || input.includes('complete')) {
      return 'project_wide';
    }

    // External indicators
    if (input.includes('search') || input.includes('documentation') || input.includes('online') ||
        input.includes('web') || input.includes('research') || input.includes('find')) {
      return 'external';
    }

    return 'multiple_files';
  }

  /**
   * Map category to required capabilities
   */
  private inferRequiredCapabilities(category: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'code_analysis': ['code_analysis', 'ast_parsing', 'lint_checking'],
      'file_operations': ['file_reading', 'directory_exploration', 'file_listing'],
      'git_operations': ['git_status', 'git_diff', 'git_history'],
      'research': ['web_search', 'documentation_search', 'pattern_research'],
      'code_generation': ['code_generation', 'template_creation', 'best_practices'],
      'problem_solving': ['debugging', 'error_analysis', 'solution_design'],
      'refactoring': ['code_transformation', 'pattern_recognition', 'optimization'],
      'testing': ['test_generation', 'test_strategy', 'quality_assurance'],
      'project_management': ['project_analysis', 'configuration', 'organization'],
      'architecture_design': ['system_design', 'pattern_application', 'planning'],
      'performance': ['performance_analysis', 'optimization', 'benchmarking']
    };

    return capabilityMap[category] || ['general_processing'];
  }

  /**
   * Estimate task duration based on intent
   */
  private estimateDuration(intent: Partial<Intent>): number {
    let baseDuration = 30; // 30 seconds base

    // Adjust by category
    const categoryMultipliers: Record<string, number> = {
      'code_analysis': 2.0,
      'file_operations': 1.0,
      'git_operations': 1.5,
      'research': 3.0,
      'code_generation': 2.5,
      'problem_solving': 3.5,
      'refactoring': 3.0,
      'testing': 2.0,
      'project_management': 4.0,
      'architecture_design': 4.5,
      'performance': 3.5
    };

    baseDuration *= categoryMultipliers[intent.category || 'general'] || 1.0;

    // Adjust by complexity
    const complexityMultipliers = {
      'simple': 0.5,
      'medium': 1.0,
      'complex': 2.5
    };

    baseDuration *= complexityMultipliers[intent.complexity || 'medium'];

    // Adjust by scope
    const scopeMultipliers = {
      'single_file': 0.8,
      'multiple_files': 1.0,
      'project_wide': 2.0,
      'external': 1.5
    };

    baseDuration *= scopeMultipliers[intent.scope || 'multiple_files'];

    return Math.round(baseDuration);
  }

  /**
   * Create fallback intent for failed classification
   */
  private createFallbackIntent(userInput: string): Intent {
    return {
      category: 'general',
      confidence: 0.3,
      complexity: this.inferComplexity(userInput),
      urgency: this.inferUrgency(userInput),
      scope: this.inferScope(userInput),
      requiredCapabilities: ['general_processing'],
      estimatedDuration: 60,
      metadata: {
        fallback: true,
        inputLength: userInput.length,
        wordCount: userInput.split(/\s+/).length
      }
    };
  }

  /**
   * Get classification statistics
   */
  getClassificationStats(): any {
    return {
      totalPatterns: this.intentPatterns.length,
      categoryCounts: this.intentPatterns.reduce((counts, pattern) => {
        counts[pattern.category] = (counts[pattern.category] || 0) + 1;
        return counts;
      }, {} as Record<string, number>),
      avgWeight: this.intentPatterns.reduce((sum, p) => sum + p.weight, 0) / this.intentPatterns.length
    };
  }
}