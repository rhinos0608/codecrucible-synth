/**
 * Unified Services Export Index
 * 
 * This file provides a centralized export for all unified services,
 * making it easy to migrate from legacy managers/coordinators to 
 * consolidated services throughout the codebase.
 */

// Import services for internal compatibility mappings
import { UnifiedCacheService, unifiedCacheService } from './unified-cache-service.js';
import { UnifiedConfigService, unifiedConfigService } from './unified-config-service.js';
import { UnifiedMCPConnectionService, unifiedMCPConnectionService } from './unified-mcp-connection-service.js';
import { UnifiedOrchestrationService, unifiedOrchestrationService } from './unified-orchestration-service.js';
import { UnifiedErrorService, unifiedErrorService } from './unified-error-service.js';

// Unified Cache Service
export {
  UnifiedCacheService,
  unifiedCacheService,
  type CacheEntry,
  type CacheOptions,
  type CacheConfig,
  type CacheStats,
} from './unified-cache-service.js';

// Unified Configuration Service  
export {
  UnifiedConfigService,
  unifiedConfigService,
  type UnifiedAppConfig,
  type LLMProviderConfig,
  type AgentConfig,
  type EnterpriseSecurityConfig,
  type EnterpriseMonitoringConfig,
  type EnterpriseBackupConfig,
  type EnterpriseComplianceConfig,
  type PerformanceConfig,
  type StreamingConfig,
  type MCPServerConfig,
  type ConfigurationValidation,
  type ConfigOptions,
} from './unified-config-service.js';

// Unified MCP Connection Service
export {
  UnifiedMCPConnectionService,
  unifiedMCPConnectionService,
  type MCPConnectionConfig,
  type MCPServerCapabilities,
  type MCPTool,
  type MCPResource,
  type MCPPrompt,
  type MCPPerformanceMetrics,
  type MCPConnection,
  type MCPConnectionStats,
} from './unified-mcp-connection-service.js';

// Unified Orchestration Service
export {
  UnifiedOrchestrationService,
  unifiedOrchestrationService,
  type UnifiedTool,
  type ToolMetadata,
  type ToolCapability,
  type ToolRequirement,
  type ToolContext,
  type ToolConstraints,
  type SecurityContext,
  type ToolResult,
  type ToolExecutionDelta,
  type ToolCategory,
  type WorkflowTask,
  type WorkflowTaskType,
  type TaskPriority,
  type TaskStatus,
  type WorkflowPattern,
  type WorkflowStage,
  WorkflowPatternType,
  type CollaborationType,
  type AgentCapability,
  type PerformanceMetrics,
  type AgentPreferences,
  type TaskResult,
  type CollaborationData,
  type ExecutionRequest,
  type ExecutionResponse,
  type ExecutionPlan,
  type ExecutionStep,
  type RiskAssessment,
} from './unified-orchestration-service.js';

// Unified Error Service
export {
  UnifiedErrorService,
  unifiedErrorService,
  StructuredError,
  ErrorSeverity,
  ErrorCategory,
  createStructuredError,
  handleError,
  handleErrorWithRecovery,
  type ErrorContext,
  type ErrorMetadata,
  type FallbackStrategy,
  type CircuitBreakerState,
  type RateLimiterState,
  type ErrorMetrics,
  type UnifiedErrorConfig,
} from './unified-error-service.js';

/**
 * Legacy Import Compatibility Layer
 * 
 * These exports maintain backward compatibility with existing imports
 * while providing a deprecation path to the unified services.
 */

// Cache compatibility exports
export const CacheManager = UnifiedCacheService;
export const cacheManager = unifiedCacheService;
export const CacheCoordinator = UnifiedCacheService; 
export const ResponseCacheManager = UnifiedCacheService;
export const responseCache = unifiedCacheService;

// Config compatibility exports
export const ConfigurationManager = UnifiedConfigService;
export const EnterpriseConfigManager = UnifiedConfigService;
export const ConfigManager = UnifiedConfigService;
export const configManager = unifiedConfigService;

// MCP compatibility exports
export const MCPServerManager = UnifiedMCPConnectionService;
export const EnhancedMCPClientManager = UnifiedMCPConnectionService;
export const mcpServerManager = unifiedMCPConnectionService;

// Orchestration compatibility exports
export const AdvancedToolOrchestrator = UnifiedOrchestrationService;
export const WorkflowOrchestrator = UnifiedOrchestrationService;
export const AdvancedWorkflowOrchestrator = UnifiedOrchestrationService;

// Error handling compatibility exports
export const ErrorHandler = UnifiedErrorService;
export const EnterpriseErrorHandler = UnifiedErrorService;
export const SearchErrorHandler = UnifiedErrorService;

/**
 * Convenience factory functions for common use cases
 */

/**
 * Create a pre-configured cache service instance
 */
export function createCacheService(config?: any): UnifiedCacheService {
  return new UnifiedCacheService(config);
}

/**
 * Create a pre-configured config service instance
 */
export function createConfigService(options?: any): Promise<UnifiedConfigService> {
  return UnifiedConfigService.getInstance(options);
}

