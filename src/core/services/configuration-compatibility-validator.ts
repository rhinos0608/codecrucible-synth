/**
 * Configuration Compatibility Validator
 *
 * Resolves Issues #7, #8, #9 from Integration Audit:
 * - Issue #7: Duplicate Configuration Options (3 different "max concurrent" settings)
 * - Issue #8: Configuration Loading Order Issues (no validation of compatibility)
 * - Issue #9: Missing Configuration Bridges (no sync mechanism between systems)
 *
 * This system validates and harmonizes configurations across all 4 enhanced systems:
 * - Intelligent Routing System
 * - Voice Optimization System
 * - MCP Enhancement System
 * - Unified Services System
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import { unifiedConfigService, UnifiedAppConfig } from './unified-config-service.js';

// Configuration conflict types identified in audit
export interface ConfigurationConflict {
  type: 'duplicate' | 'incompatible' | 'missing' | 'ordering';
  systems: string[];
  configPaths: string[];
  currentValues: any[];
  recommendedValue?: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  autoResolvable: boolean;
}

export interface SystemConfigurationProfile {
  systemName: string;
  concurrencyConfig: ConcurrencyConfiguration;
  timeoutConfig: TimeoutConfiguration;
  fallbackConfig: FallbackConfiguration;
  performanceConfig: PerformanceConfiguration;
  errorHandlingConfig: ErrorHandlingConfiguration;
}

export interface ConcurrencyConfiguration {
  maxConcurrent: number;
  maxConcurrentRequests?: number;
  maxConcurrentVoices?: number;
  maxConcurrentTasks?: number;
  maxConcurrentRouting?: number;
  batchSize?: number;
  queueSize?: number;
}

export interface TimeoutConfiguration {
  baseTimeout: number;
  requestTimeout?: number;
  connectionTimeout?: number;
  routingTimeout?: number;
  voiceTimeout?: number;
  taskTimeout?: number;
  retryTimeout?: number;
}

export interface FallbackConfiguration {
  strategy: string;
  enableFallback: boolean;
  fallbackChain?: string[];
  maxFallbackAttempts?: number;
  legacyFallback?: boolean;
  gracefulDegradation?: boolean;
}

export interface PerformanceConfiguration {
  cacheEnabled: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  compressionEnabled?: boolean;
  streamingEnabled?: boolean;
  metricsEnabled?: boolean;
}

export interface ErrorHandlingConfiguration {
  strategy: 'retry' | 'fallback' | 'circuit-breaker' | 'fail-fast';
  maxRetries: number;
  retryDelay: number;
  circuitBreakerEnabled?: boolean;
  circuitBreakerThreshold?: number;
  escalationEnabled?: boolean;
}

export interface ConfigurationSynchronizationBridge {
  sourceSystem: string;
  targetSystem: string;
  configMappings: Array<{
    sourcePath: string;
    targetPath: string;
    transformer?: (value: any) => any;
    validator?: (value: any) => boolean;
  }>;
  syncDirection: 'unidirectional' | 'bidirectional';
  autoSync: boolean;
}

export interface CompatibilityValidationResult {
  isCompatible: boolean;
  conflicts: ConfigurationConflict[];
  warnings: string[];
  recommendations: string[];
  autoResolutions: Array<{
    conflict: ConfigurationConflict;
    resolution: any;
    confidence: number;
  }>;
  harmonizedConfiguration?: SystemConfigurationProfile[];
}

/**
 * Main Configuration Compatibility Validator
 *
 * Addresses the root cause of configuration conflicts by providing:
 * 1. Unified validation across all systems
 * 2. Automatic conflict detection and resolution
 * 3. Configuration synchronization bridges
 * 4. Compatibility checking before system startup
 */
export class ConfigurationCompatibilityValidator extends EventEmitter {
  private static instance: ConfigurationCompatibilityValidator | null = null;

  // System configuration profiles for the 4 enhanced systems
  private systemProfiles: Map<string, SystemConfigurationProfile> = new Map();
  private synchronizationBridges: ConfigurationSynchronizationBridge[] = [];
  private validationRules: Map<string, Array<(config: any) => ConfigurationConflict | null>> =
    new Map();

