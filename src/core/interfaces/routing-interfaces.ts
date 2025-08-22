/**
 * Routing Interface Abstractions
 * Breaking circular dependencies in hybrid routing system
 *
 * Living Spiral Council Applied:
 * - Architect: Clean routing abstraction without client coupling
 * - Maintainer: Stable routing contracts for different strategies
 * - Security Guardian: Controlled routing decisions and validation
 * - Performance Engineer: Efficient routing with performance metrics
 */

// Task complexity metrics for routing decisions
export interface TaskComplexityMetrics {
  linesOfCode?: number;
  fileCount?: number;
  hasMultipleFiles?: boolean;
  requiresDeepAnalysis?: boolean;
  isTemplateGeneration?: boolean;
  hasSecurityImplications?: boolean;
  estimatedProcessingTime?: number;
}

// Routing decision result
export interface RoutingDecision {
  selectedLLM: 'lm-studio' | 'ollama' | 'hybrid';
  confidence: number;
  reasoning: string;
  fallbackStrategy: string;
  estimatedResponseTime: number;
  escalationThreshold?: number;
}

// Hybrid routing configuration
export interface HybridConfig {
  lmStudio: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    maxConcurrent: number;
    strengths: string[];
  };
  ollama: {
    endpoint: string;
    enabled: boolean;
    models: string[];
    maxConcurrent: number;
    strengths: string[];
  };
  routing: {
    defaultProvider: 'auto' | 'lm-studio' | 'ollama';
    escalationThreshold: number;
    confidenceScoring: boolean;
    learningEnabled: boolean;
  };
}

// Core routing interface - simplified to match existing implementation
export interface IModelRouter {
  // Core routing functionality
  routeTask(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): Promise<RoutingDecision>;

  // Allow any other methods for now
  [key: string]: any;
}

// Routing strategy interface
export interface IRoutingStrategy {
  evaluateTask(
    taskType: string,
    prompt: string,
    metrics?: TaskComplexityMetrics
  ): Promise<RoutingDecision>;
  getName(): string;
  getConfidence(): number;
}

// Task analyzer interface
export interface ITaskAnalyzer {
  analyzeComplexity(prompt: string): TaskComplexityMetrics;
  classifyTask(prompt: string): string;
  estimateResourceRequirements(prompt: string): any;
}

// Load balancer interface
export interface ILoadBalancer {
  getCurrentLoads(): { lmStudio: number; ollama: number };
  adjustForLoad(decision: RoutingDecision): RoutingDecision;
  reportCompletion(provider: string): void;
}

// Performance predictor interface
export interface IPerformancePredictor {
  predictResponseTime(provider: string, taskType: string): number;
  predictQuality(provider: string, taskType: string): number;
  updatePredictions(provider: string, actual: any): void;
}

// Routing events for decoupled communication
export interface RoutingEvents {
  routingDecisionMade: {
    taskId: string;
    decision: RoutingDecision;
    taskType: string;
  };
  routingCompleted: {
    taskId: string;
    actualPerformance: any;
    success: boolean;
  };
  routingFailed: {
    taskId: string;
    error: Error;
    fallbackUsed: boolean;
  };
  configUpdated: { config: HybridConfig };
}

// Router factory interface for DI
export interface IRouterFactory {
  createHybridRouter(config: HybridConfig): IModelRouter;
  createSimpleRouter(defaultProvider: string): IModelRouter;
  createLoadBalancedRouter(config: any): IModelRouter;
}

// Routing context for decision making
export interface RoutingContext {
  user?: any;
  session?: any;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  budget?: any;
  qualityRequirements?: any;
  deadlines?: any;
}

// Advanced routing interface with context
export interface IAdvancedRouter extends IModelRouter {
  routeWithContext(
    taskType: string,
    prompt: string,
    context: RoutingContext,
    metrics?: TaskComplexityMetrics
  ): Promise<RoutingDecision>;

  setRoutingPolicies(policies: any[]): void;
  addRoutingMiddleware(middleware: any): void;
}
