/**
 * Intelligent MCP-Voice Integration System
 *
 * Integrates MCP external services with the Voice Archetype System and Living Spiral methodology:
 * - Voice-specific MCP server routing and optimization
 * - Capability-aware voice selection for external tools
 * - Living Spiral phase-specific MCP tool orchestration
 * - Context-aware tool selection and execution
 * - Performance optimization for voice synthesis workflows
 * - Collaborative multi-voice MCP operations
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import {
  advancedMCPDiscoverySystem,
  DiscoveredMCPServer,
  ServerDiscoveryQuery,
} from './advanced-mcp-discovery-system.js';
import {
  intelligentMCPLoadBalancer,
  LoadBalancingDecision,
} from './intelligent-mcp-load-balancer.js';
import { enhancedMCPReliabilitySystem } from './enhanced-mcp-reliability-system.js';
import { enhancedMCPSecuritySystem } from './enhanced-mcp-security-system.js';

export interface VoiceCapabilityMapping {
  voiceId: string;
  voiceName: string;
  voiceRole: string;

  // Preferred capabilities for this voice
  preferredCapabilities: string[];
  expertCapabilities: string[];

  // MCP server preferences
  preferredServers: string[];
  avoidedServers: string[];

  // Performance optimization
  cachingStrategy: 'aggressive' | 'moderate' | 'minimal';
  parallelismLevel: 'low' | 'medium' | 'high';

  // Quality preferences
  reliabilityWeight: number; // 0-1
  performanceWeight: number; // 0-1
  costWeight: number; // 0-1
}

export interface LivingSpiralPhase {
  phase: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  description: string;

  // Phase-specific MCP requirements
  requiredCapabilities: string[];
  optionalCapabilities: string[];

  // Tool orchestration preferences
  executionMode: 'sequential' | 'parallel' | 'adaptive';
  errorTolerance: 'strict' | 'moderate' | 'lenient';

  // Collaboration settings
  voiceCollaboration: boolean;
  crossPhaseDataSharing: boolean;

  // Performance targets
  maxExecutionTime: number;
  qualityThreshold: number;
}

export interface VoiceMCPRequest {
  requestId: string;
  voiceId: string;
  phase: string;

  // Tool requirements
  capability: string;
  parameters: any;
  context: any;

  // Execution preferences
  priority: 'low' | 'normal' | 'high' | 'critical';
  timeout: number;
  retryPolicy: RetryPolicy;

  // Quality requirements
  minReliability: number;
  maxLatency: number;

  // Collaboration context
  relatedRequests?: string[];
  dependsOn?: string[];
  shareResultsWith?: string[];
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential' | 'adaptive';
  baseDelay: number;
  maxDelay: number;
  retryOn: 'all' | 'timeout' | 'server-error' | 'network-error';
}

export interface VoiceMCPResponse {
  requestId: string;
  voiceId: string;

  success: boolean;
  result: any;
  error?: string;

  // Execution metadata
  executionTime: number;
  serverUsed: string;
  capabilityMatched: boolean;

  // Quality metrics
  reliabilityScore: number;
  performanceScore: number;

  // Collaboration data
  sharedData?: any;
  collaborationMetadata?: any;
}

export interface MCPVoiceOrchestrationPlan {
  planId: string;
  phase: string;
  voices: string[];

  // Tool execution plan
  toolSequence: MCPToolStep[];
  executionStrategy: 'sequential' | 'parallel' | 'pipeline' | 'adaptive';

  // Resource allocation
  serverAllocation: Map<string, string[]>; // serverId -> voiceIds
  loadBalancingStrategy: string;

  // Performance optimization
  cacheStrategy: string;
  prefetchingEnabled: boolean;

  // Quality assurance
  validationRules: ValidationRule[];
  fallbackStrategies: FallbackStrategy[];

  // Collaboration coordination
  dataFlowMap: DataFlowDefinition[];
  synchronizationPoints: SynchronizationPoint[];
}

export interface MCPToolStep {
  stepId: string;
  voiceId: string;
  capability: string;
  parameters: any;

  dependencies: string[]; // stepIds this step depends on
  parallel: boolean;
  optional: boolean;

  // Execution configuration
  serverId?: string;
  timeout: number;
  retryPolicy: RetryPolicy;

  // Quality requirements
  minSuccessRate: number;
  maxResponseTime: number;
}

export interface ValidationRule {
  field: string;
  validator: string;
  parameters: any;
}

export interface FallbackStrategy {
  condition: string;
  action: 'retry' | 'alternative-server' | 'alternative-capability' | 'skip' | 'fail';
  parameters: any;
}

export interface DataFlowDefinition {
  fromStep: string;
  toStep: string;
  dataType: string;
  transformation?: string;
  caching: boolean;
}

export interface SynchronizationPoint {
  pointId: string;
  waitForSteps: string[];
  action: 'barrier' | 'checkpoint' | 'merge' | 'validate';
  parameters: any;
}

export class IntelligentMCPVoiceIntegration extends EventEmitter {
  private voiceCapabilityMappings: Map<string, VoiceCapabilityMapping> = new Map();
  private spiralPhaseDefinitions: Map<string, LivingSpiralPhase> = new Map();
  private activeOrchestrationPlans: Map<string, MCPVoiceOrchestrationPlan> = new Map();
  private voiceExecutionHistory: Map<string, VoiceMCPResponse[]> = new Map();

  // Performance optimization
  private capabilityCache: Map<string, DiscoveredMCPServer[]> = new Map();
  private voicePreferenceProfiles: Map<string, any> = new Map();

  // Collaboration coordination
  private collaborationSessions: Map<string, CollaborationSession> = new Map();

  constructor() {
    super();
    this.initializeDefaultMappings();
    this.initializeSpiralPhases();
    this.startOptimizationEngine();
  }

  /**
   * Initialize default voice capability mappings
   */
  private initializeDefaultMappings(): void {
    const defaultMappings: VoiceCapabilityMapping[] = [
      {
        voiceId: 'explorer',
        voiceName: 'Explorer',
        voiceRole: 'Innovation and Discovery',
        preferredCapabilities: ['web-search', 'research', 'data-discovery', 'api-exploration'],
        expertCapabilities: ['web-search', 'research'],
        preferredServers: ['exa-ai', 'research-tools'],
        avoidedServers: [],
        cachingStrategy: 'moderate',
        parallelismLevel: 'high',
        reliabilityWeight: 0.7,
        performanceWeight: 0.9,
        costWeight: 0.3,
      },
      {
        voiceId: 'maintainer',
        voiceName: 'Maintainer',
        voiceRole: 'Quality and Stability',
        preferredCapabilities: ['testing', 'validation', 'monitoring', 'backup'],
        expertCapabilities: ['testing', 'validation'],
        preferredServers: ['quality-tools', 'monitoring-systems'],
        avoidedServers: ['experimental-tools'],
        cachingStrategy: 'aggressive',
        parallelismLevel: 'low',
        reliabilityWeight: 0.95,
        performanceWeight: 0.6,
        costWeight: 0.5,
      },
      {
        voiceId: 'security',
        voiceName: 'Security Guardian',
        voiceRole: 'Security and Compliance',
        preferredCapabilities: ['security-scan', 'vulnerability-assessment', 'compliance-check'],
        expertCapabilities: ['security-scan', 'vulnerability-assessment'],
        preferredServers: ['security-tools', 'compliance-systems'],
        avoidedServers: ['untrusted-sources'],
        cachingStrategy: 'minimal',
        parallelismLevel: 'medium',
        reliabilityWeight: 1.0,
        performanceWeight: 0.7,
        costWeight: 0.4,
      },
      {
        voiceId: 'architect',
        voiceName: 'System Architect',
        voiceRole: 'System Design and Architecture',
        preferredCapabilities: ['modeling', 'diagram-generation', 'architecture-analysis'],
        expertCapabilities: ['modeling', 'architecture-analysis'],
        preferredServers: ['design-tools', 'modeling-systems'],
        avoidedServers: [],
        cachingStrategy: 'moderate',
        parallelismLevel: 'medium',
        reliabilityWeight: 0.8,
        performanceWeight: 0.8,
        costWeight: 0.6,
      },
      {
        voiceId: 'developer',
        voiceName: 'Developer',
        voiceRole: 'Implementation and Coding',
        preferredCapabilities: ['code-generation', 'code-analysis', 'debugging', 'testing'],
        expertCapabilities: ['code-generation', 'debugging'],
        preferredServers: ['development-tools', 'code-analysis'],
        avoidedServers: [],
        cachingStrategy: 'moderate',
        parallelismLevel: 'high',
        reliabilityWeight: 0.8,
        performanceWeight: 0.85,
        costWeight: 0.7,
      },
    ];

    defaultMappings.forEach(mapping => {
      this.voiceCapabilityMappings.set(mapping.voiceId, mapping);
    });

    logger.info(`Initialized ${defaultMappings.length} voice capability mappings`);
  }

  /**
   * Initialize Living Spiral phase definitions
   */
  private initializeSpiralPhases(): void {
    const phases: LivingSpiralPhase[] = [
      {
        phase: 'collapse',
        description: 'Problem decomposition and analysis',
        requiredCapabilities: ['analysis', 'decomposition'],
        optionalCapabilities: ['research', 'context-gathering'],
        executionMode: 'sequential',
        errorTolerance: 'strict',
        voiceCollaboration: false,
        crossPhaseDataSharing: true,
        maxExecutionTime: 300000, // 5 minutes
        qualityThreshold: 0.8,
      },
      {
        phase: 'council',
        description: 'Multi-voice perspective gathering',
        requiredCapabilities: ['analysis', 'perspective-generation'],
        optionalCapabilities: ['research', 'validation'],
        executionMode: 'parallel',
        errorTolerance: 'moderate',
        voiceCollaboration: true,
        crossPhaseDataSharing: true,
        maxExecutionTime: 600000, // 10 minutes
        qualityThreshold: 0.7,
      },
      {
        phase: 'synthesis',
        description: 'Unified solution creation',
        requiredCapabilities: ['synthesis', 'integration'],
        optionalCapabilities: ['validation', 'optimization'],
        executionMode: 'adaptive',
        errorTolerance: 'moderate',
        voiceCollaboration: true,
        crossPhaseDataSharing: true,
        maxExecutionTime: 450000, // 7.5 minutes
        qualityThreshold: 0.85,
      },
      {
        phase: 'rebirth',
        description: 'Implementation and execution',
        requiredCapabilities: ['implementation', 'execution'],
        optionalCapabilities: ['testing', 'monitoring'],
        executionMode: 'sequential',
        errorTolerance: 'lenient',
        voiceCollaboration: false,
        crossPhaseDataSharing: false,
        maxExecutionTime: 900000, // 15 minutes
        qualityThreshold: 0.9,
      },
      {
        phase: 'reflection',
        description: 'Learning and assessment',
        requiredCapabilities: ['evaluation', 'learning'],
        optionalCapabilities: ['documentation', 'optimization'],
        executionMode: 'sequential',
        errorTolerance: 'moderate',
        voiceCollaboration: true,
        crossPhaseDataSharing: false,
        maxExecutionTime: 300000, // 5 minutes
        qualityThreshold: 0.75,
      },
    ];

    phases.forEach(phase => {
      this.spiralPhaseDefinitions.set(phase.phase, phase);
    });

    logger.info(`Initialized ${phases.length} Living Spiral phase definitions`);
  }

  /**
   * Get optimal MCP server for voice and capability
   */
  async getOptimalServerForVoice(
    voiceId: string,
    capability: string,
    context?: any
  ): Promise<LoadBalancingDecision | null> {
    const voiceMapping = this.voiceCapabilityMappings.get(voiceId);
    if (!voiceMapping) {
      throw new Error(`Voice mapping not found: ${voiceId}`);
    }

    // Build discovery query based on voice preferences
    const query: ServerDiscoveryQuery = {
      capabilities: [capability],
      minReliability: voiceMapping.reliabilityWeight * 100,
      minPerformance: voiceMapping.performanceWeight * 100,
    };

    // Get servers matching capability
    let candidateServers = await this.getCachedOrDiscoverServers(query);

    // Filter by voice preferences
    if (voiceMapping.preferredServers.length > 0) {
      const preferred = candidateServers.filter(server =>
        voiceMapping.preferredServers.some(pref => server.qualifiedName.includes(pref))
      );
      if (preferred.length > 0) {
        candidateServers = preferred;
      }
    }

    // Remove avoided servers
    candidateServers = candidateServers.filter(
      server => !voiceMapping.avoidedServers.some(avoided => server.qualifiedName.includes(avoided))
    );

    if (candidateServers.length === 0) {
      logger.warn(`No suitable servers found for voice ${voiceId} and capability ${capability}`);
      return null;
    }

    // Use load balancer to select optimal server
    const poolId = `voice-${voiceId}-${capability}`;

    // Ensure connection pool exists
    await this.ensureConnectionPool(poolId, candidateServers, voiceMapping);

    // Get optimal connection
    return intelligentMCPLoadBalancer.getConnection(
      poolId,
      [capability],
      context?.sessionId,
      context
    );
  }

  /**
   * Execute MCP request for voice
   */
  async executeVoiceMCPRequest(request: VoiceMCPRequest): Promise<VoiceMCPResponse> {
    const startTime = Date.now();
    logger.info(`Executing MCP request for voice ${request.voiceId}: ${request.capability}`);

    try {
      // Security check
      const securityContext = enhancedMCPSecuritySystem.getSecurityContext(request.requestId);
      if (securityContext) {
        const authorized = await enhancedMCPSecuritySystem.authorizeRequest(
          request.requestId,
          request.capability,
          request.parameters
        );
        if (!authorized) {
          throw new Error('Request not authorized');
        }
      }

      // Get optimal server
      const serverDecision = await this.getOptimalServerForVoice(
        request.voiceId,
        request.capability,
        request.context
      );

      if (!serverDecision) {
        throw new Error('No suitable server available');
      }

      // Check if server allows request
      const connectionId = serverDecision.selectedConnection.connectionId;
      if (!enhancedMCPReliabilitySystem.shouldAllowRequest(connectionId)) {
        throw new Error('Server circuit breaker is open');
      }

      // Execute request with timeout
      const timeout = request.timeout || this.getDefaultTimeout(request.voiceId);
      const executionPromise = this.executeWithRetry(request, serverDecision);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeout);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Record success
      enhancedMCPReliabilitySystem.recordRequestCompletion(
        connectionId,
        true,
        executionTime,
        `voice-${request.voiceId}-${request.capability}`
      );

      intelligentMCPLoadBalancer.recordRequestCompletion(
        `voice-${request.voiceId}-${request.capability}`,
        connectionId,
        true,
        executionTime,
        [request.capability]
      );

      const response: VoiceMCPResponse = {
        requestId: request.requestId,
        voiceId: request.voiceId,
        success: true,
        result: result,
        executionTime,
        serverUsed: serverDecision.selectedConnection.serverId,
        capabilityMatched: true,
        reliabilityScore: serverDecision.selectedConnection.healthScore,
        performanceScore: serverDecision.confidence,
      };

      // Store execution history
      this.recordVoiceExecution(request.voiceId, response);

      this.emit('voice-mcp-success', response);
      return response;
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure
      const serverDecision = await this.getOptimalServerForVoice(
        request.voiceId,
        request.capability,
        request.context
      );

      if (serverDecision) {
        const connectionId = serverDecision.selectedConnection.connectionId;
        enhancedMCPReliabilitySystem.recordRequestCompletion(
          connectionId,
          false,
          executionTime,
          `voice-${request.voiceId}-${request.capability}`,
          error as Error
        );

        intelligentMCPLoadBalancer.recordRequestCompletion(
          `voice-${request.voiceId}-${request.capability}`,
          connectionId,
          false,
          executionTime,
          [request.capability]
        );
      }

      const response: VoiceMCPResponse = {
        requestId: request.requestId,
        voiceId: request.voiceId,
        success: false,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
        serverUsed: serverDecision?.selectedConnection.serverId || 'unknown',
        capabilityMatched: false,
        reliabilityScore: 0,
        performanceScore: 0,
      };

      this.recordVoiceExecution(request.voiceId, response);
      this.emit('voice-mcp-error', response, error);

      throw error;
    }
  }

  /**
   * Create orchestration plan for Living Spiral phase
   */
  async createOrchestrationPlan(
    phase: string,
    voices: string[],
    requirements: any
  ): Promise<MCPVoiceOrchestrationPlan> {
    const phaseDefinition = this.spiralPhaseDefinitions.get(phase);
    if (!phaseDefinition) {
      throw new Error(`Unknown Living Spiral phase: ${phase}`);
    }

    const planId = `plan-${phase}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

    // Analyze requirements and create tool sequence
    const toolSequence = await this.createToolSequence(phaseDefinition, voices, requirements);

    // Create server allocation strategy
    const serverAllocation = await this.createServerAllocation(voices, toolSequence);

    // Define data flow and synchronization
    const dataFlowMap = this.createDataFlowMap(toolSequence);
    const synchronizationPoints = this.createSynchronizationPoints(phaseDefinition, toolSequence);

    const plan: MCPVoiceOrchestrationPlan = {
      planId,
      phase,
      voices,
      toolSequence,
      executionStrategy: phaseDefinition.executionMode,
      serverAllocation,
      loadBalancingStrategy: 'capability-aware',
      cacheStrategy: 'voice-specific',
      prefetchingEnabled: true,
      validationRules: [],
      fallbackStrategies: this.createFallbackStrategies(phaseDefinition),
      dataFlowMap,
      synchronizationPoints,
    };

    this.activeOrchestrationPlans.set(planId, plan);
    logger.info(
      `Created orchestration plan ${planId} for phase ${phase} with ${voices.length} voices`
    );

    this.emit('orchestration-plan-created', plan);
    return plan;
  }

  /**
   * Execute orchestration plan
   */
  async executeOrchestrationPlan(planId: string): Promise<Map<string, VoiceMCPResponse>> {
    const plan = this.activeOrchestrationPlans.get(planId);
    if (!plan) {
      throw new Error(`Orchestration plan not found: ${planId}`);
    }

    logger.info(`Executing orchestration plan ${planId} for phase ${plan.phase}`);

    const results = new Map<string, VoiceMCPResponse>();
    const phaseDefinition = this.spiralPhaseDefinitions.get(plan.phase)!;

    try {
      // Create collaboration session if needed
      if (phaseDefinition.voiceCollaboration) {
        this.createCollaborationSession(planId, plan.voices);
      }

      // Execute based on strategy
      switch (plan.executionStrategy) {
        case 'sequential':
          await this.executeSequential(plan, results);
          break;
        case 'parallel':
          await this.executeParallel(plan, results);
          break;
        case 'pipeline':
          await this.executePipeline(plan, results);
          break;
        case 'adaptive':
          await this.executeAdaptive(plan, results);
          break;
      }

      // Validate results
      await this.validateOrchestrationResults(plan, results);

      logger.info(`Successfully executed orchestration plan ${planId}`);
      this.emit('orchestration-plan-completed', planId, results);

      return results;
    } catch (error) {
      logger.error(`Orchestration plan ${planId} failed:`, error);

      // Apply fallback strategies
      await this.applyFallbackStrategies(plan, error);

      this.emit('orchestration-plan-failed', planId, error);
      throw error;
    } finally {
      // Cleanup collaboration session
      this.collaborationSessions.delete(planId);
    }
  }

  /**
   * Helper methods for plan execution
   */
  private async executeSequential(
    plan: MCPVoiceOrchestrationPlan,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    const sortedSteps = this.topologicalSort(plan.toolSequence);

    for (const step of sortedSteps) {
      const request: VoiceMCPRequest = {
        requestId: `${plan.planId}-${step.stepId}`,
        voiceId: step.voiceId,
        phase: plan.phase,
        capability: step.capability,
        parameters: step.parameters,
        context: { planId: plan.planId },
        priority: 'normal',
        timeout: step.timeout,
        retryPolicy: step.retryPolicy,
        minReliability: step.minSuccessRate,
        maxLatency: step.maxResponseTime,
      };

      const response = await this.executeVoiceMCPRequest(request);
      results.set(step.stepId, response);

      // Share data if required
      if (plan.dataFlowMap.some(flow => flow.fromStep === step.stepId)) {
        await this.shareStepData(plan.planId, step.stepId, response);
      }
    }
  }

  private async executeParallel(
    plan: MCPVoiceOrchestrationPlan,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    const parallelGroups = this.groupParallelSteps(plan.toolSequence);

    for (const group of parallelGroups) {
      const groupPromises = group.map(async step => {
        const request: VoiceMCPRequest = {
          requestId: `${plan.planId}-${step.stepId}`,
          voiceId: step.voiceId,
          phase: plan.phase,
          capability: step.capability,
          parameters: step.parameters,
          context: { planId: plan.planId },
          priority: 'normal',
          timeout: step.timeout,
          retryPolicy: step.retryPolicy,
          minReliability: step.minSuccessRate,
          maxLatency: step.maxResponseTime,
        };

        const response = await this.executeVoiceMCPRequest(request);
        results.set(step.stepId, response);
        return { step, response };
      });

      const groupResults = await Promise.all(groupPromises);

      // Handle data sharing
      for (const { step, response } of groupResults) {
        if (plan.dataFlowMap.some(flow => flow.fromStep === step.stepId)) {
          await this.shareStepData(plan.planId, step.stepId, response);
        }
      }
    }
  }

  private async executePipeline(
    plan: MCPVoiceOrchestrationPlan,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    // Pipeline execution - start next step as soon as dependencies are ready
    const completedSteps = new Set<string>();
    const runningSteps = new Map<string, Promise<VoiceMCPResponse>>();

    while (completedSteps.size < plan.toolSequence.length) {
      // Find ready steps
      const readySteps = plan.toolSequence.filter(
        step =>
          !completedSteps.has(step.stepId) &&
          !runningSteps.has(step.stepId) &&
          step.dependencies.every(dep => completedSteps.has(dep))
      );

      // Start ready steps
      for (const step of readySteps) {
        const request: VoiceMCPRequest = {
          requestId: `${plan.planId}-${step.stepId}`,
          voiceId: step.voiceId,
          phase: plan.phase,
          capability: step.capability,
          parameters: step.parameters,
          context: { planId: plan.planId },
          priority: 'normal',
          timeout: step.timeout,
          retryPolicy: step.retryPolicy,
          minReliability: step.minSuccessRate,
          maxLatency: step.maxResponseTime,
        };

        const promise = this.executeVoiceMCPRequest(request);
        runningSteps.set(step.stepId, promise);
      }

      // Wait for at least one step to complete
      if (runningSteps.size > 0) {
        const completed = await Promise.race(
          Array.from(runningSteps.entries()).map(async ([stepId, promise]) => {
            const response = await promise;
            return { stepId, response };
          })
        );

        results.set(completed.stepId, completed.response);
        completedSteps.add(completed.stepId);
        runningSteps.delete(completed.stepId);

        // Handle data sharing
        const step = plan.toolSequence.find(s => s.stepId === completed.stepId);
        if (step && plan.dataFlowMap.some(flow => flow.fromStep === step.stepId)) {
          await this.shareStepData(plan.planId, step.stepId, completed.response);
        }
      }
    }
  }

  private async executeAdaptive(
    plan: MCPVoiceOrchestrationPlan,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    // Adaptive execution - choose strategy based on current conditions
    const performanceMetrics = this.getPhasePerformanceMetrics(plan.phase);

    if (performanceMetrics.avgLatency > 5000) {
      // High latency - use parallel execution
      await this.executeParallel(plan, results);
    } else if (performanceMetrics.errorRate > 0.1) {
      // High error rate - use sequential execution for better error handling
      await this.executeSequential(plan, results);
    } else {
      // Normal conditions - use pipeline for optimal throughput
      await this.executePipeline(plan, results);
    }
  }

  /**
   * Utility methods
   */
  private async getCachedOrDiscoverServers(
    query: ServerDiscoveryQuery
  ): Promise<DiscoveredMCPServer[]> {
    const cacheKey = JSON.stringify(query);

    if (this.capabilityCache.has(cacheKey)) {
      return this.capabilityCache.get(cacheKey)!;
    }

    const servers = advancedMCPDiscoverySystem.searchServers(query);
    this.capabilityCache.set(cacheKey, servers);

    // Cache for 5 minutes
    setTimeout(() => {
      this.capabilityCache.delete(cacheKey);
    }, 300000);

    return servers;
  }

  private async ensureConnectionPool(
    poolId: string,
    servers: DiscoveredMCPServer[],
    voiceMapping: VoiceCapabilityMapping
  ): Promise<void> {
    const existingPool = intelligentMCPLoadBalancer.getPoolMetrics(poolId);
    if (existingPool) {
      return;
    }

    const config = {
      poolId,
      minConnections: 1,
      maxConnections: Math.min(5, servers.length),
      scaleUpThreshold: 70,
      scaleDownThreshold: 30,
      connectionTimeout: 30000,
      idleTimeout: 300000,
      healthCheckInterval: 60000,
      loadBalancingStrategy: this.getLoadBalancingStrategy(voiceMapping),
      affinityEnabled: voiceMapping.cachingStrategy === 'aggressive',
      affinityTTL: 600000,
    };

    await intelligentMCPLoadBalancer.createPool(
      config,
      servers.map(s => s.id)
    );
  }

  private getLoadBalancingStrategy(voiceMapping: VoiceCapabilityMapping): any {
    if (voiceMapping.reliabilityWeight > 0.8) {
      return 'weighted-response-time';
    } else if (voiceMapping.performanceWeight > 0.8) {
      return 'capability-aware';
    } else {
      return 'hybrid';
    }
  }

  private getDefaultTimeout(voiceId: string): number {
    const voiceMapping = this.voiceCapabilityMappings.get(voiceId);
    if (!voiceMapping) return 30000;

    // More performance-focused voices get shorter timeouts
    return voiceMapping.performanceWeight > 0.8 ? 15000 : 30000;
  }

  private async executeWithRetry(
    request: VoiceMCPRequest,
    serverDecision: LoadBalancingDecision
  ): Promise<any> {
    const maxRetries = request.retryPolicy.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Simulate MCP tool execution
        // In real implementation, this would call the actual MCP server
        const result = await this.simulateMCPExecution(request, serverDecision);
        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries && this.shouldRetry(error, request.retryPolicy)) {
          const delay = this.calculateRetryDelay(attempt, request.retryPolicy);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  private async simulateMCPExecution(
    request: VoiceMCPRequest,
    serverDecision: LoadBalancingDecision
  ): Promise<any> {
    // Simulate processing time based on capability and server performance
    const baseTime = 100;
    const performanceFactor = serverDecision.expectedPerformance;
    const processingTime = baseTime + Math.random() * performanceFactor * 10;

    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error('Simulated MCP execution failure');
    }

    return {
      capability: request.capability,
      result: `Processed by ${serverDecision.selectedConnection.serverName}`,
      executionTime: processingTime,
      serverConfidence: serverDecision.confidence,
    };
  }

  private shouldRetry(error: any, retryPolicy: RetryPolicy): boolean {
    const errorMessage = error.message.toLowerCase();

    switch (retryPolicy.retryOn) {
      case 'all':
        return true;
      case 'timeout':
        return errorMessage.includes('timeout');
      case 'server-error':
        return errorMessage.includes('server') || errorMessage.includes('internal');
      case 'network-error':
        return errorMessage.includes('network') || errorMessage.includes('connection');
      default:
        return false;
    }
  }

  private calculateRetryDelay(attempt: number, retryPolicy: RetryPolicy): number {
    switch (retryPolicy.backoffStrategy) {
      case 'linear':
        return Math.min(retryPolicy.baseDelay * attempt, retryPolicy.maxDelay);
      case 'exponential':
        return Math.min(retryPolicy.baseDelay * Math.pow(2, attempt), retryPolicy.maxDelay);
      case 'adaptive':
        // Adaptive strategy based on current system performance
        const systemLoad = this.getSystemLoad();
        const multiplier = 1 + systemLoad / 100;
        return Math.min(
          retryPolicy.baseDelay * Math.pow(2, attempt) * multiplier,
          retryPolicy.maxDelay
        );
      default:
        return retryPolicy.baseDelay;
    }
  }

  private getSystemLoad(): number {
    // Simple system load simulation
    return Math.random() * 100;
  }

  private recordVoiceExecution(voiceId: string, response: VoiceMCPResponse): void {
    if (!this.voiceExecutionHistory.has(voiceId)) {
      this.voiceExecutionHistory.set(voiceId, []);
    }

    const history = this.voiceExecutionHistory.get(voiceId)!;
    history.push(response);

    // Keep only recent history
    if (history.length > 100) {
      history.shift();
    }
  }

  private async createToolSequence(
    phaseDefinition: LivingSpiralPhase,
    voices: string[],
    requirements: any
  ): Promise<MCPToolStep[]> {
    const steps: MCPToolStep[] = [];

    // Create steps for each required capability
    let stepIndex = 0;
    for (const capability of phaseDefinition.requiredCapabilities) {
      // Find best voice for this capability
      const bestVoice = this.findBestVoiceForCapability(voices, capability);

      steps.push({
        stepId: `step-${stepIndex++}`,
        voiceId: bestVoice,
        capability,
        parameters: requirements[capability] || {},
        dependencies: [],
        parallel: phaseDefinition.executionMode === 'parallel',
        optional: false,
        timeout: phaseDefinition.maxExecutionTime / phaseDefinition.requiredCapabilities.length,
        retryPolicy: {
          maxRetries: 2,
          backoffStrategy: 'exponential',
          baseDelay: 1000,
          maxDelay: 10000,
          retryOn: 'all',
        },
        minSuccessRate: phaseDefinition.qualityThreshold * 100,
        maxResponseTime: 10000,
      });
    }

    return steps;
  }

  private findBestVoiceForCapability(voices: string[], capability: string): string {
    let bestVoice = voices[0];
    let bestScore = 0;

    for (const voiceId of voices) {
      const mapping = this.voiceCapabilityMappings.get(voiceId);
      if (!mapping) continue;

      let score = 0;
      if (mapping.expertCapabilities.includes(capability)) {
        score += 100;
      } else if (mapping.preferredCapabilities.includes(capability)) {
        score += 50;
      } else {
        score += 10;
      }

      // Factor in voice performance preferences
      score += mapping.performanceWeight * 30;
      score += mapping.reliabilityWeight * 20;

      if (score > bestScore) {
        bestScore = score;
        bestVoice = voiceId;
      }
    }

    return bestVoice;
  }

  private async createServerAllocation(
    voices: string[],
    toolSequence: MCPToolStep[]
  ): Promise<Map<string, string[]>> {
    const allocation = new Map<string, string[]>();

    // Group steps by server requirements
    const serverGroups = new Map<string, MCPToolStep[]>();

    for (const step of toolSequence) {
      const voiceMapping = this.voiceCapabilityMappings.get(step.voiceId);
      if (!voiceMapping) continue;

      const preferredServer = voiceMapping.preferredServers[0] || 'default';
      if (!serverGroups.has(preferredServer)) {
        serverGroups.set(preferredServer, []);
      }
      serverGroups.get(preferredServer)!.push(step);
    }

    // Allocate voices to servers
    for (const [serverId, steps] of serverGroups) {
      const voiceIds = [...new Set(steps.map(s => s.voiceId))];
      allocation.set(serverId, voiceIds);
    }

    return allocation;
  }

  private createDataFlowMap(toolSequence: MCPToolStep[]): DataFlowDefinition[] {
    // Simple data flow - each step can share data with subsequent steps
    const dataFlow: DataFlowDefinition[] = [];

    for (let i = 0; i < toolSequence.length - 1; i++) {
      const fromStep = toolSequence[i];
      const toStep = toolSequence[i + 1];

      dataFlow.push({
        fromStep: fromStep.stepId,
        toStep: toStep.stepId,
        dataType: 'analysis-result',
        caching: true,
      });
    }

    return dataFlow;
  }

  private createSynchronizationPoints(
    phaseDefinition: LivingSpiralPhase,
    toolSequence: MCPToolStep[]
  ): SynchronizationPoint[] {
    const points: SynchronizationPoint[] = [];

    if (phaseDefinition.voiceCollaboration) {
      // Add synchronization point at the end of each voice group
      const voiceGroups = this.groupBy(toolSequence, step => step.voiceId);

      for (const [voiceId, steps] of voiceGroups) {
        points.push({
          pointId: `sync-${voiceId}`,
          waitForSteps: steps.map(s => s.stepId),
          action: 'checkpoint',
          parameters: { voice: voiceId },
        });
      }
    }

    return points;
  }

  private createFallbackStrategies(phaseDefinition: LivingSpiralPhase): FallbackStrategy[] {
    const strategies: FallbackStrategy[] = [];

    switch (phaseDefinition.errorTolerance) {
      case 'strict':
        strategies.push({
          condition: 'step_failure',
          action: 'retry',
          parameters: { maxRetries: 3 },
        });
        break;
      case 'moderate':
        strategies.push({
          condition: 'step_failure',
          action: 'alternative-server',
          parameters: { maxAlternatives: 2 },
        });
        break;
      case 'lenient':
        strategies.push({
          condition: 'step_failure',
          action: 'skip',
          parameters: { markOptional: true },
        });
        break;
    }

    return strategies;
  }

  private topologicalSort(steps: MCPToolStep[]): MCPToolStep[] {
    // Simple topological sort implementation
    const visited = new Set<string>();
    const sorted: MCPToolStep[] = [];

    const visit = (step: MCPToolStep) => {
      if (visited.has(step.stepId)) return;

      visited.add(step.stepId);

      // Visit dependencies first
      for (const depId of step.dependencies) {
        const depStep = steps.find(s => s.stepId === depId);
        if (depStep) {
          visit(depStep);
        }
      }

      sorted.push(step);
    };

    for (const step of steps) {
      visit(step);
    }

    return sorted;
  }

  private groupParallelSteps(steps: MCPToolStep[]): MCPToolStep[][] {
    // Group steps that can run in parallel (no dependencies between them)
    const groups: MCPToolStep[][] = [];
    const processed = new Set<string>();

    for (const step of steps) {
      if (processed.has(step.stepId)) continue;

      const group = [step];
      processed.add(step.stepId);

      // Find other steps that can run in parallel
      for (const otherStep of steps) {
        if (processed.has(otherStep.stepId)) continue;

        // Check if steps can run in parallel (no dependencies)
        const hasConflict =
          step.dependencies.includes(otherStep.stepId) ||
          otherStep.dependencies.includes(step.stepId);

        if (!hasConflict) {
          group.push(otherStep);
          processed.add(otherStep.stepId);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private createCollaborationSession(planId: string, voices: string[]): void {
    const session: CollaborationSession = {
      sessionId: planId,
      voices: voices,
      sharedData: new Map(),
      synchronization: new Map(),
      startTime: new Date(),
    };

    this.collaborationSessions.set(planId, session);
  }

  private async shareStepData(
    planId: string,
    stepId: string,
    response: VoiceMCPResponse
  ): Promise<void> {
    const session = this.collaborationSessions.get(planId);
    if (!session) return;

    session.sharedData.set(stepId, {
      voiceId: response.voiceId,
      data: response.result,
      timestamp: new Date(),
    });
  }

  private async validateOrchestrationResults(
    plan: MCPVoiceOrchestrationPlan,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    const phaseDefinition = this.spiralPhaseDefinitions.get(plan.phase)!;

    // Check success rate
    const successful = Array.from(results.values()).filter(r => r.success).length;
    const total = results.size;
    const successRate = successful / total;

    if (successRate < phaseDefinition.qualityThreshold) {
      throw new Error(
        `Quality threshold not met: ${successRate} < ${phaseDefinition.qualityThreshold}`
      );
    }

    // Apply validation rules
    for (const rule of plan.validationRules) {
      await this.applyValidationRule(rule, results);
    }
  }

  private async applyValidationRule(
    rule: ValidationRule,
    results: Map<string, VoiceMCPResponse>
  ): Promise<void> {
    // Placeholder for validation rule application
    logger.debug(`Applying validation rule: ${rule.validator}`);
  }

  private async applyFallbackStrategies(
    plan: MCPVoiceOrchestrationPlan,
    error: any
  ): Promise<void> {
    logger.warn(`Applying fallback strategies for plan ${plan.planId}`);

    for (const strategy of plan.fallbackStrategies) {
      try {
        await this.executeFallbackStrategy(strategy, plan, error);
      } catch (fallbackError) {
        logger.error('Fallback strategy failed:', fallbackError);
      }
    }
  }

  private async executeFallbackStrategy(
    strategy: FallbackStrategy,
    plan: MCPVoiceOrchestrationPlan,
    error: any
  ): Promise<void> {
    switch (strategy.action) {
      case 'retry':
        // Implement retry logic
        break;
      case 'alternative-server':
        // Switch to alternative server
        break;
      case 'skip':
        // Skip failed steps
        break;
      default:
        logger.warn(`Unknown fallback strategy: ${strategy.action}`);
    }
  }

  private getPhasePerformanceMetrics(phase: string): any {
    // Return cached performance metrics for the phase
    return {
      avgLatency: 3000,
      errorRate: 0.05,
      successRate: 0.95,
    };
  }

  private groupBy<T, K extends string | number>(array: T[], keyFn: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>();
    array.forEach(item => {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });
    return groups;
  }

  /**
   * Start optimization engine
   */
  private startOptimizationEngine(): void {
    // Periodically optimize voice preferences based on execution history
    setInterval(() => {
      this.optimizeVoicePreferences();
    }, 600000); // 10 minutes

    // Clean up old execution history
    setInterval(() => {
      this.cleanupExecutionHistory();
    }, 3600000); // 1 hour
  }

  private optimizeVoicePreferences(): void {
    // Analyze execution history and update voice preferences
    for (const [voiceId, history] of this.voiceExecutionHistory) {
      if (history.length < 10) continue;

      const recentHistory = history.slice(-20);
      const successRate = recentHistory.filter(r => r.success).length / recentHistory.length;
      const avgPerformance =
        recentHistory.reduce((sum, r) => sum + r.performanceScore, 0) / recentHistory.length;

      // Update voice mapping based on performance
      const mapping = this.voiceCapabilityMappings.get(voiceId);
      if (mapping) {
        // Adjust weights based on actual performance
        if (successRate > 0.9 && avgPerformance > 80) {
          mapping.performanceWeight = Math.min(1.0, mapping.performanceWeight + 0.05);
        } else if (successRate < 0.7 || avgPerformance < 60) {
          mapping.performanceWeight = Math.max(0.3, mapping.performanceWeight - 0.05);
        }

        this.voiceCapabilityMappings.set(voiceId, mapping);
      }
    }
  }

  private cleanupExecutionHistory(): void {
    for (const [voiceId, history] of this.voiceExecutionHistory) {
      // Keep only recent history
      if (history.length > 50) {
        this.voiceExecutionHistory.set(voiceId, history.slice(-50));
      }
    }
  }

  /**
   * Public API methods
   */

  getVoiceCapabilityMapping(voiceId: string): VoiceCapabilityMapping | null {
    return this.voiceCapabilityMappings.get(voiceId) || null;
  }

  updateVoiceCapabilityMapping(voiceId: string, mapping: Partial<VoiceCapabilityMapping>): void {
    const existing = this.voiceCapabilityMappings.get(voiceId);
    if (existing) {
      this.voiceCapabilityMappings.set(voiceId, { ...existing, ...mapping });
    }
  }

  getSpiralPhaseDefinition(phase: string): LivingSpiralPhase | null {
    return this.spiralPhaseDefinitions.get(phase) || null;
  }

  getOrchestrationPlan(planId: string): MCPVoiceOrchestrationPlan | null {
    return this.activeOrchestrationPlans.get(planId) || null;
  }

  getVoiceExecutionHistory(voiceId: string): VoiceMCPResponse[] {
    return this.voiceExecutionHistory.get(voiceId) || [];
  }

  getIntegrationStats(): any {
    const allHistory = Array.from(this.voiceExecutionHistory.values()).flat();

    return {
      totalRequests: allHistory.length,
      successRate: allHistory.filter(r => r.success).length / allHistory.length,
      avgExecutionTime: allHistory.reduce((sum, r) => sum + r.executionTime, 0) / allHistory.length,
      voiceActivity: Object.fromEntries(this.voiceExecutionHistory.entries()),
      activeOrchestrationPlans: this.activeOrchestrationPlans.size,
      capabilityCacheSize: this.capabilityCache.size,
    };
  }
}

interface CollaborationSession {
  sessionId: string;
  voices: string[];
  sharedData: Map<string, any>;
  synchronization: Map<string, any>;
  startTime: Date;
}

// Global instance
export const intelligentMCPVoiceIntegration = new IntelligentMCPVoiceIntegration();