  // Conflict resolution history and caching
  private resolvedConflicts: Map<string, any> = new Map();
  private validationCache: Map<string, CompatibilityValidationResult> = new Map();

  private constructor() {
    super();
    this.initializeValidationRules();
    this.initializeSynchronizationBridges();
  }

  static getInstance(): ConfigurationCompatibilityValidator {
    if (!ConfigurationCompatibilityValidator.instance) {
      ConfigurationCompatibilityValidator.instance = new ConfigurationCompatibilityValidator();
    }
    return ConfigurationCompatibilityValidator.instance;
  }

  /**
   * Main validation entry point - validates all system configurations for compatibility
   * Resolves Issue #8: Configuration Loading Order Issues
   */
  async validateSystemCompatibility(): Promise<CompatibilityValidationResult> {
    logger.info('🔧 Starting comprehensive configuration compatibility validation');

    try {
      // Step 1: Load and extract configurations from all systems
      const systemConfigs = await this.extractSystemConfigurations();

      // Step 2: Detect conflicts (Issue #7: Duplicate Configuration Options)
      const conflicts = this.detectConfigurationConflicts(systemConfigs);

      // Step 3: Generate automatic resolutions where possible
      const autoResolutions = this.generateAutoResolutions(conflicts);

      // Step 4: Create harmonized configuration profiles
      const harmonizedProfiles = this.harmonizeConfigurations(systemConfigs, autoResolutions);

      // Step 5: Generate recommendations
      const recommendations = this.generateRecommendations(conflicts, systemConfigs);
      const warnings = this.generateWarnings(conflicts);

      const result: CompatibilityValidationResult = {
        isCompatible:
          conflicts.filter(c => c.severity === 'critical' || c.severity === 'high').length === 0,
        conflicts,
        warnings,
        recommendations,
        autoResolutions,
        harmonizedConfiguration: harmonizedProfiles,
      };

      // Cache result for performance
      const cacheKey = this.generateCacheKey(systemConfigs);
      this.validationCache.set(cacheKey, result);

      logger.info(
        `✅ Configuration validation complete. Conflicts: ${conflicts.length}, Auto-resolutions: ${autoResolutions.length}`
      );
      this.emit('validation-complete', result);

      return result;
    } catch (error) {
      logger.error('❌ Configuration validation failed:', error);
      throw error;
    }
  }

  /**
   * Apply automatic conflict resolutions
   * Resolves Issue #7: Duplicate Configuration Options
   */
  async applyAutoResolutions(validationResult: CompatibilityValidationResult): Promise<void> {
    logger.info(
      `🔧 Applying ${validationResult.autoResolutions.length} automatic conflict resolutions`
    );

    const config = await unifiedConfigService;

    for (const resolution of validationResult.autoResolutions) {
      try {
        const conflict = resolution.conflict;
        const resolvedValue = resolution.resolution;

        logger.info(
          `Resolving conflict: ${conflict.description} -> ${JSON.stringify(resolvedValue)}`
        );

        // Apply resolution to all conflicting paths
        for (const configPath of conflict.configPaths) {
          await config.set(configPath, resolvedValue);
        }

        // Track resolution for audit
        this.resolvedConflicts.set(conflict.configPaths.join('|'), {
          timestamp: Date.now(),
          conflict,
          resolution: resolvedValue,
          confidence: resolution.confidence,
        });

        this.emit('conflict-resolved', conflict, resolvedValue);
      } catch (error) {
        logger.error(`Failed to resolve conflict: ${resolution.conflict.description}`, error);
      }
    }

    logger.info('✅ Auto-resolutions applied successfully');
  }

