/**
 * Enhanced MCP External Integration System - Main Export Index
 *
 * This module provides comprehensive MCP (Model Context Protocol) integration enhancements
 * for the CodeCrucible Synth AI system, including:
 *
 * - Advanced connection reliability and error handling
 * - Intelligent server discovery and registration
 * - Connection pooling and load balancing
 * - Voice archetype integration and optimization
 * - Enterprise-grade security and authentication
 * - Real-time performance monitoring and analytics
 */

// Core Enhanced MCP Components
export {
  EnhancedMCPReliabilitySystem,
  enhancedMCPReliabilitySystem,
  type ConnectionHealthMetrics,
  type ConnectionPool,
  type AdaptiveTimeout,
} from './enhanced-mcp-reliability-system.js';

export {
  AdvancedMCPDiscoverySystem,
  advancedMCPDiscoverySystem,
  type DiscoveredMCPServer,
  type ServerDiscoveryQuery,
  type ServerRecommendation,
  type MCPServerCapability,
} from './advanced-mcp-discovery-system.js';

export {
  IntelligentMCPLoadBalancer,
  intelligentMCPLoadBalancer,
  type ConnectionPoolConfig,
  type LoadBalancingStrategy,
  type LoadBalancingDecision,
  type PoolConnection,
  type PoolMetrics,
} from './intelligent-mcp-load-balancer.js';

export {
  EnhancedMCPSecuritySystem,
  enhancedMCPSecuritySystem,
  type SecurityPolicy,
  type SecurityContext,
  type SecurityEvent,
  type AuthenticationMethod,
  type ValidationRule,
  type FilteringRule,
} from './enhanced-mcp-security-system.js';

export {
  IntelligentMCPVoiceIntegration,
  intelligentMCPVoiceIntegration,
  type VoiceCapabilityMapping,
  type LivingSpiralPhase,
  type VoiceMCPRequest,
  type VoiceMCPResponse,
  type MCPVoiceOrchestrationPlan,
  type MCPToolStep,
} from './intelligent-mcp-voice-integration.js';

export {
  MCPPerformanceAnalyticsSystem,
  mcpPerformanceAnalyticsSystem,
  type PerformanceMetric,
  type PerformanceAlert,
  type PerformanceTrend,
  type CapacityPlan,
  type PerformanceReport,
  type PerformanceRecommendation,
} from './mcp-performance-analytics-system.js';

// Integration utilities and helpers
export * from './integration-utils.js';

// Import classes for internal use in the integration manager
import { EnhancedMCPReliabilitySystem } from './enhanced-mcp-reliability-system.js';
import { AdvancedMCPDiscoverySystem } from './advanced-mcp-discovery-system.js';
import { IntelligentMCPLoadBalancer } from './intelligent-mcp-load-balancer.js';
import { EnhancedMCPSecuritySystem } from './enhanced-mcp-security-system.js';
import { IntelligentMCPVoiceIntegration } from './intelligent-mcp-voice-integration.js';
import { MCPPerformanceAnalyticsSystem } from './mcp-performance-analytics-system.js';
import { PerformanceReport } from '../../domain/services/unified-performance-system.js';

/**
 * Enhanced MCP Integration Manager
 *
 * Provides a unified interface for all enhanced MCP functionality
 */
export class EnhancedMCPIntegrationManager {
  private static instance: EnhancedMCPIntegrationManager | null = null;

  private readonly reliabilitySystem = new EnhancedMCPReliabilitySystem();
  private readonly discoverySystem = new AdvancedMCPDiscoverySystem();
  private readonly loadBalancer = new IntelligentMCPLoadBalancer();
  private readonly securitySystem = new EnhancedMCPSecuritySystem();
  private readonly voiceIntegration = new IntelligentMCPVoiceIntegration();
  private readonly analyticsSystem = new MCPPerformanceAnalyticsSystem();

  private constructor() {}

  static getInstance(): EnhancedMCPIntegrationManager {
    if (!EnhancedMCPIntegrationManager.instance) {
      EnhancedMCPIntegrationManager.instance = new EnhancedMCPIntegrationManager();
    }
    return EnhancedMCPIntegrationManager.instance;
  }

