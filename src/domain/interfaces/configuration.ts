/**
 * Unified Configuration Interface - Backward Compatibility Layer
 *
 * @deprecated Use UnifiedConfiguration from '../types/unified-types.js' instead
 * This file provides backward compatibility for old imports while redirecting to the canonical definition.
 *
 * ULTRATHINK ARCHITECTURE FIX: Consolidates duplicate UnifiedConfiguration interfaces
 * - Eliminates type conflicts between domain/interfaces and domain/types
 * - Provides seamless backward compatibility
 * - Maintains single source of truth in unified-types.ts
 */

// Import types for local use
import type { ApplicationConfiguration, VoiceSystemConfiguration } from '../types/unified-types.js';

// Re-export the canonical UnifiedConfiguration and all related types from unified-types
export type {
  UnifiedConfiguration,
  SystemConfiguration,
  ApplicationConfiguration,
  ModelConfiguration,
  VoiceSystemConfiguration,
  ToolConfiguration,
  SecurityConfiguration,
  PerformanceConfiguration,
  MonitoringConfiguration,
  InfrastructureConfiguration,
  DatabaseConfiguration,
  BackupConfiguration,
  StorageConfiguration,
  MessagingConfiguration,
  NetworkConfiguration,
  ProxyConfiguration,
  TLSConfiguration,
  CacheConfiguration,
  PoolConfiguration,
  ConnectionPoolConfiguration,
  ThreadPoolConfiguration,
  OptimizationConfiguration,
  MetricConfiguration,
  AlertConfiguration,
  DashboardConfiguration,
  EncryptionConfiguration,
  AuditConfiguration,
  ConfigurationValidation,
  ConfigurationError,
  ConfigurationSource,
  ConfigurationSourceInfo,
  ConfigurationWarning,
} from '../types/unified-types.js';

// Legacy aliases for backward compatibility
export type AppConfiguration = ApplicationConfiguration;
export type VoiceConfiguration = VoiceSystemConfiguration;

// Common provider configuration types that might be expected
export interface ModelProviderConfiguration {
  name: string;
  enabled: boolean;
  config: Record<string, any>;
  priority: number;
  fallback?: boolean;
}

export interface ProviderConfiguration {
  type: string;
  enabled: boolean;
  config: Record<string, any>;
  healthCheck?: {
    enabled: boolean;
    interval: number;
    timeout: number;
  };
}