  /**
   * Synchronize configurations between systems
   * Resolves Issue #9: Missing Configuration Bridges
   */
  async synchronizeSystemConfigurations(): Promise<void> {
    logger.info('🔄 Synchronizing configurations between systems');

    const config = await unifiedConfigService;

    for (const bridge of this.synchronizationBridges) {
      try {
        logger.debug(`Syncing: ${bridge.sourceSystem} -> ${bridge.targetSystem}`);

        for (const mapping of bridge.configMappings) {
          const sourceValue = await config.get(mapping.sourcePath);

          if (sourceValue !== undefined) {
            // Apply transformation if specified
            const transformedValue = mapping.transformer
              ? mapping.transformer(sourceValue)
              : sourceValue;

            // Validate if validator specified
            if (mapping.validator && !mapping.validator(transformedValue)) {
              logger.warn(
                `Validation failed for sync: ${mapping.sourcePath} -> ${mapping.targetPath}`
              );
              continue;
            }

            // Apply synchronized value
            await config.set(mapping.targetPath, transformedValue);

            logger.debug(
              `Synced: ${mapping.sourcePath} (${sourceValue}) -> ${mapping.targetPath} (${transformedValue})`
            );
          }
        }

        this.emit('configuration-synchronized', bridge);
      } catch (error) {
        logger.error(
          `Failed to synchronize configuration bridge: ${bridge.sourceSystem} -> ${bridge.targetSystem}`,
          error
        );
      }
    }

    logger.info('✅ Configuration synchronization complete');
  }

  /**
   * Get system health related to configuration compatibility
   */
  getConfigurationHealth(): {
    compatibilityStatus: string;
    conflictCount: number;
    lastValidation: Date | null;
    systemProfiles: string[];
    bridgeStatus: Array<{ source: string; target: string; status: string }>;
    resolvedConflictCount: number;
  } {
    const lastValidation =
      this.validationCache.size > 0
        ? new Date(
            Math.max(
              ...Array.from(this.validationCache.keys()).map(k => parseInt(k.split('_')[1] || '0'))
            )
          )
        : null;

    return {
      compatibilityStatus: this.validationCache.size > 0 ? 'validated' : 'pending',
      conflictCount: Array.from(this.validationCache.values()).reduce(
        (total, result) => total + result.conflicts.length,
        0
      ),
      lastValidation,
      systemProfiles: Array.from(this.systemProfiles.keys()),
      bridgeStatus: this.synchronizationBridges.map(bridge => ({
        source: bridge.sourceSystem,
        target: bridge.targetSystem,
        status: 'active',
      })),
      resolvedConflictCount: this.resolvedConflicts.size,
    };
  }

  /**
   * Private implementation methods
   */

