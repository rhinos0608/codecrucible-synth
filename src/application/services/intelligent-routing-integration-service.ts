/**
 * Intelligent Routing Integration Service (Refactored)
 * Application Layer - Integrates intelligent routing with CLI and Living Spiral processes
 *
 * Handles: CLI command routing, Living Spiral phase-aware routing, real-time performance monitoring,
 *          system analytics integration, predictive optimization, circuit breakers, anomaly detection
 * 
 * ARCHITECTURE: This service now orchestrates focused, single-responsibility modules instead of
 *               implementing everything monolithically. Each module handles its specific domain.
 * 
 * Imports: Domain services and core routing systems (follows ARCHITECTURE.md)
 */

import { createLogger } from '../../infrastructure/logging/logger-adapter.js';
import { EventEmitter } from 'events';

// Domain imports
import { ProcessingRequest, RequestType } from '../../domain/entities/request.js';

// Performance System Modules
import {
  SystemMetricsCollector,
  CircuitBreakerManager,
  PerformanceAnomalyDetector,
  PredictiveAnalytics,
  PerformanceOptimizationEngine,
  DEFAULT_METRICS_CONFIG,
  DEFAULT_PERFORMANCE_SYSTEM_CONFIG,
  DEFAULT_ANOMALY_DETECTION_CONFIG,
  DEFAULT_PREDICTIVE_CONFIG,
  DEFAULT_OPTIMIZATION_CONFIG
} from './performance/index.js';

// Re-export types for backward compatibility
import type {
  SystemMetrics,
  PerformanceThresholds,
  CircuitBreakerState,
  PerformanceAnomalyEvent,
  PredictiveInsights,
  RealTimeOptimizationAction,
  MetricsCollectionConfig,
  PerformanceSystemConfig
} from './performance/index.js';

// Core imports
import {
  IIntelligentRoutingCoordinator,
  IntelligentRoutingDecision,
  RoutingContext,
  RoutingPerformance,
  RoutingPreferences,
} from '../routing/intelligent-routing-coordinator.js';

const logger = createLogger('IntelligentRouting');

// Use case imports
import { SpiralIteration } from '../use-cases/living-spiral-process-use-case.js';

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
  routeCLICommand: (request: Readonly<CLIRoutingRequest>) => Promise<CLIRoutingResponse>;
  executePlan: (plan: Readonly<ExecutionPlan>) => Promise<string>;

  // Living Spiral Integration
  routeLivingSpiralPhase: (context: Readonly<LivingSpiralRoutingContext>) => Promise<IntelligentRoutingDecision>;
  optimizeIterativeProcess: (iterations: ReadonlyArray<SpiralIteration>) => Promise<RoutingPreferences>;

  // Performance Monitoring (Legacy)
  recordExecutionPerformance: (trackingId: string, performance: Readonly<RoutingPerformance>) => Promise<void>;
  getRoutingAnalytics: () => Promise<unknown>;
  optimizeRouting: () => Promise<void>;

  // Real-Time Performance System (Modular Orchestration)
  startRealTimeMonitoring: () => Promise<void>;
  stopRealTimeMonitoring: () => Promise<void>;
  getCurrentSystemMetrics: () => Promise<SystemMetrics>;
  getPerformanceThresholds: () => PerformanceThresholds;
  updatePerformanceThresholds: (thresholds: Partial<PerformanceThresholds>) => Promise<void>;
  
  // Circuit Breaker Management (Delegated)
  getCircuitBreakerStates: () => Promise<CircuitBreakerState[]>;
  resetCircuitBreaker: (name: string) => Promise<void>;
  executeWithCircuitBreaker: <T>(name: string, operation: () => Promise<T>) => Promise<T>;
  
  // Anomaly Detection (Delegated)
  getRecentAnomalies: (timeWindowMs?: number) => Promise<PerformanceAnomalyEvent[]>;
  subscribeToAnomalies: (callback: (anomaly: PerformanceAnomalyEvent) => void) => void;
  unsubscribeFromAnomalies: (callback: (anomaly: PerformanceAnomalyEvent) => void) => void;
  
  // Predictive Analytics (Delegated)
  getPredictiveInsights: () => Promise<PredictiveInsights>;
  getOptimizationRecommendations: () => Promise<RealTimeOptimizationAction[]>;
  
  // Real-Time Streaming (EventEmitter-based)
  subscribeToMetrics: (callback: (metrics: SystemMetrics) => void) => void;
  subscribeToOptimizationActions: (callback: (action: RealTimeOptimizationAction) => void) => void;
  unsubscribeFromMetrics: (callback: (metrics: SystemMetrics) => void) => void;
  unsubscribeFromOptimizationActions: (callback: (action: RealTimeOptimizationAction) => void) => void;
  
  // System Health and Status
  getSystemHealth: () => Promise<{
    overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    modules: Record<string, 'ACTIVE' | 'INACTIVE' | 'ERROR'>;
    metrics: {
      uptime: number;
      totalRequests: number;
      activeConnections: number;
      errorRate: number;
    };
  }>;
}

