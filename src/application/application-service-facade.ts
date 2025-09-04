/**
 * Application Service Facade
 * Application Layer - Clean interface for all use cases
 *
 * Provides: Clean separation from infrastructure with proper input/output transformation
 * Handles: Use case orchestration without infrastructure dependencies
 * Imports: Domain services and application use cases only (follows ARCHITECTURE.md)
 */

import {
  ProcessAIRequestUseCase,
  AIRequestInput,
  AIRequestOutput,
} from './use-cases/process-ai-request-use-case.js';
import {
  MultiVoiceSynthesisUseCase,
  MultiVoiceSynthesisInput,
  MultiVoiceSynthesisOutput,
} from './use-cases/multi-voice-synthesis-use-case.js';
import {
  LivingSpiralProcessUseCase,
  LivingSpiralInput,
  LivingSpiralOutput,
} from './use-cases/living-spiral-process-use-case.js';
import {
  AnalyzeCodebaseUseCase,
  CodebaseAnalysisInput,
  CodebaseAnalysisOutput,
} from './use-cases/analyze-codebase-use-case.js';
import {
  SimplifiedLivingSpiralCoordinator,
  SimplifiedSpiralInput,
  SimplifiedSpiralOutput,
} from './coordinators/simplified-living-spiral-coordinator.js';
import { VoiceOrchestrationService } from '../domain/services/voice-orchestration-service.js';
import { ModelSelectionService } from '../domain/services/model-selection-service.js';
import { UnifiedModelClient } from './services/model-client.js';

/**
 * Application Service Facade
 * Single entry point for all application layer use cases
 * Ensures clean separation from infrastructure concerns
 */
export class ApplicationServiceFacade {
  private processAIRequestUseCase: ProcessAIRequestUseCase;
  private multiVoiceSynthesisUseCase: MultiVoiceSynthesisUseCase;
  private livingSpiralProcessUseCase: LivingSpiralProcessUseCase;
  private analyzeCodebaseUseCase: AnalyzeCodebaseUseCase;
  private simplifiedLivingSpiralCoordinator: SimplifiedLivingSpiralCoordinator;

  constructor(
    voiceOrchestrationService: VoiceOrchestrationService,
    modelSelectionService: ModelSelectionService,
    modelClient?: UnifiedModelClient
  ) {
    // Validate required dependencies - fail fast if critical services are missing
    if (!modelClient) {
      throw new Error(
        'UnifiedModelClient is required for ApplicationServiceFacade. Please ensure the model client is properly initialized.'
      );
    }

    // Initialize use cases with domain services (no infrastructure dependencies)
    this.processAIRequestUseCase = new ProcessAIRequestUseCase(
      modelSelectionService,
      voiceOrchestrationService,
      modelClient
    );

    this.multiVoiceSynthesisUseCase = new MultiVoiceSynthesisUseCase(
      voiceOrchestrationService,
      modelSelectionService
    );

    this.livingSpiralProcessUseCase = new LivingSpiralProcessUseCase(
      voiceOrchestrationService,
      modelClient
    );

    this.analyzeCodebaseUseCase = new AnalyzeCodebaseUseCase(modelSelectionService);

    this.simplifiedLivingSpiralCoordinator = new SimplifiedLivingSpiralCoordinator(
      voiceOrchestrationService,
      modelSelectionService
    );
  }

  /**
   * Process a single AI request
   * Use case: Basic AI interaction
   */
  async processAIRequest(input: AIRequestInput): Promise<AIRequestOutput> {
    return await this.processAIRequestUseCase.execute(input);
  }

  /**
   * Execute multi-voice synthesis
   * Use case: Complex problem solving with multiple perspectives
   */
  async executeMultiVoiceSynthesis(
    input: MultiVoiceSynthesisInput
  ): Promise<MultiVoiceSynthesisOutput> {
    return await this.multiVoiceSynthesisUseCase.execute(input);
  }