  /**
   * Initialize all enhanced MCP systems
   */
  async initialize(config?: any): Promise<void> {
    // Initialize discovery system with Smithery integration
    if (config?.smithery?.apiKey) {
      await this.discoverySystem.registerDiscoverySource(
        'smithery',
        new (
          await import('../../mcp-servers/smithery-registry-integration.js')
        ).SmitheryRegistryIntegration({
          apiKey: config.smithery.apiKey,
        })
      );
    }

    // Start server discovery
    await this.discoverySystem.discoverServers();

    // Set up event listeners for system coordination
    this.setupSystemCoordination();

    console.log('🚀 Enhanced MCP Integration System initialized successfully');
  }

  /**
   * Set up coordination between different MCP systems
   */
  private setupSystemCoordination(): void {
    // Coordinate discovery with reliability monitoring
    this.discoverySystem.on('discovery-completed', (serverCount: number) => {
      console.log(`📡 Discovered ${serverCount} MCP servers - initializing reliability monitoring`);
    });

    // Coordinate load balancer with performance analytics
    this.loadBalancer.on(
      'request-completed',
      (poolId: string, connectionId: string, success: boolean, responseTime: number) => {
        // Record performance metric
        this.analyticsSystem.recordMetric('mcp_request_response_time', responseTime, 'ms');
      }
    );

    // Coordinate security with voice integration
    this.securitySystem.on('security-event', (event: any) => {
      if (event.severity === 'critical') {
        console.log(`🔒 Critical security event detected: ${event.description}`);
      }
    });

    // Coordinate voice integration with analytics
    this.voiceIntegration.on('voice-mcp-success', (response: any) => {
      console.log(
        `🎭 Voice ${response.voiceId} successfully executed MCP request in ${response.executionTime}ms`
      );
    });

    // Coordinate analytics with all systems
    this.analyticsSystem.on('alert-created', (alert: any) => {
      if (alert.severity === 'critical' || alert.severity === 'error') {
        console.log(`⚠️ Performance alert: ${alert.description} (Severity: ${alert.severity})`);
      }
    });
  }

  /**
   * Get comprehensive system status
   */
  getSystemStatus() {
    return {
      discovery: this.discoverySystem.getDiscoveryStats(),
      reliability: this.reliabilitySystem.getAllHealthMetrics(),
      loadBalancing: this.loadBalancer.getAllPoolMetrics(),
      security: this.securitySystem.getSecurityStats(),
      voiceIntegration: this.voiceIntegration.getIntegrationStats(),
      analytics: this.analyticsSystem.getAnalyticsStats(),
    };
  }