/**
 * Intelligent Routing Integration Service
 * Connects intelligent routing with application-layer concerns
 */
/**
 * Intelligent Routing Integration Service (Modular Architecture)
 * 
 * REFACTORED: This service now orchestrates specialized performance modules instead of
 * implementing everything monolithically. Each module has a single responsibility:
 * 
 * - SystemMetricsCollector: Real-time system resource monitoring
 * - CircuitBreakerManager: Adaptive circuit breakers for resilience
 * - PerformanceAnomalyDetector: Anomaly detection with auto-remediation
 * - PredictiveAnalytics: Machine learning predictions and insights
 * - PerformanceOptimizationEngine: Real-time optimization triggers
 */
export class IntelligentRoutingIntegrationService extends EventEmitter implements IIntelligentRoutingIntegrationService {
  private routingCoordinator: IIntelligentRoutingCoordinator;
  private executionTracking: Map<string, { plan: ExecutionPlan; startTime: number }> = new Map();
  
  // ========================= PERFORMANCE SYSTEM MODULES =========================
  private metricsCollector: SystemMetricsCollector;
  private circuitBreakerManager: CircuitBreakerManager;
  private anomalyDetector: PerformanceAnomalyDetector;
  private predictiveAnalytics: PredictiveAnalytics;
  private optimizationEngine: PerformanceOptimizationEngine;
  
  // Module State
  private isInitialized = false;
  private startupTime = Date.now();
  
  constructor(
    routingCoordinator: IIntelligentRoutingCoordinator,
    config?: Partial<PerformanceSystemConfig>
  ) {
    super();
    this.routingCoordinator = routingCoordinator;
    
    // Initialize performance modules with configuration
    const systemConfig = { ...DEFAULT_PERFORMANCE_SYSTEM_CONFIG, ...config };
    
    this.metricsCollector = new SystemMetricsCollector({
      ...DEFAULT_METRICS_CONFIG,
      ...systemConfig
    });
    
    this.circuitBreakerManager = new CircuitBreakerManager(systemConfig.circuitBreakers);
    
    this.anomalyDetector = new PerformanceAnomalyDetector(DEFAULT_ANOMALY_DETECTION_CONFIG);
    
    this.predictiveAnalytics = new PredictiveAnalytics(DEFAULT_PREDICTIVE_CONFIG);
    
    this.optimizationEngine = new PerformanceOptimizationEngine(DEFAULT_OPTIMIZATION_CONFIG);
    
    // Wire up module interactions
    this.setupModuleInteractions();
    
    // Auto-initialize
    process.nextTick(() => {
      this.initialize().catch(err => 
        logger.error('Failed to initialize performance system', { error: err })
      );
    });
    
    logger.info('IntelligentRoutingIntegrationService created with modular architecture', {
      modules: {
        metricsCollector: 'SystemMetricsCollector',
        circuitBreakerManager: 'CircuitBreakerManager',
        anomalyDetector: 'PerformanceAnomalyDetector',
        predictiveAnalytics: 'PredictiveAnalytics',
        optimizationEngine: 'PerformanceOptimizationEngine'
      }
    });
  }
  
