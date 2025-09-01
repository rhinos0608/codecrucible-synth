/**
 * Intelligent Routing Integration Service
 * Application Layer - Integrates intelligent routing with CLI and Living Spiral processes
 *
 * Handles: CLI command routing, Living Spiral phase-aware routing, performance monitoring
 * Imports: Domain services and core routing systems (follows ARCHITECTURE.md)
 */

import { logger } from '../../core/logger.js';

// Domain imports
import { ProcessingRequest } from '../../domain/entities/request.js';
import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';

// Core imports
import {
  IIntelligentRoutingCoordinator,
  IntelligentRoutingDecision,
  RoutingContext,
  RoutingPreferences,
  RoutingPerformance,
} from '../../core/routing/intelligent-routing-coordinator.js';
import { IProviderSelectionStrategy } from '../../core/providers/provider-selection-strategy.js';
import { HybridLLMRouter } from '../../core/hybrid/hybrid-llm-router.js';
import { PerformanceMonitor } from '../../utils/performance.js';

// Use case imports
import {
  LivingSpiralProcessUseCase,
  SpiralIteration,
} from '../use-cases/living-spiral-process-use-case.js';

export interface CLIRoutingRequest {
  command: string;
  args: string[];
  prompt: string;
  context?: Record<string, unknown>;
  preferences?: RoutingPreferences;
  priority?: 'low' | 'medium' | 'high' | 'critical';
}

export interface CLIRoutingResponse {
  routingDecision: IntelligentRoutingDecision;
  executionPlan: ExecutionPlan;
  estimatedCompletion: Date;
  trackingId: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalEstimatedTime: number;
  parallelizable: boolean;
  resourceRequirements: ResourceRequirements;
}

export interface ExecutionStep {
  stepId: string;
  description: string;
  routingDecision: IntelligentRoutingDecision;
  dependencies: string[];
  estimatedDuration: number;
  phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
}

export interface ResourceRequirements {
  memory: number;
  cpu: number;
  networkBandwidth: number;
  storageSpace: number;
}

export interface LivingSpiralRoutingContext {
  initialPrompt: string;
  currentIteration: number;
  phase: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  previousIterations: SpiralIteration[];
  qualityThreshold: number;
  preferences?: RoutingPreferences;
}

export interface IIntelligentRoutingIntegrationService {
  // CLI Integration
  routeCLICommand(request: CLIRoutingRequest): Promise<CLIRoutingResponse>;
  executePlan(plan: ExecutionPlan): Promise<string>;

  // Living Spiral Integration
  routeLivingSpiralPhase(context: LivingSpiralRoutingContext): Promise<IntelligentRoutingDecision>;
  optimizeIterativeProcess(iterations: SpiralIteration[]): Promise<RoutingPreferences>;

  // Performance Monitoring
  recordExecutionPerformance(trackingId: string, performance: RoutingPerformance): void;
  getRoutingAnalytics(): Promise<any>;
  optimizeRouting(): Promise<void>;
}

/**
 * Intelligent Routing Integration Service
 * Connects intelligent routing with application-layer concerns
 */
export class IntelligentRoutingIntegrationService implements IIntelligentRoutingIntegrationService {
  private routingCoordinator: IIntelligentRoutingCoordinator;
  private livingSpiralUseCase: LivingSpiralProcessUseCase;
  private executionTracking: Map<string, { plan: ExecutionPlan; startTime: number }> = new Map();

  constructor(
    routingCoordinator: IIntelligentRoutingCoordinator,
    livingSpiralUseCase: LivingSpiralProcessUseCase
  ) {
    this.routingCoordinator = routingCoordinator;
    this.livingSpiralUseCase = livingSpiralUseCase;
  }