  /**
   * Execute Living Spiral process (legacy interface)
   * Use case: Iterative development methodology
   */
  async executeLivingSpiralProcess(input: LivingSpiralInput): Promise<LivingSpiralOutput> {
    return await this.livingSpiralProcessUseCase.execute(input);
  }

  /**
   * Execute Simplified Living Spiral process (new interface)
   * Use case: Clean iterative development with better separation of concerns
   */
  async executeSimplifiedSpiralProcess(
    input: SimplifiedSpiralInput
  ): Promise<SimplifiedSpiralOutput> {
    return await this.simplifiedLivingSpiralCoordinator.executeSpiralProcess(input);
  }

  /**
   * Analyze codebase
   * Use case: Code analysis and recommendations
   */
  async analyzeCodebase(input: CodebaseAnalysisInput): Promise<CodebaseAnalysisOutput> {
    return await this.analyzeCodebaseUseCase.execute(input);
  }

  /**
   * Get available use cases
   * Returns: List of available application operations
   */
  getAvailableUseCases(): Array<{
    name: string;
    description: string;
    inputType: string;
    outputType: string;
  }> {
    return [
      {
        name: 'processAIRequest',
        description: 'Process a single AI request with model and voice selection',
        inputType: 'AIRequestInput',
        outputType: 'AIRequestOutput',
      },
      {
        name: 'executeMultiVoiceSynthesis',
        description: 'Execute multi-voice synthesis for complex problems',
        inputType: 'MultiVoiceSynthesisInput',
        outputType: 'MultiVoiceSynthesisOutput',
      },
      {
        name: 'executeLivingSpiralProcess',
        description: 'Execute iterative Living Spiral development process',
        inputType: 'LivingSpiralInput',
        outputType: 'LivingSpiralOutput',
      },
      {
        name: 'executeSimplifiedSpiralProcess',
        description: 'Execute simplified Living Spiral process with clean architecture',
        inputType: 'SimplifiedSpiralInput',
        outputType: 'SimplifiedSpiralOutput',
      },
      {
        name: 'analyzeCodebase',
        description: 'Analyze codebase structure, quality, and provide recommendations',
        inputType: 'CodebaseAnalysisInput',
        outputType: 'CodebaseAnalysisOutput',
      },
    ];
  }

  /**
   * Health check for application services
   * Returns: Status of application layer components
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, 'available' | 'unavailable'>;
    timestamp: Date;
  }> {
    const services: Record<string, 'available' | 'unavailable'> = {};

    try {
      // Test each use case availability (simplified check)
      services.processAIRequest = this.processAIRequestUseCase ? 'available' : 'unavailable';
      services.multiVoiceSynthesis = this.multiVoiceSynthesisUseCase ? 'available' : 'unavailable';
      services.livingSpiralProcess = this.livingSpiralProcessUseCase ? 'available' : 'unavailable';
      services.simplifiedSpiralProcess = this.simplifiedLivingSpiralCoordinator
        ? 'available'
        : 'unavailable';
      services.codebaseAnalysis = this.analyzeCodebaseUseCase ? 'available' : 'unavailable';

      const unavailableCount = Object.values(services).filter(
        status => status === 'unavailable'
      ).length;
      const status =
        unavailableCount === 0 ? 'healthy' : unavailableCount < 3 ? 'degraded' : 'unhealthy';

      return {
        status,
        services,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        services: Object.fromEntries(Object.keys(services).map(key => [key, 'unavailable'])),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Graceful shutdown
   * Cleanup application resources
   */
  async shutdown(): Promise<void> {
    // Clean shutdown of use cases if needed
    // In current implementation, no special cleanup required
    // This method provides extension point for future needs
  }
}

// Export types for external use
export type {
  AIRequestInput,
  AIRequestOutput,
  MultiVoiceSynthesisInput,
  MultiVoiceSynthesisOutput,
  LivingSpiralInput,
  LivingSpiralOutput,
  SimplifiedSpiralInput,
  SimplifiedSpiralOutput,
  CodebaseAnalysisInput,
  CodebaseAnalysisOutput,
};