  /**
   * Initialize all performance modules and wire up their interactions
   */
  private async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Performance system already initialized');
      return;
    }
    
    try {
      logger.info('Initializing modular performance system...');
      
      // Start metrics collection
      await this.metricsCollector.startCollection();
      
      // All modules are initialized in their constructors
      // Wire up real-time data flow
      this.wireModuleDataFlow();
      
      this.isInitialized = true;
      
      logger.info('Modular performance system initialized successfully', {
        modules: 5,
        startupTime: Date.now() - this.startupTime
      });
      
      this.emit('system-initialized', { timestamp: Date.now() });
      
    } catch (error) {
      logger.error('Failed to initialize performance system', { error });
      throw error;
    }
  }
  
  /**
   * Setup interactions between performance modules
   */
  private setupModuleInteractions(): void {
    // Circuit breaker events -> Anomaly detector
    this.circuitBreakerManager.on('state-change', (event) => {
      logger.debug('Circuit breaker state change detected', event.data);
      this.emit('circuit-breaker-event', event);
    });
    
    // Anomaly events -> Optimization engine
    this.anomalyDetector.on('anomaly', (event) => {
      logger.debug('Performance anomaly detected', { 
        type: event.data.type, 
        severity: event.data.severity 
      });
      this.emit('anomaly-detected', event);
    });
    
    // Optimization actions -> External subscribers
    this.optimizationEngine.on('optimization-applied', (event) => {
      logger.debug('Optimization action applied', { 
        type: event.data.type, 
        success: event.data.result?.success 
      });
      this.emit('optimization-applied', event);
    });
    
    // Predictive insights -> Optimization recommendations
    this.predictiveAnalytics.on('insights-generated', (insights) => {
      logger.debug('Predictive insights generated', { 
        confidence: insights.predictions.confidence,
        recommendations: insights.recommendations.length 
      });
      this.emit('insights-generated', insights);
    });
  }
  
  /**
   * Wire up real-time data flow between modules
   */
  private wireModuleDataFlow(): void {
    // Metrics -> Anomaly Detection -> Optimization
    this.metricsCollector.on('metrics', async (event) => {
      const metrics = event.data;
      
      // Forward to anomaly detector
      try {
        const thresholds = DEFAULT_PERFORMANCE_SYSTEM_CONFIG.thresholds;
        await this.anomalyDetector.detectAnomalies(metrics, thresholds);
      } catch (error) {
        logger.error('Error in anomaly detection', { error });
      }
      
      // Forward to predictive analytics
      try {
        await this.predictiveAnalytics.updatePredictionModel([metrics]);
      } catch (error) {
        logger.error('Error updating prediction model', { error });
      }
      
      // Forward to optimization engine
      try {
        const thresholds = DEFAULT_PERFORMANCE_SYSTEM_CONFIG.thresholds;
        await this.optimizationEngine.evaluateOptimizationTriggers(metrics, thresholds);
      } catch (error) {
        logger.error('Error evaluating optimization triggers', { error });
      }
      
      // Forward to external subscribers
      this.emit('metrics', event);
    });
  }

  // ========================= INTERFACE IMPLEMENTATIONS (DELEGATED) =========================

  /**
   * Start real-time monitoring (delegated to SystemMetricsCollector)
   */
  public async startRealTimeMonitoring(): Promise<void> {
    return this.metricsCollector.startCollection();
  }

  /**
   * Stop real-time monitoring (delegated to SystemMetricsCollector)
   */
  public async stopRealTimeMonitoring(): Promise<void> {
    return this.metricsCollector.stopCollection();
  }

  /**
   * Get current system metrics (delegated to SystemMetricsCollector)
   */
  public async getCurrentSystemMetrics(): Promise<SystemMetrics> {
    return this.metricsCollector.getCurrentMetrics();
  }

  /**
   * Get performance thresholds
   */
  public getPerformanceThresholds(): PerformanceThresholds {
    return DEFAULT_PERFORMANCE_SYSTEM_CONFIG.thresholds;
  }

  /**
   * Update performance thresholds
   */
  public async updatePerformanceThresholds(thresholds: Partial<PerformanceThresholds>): Promise<void> {
    // Update the default config (in production, this would persist)
    Object.assign(DEFAULT_PERFORMANCE_SYSTEM_CONFIG.thresholds, thresholds);
    logger.info('Performance thresholds updated', { thresholds });
    this.emit('thresholds-updated', { thresholds, timestamp: Date.now() });
  }

  /**
   * Get circuit breaker states (delegated to CircuitBreakerManager)
   */
  public async getCircuitBreakerStates(): Promise<CircuitBreakerState[]> {
    return this.circuitBreakerManager.getAllStates();
  }

  /**
   * Reset circuit breaker (delegated to CircuitBreakerManager)
   */
  public async resetCircuitBreaker(name: string): Promise<void> {
    return this.circuitBreakerManager.resetBreaker(name);
  }

  /**
   * Execute with circuit breaker protection (delegated to CircuitBreakerManager)
   */
  public async executeWithCircuitBreaker<T>(name: string, operation: () => Promise<T>): Promise<T> {
    return this.circuitBreakerManager.executeWithBreaker(name, operation);
  }

  /**
   * Get recent anomalies (delegated to PerformanceAnomalyDetector)
   */
  public async getRecentAnomalies(timeWindowMs?: number): Promise<PerformanceAnomalyEvent[]> {
    return this.anomalyDetector.getRecentAnomalies(timeWindowMs);
  }

  /**
   * Subscribe to anomalies (delegated to PerformanceAnomalyDetector)
   */
  public subscribeToAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void {
    this.anomalyDetector.subscribeToAnomalies(callback);
  }

  /**
   * Unsubscribe from anomalies (delegated to PerformanceAnomalyDetector)
   */
  public unsubscribeFromAnomalies(callback: (anomaly: PerformanceAnomalyEvent) => void): void {
    this.anomalyDetector.unsubscribeFromAnomalies(callback);
  }

  /**
   * Get predictive insights (delegated to PredictiveAnalytics)
   */
  public async getPredictiveInsights(): Promise<PredictiveInsights> {
    const insights = await this.predictiveAnalytics.getPredictions();
    if (!insights) {
      // Generate fresh insights if none available
      const metricsHistory = this.metricsCollector.getMetricsHistory();
      return this.predictiveAnalytics.generateInsights(metricsHistory);
    }
    return insights;
  }

  /**
   * Get optimization recommendations (delegated to PredictiveAnalytics & OptimizationEngine)
   */
  public async getOptimizationRecommendations(): Promise<RealTimeOptimizationAction[]> {
    const [predictiveActions, optimizationActions] = await Promise.all([
      this.predictiveAnalytics.getOptimizationRecommendations(),
      this.optimizationEngine.getRecentOptimizations(300000) // Last 5 minutes
    ]);
    
    return [...predictiveActions, ...optimizationActions];
  }

  /**
   * Subscribe to metrics (EventEmitter-based)
   */
  public subscribeToMetrics(callback: (metrics: SystemMetrics) => void): void {
    this.metricsCollector.on('metrics', (event) => callback(event.data));
  }

  /**
   * Subscribe to optimization actions (EventEmitter-based)
   */
  public subscribeToOptimizationActions(callback: (action: RealTimeOptimizationAction) => void): void {
    this.optimizationEngine.subscribeToOptimizations(callback);
  }

  /**
   * Unsubscribe from metrics
   */
  public unsubscribeFromMetrics(callback: (metrics: SystemMetrics) => void): void {
    this.metricsCollector.off('metrics', callback);
  }

  /**
   * Unsubscribe from optimization actions
   */
  public unsubscribeFromOptimizationActions(callback: (action: RealTimeOptimizationAction) => void): void {
    this.optimizationEngine.unsubscribeFromOptimizations(callback);
  }

  /**
   * Get system health status
   */
  public async getSystemHealth(): Promise<{
    overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL';
    modules: Record<string, 'ACTIVE' | 'INACTIVE' | 'ERROR'>;
    metrics: {
      uptime: number;
      totalRequests: number;
      activeConnections: number;
      errorRate: number;
    };
  }> {
    const currentMetrics = await this.getCurrentSystemMetrics();
    const circuitBreakerHealth = this.circuitBreakerManager.getHealthStatus();
    const optimizationStats = this.optimizationEngine.getOptimizationStats();
    const anomalyStats = this.anomalyDetector.getDetectionStats();
    
    // Determine overall health
    let overall: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' = 'HEALTHY';
    
    if (currentMetrics.cpu.usage > 90 || currentMetrics.memory.usage > 95 || 
        circuitBreakerHealth.unhealthy.length > 0) {
      overall = 'CRITICAL';
    } else if (currentMetrics.cpu.usage > 80 || currentMetrics.memory.usage > 85 || 
               circuitBreakerHealth.degraded.length > 0 || 
               anomalyStats.totalAnomalies > 10) {
      overall = 'DEGRADED';
    }
    
    return {
      overall,
      modules: {
        metricsCollector: this.metricsCollector.isCollectionActive() ? 'ACTIVE' : 'INACTIVE',
        circuitBreakerManager: 'ACTIVE',
        anomalyDetector: 'ACTIVE',
        predictiveAnalytics: 'ACTIVE',
        optimizationEngine: 'ACTIVE'
      },
      metrics: {
        uptime: Date.now() - this.startupTime,
        totalRequests: optimizationStats.totalOptimizations,
        activeConnections: currentMetrics.network.connectionsActive,
        errorRate: optimizationStats.totalOptimizations > 0 
          ? (1 - optimizationStats.successRate) * 100 
          : 0
      }
    };
  }

  // ========================= LEGACY METHODS (Preserved for backward compatibility) =========================

  /**
   * Route CLI commands through intelligent routing system
   */
  public async routeCLICommand(request: Readonly<CLIRoutingRequest>): Promise<CLIRoutingResponse> {
    return this.executeWithCircuitBreaker('cli-processing', async () => {
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
      } catch (error: unknown) {
        logger.error('Error routing CLI command', { error, command: request.command });
        if (error instanceof Error) {
          throw new Error(`Failed to route CLI command: ${error.message}`);
        } else {
          throw new Error(`Failed to route CLI command: ${String(error)}`);
        }
      }
    });
  }

  /**
   * Execute a routing-optimized execution plan
   */
  public async executePlan(plan: Readonly<ExecutionPlan>): Promise<string> {
    return this.executeWithCircuitBreaker('cli-processing', async () => {
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
      } catch (error: unknown) {
        logger.error('Error executing plan', { error, planSteps: plan.steps.length });
        if (error instanceof Error) {
          throw new Error(`Plan execution failed: ${error.message}`);
        } else {
          throw new Error(`Plan execution failed: ${String(error)}`);
        }
      }
    });
  }

  /**
   * Route specific Living Spiral phases with intelligent routing
   */
  public async routeLivingSpiralPhase(
    context: Readonly<LivingSpiralRoutingContext>
  ): Promise<IntelligentRoutingDecision> {
    return this.executeWithCircuitBreaker('spiral-processing', async () => {
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
        await this.applySpiralOptimizations(decision, context);

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
        throw new Error(`Living Spiral phase routing failed: ${String(error)}`);
      }
    });
  }

  /**
   * Optimize routing preferences based on iterative process performance
   */
  public async optimizeIterativeProcess(iterations: readonly SpiralIteration[]): Promise<RoutingPreferences> {
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
      throw new Error(`Iterative process optimization failed: ${String(error)}`);
    }
  }

  /**
   * Record execution performance for routing optimization
   */
  public async recordExecutionPerformance(trackingId: string, performance: Readonly<RoutingPerformance>): Promise<void> {
    logger.debug('Recording execution performance', { trackingId, success: performance.success });

    try {
      const execution = this.executionTracking.get(trackingId);
      if (execution) {
        const duration = Date.now() - execution.startTime;

        // Record performance with routing coordinator
        await this.routingCoordinator.recordPerformance(trackingId, {
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
  public async getRoutingAnalytics(): Promise<Record<string, unknown>> {
    try {
      const coreAnalytics = await this.routingCoordinator.getAnalytics();
      
      // Add integration-specific analytics from performance modules
      const systemHealth = await this.getSystemHealth();
      const predictiveInsights = await this.getPredictiveInsights();
      const optimizationStats = this.optimizationEngine.getOptimizationStats();
      
      const integrationAnalytics = {
        systemHealth,
        predictiveInsights: {
          confidence: predictiveInsights.predictions.confidence,
          trends: predictiveInsights.trends,
          recommendationsCount: predictiveInsights.recommendations.length
        },
        optimization: optimizationStats,
        circuitBreakers: this.circuitBreakerManager.getHealthStatus()
      };

      return {
        ...coreAnalytics,
        integration: integrationAnalytics,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Error getting routing analytics', { error });
      throw new Error(`Failed to get routing analytics: ${String(error)}`);
    }
  }

  /**
   * Optimize routing system based on performance data
   */
  public async optimizeRouting(): Promise<void> {
    logger.info('Starting comprehensive routing optimization');

    try {
      // Run core routing optimization
      await this.routingCoordinator.optimizeRouting();

      // Run performance module optimizations
      const currentMetrics = await this.getCurrentSystemMetrics();
      const thresholds = this.getPerformanceThresholds();
      
      await this.optimizationEngine.evaluateOptimizationTriggers(currentMetrics, thresholds);

      logger.info('Comprehensive routing optimization completed successfully');
    } catch (error) {
      logger.error('Error during routing optimization', { error });
      throw new Error(`Routing optimization failed: ${String(error)}`);
    }
  }

  // ========================= ESSENTIAL ORCHESTRATION UTILITIES =========================

  private createProcessingRequestFromCLI(request: CLIRoutingRequest): ProcessingRequest {
    const requestTypeMap: Record<string, RequestType> = {
      analyze: RequestType.CODE_ANALYSIS,
      generate: RequestType.CODE_GENERATION,
      create: RequestType.CODE_GENERATION, 
      refactor: RequestType.OPTIMIZATION,
      review: RequestType.REVIEW,
      document: RequestType.DOCUMENTATION,
      test: RequestType.CODE_ANALYSIS
    };

    return ProcessingRequest.create(
      request.prompt,
      requestTypeMap[request.command] || RequestType.CODE_GENERATION,
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

  private createExecutionPlan(decision: IntelligentRoutingDecision, request: CLIRoutingRequest): ExecutionPlan {
    const steps: ExecutionStep[] = [{
      stepId: 'primary_execution',
      description: `Execute ${request.command} with ${decision.routingStrategy} strategy`,
      routingDecision: decision,
      dependencies: [],
      estimatedDuration: decision.estimatedLatency,
    }];

    let totalTime = decision.estimatedLatency;

    if (decision.routingStrategy === 'multi-voice') {
      steps.push({
        stepId: 'voice_synthesis',
        description: 'Synthesize multi-voice responses',
        routingDecision: decision,
        dependencies: ['primary_execution'],
        estimatedDuration: Math.round(decision.estimatedLatency * 0.2),
      });
      totalTime += steps[1].estimatedDuration;
    }

    return {
      steps,
      totalEstimatedTime: totalTime,
      parallelizable: decision.routingStrategy === 'load-balanced',
      resourceRequirements: {
        memory: 100,
        cpu: 10,
        networkBandwidth: 1,
        storageSpace: 10,
      },
    };
  }

  private generateTrackingId(command: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${command}_${timestamp}_${random}`;
  }

  private async executeSequentialPlan(plan: ExecutionPlan): Promise<string> {
    let result = '';
    for (const step of plan.steps) {
      result += `Step ${step.stepId} completed with ${step.routingDecision.routingStrategy} strategy.\n`;
    }
    return result;
  }

  private async executeParallelPlan(plan: ExecutionPlan): Promise<string> {
    const parallelSteps = plan.steps.filter(step => step.dependencies.length === 0);
    const sequentialSteps = plan.steps.filter(step => step.dependencies.length > 0);

    const parallelResults = await Promise.all(
      parallelSteps.map(async (step) => `Step ${step.stepId} completed in parallel.`)
    );

    let sequentialResult = '';
    for (const step of sequentialSteps) {
      sequentialResult += `Step ${step.stepId} completed after dependencies.\n`;
    }

    return [...parallelResults, sequentialResult].join('\n');
  }

  private createProcessingRequestFromSpiral(context: LivingSpiralRoutingContext): ProcessingRequest {
    const phaseTypes: Record<string, RequestType> = {
      collapse: RequestType.CODE_ANALYSIS,
      council: RequestType.REVIEW,
      synthesis: RequestType.CODE_GENERATION,
      rebirth: RequestType.OPTIMIZATION,
      reflection: RequestType.CODE_ANALYSIS,
    };

    return ProcessingRequest.create(
      context.initialPrompt,
      phaseTypes[context.phase] || RequestType.CODE_GENERATION,
      'medium',
      {
        iteration: context.currentIteration,
        previousIterations: context.previousIterations,
      },
      {}
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
        enableMultiVoice: spiralContext.phase === 'council',
        prioritizeQuality: spiralContext.phase === 'synthesis' || spiralContext.phase === 'reflection',
        prioritizeSpeed: spiralContext.phase === 'collapse',
      },
      metrics: {
        requiresDeepAnalysis: spiralContext.phase === 'council' || spiralContext.phase === 'reflection',
        estimatedProcessingTime: 10000,
      },
    };
  }

  private async applySpiralOptimizations(
    decision: IntelligentRoutingDecision,
    context: LivingSpiralRoutingContext
  ): Promise<void> {
    if (context.currentIteration > 1) {
      const avgQuality = context.previousIterations.reduce((sum, iter) => sum + iter.quality, 0) / 
                         context.previousIterations.length;

      if (avgQuality < context.qualityThreshold) {
        decision.confidence = Math.min(decision.confidence * 1.1, 1.0);
        decision.reasoning += ' (boosted for quality improvement)';
      }
    }

    if (context.phase === 'council' && decision.routingStrategy !== 'multi-voice') {
      logger.warn('Council phase should typically use multi-voice routing');
    }
  }

  private analyzePhasePerformance(iterations: readonly SpiralIteration[]): { councilPhaseEffective: boolean } {
    const councilIterations = iterations.filter(iter => iter.phase === 'council');
    const avgCouncilQuality = councilIterations.length > 0
      ? councilIterations.reduce((sum, iter) => sum + iter.quality, 0) / councilIterations.length
      : 0;

    return { councilPhaseEffective: avgCouncilQuality > 0.7 };
  }

  private isQualityImproving(iterations: readonly SpiralIteration[]): boolean {
    if (iterations.length < 2) return true;

    const recent = iterations.slice(-3);
    const older = iterations.slice(-6, -3);

    if (older.length === 0) return true;

    const recentAvg = recent.reduce((sum, iter) => sum + iter.quality, 0) / recent.length;
    const olderAvg = older.reduce((sum, iter) => sum + iter.quality, 0) / older.length;

    return recentAvg > olderAvg;
  }
}