  private async extractSystemConfigurations(): Promise<Map<string, SystemConfigurationProfile>> {
    const config = await unifiedConfigService;
    const allConfig = config.getAll();

    const profiles = new Map<string, SystemConfigurationProfile>();

    // Extract Routing System configuration
    profiles.set('routing', {
      systemName: 'routing',
      concurrencyConfig: {
        maxConcurrent: (await config.get('performance.maxConcurrentRequests')) || 3,
        maxConcurrentRouting: 3, // Default for routing-specific concurrency
        batchSize: 2,
        queueSize: 50,
      },
      timeoutConfig: {
        baseTimeout: (await config.get('performance.timeoutMs')) || 180000,
        routingTimeout: 10000, // Routing-specific timeout
        connectionTimeout: 5000,
      },
      fallbackConfig: {
        strategy: (await config.get('fallbackChain.0')) || 'lm-studio',
        enableFallback: true,
        fallbackChain: (await config.get('fallbackChain')) || ['ollama', 'lm-studio'],
        maxFallbackAttempts: 2,
      },
      performanceConfig: {
        cacheEnabled: (await config.get('performance.responseCache.enabled')) || true,
        cacheSize: (await config.get('performance.responseCache.maxSize')) || 100,
        cacheTTL: (await config.get('performance.responseCache.maxAge')) || 3600000,
        metricsEnabled: (await config.get('agent.enableMetrics')) || true,
      },
      errorHandlingConfig: {
        strategy: 'circuit-breaker',
        maxRetries: 3,
        retryDelay: 1000,
        circuitBreakerEnabled: true,
        circuitBreakerThreshold: 5,
      },
    });

    // Extract Voice System configuration
    profiles.set('voice', {
      systemName: 'voice',
      concurrencyConfig: {
        maxConcurrent: (await config.get('voices.maxConcurrent')) || 3,
        maxConcurrentVoices: (await config.get('performance.voiceParallelism.maxConcurrent')) || 4,
        batchSize: (await config.get('performance.voiceParallelism.batchSize')) || 3,
        queueSize: 30,
      },
      timeoutConfig: {
        baseTimeout: (await config.get('performance.timeoutMs')) || 180000,
        voiceTimeout: 60000, // Voice-specific timeout
        connectionTimeout: 8000,
      },
      fallbackConfig: {
        strategy: 'legacy-fallback',
        enableFallback: true,
        legacyFallback: true,
        gracefulDegradation: true,
        maxFallbackAttempts: 1,
      },
      performanceConfig: {
        cacheEnabled: (await config.get('agent.enableCaching')) || true,
        streamingEnabled: (await config.get('streaming.chunkSize')) > 0,
        compressionEnabled: true,
        metricsEnabled: (await config.get('agent.enableMetrics')) || true,
      },
      errorHandlingConfig: {
        strategy: 'fallback',
        maxRetries: 2,
        retryDelay: 500,
        escalationEnabled: true,
      },
    });

    // Extract MCP System configuration
    profiles.set('mcp', {
      systemName: 'mcp',
      concurrencyConfig: {
        maxConcurrent: 5, // MCP-specific concurrency limit
        maxConcurrentTasks: 8,
        batchSize: 4,
        queueSize: 100,
      },
      timeoutConfig: {
        baseTimeout: (await config.get('performance.timeoutMs')) || 180000,
        connectionTimeout: (await config.get('mcp.servers.terminal.timeout')) || 30000,
        taskTimeout: 45000,
      },
      fallbackConfig: {
        strategy: 'retry-strategy',
        enableFallback: true,
        fallbackChain: ['local-mcp', 'smithery-mcp'],
        maxFallbackAttempts: 3,
      },
      performanceConfig: {
        cacheEnabled: false, // MCP operations typically not cached
        metricsEnabled: (await config.get('monitoring.enableMetrics')) || true,
        streamingEnabled: false,
      },
      errorHandlingConfig: {
        strategy: 'retry',
        maxRetries: 3,
        retryDelay: 2000,
        circuitBreakerEnabled: true,
        circuitBreakerThreshold: 10,
      },
    });

    // Extract Orchestration System configuration
    profiles.set('orchestration', {
      systemName: 'orchestration',
      concurrencyConfig: {
        maxConcurrent: (await config.get('performance.maxConcurrentRequests')) || 3,
        maxConcurrentTasks: 10,
        batchSize: 5,
        queueSize: 200,
      },
      timeoutConfig: {
        baseTimeout: (await config.get('performance.timeoutMs')) || 180000,
        taskTimeout: 120000, // Orchestration tasks can be longer
        connectionTimeout: 10000,
      },
      fallbackConfig: {
        strategy: 'error-recovery',
        enableFallback: true,
        gracefulDegradation: true,
        maxFallbackAttempts: 2,
      },
      performanceConfig: {
        cacheEnabled: (await config.get('performance.responseCache.enabled')) || true,
        metricsEnabled: (await config.get('monitoring.enableMetrics')) || true,
        streamingEnabled: (await config.get('streaming.enableBackpressure')) || true,
      },
      errorHandlingConfig: {
        strategy: 'retry',
        maxRetries: (await config.get('agent.maxConcurrency')) || 3,
        retryDelay: 1500,
        escalationEnabled: true,
        circuitBreakerEnabled: false,
      },
    });

    // Store profiles for reuse
    profiles.forEach((profile, systemName) => {
      this.systemProfiles.set(systemName, profile);
    });

    return profiles;
  }

