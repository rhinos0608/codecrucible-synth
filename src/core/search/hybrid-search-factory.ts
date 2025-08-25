/**
 * Hybrid Search Factory for CodeCrucible Synth
 * Provides convenience methods for setting up hybrid search configurations
 */

import { HybridSearchConfig } from './hybrid-search-coordinator.js';

/**
 * Pre-configured hybrid search configurations for different use cases
 */
export class HybridSearchFactory {
  /**
   * Performance-optimized configuration for fast searches
   */
  static createPerformanceConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.8,
        semanticSimilarityThreshold: 0.5,
        performanceTimeoutMs: 1000, // Faster timeout
        memoryPressureThreshold: 0.7, // Switch to ripgrep earlier
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: true,
        enableFallbackMechanism: true,
        enableResultFusion: false, // Disabled for speed
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: false, // Reduced logging
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Accuracy-optimized configuration for comprehensive searches
   */
  static createAccuracyConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.9, // Higher threshold for exact matches
        semanticSimilarityThreshold: 0.7, // Higher threshold for semantic
        performanceTimeoutMs: 5000, // Longer timeout
        memoryPressureThreshold: 0.9, // Use more memory for accuracy
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: false,
        enableFallbackMechanism: true,
        enableResultFusion: true, // Enable result fusion
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: true,
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Balanced configuration for general use
   */
  static createBalancedConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.7,
        semanticSimilarityThreshold: 0.6,
        performanceTimeoutMs: 2000,
        memoryPressureThreshold: 0.8,
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: true,
        enableFallbackMechanism: true,
        enableResultFusion: true,
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: false,
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Development configuration with extensive logging and monitoring
   */
  static createDevelopmentConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.6,
        semanticSimilarityThreshold: 0.5,
        performanceTimeoutMs: 3000,
        memoryPressureThreshold: 0.8,
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: true,
        enableFallbackMechanism: true,
        enableResultFusion: true,
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: true, // Enable detailed logging
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Conservative configuration that prefers RAG over ripgrep
   */
  static createConservativeConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.9, // Very high threshold for ripgrep
        semanticSimilarityThreshold: 0.4, // Lower threshold for RAG
        performanceTimeoutMs: 4000,
        memoryPressureThreshold: 0.9,
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: false,
        enableFallbackMechanism: true,
        enableResultFusion: false,
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: true,
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Aggressive configuration that prefers ripgrep over RAG
   */
  static createAggressiveConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 0.5, // Lower threshold for ripgrep
        semanticSimilarityThreshold: 0.8, // Higher threshold for RAG
        performanceTimeoutMs: 1500,
        memoryPressureThreshold: 0.6,
      },
      featureFlags: {
        enableHybridRouting: true,
        enablePerformanceOptimization: true,
        enableFallbackMechanism: true,
        enableResultFusion: false, // Prefer speed over fusion
      },
      monitoring: {
        enableMetrics: true,
        logRoutingDecisions: false,
        benchmarkComparisons: true,
      },
    };
  }

  /**
   * Minimal configuration with hybrid routing disabled (RAG only)
   */
  static createRAGOnlyConfig(): HybridSearchConfig {
    return {
      routing: {
        exactPatternThreshold: 1.0, // Never use ripgrep
        semanticSimilarityThreshold: 0.0, // Always use RAG
        performanceTimeoutMs: 5000,
        memoryPressureThreshold: 1.0,
      },
      featureFlags: {
        enableHybridRouting: false, // Disable hybrid routing
        enablePerformanceOptimization: false,
        enableFallbackMechanism: false,
        enableResultFusion: false,
      },
      monitoring: {
        enableMetrics: false,
        logRoutingDecisions: false,
        benchmarkComparisons: false,
      },
    };
  }

  /**
   * Create a custom configuration based on user preferences
   */
  static createCustomConfig(options: {
    preferSpeed?: boolean;
    preferAccuracy?: boolean;
    enableLogging?: boolean;
    aggressiveRipgrep?: boolean;
    conservativeRAG?: boolean;
  }): HybridSearchConfig {
    const base = this.createBalancedConfig();

    if (options.preferSpeed) {
      base.routing.performanceTimeoutMs = 1000;
      base.featureFlags.enableResultFusion = false;
      base.monitoring.logRoutingDecisions = false;
    }

    if (options.preferAccuracy) {
      base.routing.performanceTimeoutMs = 5000;
      base.featureFlags.enableResultFusion = true;
      base.routing.exactPatternThreshold = 0.9;
    }

    if (options.enableLogging) {
      base.monitoring.logRoutingDecisions = true;
      base.monitoring.enableMetrics = true;
    }

    if (options.aggressiveRipgrep) {
      base.routing.exactPatternThreshold = 0.4;
      base.routing.memoryPressureThreshold = 0.6;
    }

    if (options.conservativeRAG) {
      base.routing.exactPatternThreshold = 0.9;
      base.routing.semanticSimilarityThreshold = 0.3;
    }

    return base;
  }

  /**
   * Get recommended configuration based on project characteristics
   */
  static getRecommendedConfig(projectInfo: {
    codebaseSize: 'small' | 'medium' | 'large';
    searchFrequency: 'low' | 'medium' | 'high';
    accuracyRequirement: 'basic' | 'standard' | 'high';
    performanceRequirement: 'standard' | 'fast' | 'critical';
  }): HybridSearchConfig {
    // Large codebases benefit from aggressive ripgrep usage
    if (projectInfo.codebaseSize === 'large') {
      return projectInfo.performanceRequirement === 'critical'
        ? this.createAggressiveConfig()
        : this.createPerformanceConfig();
    }

    // High accuracy requirements need result fusion
    if (projectInfo.accuracyRequirement === 'high') {
      return this.createAccuracyConfig();
    }

    // High search frequency benefits from performance optimization
    if (
      projectInfo.searchFrequency === 'high' &&
      projectInfo.performanceRequirement !== 'standard'
    ) {
      return this.createPerformanceConfig();
    }

    // Default to balanced configuration
    return this.createBalancedConfig();
  }
}