/**
 * Create a pre-configured MCP connection service instance
 */
export function createMCPService(): UnifiedMCPConnectionService {
  return UnifiedMCPConnectionService.getInstance();
}

/**
 * Create a pre-configured orchestration service instance
 */
export function createOrchestrationService(): UnifiedOrchestrationService {
  return UnifiedOrchestrationService.getInstance();
}

/**
 * Create a pre-configured error service instance
 */
export function createErrorService(config?: any): UnifiedErrorService {
  return UnifiedErrorService.getInstance(config);
}

/**
 * Service Health Check Utilities
 */
export async function checkServicesHealth(): Promise<{
  cache: boolean;
  config: boolean;
  mcp: boolean;
  orchestration: boolean;
  error: boolean;
  overall: boolean;
}> {
  const results = {
    cache: false,
    config: false,
    mcp: false,
    orchestration: false,
    error: false,
    overall: false,
  };

  try {
    // Cache service health
    const cacheStats = unifiedCacheService.getStats();
    results.cache = true;
  } catch (error) {
    console.warn('Cache service health check failed:', error);
  }

  try {
    // Config service health
    const configService = await unifiedConfigService;
    results.config = true;
  } catch (error) {
    console.warn('Config service health check failed:', error);
  }

  try {
    // MCP service health
    const mcpStats = unifiedMCPConnectionService.getGlobalStats();
    results.mcp = true;
  } catch (error) {
    console.warn('MCP service health check failed:', error);
  }

  try {
    // Orchestration service health
    const orchStats = unifiedOrchestrationService.getPerformanceStats();
    results.orchestration = true;
  } catch (error) {
    console.warn('Orchestration service health check failed:', error);
  }

  try {
    // Error service health
    const errorStats = unifiedErrorService.getErrorStats();
    results.error = true;
  } catch (error) {
    console.warn('Error service health check failed:', error);
  }

  results.overall = Object.values(results).filter(Boolean).length >= 4;
  return results;
}

/**
 * Migration Utilities
 */
export const MIGRATION_GUIDE = {
  cache: {
    from: [
      'core/cache/cache-manager.ts',
      'core/caching/cache-coordinator.ts', 
      'core/performance/response-cache-manager.ts'
    ],
    to: 'core/services/unified-cache-service.ts',
    importChange: "import { unifiedCacheService } from '../services/index.js';",
    notes: 'All cache functionality consolidated into single service with intelligent caching features'
  },
  config: {
    from: [
      'core/config/configuration-manager.ts',
      'core/config/enterprise-config-manager.ts',
      'config/config-manager.ts'
    ],
    to: 'core/services/unified-config-service.ts',
    importChange: "import { unifiedConfigService } from '../services/index.js';",
    notes: 'All configuration management consolidated with enterprise features and validation'
  },
  mcp: {
    from: [
      'mcp-servers/mcp-server-manager.ts',
      'mcp-servers/enhanced-mcp-client-manager.ts',
      'core/mcp-server-manager.ts'
    ],
    to: 'core/services/unified-mcp-connection-service.ts',
    importChange: "import { unifiedMCPConnectionService } from '../services/index.js';",
    notes: 'All MCP connection management consolidated with health monitoring and circuit breakers'
  },
  orchestration: {
    from: [
      'core/tools/advanced-tool-orchestrator.ts',
      'core/workflow/workflow-orchestrator.ts',
      'core/collaboration/advanced-workflow-orchestrator.ts'
    ],
    to: 'core/services/unified-orchestration-service.ts',
    importChange: "import { unifiedOrchestrationService } from '../services/index.js';",
    notes: 'All orchestration functionality consolidated with intelligent tool selection and multi-agent collaboration'
  },
  error: {
    from: [
      'core/error-handling/enterprise-error-handler.ts',
      'core/error-handling/structured-error-system.ts',
      'core/search/error-handler.ts'
    ],
    to: 'core/services/unified-error-service.ts',
    importChange: "import { unifiedErrorService } from '../services/index.js';",
    notes: 'All error handling consolidated with intelligent retry, circuit breakers, and fallback strategies'
  }
};

/**
 * Deprecation warnings for development
 */
if (process.env.NODE_ENV === 'development') {
  const deprecationWarnings = new Set<string>();
  
  const warnDeprecated = (oldPath: string, newPath: string) => {
    if (!deprecationWarnings.has(oldPath)) {
      console.warn(
        `⚠️  DEPRECATION WARNING: Import from '${oldPath}' is deprecated. ` +
        `Use '${newPath}' instead. See MIGRATION_GUIDE for details.`
      );
      deprecationWarnings.add(oldPath);
    }
  };

  // This would be used by a build-time plugin to warn about deprecated imports
  (globalThis as any).__UNIFIED_SERVICES_DEPRECATION_WARN__ = warnDeprecated;
}

/**
 * Default export for convenience
 */
export default {
  cache: unifiedCacheService,
  config: unifiedConfigService, 
  mcp: unifiedMCPConnectionService,
  orchestration: unifiedOrchestrationService,
  error: unifiedErrorService,
  health: checkServicesHealth,
  migration: MIGRATION_GUIDE,
};