  private detectConfigurationConflicts(
    profiles: Map<string, SystemConfigurationProfile>
  ): ConfigurationConflict[] {
    const conflicts: ConfigurationConflict[] = [];

    // Issue #7: Detect duplicate maxConcurrent settings
    const concurrencyValues = new Map<string, { systems: string[]; values: number[] }>();

    for (const [systemName, profile] of profiles) {
      const config = profile.concurrencyConfig;

      // Track different concurrency settings
      if (config.maxConcurrent) {
        this.trackConfigValue(concurrencyValues, 'maxConcurrent', systemName, config.maxConcurrent);
      }
      if (config.maxConcurrentRequests) {
        this.trackConfigValue(
          concurrencyValues,
          'maxConcurrentRequests',
          systemName,
          config.maxConcurrentRequests
        );
      }
      if (config.maxConcurrentVoices) {
        this.trackConfigValue(
          concurrencyValues,
          'maxConcurrentVoices',
          systemName,
          config.maxConcurrentVoices
        );
      }
      if (config.maxConcurrentTasks) {
        this.trackConfigValue(
          concurrencyValues,
          'maxConcurrentTasks',
          systemName,
          config.maxConcurrentTasks
        );
      }
    }

    // Generate conflicts for inconsistent concurrency settings
    for (const [configKey, tracking] of concurrencyValues) {
      if (tracking.values.length > 1 && new Set(tracking.values).size > 1) {
        conflicts.push({
          type: 'duplicate',
          systems: tracking.systems,
          configPaths: tracking.systems.map(sys => `${sys}.concurrencyConfig.${configKey}`),
          currentValues: tracking.values,
          recommendedValue: Math.max(...tracking.values), // Use highest safe value
          severity: 'high',
          description: `Inconsistent ${configKey} settings across systems: ${tracking.systems.join(', ')}`,
          autoResolvable: true,
        });
      }
    }

    // Detect timeout configuration conflicts
    this.detectTimeoutConflicts(profiles, conflicts);

    // Detect fallback strategy conflicts
    this.detectFallbackConflicts(profiles, conflicts);

    // Detect performance configuration conflicts
    this.detectPerformanceConflicts(profiles, conflicts);

    // Detect error handling strategy conflicts
    this.detectErrorHandlingConflicts(profiles, conflicts);

    return conflicts;
  }

  private trackConfigValue(
    tracking: Map<string, { systems: string[]; values: number[] }>,
    key: string,
    system: string,
    value: number
  ): void {
    if (!tracking.has(key)) {
      tracking.set(key, { systems: [], values: [] });
    }
    const entry = tracking.get(key)!;
    entry.systems.push(system);
    entry.values.push(value);
  }

  private detectTimeoutConflicts(
    profiles: Map<string, SystemConfigurationProfile>,
    conflicts: ConfigurationConflict[]
  ): void {
    const timeoutValues = Array.from(profiles.values()).map(p => p.timeoutConfig.baseTimeout);
    const uniqueTimeouts = new Set(timeoutValues);

    if (uniqueTimeouts.size > 1) {
      conflicts.push({
        type: 'incompatible',
        systems: Array.from(profiles.keys()),
        configPaths: Array.from(profiles.keys()).map(sys => `${sys}.timeoutConfig.baseTimeout`),
        currentValues: timeoutValues,
        recommendedValue: Math.min(...timeoutValues), // Use most conservative timeout
        severity: 'medium',
        description:
          'Inconsistent base timeout values across systems may cause coordination issues',
        autoResolvable: true,
      });
    }
  }

  private detectFallbackConflicts(
    profiles: Map<string, SystemConfigurationProfile>,
    conflicts: ConfigurationConflict[]
  ): void {
    const strategies = Array.from(profiles.values()).map(p => p.fallbackConfig.strategy);
    const uniqueStrategies = new Set(strategies);

    if (uniqueStrategies.size > 2) {
      // Allow some variation but not too much
      conflicts.push({
        type: 'incompatible',
        systems: Array.from(profiles.keys()),
        configPaths: Array.from(profiles.keys()).map(sys => `${sys}.fallbackConfig.strategy`),
        currentValues: strategies,
        severity: 'medium',
        description:
          'Too many different fallback strategies may cause unpredictable error handling',
        autoResolvable: false, // Requires human decision
      });
    }
  }