  /**
   * Route CLI commands through intelligent routing system
   */
  async routeCLICommand(request: CLIRoutingRequest): Promise<CLIRoutingResponse> {
    logger.info('Routing CLI command through intelligent system', {
      command: request.command,
      promptLength: request.prompt.length,
    });

    try {
      // Analyze command and create processing request
      const processingRequest = this.createProcessingRequestFromCLI(request);

      // Build routing context
      const routingContext = this.buildRoutingContextFromCLI(processingRequest, request);

      // Get routing decision
      const routingDecision = await this.routingCoordinator.routeRequest(routingContext);

      // Create execution plan
      const executionPlan = this.createExecutionPlan(routingDecision, request);

      // Generate tracking ID
      const trackingId = this.generateTrackingId(request.command);

      // Store execution tracking
      this.executionTracking.set(trackingId, {
        plan: executionPlan,
        startTime: Date.now(),
      });

      const response: CLIRoutingResponse = {
        routingDecision,
        executionPlan,
        estimatedCompletion: new Date(Date.now() + executionPlan.totalEstimatedTime),
        trackingId,
      };

      logger.info('CLI routing completed', {
        trackingId,
        strategy: routingDecision.routingStrategy,
        estimatedTime: `${executionPlan.totalEstimatedTime}ms`,
      });

      return response;
    } catch (error) {
      logger.error('Error routing CLI command', { error, command: request.command });
      throw new Error(`Failed to route CLI command: ${error}`);
    }
  }

  /**
   * Execute a routing-optimized execution plan
   */
  async executePlan(plan: ExecutionPlan): Promise<string> {
    logger.info('Executing routing-optimized plan', {
      steps: plan.steps.length,
      parallelizable: plan.parallelizable,
    });

    try {
      if (plan.parallelizable && plan.steps.length > 1) {
        return await this.executeParallelPlan(plan);
      } else {
        return await this.executeSequentialPlan(plan);
      }
    } catch (error) {
      logger.error('Error executing plan', { error, planSteps: plan.steps.length });
      throw new Error(`Plan execution failed: ${error}`);
    }
  }

  /**
   * Route specific Living Spiral phases with intelligent routing
   */
  async routeLivingSpiralPhase(
    context: LivingSpiralRoutingContext
  ): Promise<IntelligentRoutingDecision> {
    logger.info('Routing Living Spiral phase', {
      phase: context.phase,
      iteration: context.currentIteration,
    });

    try {
      // Create processing request for the phase
      const processingRequest = this.createProcessingRequestFromSpiral(context);

      // Build phase-specific routing context
      const routingContext = this.buildSpiralRoutingContext(processingRequest, context);

      // Get intelligent routing decision
      const decision = await this.routingCoordinator.routeRequest(routingContext);

      // Apply spiral-specific optimizations
      this.applySpiralOptimizations(decision, context);

      logger.info('Living Spiral phase routing completed', {
        phase: context.phase,
        strategy: decision.routingStrategy,
        confidence: decision.confidence,
      });

      return decision;
    } catch (error) {
      logger.error('Error routing Living Spiral phase', {
        error,
        phase: context.phase,
        iteration: context.currentIteration,
      });
      throw new Error(`Living Spiral phase routing failed: ${error}`);
    }
  }

  /**
   * Optimize routing preferences based on iterative process performance
   */
  async optimizeIterativeProcess(iterations: SpiralIteration[]): Promise<RoutingPreferences> {
    logger.info('Optimizing iterative process routing', { iterations: iterations.length });

    try {
      const preferences: RoutingPreferences = {};

      // Analyze phase performance
      const phaseAnalysis = this.analyzePhasePerformance(iterations);

      // Optimize based on quality trends
      if (this.isQualityImproving(iterations)) {
        preferences.prioritizeQuality = true;
        preferences.maxLatency = 30000; // Allow more time for quality
      } else {
        preferences.prioritizeSpeed = true;
        preferences.maxLatency = 10000; // Prioritize speed to break stagnation
      }

      // Optimize voice usage based on phase effectiveness
      if (phaseAnalysis.councilPhaseEffective) {
        preferences.enableMultiVoice = true;
        preferences.maxVoices = 3;
      } else {
        preferences.enableMultiVoice = false;
        preferences.maxVoices = 1;
      }

      // Cost optimization for long processes
      if (iterations.length > 5) {
        preferences.optimizeForCost = true;
        preferences.maxCostPerRequest = 0.02;
      }

      logger.info('Iterative process optimization completed', { preferences });
      return preferences;
    } catch (error) {
      logger.error('Error optimizing iterative process', { error });
      throw new Error(`Iterative process optimization failed: ${error}`);
    }
  }