/**
 * Configuration validation utilities
 */
export class HybridConfigValidator {
  static validateConfig(config: HybridSearchConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate routing thresholds
    if (config.routing.exactPatternThreshold < 0 || config.routing.exactPatternThreshold > 1) {
      errors.push('exactPatternThreshold must be between 0 and 1');
    }

    if (
      config.routing.semanticSimilarityThreshold < 0 ||
      config.routing.semanticSimilarityThreshold > 1
    ) {
      errors.push('semanticSimilarityThreshold must be between 0 and 1');
    }

    if (config.routing.memoryPressureThreshold < 0 || config.routing.memoryPressureThreshold > 1) {
      errors.push('memoryPressureThreshold must be between 0 and 1');
    }

    if (config.routing.performanceTimeoutMs < 100 || config.routing.performanceTimeoutMs > 30000) {
      errors.push('performanceTimeoutMs should be between 100ms and 30000ms');
    }

    // Validate logical consistency
    if (config.featureFlags.enableResultFusion && !config.featureFlags.enableHybridRouting) {
      errors.push('Result fusion requires hybrid routing to be enabled');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  static suggestOptimizations(config: HybridSearchConfig): string[] {
    const suggestions: string[] = [];

    // Performance suggestions
    if (
      config.routing.performanceTimeoutMs > 3000 &&
      config.featureFlags.enablePerformanceOptimization
    ) {
      suggestions.push('Consider reducing performanceTimeoutMs for better responsiveness');
    }

    if (
      config.featureFlags.enableResultFusion &&
      config.featureFlags.enablePerformanceOptimization
    ) {
      suggestions.push(
        'Result fusion may conflict with performance optimization - consider disabling one'
      );
    }

    if (config.monitoring.logRoutingDecisions && !config.monitoring.enableMetrics) {
      suggestions.push('Enable metrics collection to get more value from routing decision logs');
    }

    // Resource usage suggestions
    if (config.routing.memoryPressureThreshold < 0.5) {
      suggestions.push(
        'Very low memory pressure threshold may cause frequent switching to ripgrep'
      );
    }

    if (
      config.routing.exactPatternThreshold > 0.9 &&
      config.routing.semanticSimilarityThreshold < 0.3
    ) {
      suggestions.push(
        'Configuration heavily favors RAG - consider balancing for better performance'
      );
    }

    return suggestions;
  }
}