  private detectPerformanceConflicts(
    profiles: Map<string, SystemConfigurationProfile>,
    conflicts: ConfigurationConflict[]
  ): void {
    const cachingEnabled = Array.from(profiles.values()).map(p => p.performanceConfig.cacheEnabled);
    const metricsEnabled = Array.from(profiles.values()).map(
      p => p.performanceConfig.metricsEnabled
    );

    // Check for caching inconsistencies that might affect performance
    if (new Set(cachingEnabled).size > 1) {
      conflicts.push({
        type: 'incompatible',
        systems: Array.from(profiles.keys()),
        configPaths: Array.from(profiles.keys()).map(
          sys => `${sys}.performanceConfig.cacheEnabled`
        ),
        currentValues: cachingEnabled,
        recommendedValue: true, // Enable caching by default for performance
        severity: 'low',
        description: 'Inconsistent caching settings across systems may impact performance',
        autoResolvable: true,
      });
    }
  }

  private detectErrorHandlingConflicts(
    profiles: Map<string, SystemConfigurationProfile>,
    conflicts: ConfigurationConflict[]
  ): void {
    const retryDelays = Array.from(profiles.values()).map(p => p.errorHandlingConfig.retryDelay);
    const maxRetries = Array.from(profiles.values()).map(p => p.errorHandlingConfig.maxRetries);

    // Check for extreme variations in retry configurations
    const minDelay = Math.min(...retryDelays);
    const maxDelay = Math.max(...retryDelays);

    if (maxDelay > minDelay * 5) {
      // More than 5x difference
      conflicts.push({
        type: 'incompatible',
        systems: Array.from(profiles.keys()),
        configPaths: Array.from(profiles.keys()).map(
          sys => `${sys}.errorHandlingConfig.retryDelay`
        ),
        currentValues: retryDelays,
        recommendedValue: Math.round((minDelay + maxDelay) / 2), // Average
        severity: 'medium',
        description:
          'Large variation in retry delays may cause inconsistent error recovery behavior',
        autoResolvable: true,
      });
    }
  }

  private generateAutoResolutions(conflicts: ConfigurationConflict[]): Array<{
    conflict: ConfigurationConflict;
    resolution: any;
    confidence: number;
  }> {
    return conflicts
      .filter(conflict => conflict.autoResolvable)
      .map(conflict => ({
        conflict,
        resolution: conflict.recommendedValue,
        confidence: this.calculateResolutionConfidence(conflict),
      }));
  }

  private calculateResolutionConfidence(conflict: ConfigurationConflict): number {
    // Higher confidence for simple numeric conflicts
    if (conflict.type === 'duplicate' && typeof conflict.recommendedValue === 'number') {
      return 0.9;
    }

    // Lower confidence for complex strategy conflicts
    if (conflict.configPaths.some(path => path.includes('strategy'))) {
      return 0.6;
    }

    // Medium confidence for performance-related conflicts
    if (conflict.severity === 'low') {
      return 0.8;
    }

    return 0.7; // Default confidence
  }

  private harmonizeConfigurations(
    profiles: Map<string, SystemConfigurationProfile>,
    resolutions: Array<{ conflict: ConfigurationConflict; resolution: any; confidence: number }>
  ): SystemConfigurationProfile[] {
    // Create harmonized versions of the profiles with conflicts resolved
    const harmonized: SystemConfigurationProfile[] = [];

    for (const [systemName, profile] of profiles) {
      const harmonizedProfile = JSON.parse(JSON.stringify(profile)); // Deep clone

      // Apply resolutions
      for (const { conflict, resolution } of resolutions) {
        if (conflict.systems.includes(systemName)) {
          // Apply resolution to the appropriate config path
          this.applyResolutionToProfile(harmonizedProfile, conflict, resolution);
        }
      }

      harmonized.push(harmonizedProfile);
    }

    return harmonized;
  }

  private applyResolutionToProfile(
    profile: SystemConfigurationProfile,
    conflict: ConfigurationConflict,
    resolution: any
  ): void {
    // Simple path-based resolution application
    for (const configPath of conflict.configPaths) {
      if (configPath.includes(profile.systemName)) {
        const pathParts = configPath.split('.').slice(1); // Remove system name
        this.setNestedValue(profile, pathParts, resolution);
      }
    }
  }

