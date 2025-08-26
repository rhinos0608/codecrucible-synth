/**
 * AI-Powered Parameter Generator (2025 Best Practices)
 * 
 * Implements intelligent parameter generation using AI models instead of simple heuristics.
 * Based on 2025 patterns from Cursor, GitHub Copilot, and Aider for context-aware tool parameter inference.
 * 
 * Key Features:
 * - Context-aware parameter generation using AI reasoning
 * - Tool schema analysis for type-safe parameter creation  
 * - Multi-modal input processing (text, file paths, code context)
 * - Confidence scoring and fallback parameter strategies
 * - Integration with domain-aware tool selection
 */

import { logger } from '../logger.js';

export interface ParameterGenerationContext {
  userPrompt: string;
  toolName: string;
  toolSchema: any;
  workingDirectory: string;
  fileContext?: string[];
  codebaseContext?: string;
  previousToolResults?: any[];
  domainContext: string;
  taskType: 'file_analysis' | 'code_generation' | 'system_operation' | 'research' | 'mixed';
}

export interface GeneratedParameters {
  parameters: Record<string, any>;
  confidence: number;
  reasoning: string;
  alternatives?: Record<string, any>[];
  fallbackUsed: boolean;
  validationErrors?: string[];
}

export interface ParameterGenerationStrategy {
  name: string;
  description: string;
  priority: number;
  canHandle: (context: ParameterGenerationContext) => boolean;
  generate: (context: ParameterGenerationContext, modelClient?: any) => Promise<GeneratedParameters>;
}

/**
 * Main AI-Powered Parameter Generator
 * Combines multiple strategies for intelligent parameter inference
 */
export class AIPoweredParameterGenerator {
  private strategies: ParameterGenerationStrategy[] = [];
  private modelClient?: any;

  constructor(modelClient?: any) {
    this.modelClient = modelClient;
    this.initializeStrategies();
  }

  /**
   * Generate parameters for a tool using AI reasoning and context analysis
   */
  async generateParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    logger.info('🧠 AI-Powered parameter generation starting', {
      tool: context.toolName,
      taskType: context.taskType,
      domain: context.domainContext,
      promptLength: context.userPrompt.length
    });

    // Find the best strategy for this context
    const strategy = this.selectBestStrategy(context);
    
    try {
      const result = await strategy.generate(context, this.modelClient);
      
      // Validate generated parameters against tool schema
      const validation = this.validateParameters(result.parameters, context.toolSchema);
      if (!validation.valid) {
        // Try fallback strategy if validation fails
        const fallbackResult = await this.generateFallbackParameters(context);
        fallbackResult.validationErrors = validation.errors;
        return fallbackResult;
      }

      logger.info('✅ AI parameter generation successful', {
        tool: context.toolName,
        strategy: strategy.name,
        confidence: result.confidence,
        parametersGenerated: Object.keys(result.parameters).length
      });

      return result;
    } catch (error) {
      logger.warn('⚠️ AI parameter generation failed, using fallback', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return await this.generateFallbackParameters(context);
    }
  }

  /**
   * Select the best strategy based on context analysis
   */
  private selectBestStrategy(context: ParameterGenerationContext): ParameterGenerationStrategy {
    const applicableStrategies = this.strategies
      .filter(strategy => strategy.canHandle(context))
      .sort((a, b) => b.priority - a.priority);

    if (applicableStrategies.length === 0) {
      logger.warn('No applicable strategies found, using fallback');
      return this.strategies.find(s => s.name === 'fallback_heuristic')!;
    }

    return applicableStrategies[0];
  }

