/**
 * Use Case Router - Modularized Request Routing
 * 
 * Extracted from UnifiedCLICoordinator to handle use case routing and execution:
 * - Route requests to appropriate use cases based on intent and context
 * - Handle analysis, generation, prompt processing, and diagnostic operations
 * - Integrate with workflow orchestrator for complex operations
 * - Manage context enhancement and input processing
 * - Simple question routing and optimization
 * 
 * This module centralizes the routing logic for different types of CLI operations.
 */

import { logger } from '../../infrastructure/logging/unified-logger.js';
import { getDependencyContainer, UseCaseDependencies } from '../services/dependency-container.js';
import { AnalysisRequest, GenerationRequest } from '../use-cases/index.js';
import { FileReferenceParser } from './file-reference-parser.js';
import {
  projectConfigurationLoader,
  CombinedProjectConfig,
} from '../config/project-config-loader.js';
import { CodebaseAnalysisResult } from '../context/context-window-manager.js';
import { naturalLanguageInterface, ParsedCommand } from './natural-language-interface.js';
import {
  IWorkflowOrchestrator,
  WorkflowRequest,
  WorkflowResponse,
  WorkflowContext,
} from '../../domain/interfaces/workflow-orchestrator.js';

export interface CLIOperationRequest {
  id: string;
  type: 'prompt' | 'analyze' | 'execute' | 'navigate' | 'suggest';
  input: string | any;
  options?: UseCaseRouterOptions;
  session?: {
    id: string;
    workingDirectory: string;
    context: WorkflowContext;
  };
}

export interface CLIOperationResponse {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  enhancements?: {
    contextAdded?: boolean;
    suggestions?: any[];
    performanceOptimized?: boolean;
    errorsRecovered?: number;
  };
  metrics: {
    processingTime: number;
    contextConfidence: number;
    systemHealth: number;
  };
}

export interface UseCaseRouterOptions {
  includeTests?: boolean;
  includeDocumentation?: boolean;
  dryRun?: boolean;
  stream?: boolean;
  useTools?: boolean;
  enableContextIntelligence?: boolean;
  enablePerformanceOptimization?: boolean;
  enableErrorResilience?: boolean;
}

/**
 * Routes CLI operations to appropriate use cases and handles execution
 */
export class UseCaseRouter {
  private useCases?: UseCaseDependencies;
  private orchestrator?: IWorkflowOrchestrator;
  private isInitialized = false;

  constructor() {
    // Dependencies will be injected during initialization
  }

  /**
   * Initialize the router with dependencies
   */
  async initialize(orchestrator: IWorkflowOrchestrator): Promise<void> {
    this.orchestrator = orchestrator;
    
    // Initialize dependency container and use cases
    const container = getDependencyContainer();
    container.initialize(orchestrator);
    this.useCases = container.useCases;

    this.isInitialized = true;
    logger.info('UseCaseRouter initialized successfully');
  }