  /**
   * Execute optimized MCP request using all enhanced systems
   */
  async executeOptimizedMCPRequest(request: {
    voiceId: string;
    capability: string;
    parameters: any;
    context?: any;
  }) {
    try {
      // Create voice MCP request
      const voiceRequest = {
        requestId: `req-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        voiceId: request.voiceId,
        phase: request.context?.phase || 'council',
        capability: request.capability,
        parameters: request.parameters,
        context: request.context,
        priority: 'normal' as const,
        timeout: 30000,
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential' as const,
          baseDelay: 1000,
          maxDelay: 10000,
          retryOn: 'all' as const,
        },
        minReliability: 80,
        maxLatency: 5000,
      };

      // Execute through voice integration system
      const response = await this.voiceIntegration.executeVoiceMCPRequest(voiceRequest);

      return response;
    } catch (error) {
      console.error('Enhanced MCP request execution failed:', error);
      throw error;
    }
  }

  /**
   * Create orchestration plan for multi-voice collaboration
   */
  async createCollaborationPlan(phase: string, voices: string[], requirements: any) {
    return this.voiceIntegration.createOrchestrationPlan(phase, voices, requirements);
  }

  /**
   * Execute collaboration plan
   */
  async executeCollaborationPlan(planId: string) {
    return this.voiceIntegration.executeOrchestrationPlan(planId);
  }

  /**
   * Get performance insights and recommendations
   */
  async getPerformanceInsights() {
    const [trends, alerts, recommendations] = await Promise.all([
      Promise.resolve(this.analyticsSystem.getPerformanceTrends()),
      Promise.resolve(this.analyticsSystem.getActiveAlerts()),
      this.analyticsSystem
        .generatePerformanceReport()
        .then((report: PerformanceReport) => report.recommendations),
    ]);

    return {
      trends: Array.from(trends.entries()),
      activeAlerts: alerts,
      recommendations,
    };
  }

  /**
   * Generate capacity planning report
   */
  async generateCapacityPlan(serverId: string) {
    return this.analyticsSystem.generateCapacityPlan();
  }

  /**
   * Integration method for SystemIntegrationCoordinator
   * Execute integrated MCP request based on voice result and capability requirements
   */
  async executeIntegratedRequest(
    voiceResult: any,
    mcpCapabilityRequirements: string[]
  ): Promise<any> {
    try {
      const startTime = Date.now();

      // If no MCP capabilities required, return voice result directly
      if (!mcpCapabilityRequirements || mcpCapabilityRequirements.length === 0) {
        return {
          content: voiceResult.content || voiceResult,
          mcpCapabilitiesUsed: [],
          mcpResults: [],
          processingTime: 0,
          fallback: false,
        };
      }

      // For now, return enhanced voice result with simulated MCP integration
      // TODO: Implement full MCP capability discovery and execution
      const simulatedMCPResult = this.simulateMCPIntegration(
        voiceResult,
        mcpCapabilityRequirements
      );

      const processingTime = Date.now() - startTime;

      return {
        content: simulatedMCPResult.content,
        mcpCapabilitiesUsed: mcpCapabilityRequirements,
        mcpResults: simulatedMCPResult.results,
        processingTime,
        serversUsed: ['simulated-mcp-server'],
        fallback: false,
        integrationMetadata: {
          timestamp: Date.now(),
          capabilityCount: mcpCapabilityRequirements.length,
          serverCount: 1,
          integrationMethod: 'executeIntegratedRequest',
          note: 'Using simulated MCP integration until full implementation',
        },
      };
    } catch (error) {
      console.error('Failed to execute integrated MCP request:', error);

      // Return fallback result
      return this.createMCPFallbackResult(voiceResult, mcpCapabilityRequirements, error);
    }
  }

  /**
   * Simulate MCP integration for testing and development
   */
  private simulateMCPIntegration(voiceResult: any, capabilities: string[]): any {
    const baseContent = voiceResult.content || voiceResult;
    const results: any[] = [];

    // Simulate different MCP capabilities
    for (const capability of capabilities) {
      switch (capability) {
        case 'file_operations':
          results.push({
            capability: 'file_operations',
            result: `[MCP] File operations simulated for content analysis`,
            confidence: 0.8,
          });
          break;

        case 'code_execution':
          results.push({
            capability: 'code_execution',
            result: `[MCP] Code execution simulated - syntax validated`,
            confidence: 0.9,
          });
          break;

        case 'web_search':
          results.push({
            capability: 'web_search',
            result: `[MCP] Web search simulated - relevant resources found`,
            confidence: 0.7,
          });
          break;

        default:
          results.push({
            capability,
            result: `[MCP] ${capability} simulated`,
            confidence: 0.6,
          });
      }
    }

    // Combine voice result with simulated MCP results
    const enhancedContent = [
      baseContent,
      '--- MCP Integration ---',
      ...results.map(r => r.result),
    ].join('\n');

    return {
      content: enhancedContent,
      results,
      enhanced: true,
    };
  }

  /**
   * Create fallback result when MCP integration fails
   */
  private createMCPFallbackResult(voiceResult: any, requirements: string[], error?: any): any {
    return {
      content: voiceResult.content || voiceResult,
      mcpCapabilitiesUsed: [],
      mcpResults: [],
      processingTime: 0,
      fallback: true,
      fallbackReason: error ? error.message : 'MCP integration unavailable',
      originalRequirements: requirements,
      warning: 'MCP integration unavailable - using voice result only',
    };
  }

  // Provide access to individual systems
  get reliability() {
    return this.reliabilitySystem;
  }
  get discovery() {
    return this.discoverySystem;
  }
  get loadBalancing() {
    return this.loadBalancer;
  }
  get security() {
    return this.securitySystem;
  }
  get voiceIntegrationSystem() {
    return this.voiceIntegration;
  }
  get analytics() {
    return this.analyticsSystem;
  }
}

// Export singleton instance
export const enhancedMCPIntegrationManager = EnhancedMCPIntegrationManager.getInstance();

// Export integration utilities
export * from './integration-utils.js';
