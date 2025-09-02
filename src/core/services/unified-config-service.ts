/**
 * Unified Config Service - Replaced with Domain Implementation
 *
 * @deprecated Use UnifiedConfigurationManager from domain/services instead
 * This provides backward compatibility during architectural migration.
 *
 * The previous implementation referenced non-existent SecurityUtils and
 * violated architectural layering. The domain-level configuration manager
 * provides the same functionality with proper dependency management.
 */

// Re-export the properly layered domain implementation
export * from '../../domain/config/config-manager.js';
export * from '../../domain/interfaces/configuration.js';

// For backward compatibility, provide type aliases for old naming conventions
export type {
  UnifiedConfiguration as UnifiedConfig,
  UnifiedConfiguration as UnifiedAppConfig,
  AppConfiguration as AppConfig,
  ModelConfiguration as ModelConfig,
  ModelProviderConfiguration as LLMProviderConfig,
  SecurityConfiguration as EnterpriseSecurityConfig,
  PerformanceConfiguration as PerformanceConfig,
  VoiceConfiguration as StreamingConfig,
  ToolConfiguration as MCPServerConfig,
  InfrastructureConfiguration as EnterpriseMonitoringConfig,
  ConfigurationValidation,
} from '../../domain/interfaces/configuration.js';

// Agent configuration based on legacy structure
export interface AgentConfig {
  enabled: boolean;
  mode: 'fast' | 'balanced' | 'thorough' | 'auto';
  maxConcurrency: number;
  enableCaching: boolean;
  enableMetrics: boolean;
  enableSecurity: boolean;
}

// Enterprise configurations - these extend the base security and performance configs
export interface EnterpriseBackupConfig {
  enabled: boolean;
  interval: number;
  retention: number;
  path: string;
  compressionLevel: number;
  encryptionEnabled: boolean;
}

export interface EnterpriseComplianceConfig {
  enabled: boolean;
  auditLevel: 'basic' | 'detailed' | 'comprehensive';
  reportingInterval: number;
  complianceStandards: string[];
  dataRetentionPeriod: number;
}

export interface ConfigOptions {
  validateOnLoad: boolean;
  watchForChanges: boolean;
  enableBackups: boolean;
  strictMode: boolean;
  migrationMode: boolean;
}

// Export the class as a value, not just a type
export { UnifiedConfigurationManager as UnifiedConfigService } from '../../domain/config/config-manager.js';

// Create a singleton instance for backward compatibility
import { UnifiedConfigurationManager } from '../../domain/config/config-manager.js';
import { createLogger } from '../../infrastructure/logging/logger-adapter.js';

const logger = createLogger('UnifiedConfigService');
export const unifiedConfigService = new UnifiedConfigurationManager(logger);