  /**
   * Route and execute a CLI operation
   */
  async executeOperation(request: CLIOperationRequest): Promise<any> {
    if (!this.isInitialized || !this.orchestrator || !this.useCases) {
      throw new Error('UseCaseRouter not initialized. Call initialize() first.');
    }

    const workingDir = request.session?.workingDirectory || process.cwd();
    const options = request.options || {};

    // Parse natural language command if input is string
    let parsedCommand: ParsedCommand | null = null;
    if (typeof request.input === 'string') {
      parsedCommand = naturalLanguageInterface.parseCommand(request.input);

      // Log natural language understanding for transparency
      if (parsedCommand.confidence > 0.7) {
        logger.info(
          `🎯 Command understood: ${parsedCommand.intent} (${(parsedCommand.confidence * 100).toFixed(0)}% confidence)`
        );
      }
    }

    // Load project configuration for context-aware responses
    let projectConfig: CombinedProjectConfig | null = null;
    try {
      projectConfig = await projectConfigurationLoader.loadProjectConfig(workingDir);
      if (projectConfig.isLoaded) {
        logger.info(
          `🏗️ Loaded project config: ${projectConfig.configuration.name || 'Unknown'} (${projectConfig.configuration.language || 'Unknown'})`
        );
      }
    } catch (error) {
      logger.warn('⚠️ Failed to load project configuration:', error);
    }

    // Process @ syntax file references
    let processedInput = request.input;
    if (typeof request.input === 'string' && request.input.includes('@')) {
      try {
        const parser = new FileReferenceParser();
        const parsed = await parser.parseFileReferences(request.input, workingDir);

        if (parsed.references.length > 0) {
          processedInput = parsed.enhancedPrompt;
          logger.info(
            `📁 Processed ${parsed.references.length} file references: ${parsed.contextSummary}`
          );
        }
      } catch (error) {
        logger.warn('❌ Failed to process @ file references:', error);
        // Continue with original input on parsing failure
      }
    }

    // AI-driven tool selection: Let the model decide between MCP tools and codebase analysis
    const codebaseAnalysis: CodebaseAnalysisResult | null = null;

    // Enhance input with project context if available
    let contextEnhancedInput = processedInput;
    if (projectConfig && projectConfig.isLoaded && typeof processedInput === 'string') {
      contextEnhancedInput = this.enhanceInputWithProjectContext(processedInput, projectConfig);
    }

    // Further enhance with codebase analysis if available
    if (codebaseAnalysis && typeof contextEnhancedInput === 'string') {
      contextEnhancedInput = this.enhanceInputWithCodebaseAnalysis(
        contextEnhancedInput,
        codebaseAnalysis
      );
    }

    const enhancedInput = contextEnhancedInput;

    // Use natural language intent to refine operation type if confidence is high
    let effectiveOperationType = request.type;
    if (parsedCommand && parsedCommand.confidence > 0.5) {
      // Map natural language intents to operation types
      const intentToOperationMap: Record<string, typeof request.type> = {
        analyze: 'analyze',
        diagnose: 'analyze', // Diagnostics are a form of analysis
        review: 'analyze',
        explain: 'analyze', // Explanation should be analysis, not code generation
        generate: 'prompt', // Code generation goes through prompt system
        fix: 'prompt',
        refactor: 'prompt',
        optimize: 'prompt',
        test: 'prompt',
        document: 'prompt',
        help: 'suggest',
        chat: 'prompt',
      };

      const mappedOperation = intentToOperationMap[parsedCommand.intent];
      if (mappedOperation && mappedOperation !== request.type) {
        logger.info(
          `🔄 Routing: ${request.type} → ${mappedOperation} based on natural language intent`
        );
        effectiveOperationType = mappedOperation;
      }
    }

    // Route to appropriate use case
    return await this.routeToUseCase(
      effectiveOperationType,
      request,
      enhancedInput,
      options,
      parsedCommand
    );
  }

  /**
   * Route to the appropriate use case based on operation type
   */
  private async routeToUseCase(
    operationType: CLIOperationRequest['type'],
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UseCaseRouterOptions,
    parsedCommand: ParsedCommand | null
  ): Promise<any> {
    switch (operationType) {
      case 'analyze': {
        return await this.handleAnalyzeOperation(request, enhancedInput, options);
      }

      case 'prompt': {
        return await this.handlePromptOperation(request, enhancedInput, options);
      }

      case 'execute':
      case 'navigate':
      case 'suggest':
      default: {
        // Fallback to orchestrator for other operation types
        return await this.executeViaOrchestrator(request, enhancedInput, options);
      }
    }
  }

  /**
   * Handle analysis operations
   */
  private async handleAnalyzeOperation(
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UseCaseRouterOptions
  ): Promise<any> {
    if (!this.useCases) {
      throw new Error('Use cases not available');
    }

    // Determine if it's file or directory analysis
    if (
      typeof request.input === 'string' &&
      request.input.includes('/') &&
      !request.input.includes(' ')
    ) {
      // Likely a file or directory path
      const analysisRequest: AnalysisRequest = {
        filePath: request.input.endsWith('/') ? undefined : request.input,
        directoryPath: request.input.endsWith('/') ? request.input : undefined,
        options: {
          depth: 3,
          includeTests: options.includeTests,
          includeDocumentation: options.includeDocumentation,
          outputFormat: 'structured',
        },
      };

      if (analysisRequest.directoryPath) {
        return await this.useCases.analyzeDirectoryUseCase.execute(analysisRequest);
      } else {
        return await this.useCases.analyzeFileUseCase.execute(analysisRequest);
      }
    } else {
      // Check if this is a simple question that should go directly to AI
      const originalInputStr = request.input as string;
      const isSimpleQuestion = this.isSimpleQuestion(originalInputStr);

      if (isSimpleQuestion) {
        // Route simple questions directly to orchestrator for real AI responses
        // BUT don't include tools for simple questions to enable pure streaming
        logger.info('🎯 Routing simple question directly to AI orchestrator (no tools)');
        return await this.executeViaOrchestratorWithoutTools(request, enhancedInput, options);
      } else {
        // General analysis request - use file analysis with content
        const analysisRequest: AnalysisRequest = {
          content: enhancedInput as string,
          options: {
            includeTests: options.includeTests,
            includeDocumentation: options.includeDocumentation,
            outputFormat: 'structured',
          },
        };
        return await this.useCases.analyzeFileUseCase.execute(analysisRequest);
      }
    }
  }