  /**
   * Initialize all parameter generation strategies
   */
  private initializeStrategies(): void {
    // Strategy 1: AI-Powered Context Analysis (highest priority)
    this.strategies.push({
      name: 'ai_context_analysis',
      description: 'Uses AI model to analyze context and generate appropriate parameters',
      priority: 10,
      canHandle: (context) => !!this.modelClient && context.userPrompt.length > 0,
      generate: async (context, modelClient) => {
        return await this.generateWithAIAnalysis(context, modelClient);
      }
    });

    // Strategy 2: File Path Intelligence 
    this.strategies.push({
      name: 'file_path_intelligence',
      description: 'Intelligent file path extraction and analysis',
      priority: 8,
      canHandle: (context) => this.isFileRelatedTool(context.toolName),
      generate: async (context) => {
        return await this.generateFilePathParameters(context);
      }
    });

    // Strategy 3: Code Context Analysis
    this.strategies.push({
      name: 'code_context_analysis', 
      description: 'Analyzes code context for development-related tools',
      priority: 7,
      canHandle: (context) => context.taskType === 'code_generation' || context.domainContext === 'coding',
      generate: async (context) => {
        return await this.generateCodeContextParameters(context);
      }
    });

    // Strategy 4: System Command Intelligence
    this.strategies.push({
      name: 'system_command_intelligence',
      description: 'Generates intelligent system commands based on intent',
      priority: 6,
      canHandle: (context) => context.toolName.includes('execute_command') || context.toolName.includes('terminal'),
      generate: async (context) => {
        return await this.generateSystemCommandParameters(context);
      }
    });

    // Strategy 5: Fallback Heuristics (lowest priority)
    this.strategies.push({
      name: 'fallback_heuristic',
      description: 'Basic heuristic-based parameter generation as fallback',
      priority: 1,
      canHandle: () => true, // Always applicable as fallback
      generate: async (context) => {
        return await this.generateHeuristicParameters(context);
      }
    });

    logger.info('🔧 Initialized AI parameter generation strategies', {
      strategyCount: this.strategies.length,
      hasModelClient: !!this.modelClient
    });
  }