  /**
   * Record execution performance for routing optimization
   */
  recordExecutionPerformance(trackingId: string, performance: RoutingPerformance): void {
    logger.debug('Recording execution performance', { trackingId, success: performance.success });

    try {
      const execution = this.executionTracking.get(trackingId);
      if (execution) {
        const duration = Date.now() - execution.startTime;

        // Record performance with routing coordinator
        this.routingCoordinator.recordPerformance(trackingId, {
          ...performance,
          actualLatency: duration,
        });

        // Clean up tracking
        this.executionTracking.delete(trackingId);

        logger.debug('Performance recorded successfully', { trackingId, duration });
      } else {
        logger.warn('Execution tracking not found for performance recording', { trackingId });
      }
    } catch (error) {
      logger.error('Error recording execution performance', { error, trackingId });
    }
  }

  /**
   * Get comprehensive routing analytics
   */
  async getRoutingAnalytics(): Promise<any> {
    try {
      const coreAnalytics = this.routingCoordinator.getAnalytics();

      // Add integration-specific analytics
      const integrationAnalytics = {
        cliRequests: this.getCLIAnalytics(),
        spiralProcesses: this.getSpiralAnalytics(),
        executionTracking: this.getExecutionAnalytics(),
      };

      return {
        ...coreAnalytics,
        integration: integrationAnalytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error getting routing analytics', { error });
      throw new Error(`Failed to get routing analytics: ${error}`);
    }
  }

  /**
   * Optimize routing system based on performance data
   */
  async optimizeRouting(): Promise<void> {
    logger.info('Starting routing optimization');

    try {
      // Run core routing optimization
      await this.routingCoordinator.optimizeRouting();

      // Add integration-specific optimizations
      await this.optimizeCLIRouting();
      await this.optimizeSpiralRouting();

      logger.info('Routing optimization completed successfully');
    } catch (error) {
      logger.error('Error during routing optimization', { error });
      throw new Error(`Routing optimization failed: ${error}`);
    }
  }

  // Private helper methods

  private createProcessingRequestFromCLI(request: CLIRoutingRequest): ProcessingRequest {
    // Infer request type from command
    let requestType: string;

    switch (request.command) {
      case 'analyze':
        requestType = 'code-analysis';
        break;
      case 'generate':
      case 'create':
        requestType = 'code-generation';
        break;
      case 'refactor':
        requestType = 'code-refactoring';
        break;
      case 'review':
        requestType = 'code-review';
        break;
      case 'document':
        requestType = 'documentation';
        break;
      case 'test':
        requestType = 'testing';
        break;
      default:
        requestType = 'general';
    }

    return ProcessingRequest.create(
      request.prompt,
      requestType as any,
      request.priority || 'medium',
      request.context || {},
      {}
    );
  }

  private buildRoutingContextFromCLI(
    processingRequest: ProcessingRequest,
    cliRequest: CLIRoutingRequest
  ): RoutingContext {
    return {
      request: processingRequest,
      priority: cliRequest.priority || 'medium',
      preferences: {
        ...cliRequest.preferences,
        // CLI-specific defaults
        enableHybridRouting: true,
        enableLoadBalancing: true,
        learningEnabled: true,
      },
      metrics: {
        hasMultipleFiles: cliRequest.args.some(arg => arg.includes('*')),
        requiresDeepAnalysis: cliRequest.command === 'analyze',
        isTemplateGeneration: cliRequest.command === 'generate',
      },
    };
  }

  private createProcessingRequestFromSpiral(
    context: LivingSpiralRoutingContext
  ): ProcessingRequest {
    // Phase-specific request types
    const phaseRequestTypes = {
      collapse: 'problem-decomposition',
      council: 'multi-perspective-analysis',
      synthesis: 'solution-synthesis',
      rebirth: 'implementation-planning',
      reflection: 'quality-assessment',
    };

    return ProcessingRequest.create(
      context.initialPrompt,
      phaseRequestTypes[context.phase] as any,
      'medium',
      {
        iteration: context.currentIteration,
        previousIterations: context.previousIterations,
      },
      this.getPhaseConstraints(context.phase)
    );
  }

  private buildSpiralRoutingContext(
    processingRequest: ProcessingRequest,
    spiralContext: LivingSpiralRoutingContext
  ): RoutingContext {
    return {
      request: processingRequest,
      priority: 'medium',
      phase: spiralContext.phase,
      preferences: {
        ...spiralContext.preferences,
        // Spiral-specific optimizations
        enableMultiVoice: spiralContext.phase === 'council',
        prioritizeQuality:
          spiralContext.phase === 'synthesis' || spiralContext.phase === 'reflection',
        prioritizeSpeed: spiralContext.phase === 'collapse',
      },
      metrics: {
        requiresDeepAnalysis:
          spiralContext.phase === 'council' || spiralContext.phase === 'reflection',
        estimatedProcessingTime: this.estimatePhaseProcessingTime(spiralContext.phase),
      },
    };
  }

  private getPhaseConstraints(phase: string): any {
    switch (phase) {
      case 'collapse':
        return { mustIncludeVoices: ['explorer'] };
      case 'council':
        return { maxVoices: 3, minVoices: 2 };
      case 'synthesis':
        return { mustIncludeVoices: ['architect'] };
      case 'rebirth':
        return { mustIncludeVoices: ['implementor'] };
      case 'reflection':
        return { mustIncludeVoices: ['guardian'] };
      default:
        return {};
    }
  }

  private createExecutionPlan(
    decision: IntelligentRoutingDecision,
    request: CLIRoutingRequest
  ): ExecutionPlan {
    const steps: ExecutionStep[] = [];
    let totalTime = 0;

    // Create primary execution step
    const primaryStep: ExecutionStep = {
      stepId: 'primary_execution',
      description: `Execute ${request.command} with ${decision.routingStrategy} strategy`,
      routingDecision: decision,
      dependencies: [],
      estimatedDuration: decision.estimatedLatency,
    };

    steps.push(primaryStep);
    totalTime += decision.estimatedLatency;

    // Add post-processing step if needed
    if (decision.routingStrategy === 'multi-voice') {
      const synthesisStep: ExecutionStep = {
        stepId: 'voice_synthesis',
        description: 'Synthesize multi-voice responses',
        routingDecision: decision,
        dependencies: ['primary_execution'],
        estimatedDuration: Math.round(decision.estimatedLatency * 0.2),
      };

      steps.push(synthesisStep);
      totalTime += synthesisStep.estimatedDuration;
    }

    return {
      steps,
      totalEstimatedTime: totalTime,
      parallelizable: decision.routingStrategy === 'load-balanced',
      resourceRequirements: this.estimateResourceRequirements(decision),
    };
  }

  private estimateResourceRequirements(decision: IntelligentRoutingDecision): ResourceRequirements {
    const baseRequirements = {
      memory: 100, // MB
      cpu: 10, // %
      networkBandwidth: 1, // Mbps
      storageSpace: 10, // MB
    };

    // Adjust based on routing strategy
    const multipliers = {
      'single-model': 1.0,
      hybrid: 1.3,
      'multi-voice': 1.5,
      'load-balanced': 1.2,
    };

    const multiplier = multipliers[decision.routingStrategy] || 1.0;

    return {
      memory: Math.round(baseRequirements.memory * multiplier),
      cpu: Math.round(baseRequirements.cpu * multiplier),
      networkBandwidth: baseRequirements.networkBandwidth,
      storageSpace: Math.round(baseRequirements.storageSpace * multiplier),
    };
  }

  private async executeSequentialPlan(plan: ExecutionPlan): Promise<string> {
    logger.debug('Executing sequential plan', { steps: plan.steps.length });

    let result = '';
    for (const step of plan.steps) {
      logger.debug('Executing step', { stepId: step.stepId });
      // In a real implementation, this would execute the actual routing decision
      // For now, return a placeholder
      result += `Step ${step.stepId} completed with ${step.routingDecision.routingStrategy} strategy.\n`;
    }

    return result;
  }

  private async executeParallelPlan(plan: ExecutionPlan): Promise<string> {
    logger.debug('Executing parallel plan', { steps: plan.steps.length });

    // Execute independent steps in parallel
    const parallelSteps = plan.steps.filter(step => step.dependencies.length === 0);
    const sequentialSteps = plan.steps.filter(step => step.dependencies.length > 0);

    // Execute parallel steps
    const parallelResults = await Promise.all(
      parallelSteps.map(async step => {
        logger.debug('Executing parallel step', { stepId: step.stepId });
        return `Step ${step.stepId} completed in parallel.`;
      })
    );

    // Execute sequential steps
    let sequentialResult = '';
    for (const step of sequentialSteps) {
      logger.debug('Executing sequential step', { stepId: step.stepId });
      sequentialResult += `Step ${step.stepId} completed after dependencies.\n`;
    }

    return [...parallelResults, sequentialResult].join('\n');
  }

  private applySpiralOptimizations(
    decision: IntelligentRoutingDecision,
    context: LivingSpiralRoutingContext
  ): void {
    // Apply phase-specific optimizations
    if (context.currentIteration > 1) {
      // Learn from previous iterations
      const avgQuality =
        context.previousIterations.reduce((sum, iter) => sum + iter.quality, 0) /
        context.previousIterations.length;

      if (avgQuality < context.qualityThreshold) {
        // Boost confidence for quality-focused routing
        decision.confidence = Math.min(decision.confidence * 1.1, 1.0);
        decision.reasoning += ' (boosted for quality improvement)';
      }
    }

    // Phase-specific adjustments
    if (context.phase === 'council' && decision.routingStrategy !== 'multi-voice') {
      logger.warn('Council phase should typically use multi-voice routing');
    }
  }

  private analyzePhasePerformance(iterations: SpiralIteration[]): {
    councilPhaseEffective: boolean;
  } {
    const councilIterations = iterations.filter(iter => iter.phase === 'council');
    const avgCouncilQuality =
      councilIterations.length > 0
        ? councilIterations.reduce((sum, iter) => sum + iter.quality, 0) / councilIterations.length
        : 0;

    return {
      councilPhaseEffective: avgCouncilQuality > 0.7,
    };
  }

  private isQualityImproving(iterations: SpiralIteration[]): boolean {
    if (iterations.length < 2) return true;

    const recent = iterations.slice(-3); // Last 3 iterations
    const older = iterations.slice(-6, -3); // Previous 3 iterations

    if (older.length === 0) return true;

    const recentAvg = recent.reduce((sum, iter) => sum + iter.quality, 0) / recent.length;
    const olderAvg = older.reduce((sum, iter) => sum + iter.quality, 0) / older.length;

    return recentAvg > olderAvg;
  }

  private estimatePhaseProcessingTime(phase: string): number {
    const phaseTimes = {
      collapse: 5000, // 5 seconds - quick problem breakdown
      council: 15000, // 15 seconds - multi-voice discussion
      synthesis: 10000, // 10 seconds - unified solution
      rebirth: 12000, // 12 seconds - implementation planning
      reflection: 8000, // 8 seconds - quality assessment
    };

    return phaseTimes[phase as keyof typeof phaseTimes] || 10000;
  }

  private generateTrackingId(command: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${command}_${timestamp}_${random}`;
  }

  private getCLIAnalytics(): any {
    // Implementation would track CLI-specific metrics
    return {
      totalCommands: 0,
      commandTypes: {},
      avgExecutionTime: 0,
    };
  }

  private getSpiralAnalytics(): any {
    // Implementation would track spiral-specific metrics
    return {
      totalProcesses: 0,
      avgIterations: 0,
      convergenceRate: 0,
    };
  }

  private getExecutionAnalytics(): any {
    return {
      activeExecutions: this.executionTracking.size,
      completedExecutions: 0,
      avgExecutionTime: 0,
    };
  }

  private async optimizeCLIRouting(): Promise<void> {
    // Implementation would optimize CLI-specific routing patterns
    logger.debug('Optimizing CLI routing patterns');
  }

  private async optimizeSpiralRouting(): Promise<void> {
    // Implementation would optimize spiral-specific routing patterns
    logger.debug('Optimizing spiral routing patterns');
  }
}