  /**
   * Handle prompt operations (including code generation)
   */
  private async handlePromptOperation(
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UseCaseRouterOptions
  ): Promise<any> {
    if (!this.useCases) {
      throw new Error('Use cases not available');
    }

    // Check if this is a code generation request using ORIGINAL user input, not enhanced context
    const originalInput = request.input as string;
    if (this.isCodeGenerationRequest(originalInput)) {
      const generationRequest: GenerationRequest = {
        prompt: enhancedInput as string,
        context: this.extractGenerationContext(request),
        options: {
          includeTests: options.includeTests,
          includeDocumentation: options.includeDocumentation,
          // For explicit code generation requests, default to actually writing files
          // Only dry-run if explicitly requested via options
          dryRun: options.dryRun ?? false,
        },
      };
      return await this.useCases.generateCodeUseCase.execute(generationRequest);
    } else {
      // Regular prompt - fallback to orchestrator
      return await this.executeViaOrchestrator(request, enhancedInput, options);
    }
  }

  /**
   * Execute via orchestrator (fallback for non-use-case operations)
   */
  private async executeViaOrchestrator(
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UseCaseRouterOptions
  ): Promise<any> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not available');
    }

    const workflowRequest: WorkflowRequest = {
      id: request.id,
      type: this.mapOperationType(request.type),
      payload: {
        input: enhancedInput,
        originalInput: request.input,
        options: {
          ...options,
          // CRITICAL FIX: Default to streaming for Ollama responses, but respect explicit false
          stream: options.stream !== false,
        },
      },
      context: request.session?.context,
      metadata: {
        routerVersion: '1.0.0-modular',
        capabilities: {
          contextIntelligence: options.enableContextIntelligence,
          performanceOptimized: options.enablePerformanceOptimization,
          errorResilience: options.enableErrorResilience,
        },
      },
    };

    const workflowResponse = await this.orchestrator.processRequest(workflowRequest);

    if (!workflowResponse.success) {
      throw workflowResponse.error || new Error('Workflow execution failed');
    }

    return workflowResponse.result;
  }

  /**
   * Execute via orchestrator without tools (for simple questions to enable pure streaming)
   */
  private async executeViaOrchestratorWithoutTools(
    request: CLIOperationRequest,
    enhancedInput: string | any,
    options: UseCaseRouterOptions
  ): Promise<any> {
    if (!this.orchestrator) {
      throw new Error('Orchestrator not available');
    }

    const workflowRequest: WorkflowRequest = {
      id: request.id,
      type: this.mapOperationType(request.type),
      payload: {
        input: enhancedInput,
        originalInput: request.input,
        options: {
          ...options,
          // CRITICAL FIX: Default to streaming for Ollama responses, but respect explicit false
          stream: options.stream !== false,
          // CRITICAL: Disable tools for simple questions to enable pure streaming
          useTools: false,
        },
      },
      context: request.session?.context,
      metadata: {
        routerVersion: '1.0.0-modular',
        capabilities: {
          contextIntelligence: options.enableContextIntelligence,
          performanceOptimized: options.enablePerformanceOptimization,
          errorResilience: options.enableErrorResilience,
        },
      },
    };

    const workflowResponse = await this.orchestrator.processRequest(workflowRequest);

    if (!workflowResponse.success) {
      throw workflowResponse.error || new Error('Workflow execution failed');
    }

    return workflowResponse.result;
  }

  /**
   * Check if this is a simple question that should go directly to AI
   */
  private isSimpleQuestion(input: string): boolean {
    if (typeof input !== 'string') return false;

    const inputLower = input.toLowerCase().trim();

    // Simple math questions
    if (/^\s*\d+\s*[+\-*\/]\s*\d+[\s?]*$/.test(inputLower)) return true;

    // Simple "what is" questions
    if (inputLower.startsWith('what is') && inputLower.length < 50) return true;

    // Simple questions with question words
    const questionWords = ['what', 'who', 'when', 'where', 'why', 'how'];
    const startsWithQuestion = questionWords.some(word => inputLower.startsWith(`${word} `));

    // Direct questions under 100 characters that don't mention files or code
    const isShort = inputLower.length < 100;
    const noFileReferences =
      !inputLower.includes('.') && !inputLower.includes('/') && !inputLower.includes('\\');
    const noCodeKeywords =
      !inputLower.includes('function') &&
      !inputLower.includes('class') &&
      !inputLower.includes('import');

    return startsWithQuestion && isShort && noFileReferences && noCodeKeywords;
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
    const weakKeywords = ['function', 'class', 'component', 'module'];
    const creationContext = ['new', 'create', 'make', 'add', 'build'];

    return weakKeywords.some(
      keyword =>
        lowerPrompt.includes(keyword) &&
        creationContext.some(context => lowerPrompt.includes(context))
    );
  }

  /**
   * Extract generation context from request
   */
  private extractGenerationContext(request: CLIOperationRequest): GenerationRequest['context'] {
    return {
      projectType: 'general',
      language: 'typescript', // Default, could be enhanced with project detection
      framework: undefined,
      existingFiles: [],
    };
  }

  /**
   * Map CLI operation types to workflow types
   */
  private mapOperationType(type: CLIOperationRequest['type']): WorkflowRequest['type'] {
    const mapping: Record<CLIOperationRequest['type'], WorkflowRequest['type']> = {
      prompt: 'prompt',
      analyze: 'analysis',
      execute: 'tool-execution',
      navigate: 'analysis',
      suggest: 'analysis',
    };
    return mapping[type] || 'prompt';
  }

  /**
   * Enhance input with project configuration context
   */
  private enhanceInputWithProjectContext(
    input: string,
    projectConfig: CombinedProjectConfig
  ): string {
    const contextParts: string[] = [];

    // Add project overview
    if (projectConfig.configuration.name || projectConfig.instructions.projectName) {
      contextParts.push(
        `Project: ${projectConfig.configuration.name || projectConfig.instructions.projectName}`
      );
    }

    // Add language and framework info
    if (projectConfig.configuration.language) {
      let techStack = `Language: ${projectConfig.configuration.language}`;
      if (projectConfig.configuration.framework) {
        techStack += `, Framework: ${projectConfig.configuration.framework}`;
      }
      contextParts.push(techStack);
    }

    // Add custom instructions from CODECRUCIBLE.md
    if (
      projectConfig.instructions.instructions &&
      projectConfig.instructions.instructions.length > 0
    ) {
      contextParts.push(`Custom Project Instructions:\n${projectConfig.instructions.instructions}`);
    }

    // Build enhanced prompt
    if (contextParts.length === 0) {
      return input;
    }

    const contextHeader = `=== PROJECT CONTEXT ===\n${contextParts.join('\n')}\n=== USER REQUEST ===\n`;
    return contextHeader + input;
  }

  /**
   * Enhance input with codebase analysis results
   */
  private enhanceInputWithCodebaseAnalysis(
    input: string,
    analysis: CodebaseAnalysisResult
  ): string {
    if (analysis.chunks.length === 0) {
      return input;
    }

    const contextParts: string[] = [];

    // Add codebase overview
    contextParts.push(`=== CODEBASE ANALYSIS ===`);
    contextParts.push(`Files analyzed: ${analysis.analyzedFiles}/${analysis.totalFiles}`);
    contextParts.push(`Context efficiency: ${(analysis.contextEfficiency * 100).toFixed(1)}%`);

    // Build enhanced prompt
    const contextHeader = `${contextParts.join('\n')}\n\n=== USER REQUEST ===\n`;
    return contextHeader + input;
  }
}

// Create a default instance for convenience
export const useCaseRouter = new UseCaseRouter();

export default UseCaseRouter;