  /**
   * AI-Powered Context Analysis Strategy
   * Uses AI model to understand context and generate appropriate parameters
   */
  private async generateWithAIAnalysis(
    context: ParameterGenerationContext, 
    modelClient: any
  ): Promise<GeneratedParameters> {
    const prompt = this.buildAIParameterPrompt(context);
    
    try {
      const response = await modelClient.generateText(prompt);
      const parsedResponse = this.parseAIParameterResponse(response, context.toolSchema);
      
      return {
        parameters: parsedResponse.parameters,
        confidence: parsedResponse.confidence,
        reasoning: parsedResponse.reasoning,
        alternatives: parsedResponse.alternatives,
        fallbackUsed: false
      };
    } catch (error) {
      logger.warn('AI analysis failed:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Build AI prompt for parameter generation
   */
  private buildAIParameterPrompt(context: ParameterGenerationContext): string {
    return `You are an expert AI assistant helping to generate parameters for tool execution.

**Context:**
- User Request: "${context.userPrompt}"
- Tool: ${context.toolName}
- Task Type: ${context.taskType}
- Domain: ${context.domainContext}
- Working Directory: ${context.workingDirectory}
${context.fileContext ? `- Available Files: ${context.fileContext.slice(0, 10).join(', ')}` : ''}
${context.codebaseContext ? `- Codebase Context: ${context.codebaseContext.substring(0, 200)}...` : ''}

**Tool Schema:**
${JSON.stringify(context.toolSchema, null, 2)}

**Instructions:**
1. Analyze the user request and understand the intent
2. Generate appropriate parameters for the ${context.toolName} tool
3. Consider the working directory and available context
4. Provide confidence score (0-1) based on how certain you are
5. Explain your reasoning

**Response Format (JSON):**
{
  "parameters": {
    // Generated parameters based on tool schema
  },
  "confidence": 0.8, // 0-1 confidence score
  "reasoning": "Why these parameters were chosen...",
  "alternatives": [
    // Optional alternative parameter sets
  ]
}

Generate the most appropriate parameters:`;
  }

  /**
   * Parse AI response for parameter generation
   */
  private parseAIParameterResponse(response: string, toolSchema: any): any {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.parameters || typeof parsed.confidence !== 'number') {
        throw new Error('Invalid response format');
      }
      
      return {
        parameters: parsed.parameters,
        confidence: Math.max(0, Math.min(1, parsed.confidence)),
        reasoning: parsed.reasoning || 'AI-generated parameters',
        alternatives: parsed.alternatives || []
      };
    } catch (error) {
      logger.warn('Failed to parse AI response:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * File Path Intelligence Strategy
   * Extracts and validates file paths from user context
   */
  private async generateFilePathParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    const prompt = context.userPrompt.toLowerCase();
    const parameters: Record<string, any> = {};
    let confidence = 0.3;
    let reasoning = 'File path heuristics';

    // Smart file path extraction
    if (context.toolName.includes('read_file') || context.toolName.includes('filesystem_read')) {
      const filePath = this.extractFilePath(context.userPrompt, context.workingDirectory, context.fileContext);
      if (filePath) {
        parameters.filePath = filePath;
        parameters.path = filePath; // Alternative parameter name
        confidence = 0.8;
        reasoning = `Extracted file path: ${filePath}`;
      }
    }

    if (context.toolName.includes('list_directory') || context.toolName.includes('filesystem_list')) {
      parameters.path = this.extractDirectoryPath(context.userPrompt, context.workingDirectory) || '.';
      confidence = 0.7;
      reasoning = 'Directory path extraction';
    }

    return {
      parameters,
      confidence,
      reasoning,
      fallbackUsed: false
    };
  }

  /**
   * Extract file path from user prompt using intelligent analysis
   */
  private extractFilePath(prompt: string, workingDir: string, fileContext?: string[]): string | null {
    // Look for explicit file mentions
    const filePatterns = [
      /["'`]([^"'`]+\.[a-zA-Z]+)["'`]/g, // Quoted files with extensions
      /\b(\w+\.\w+)\b/g,                 // Simple file.ext pattern
      /\b(README\.md|package\.json|tsconfig\.json)\b/gi // Common files
    ];

    for (const pattern of filePatterns) {
      const matches = Array.from(prompt.matchAll(pattern));
      for (const match of matches) {
        const filePath = match[1];
        // Validate against available files if context provided
        if (!fileContext || fileContext.some(f => f.includes(filePath))) {
          return filePath;
        }
      }
    }

    // Smart defaults based on context
    if (prompt.includes('readme')) return 'README.md';
    if (prompt.includes('package')) return 'package.json';
    if (prompt.includes('config')) return 'tsconfig.json';
    
    return null;
  }

  /**
   * Extract directory path from user prompt
   */
  private extractDirectoryPath(prompt: string, workingDir: string): string | null {
    // Look for directory references
    if (prompt.includes('current') || prompt.includes('here') || prompt.includes('this')) {
      return '.';
    }
    
    // Look for specific directory names
    const dirMatch = prompt.match(/\b(src|dist|lib|docs|test|tests|build)\b/i);
    if (dirMatch) {
      return dirMatch[1];
    }
    
    return null;
  }

  /**
   * Code Context Analysis Strategy
   */
  private async generateCodeContextParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    const parameters: Record<string, any> = {};
    let confidence = 0.6;
    let reasoning = 'Code context analysis';

    // Analyze for coding-related parameters
    if (context.codebaseContext) {
      // Extract language context
      const language = this.detectLanguage(context.codebaseContext);
      if (language && context.toolSchema.properties?.language) {
        parameters.language = language;
        confidence = 0.8;
        reasoning += `, detected language: ${language}`;
      }
    }

    // Add file-related parameters for coding tools
    if (this.isFileRelatedTool(context.toolName)) {
      const fileParams = await this.generateFilePathParameters(context);
      Object.assign(parameters, fileParams.parameters);
      confidence = Math.max(confidence, fileParams.confidence);
    }

    return {
      parameters,
      confidence,
      reasoning,
      fallbackUsed: false
    };
  }

  /**
   * System Command Intelligence Strategy
   */
  private async generateSystemCommandParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    const prompt = context.userPrompt.toLowerCase();
    const parameters: Record<string, any> = {};
    let confidence = 0.7;
    let reasoning = 'System command analysis';

    // Intelligent command generation based on intent
    if (prompt.includes('list') || prompt.includes('show files')) {
      parameters.command = 'ls -la';
      confidence = 0.9;
      reasoning = 'List files command';
    } else if (prompt.includes('git status') || prompt.includes('repository status')) {
      parameters.command = 'git status';
      confidence = 0.95;
      reasoning = 'Git status command';
    } else if (prompt.includes('npm') || prompt.includes('install')) {
      parameters.command = 'npm list';
      confidence = 0.8;
      reasoning = 'NPM command';
    } else if (prompt.includes('current directory') || prompt.includes('where am i')) {
      parameters.command = 'pwd';
      confidence = 0.9;
      reasoning = 'Current directory command';
    } else {
      parameters.command = 'pwd'; // Safe default
      confidence = 0.3;
      reasoning = 'Default safe command';
    }

    // Add timeout for safety
    parameters.timeout = 30000;

    return {
      parameters,
      confidence,
      reasoning,
      fallbackUsed: false
    };
  }

  /**
   * Fallback Heuristic Strategy (original logic)
   */
  private async generateHeuristicParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    const toolName = context.toolName;
    const prompt = context.userPrompt.toLowerCase();
    
    // Original heuristic logic from AdvancedToolOrchestrator
    if (toolName === 'filesystem_read_file') {
      if (prompt.includes('readme')) return { parameters: { filePath: 'README.md' }, confidence: 0.8, reasoning: 'README heuristic', fallbackUsed: true };
      if (prompt.includes('package.json')) return { parameters: { filePath: 'package.json' }, confidence: 0.8, reasoning: 'Package.json heuristic', fallbackUsed: true };
      if (prompt.includes('.ts')) return { parameters: { filePath: prompt.match(/\w+\.ts/)?.[0] || 'index.ts' }, confidence: 0.6, reasoning: 'TypeScript file heuristic', fallbackUsed: true };
      return { parameters: { filePath: 'README.md' }, confidence: 0.3, reasoning: 'Default README fallback', fallbackUsed: true };
    }
    
    if (toolName === 'filesystem_list_directory') {
      return { parameters: { path: '.' }, confidence: 0.7, reasoning: 'Current directory default', fallbackUsed: true };
    }

    if (toolName.includes('execute_command')) {
      if (prompt.includes('ls') || prompt.includes('list')) return { parameters: { command: 'ls -la' }, confidence: 0.8, reasoning: 'List command heuristic', fallbackUsed: true };
      if (prompt.includes('git')) return { parameters: { command: 'git status' }, confidence: 0.8, reasoning: 'Git command heuristic', fallbackUsed: true };
      return { parameters: { command: 'pwd' }, confidence: 0.5, reasoning: 'Safe default command', fallbackUsed: true };
    }

    return { parameters: {}, confidence: 0.1, reasoning: 'No applicable heuristics', fallbackUsed: true };
  }

  /**
   * Generate fallback parameters when primary strategies fail
   */
  private async generateFallbackParameters(context: ParameterGenerationContext): Promise<GeneratedParameters> {
    const fallbackStrategy = this.strategies.find(s => s.name === 'fallback_heuristic')!;
    const result = await fallbackStrategy.generate(context);
    result.fallbackUsed = true;
    return result;
  }

  /**
   * Validate generated parameters against tool schema
   */
  private validateParameters(parameters: Record<string, any>, schema: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!schema || !schema.properties) {
      return { valid: true, errors }; // No schema to validate against
    }

    // Check required parameters
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in parameters)) {
          errors.push(`Missing required parameter: ${required}`);
        }
      }
    }

    // Type checking (basic)
    for (const [key, value] of Object.entries(parameters)) {
      const propSchema = schema.properties[key];
      if (propSchema && propSchema.type) {
        if (propSchema.type === 'string' && typeof value !== 'string') {
          errors.push(`Parameter ${key} must be string, got ${typeof value}`);
        }
        if (propSchema.type === 'number' && typeof value !== 'number') {
          errors.push(`Parameter ${key} must be number, got ${typeof value}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Helper methods
   */
  private isFileRelatedTool(toolName: string): boolean {
    return toolName.includes('read_file') || 
           toolName.includes('write_file') || 
           toolName.includes('list_directory') ||
           toolName.includes('filesystem');
  }

  private detectLanguage(codebaseContext: string): string | null {
    if (codebaseContext.includes('typescript') || codebaseContext.includes('.ts')) return 'typescript';
    if (codebaseContext.includes('javascript') || codebaseContext.includes('.js')) return 'javascript';
    if (codebaseContext.includes('python') || codebaseContext.includes('.py')) return 'python';
    if (codebaseContext.includes('java') && !codebaseContext.includes('javascript')) return 'java';
    return null;
  }
}