/**
 * Development Mode Configuration
 * Following AI_INSTRUCTIONS.md security patterns for environment detection
 * 
 * This module provides secure dev mode detection and configuration
 * that enables unlimited AI generations for development and testing.
 */

import { logger } from '../logger';

interface DevModeConfig {
  isEnabled: boolean;
  reason: string;
  features: {
    unlimitedGenerations: boolean;
    unlimitedVoiceCombinations: boolean;
    bypassRateLimit: boolean;
    extendedPromptLength: boolean;
    unlimitedSynthesis: boolean;
  };
  metadata: {
    environment: string;
    replId?: string;
    nodeEnv?: string;
    timestamp: string;
  };
}

/**
 * PRODUCTION DEPLOYMENT: Development mode COMPLETELY DISABLED
 * Following AI_INSTRUCTIONS.md security patterns for paywall enforcement
 * 
 * All dev mode functionality has been permanently disabled to ensure:
 * - Proper subscription tier enforcement
 * - Rate limiting compliance  
 * - Feature access control
 * - Stripe paywall integration
 */
function detectDevMode(): DevModeConfig {
  // CRITICAL SECURITY: Development mode is PERMANENTLY DISABLED
  // This ensures all paywall restrictions are enforced
  return {
    isEnabled: false,
    reason: 'production_mode_enforced_paywall_active',
    features: {
      unlimitedGenerations: false,
      unlimitedVoiceCombinations: false,
      bypassRateLimit: false,
      extendedPromptLength: false,
      unlimitedSynthesis: false,
    },
    metadata: {
      environment: 'production',
      replId: process.env.REPL_ID || undefined,
      nodeEnv: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString(),
    }
  };
  
  const config: DevModeConfig = {
    isEnabled,
    reason,
    features: {
      unlimitedGenerations: isEnabled,
      unlimitedVoiceCombinations: isEnabled,
      bypassRateLimit: isEnabled,
      extendedPromptLength: isEnabled,
      unlimitedSynthesis: isEnabled,
    },
    metadata: {
      environment: isEnabled ? 'development' : 'production',
      replId: replId || undefined,
      nodeEnv: nodeEnv || undefined,
      timestamp: new Date().toISOString(),
    }
  };
  
  // Log dev mode status for security audit
  if (isEnabled) {
    logger.info('Development mode enabled', {
      reason,
      features: config.features,
      replId: replId?.substring(0, 8) + '...' || 'none',
      nodeEnv: nodeEnv || 'undefined'
    });
  }
  
  return config;
}

// Singleton instance
let devModeConfig: DevModeConfig | null = null;

/**
 * Get the current dev mode configuration
 * Cached for performance, recalculated on server restart
 */
export function getDevModeConfig(): DevModeConfig {
  if (!devModeConfig) {
    devModeConfig = detectDevMode();
  }
  return devModeConfig;
}

/**
 * Check if dev mode is enabled
 */
export function isDevModeEnabled(): boolean {
  return getDevModeConfig().isEnabled;
}

/**
 * Check if a specific dev mode feature is enabled
 */
export function isDevModeFeatureEnabled(feature: keyof DevModeConfig['features']): boolean {
  return getDevModeConfig().features[feature];
}

/**
 * Get dev mode metadata for session tracking
 */
export function getDevModeMetadata(): DevModeConfig['metadata'] {
  return getDevModeConfig().metadata;
}

/**
 * Create dev mode watermark for generated content
 */
export function createDevModeWatermark(): string {
  const config = getDevModeConfig();
  if (!config.isEnabled) return '';
  
  return 'DEV-GEN 🔧';
}

/**
 * Validate that dev mode usage is appropriate
 * Prevents accidental production exposure
 */
export function validateDevModeUsage(context: string): void {
  const config = getDevModeConfig();
  
  if (config.isEnabled && process.env.NODE_ENV === 'production') {
    logger.warn('Dev mode enabled in production environment', {
      context,
      reason: config.reason,
      environment: process.env.NODE_ENV,
      replId: process.env.REPL_ID?.substring(0, 8) + '...' || 'none'
    });
  }
}

/**
 * Security audit log for dev mode bypasses
 */
export function logDevModeBypass(operation: string, details: Record<string, any> = {}): void {
  const config = getDevModeConfig();
  
  if (config.isEnabled) {
    logger.info(`Dev mode bypass: ${operation}`, {
      operation,
      reason: config.reason,
      environment: config.metadata.environment,
      ...details,
      devModeWatermark: createDevModeWatermark()
    });
  }
}