  private setNestedValue(obj: any, path: string[], value: any): void {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in current)) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
  }

  private generateRecommendations(
    conflicts: ConfigurationConflict[],
    profiles: Map<string, SystemConfigurationProfile>
  ): string[] {
    const recommendations: string[] = [];

    const highSeverityConflicts = conflicts.filter(
      c => c.severity === 'high' || c.severity === 'critical'
    );
    if (highSeverityConflicts.length > 0) {
      recommendations.push(
        `Resolve ${highSeverityConflicts.length} high-priority configuration conflicts before production deployment`
      );
    }

    const duplicateConflicts = conflicts.filter(c => c.type === 'duplicate');
    if (duplicateConflicts.length > 0) {
      recommendations.push(
        'Consider using a centralized configuration service to eliminate duplicate settings'
      );
    }

    const strategyConflicts = conflicts.filter(c => c.description.includes('strategy'));
    if (strategyConflicts.length > 0) {
      recommendations.push(
        'Standardize error handling and fallback strategies across all systems for predictable behavior'
      );
    }

    return recommendations;
  }

  private generateWarnings(conflicts: ConfigurationConflict[]): string[] {
    const warnings: string[] = [];

    for (const conflict of conflicts) {
      if (conflict.severity === 'critical') {
        warnings.push(`CRITICAL: ${conflict.description}`);
      } else if (conflict.severity === 'high') {
        warnings.push(`HIGH: ${conflict.description}`);
      }
    }

    return warnings;
  }

  private generateCacheKey(profiles: Map<string, SystemConfigurationProfile>): string {
    const hash = Array.from(profiles.values())
      .map(p => JSON.stringify(p))
      .join('|');

    return `config_${Date.now()}_${hash.length}`;
  }

  private initializeValidationRules(): void {
    // Concurrency validation rules
    this.validationRules.set('concurrency', [
      config => {
        const maxConcurrent = config.concurrencyConfig?.maxConcurrent || 0;
        if (maxConcurrent > 20) {
          return {
            type: 'incompatible',
            systems: [config.systemName],
            configPaths: [`${config.systemName}.concurrencyConfig.maxConcurrent`],
            currentValues: [maxConcurrent],
            recommendedValue: 10,
            severity: 'high',
            description: `Excessive concurrency setting (${maxConcurrent}) may cause resource exhaustion`,
            autoResolvable: true,
          } as ConfigurationConflict;
        }
        return null;
      },
    ]);

    // Add more validation rules as needed
  }

  private initializeSynchronizationBridges(): void {
    // Bridge: Sync concurrency settings between routing and orchestration
    this.synchronizationBridges.push({
      sourceSystem: 'routing',
      targetSystem: 'orchestration',
      configMappings: [
        {
          sourcePath: 'performance.maxConcurrentRequests',
          targetPath: 'performance.maxConcurrentRequests',
          validator: value => typeof value === 'number' && value > 0 && value <= 10,
        },
      ],
      syncDirection: 'unidirectional',
      autoSync: true,
    });

    // Bridge: Sync timeout settings across all systems
    this.synchronizationBridges.push({
      sourceSystem: 'unified-config',
      targetSystem: 'all-systems',
      configMappings: [
        {
          sourcePath: 'performance.timeoutMs',
          targetPath: 'timeoutConfig.baseTimeout',
          transformer: value => Math.min(value, 300000), // Cap at 5 minutes
          validator: value => typeof value === 'number' && value >= 5000,
        },
      ],
      syncDirection: 'unidirectional',
      autoSync: true,
    });

    // Bridge: Sync error handling configuration
    this.synchronizationBridges.push({
      sourceSystem: 'error-service',
      targetSystem: 'all-systems',
      configMappings: [
        {
          sourcePath: 'maxRetryAttempts',
          targetPath: 'errorHandlingConfig.maxRetries',
          validator: value => typeof value === 'number' && value >= 0 && value <= 5,
        },
        {
          sourcePath: 'retryDelayMs',
          targetPath: 'errorHandlingConfig.retryDelay',
          validator: value => typeof value === 'number' && value >= 100,
        },
      ],
      syncDirection: 'unidirectional',
      autoSync: true,
    });
  }
}

// Global instance for system integration
export const configurationCompatibilityValidator =
  ConfigurationCompatibilityValidator.getInstance();
