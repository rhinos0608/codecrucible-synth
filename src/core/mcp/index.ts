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
        new (await import('../../mcp-servers/smithery-registry-integration.js')).SmitheryRegistryIntegration({
          apiKey: config.smithery.apiKey
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
    this.loadBalancer.on('request-completed', (poolId: string, connectionId: string, success: boolean, responseTime: number) => {
      // Record performance metric
      this.analyticsSystem.recordMetric({
        metricId: `metric-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        timestamp: new Date(),
        connectionId,
        serverId: connectionId.split('-')[0], // Extract server ID
        serverName: connectionId.split('-')[0],
        responseTime,
        throughput: 1, // 1 request
        errorRate: success ? 0 : 100,
        availability: success ? 100 : 0,
        successRate: success ? 100 : 0,
        reliability: success ? 100 : 0,
      });
    });
    
    // Coordinate security with voice integration
    this.securitySystem.on('security-event', (event: any) => {
      if (event.severity === 'critical') {
        console.log(`🔒 Critical security event detected: ${event.description}`);
      }
    });
    
    // Coordinate voice integration with analytics
    this.voiceIntegration.on('voice-mcp-success', (response: any) => {
      console.log(`🎭 Voice ${response.voiceId} successfully executed MCP request in ${response.executionTime}ms`);
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
  async createCollaborationPlan(
    phase: string,
    voices: string[],
    requirements: any
  ) {
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
      this.analyticsSystem.generatePerformanceReport('daily').then(report => report.recommendations),
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
    return this.analyticsSystem.generateCapacityPlan(serverId);
  }
  
  // Provide access to individual systems
  get reliability() { return this.reliabilitySystem; }
  get discovery() { return this.discoverySystem; }
  get loadBalancing() { return this.loadBalancer; }
  get security() { return this.securitySystem; }
  get voiceIntegrationSystem() { return this.voiceIntegration; }
  get analytics() { return this.analyticsSystem; }
}

// Export singleton instance
export const enhancedMCPIntegrationManager = EnhancedMCPIntegrationManager.getInstance();

// Export integration utilities
export * from './integration-utils.js';