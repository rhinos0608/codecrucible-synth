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
import { toReadonlyRecord } from '../../utils/type-guards.js';
import {
  type UseCaseDependencies,
  getDependencyContainer,
} from '../services/dependency-container.js';
import type { AnalysisRequest, GenerationRequest } from '../use-cases/index.js';
import { FileReferenceParser } from './file-reference-parser.js';
import {
  type CombinedProjectConfig,
  projectConfigurationLoader,
} from '../config/project-config-loader.js';
import type { CodebaseAnalysisResult } from '../context/context-window-manager.js';
import { type ParsedCommand, naturalLanguageInterface } from './natural-language-interface.js';
import type {
  IWorkflowOrchestrator,
  WorkflowContext,
  WorkflowRequest,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { PromptIntentClassifier, type PromptClassification } from '../../infrastructure/classifiers/prompt-intent-classifier.js';

export interface CLIOperationRequest {
  id: string;
  type: 'prompt' | 'analyze' | 'execute' | 'navigate' | 'suggest';
  input: string | object;
  options?: UseCaseRouterOptions;
  session?: {
    id: string;
    workingDirectory?: string;
    context?: WorkflowContext;
  };
}

export interface CLIOperationResponse {
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
  enhancements?: {
    contextAdded?: boolean;
    suggestions?: unknown[];
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
  private intentClassifier?: PromptIntentClassifier;
  private isInitialized = false;

  public constructor() {
    // Dependencies will be injected during initialization
  }

  /**
   * Initialize the router with dependencies
   */
  public initialize(orchestrator: IWorkflowOrchestrator): void {
    this.orchestrator = orchestrator;
    this.intentClassifier = new PromptIntentClassifier(orchestrator);

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
  public async executeOperation(
    request: Readonly<CLIOperationRequest>
  ): Promise<CLIOperationResponse> {
    if (!this.isInitialized || !this.orchestrator || !this.useCases) {
      throw new Error('UseCaseRouter not initialized. Call initialize() first.');
    }

    const workingDir = request.session?.workingDirectory ?? process.cwd();
    const options = request.options ?? {};

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
          `🏗️ Loaded project config: ${projectConfig.configuration.name ?? 'Unknown'} (${projectConfig.configuration.language ?? 'Unknown'})`
        );
      }
    } catch (error) {
      logger.warn('⚠️ Failed to load project configuration:', toReadonlyRecord(error));
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
        logger.warn('❌ Failed to process @ file references:', toReadonlyRecord(error));
        // Continue with original input on parsing failure
      }
    }

    // AI-driven tool selection: Let the model decide between MCP tools and codebase analysis
    // const codebaseAnalysis: CodebaseAnalysisResult | null = null;

    // Ensure processedInput is a string for downstream processing
    const stringInput =
      typeof processedInput === 'string' ? processedInput : JSON.stringify(processedInput);

    // Enhance input with project context if available
    let contextEnhancedInput = stringInput;
    if (projectConfig && projectConfig.isLoaded) {
      contextEnhancedInput = this.enhanceInputWithProjectContext(stringInput, projectConfig);
    }

    // Further enhance with codebase analysis if available
    // Removed unnecessary always-falsy conditional
    // if (codebaseAnalysis && typeof contextEnhancedInput === 'string') {
    //   contextEnhancedInput = this.enhanceInputWithCodebaseAnalysis(
    //     contextEnhancedInput,
    //     codebaseAnalysis
    //   );
    // }

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
      // Remove unnecessary always-truthy conditional
      logger.info(
        `🔄 Routing: ${request.type} → ${mappedOperation} based on natural language intent`
      );
      effectiveOperationType = mappedOperation;
    }

    let classification: PromptClassification | null = null;
    if (effectiveOperationType === 'prompt' && this.intentClassifier) {
      classification = await this.intentClassifier.classify(enhancedInput);
    }

    // Route to appropriate use case
    // Avoid returning an awaited promise directly
    const result = await this.routeToUseCase(
      effectiveOperationType,
      request,
      enhancedInput,
      options,
      parsedCommand,
      classification
    );
    // Ensure result is of type CLIOperationResponse
    return result;
  }

  /**
   * Route to the appropriate use case based on operation type
   */
  private async routeToUseCase(
    operationType: CLIOperationRequest['type'],
    request: Readonly<CLIOperationRequest>,
    enhancedInput: string,
    options: Readonly<UseCaseRouterOptions>,
    _parsedCommand: Readonly<ParsedCommand> | null,
    classification: PromptClassification | null
  ): Promise<CLIOperationResponse> {
    switch (operationType) {
      case 'analyze': {
        const result: unknown = await this.handleAnalyzeOperation(request, enhancedInput, options);
        return result as CLIOperationResponse;
      }

      case 'prompt': {
        const result: unknown = await this.handlePromptOperation(
          request,
          enhancedInput,
          options,
          classification
        );
        return result as CLIOperationResponse;
      }

      case 'execute':
      case 'navigate':
      case 'suggest':
      default: {
        // Fallback to orchestrator for other operation types
        const result: unknown = await this.executeViaOrchestrator(
          request,
          enhancedInput,
          options,
          classification
        );
        return result as CLIOperationResponse;
      }
    }
  }

  /**
   * Handle analysis operations
   */
  private async handleAnalyzeOperation(
    request: Readonly<CLIOperationRequest>,
    enhancedInput: string,
    options: Readonly<UseCaseRouterOptions>
  ): Promise<CLIOperationResponse> {
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
        const analysisResult = await this.useCases.analyzeDirectoryUseCase.execute(analysisRequest);
        const success =
          typeof analysisResult === 'object' &&
          analysisResult !== null &&
          'success' in analysisResult
            ? (analysisResult as { success: boolean }).success
            : true;
        return {
          id: request.id,
          success,
          result: analysisResult,
          metrics: {
            processingTime: 0,
            contextConfidence: 1,
            systemHealth: 1,
          },
        };
      } else {
        const analysisResult = await this.useCases.analyzeFileUseCase.execute(analysisRequest);
        const success =
          typeof analysisResult === 'object' &&
          analysisResult !== null &&
          'success' in analysisResult
            ? (analysisResult as { success: boolean }).success
            : true;
        return {
          id: request.id,
          success,
          result: analysisResult,
          metrics: {
            processingTime: 0,
            contextConfidence: 1,
            systemHealth: 1,
          },
        };
      }
    } else {
      // SIMPLIFIED: Always route to orchestrator with tools available
      // Let the AI and system prompt decide when and how to use tools
      logger.info('🎯 Routing to AI orchestrator (tools available, AI decides usage)');
      const orchestratorResult = (await this.executeViaOrchestrator(
        request,
        enhancedInput,
        options
      )) as CLIOperationResponse;
      return orchestratorResult;
    }
  }

  /**
   * Handle prompt operations (including code generation)
   */
  private async handlePromptOperation(
    request: Readonly<CLIOperationRequest>,
    enhancedInput: unknown,
    options: Readonly<UseCaseRouterOptions>,
    classification: PromptClassification | null
  ): Promise<unknown> {
    if (!this.useCases) {
      throw new Error('Use cases not available');
    }

    // All prompts go to orchestrator - let AI decide naturally what to do
    const result = await this.executeViaOrchestrator(
      request,
      enhancedInput,
      options,
      classification
    );
    return result as CLIOperationResponse;
  }

  /**
   * Execute via orchestrator (fallback for non-use-case operations)
   */
  private async executeViaOrchestrator(
    request: Readonly<CLIOperationRequest>,
    enhancedInput: unknown,
    options: Readonly<UseCaseRouterOptions>,
    classification?: PromptClassification | null
  ): Promise<unknown> {
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
        intent: classification?.intent,
        riskLevel: classification?.riskLevel,
      },
    };

    const workflowResponse = await this.orchestrator.processRequest(workflowRequest);

    if (!workflowResponse.success) {
      throw workflowResponse.error || new Error('Workflow execution failed');
    }

    return workflowResponse.result as CLIOperationResponse;
  }

  /**
   * Extract generation context from request
   */
  private extractGenerationContext(
    _request: Readonly<CLIOperationRequest>
  ): GenerationRequest['context'] {
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
