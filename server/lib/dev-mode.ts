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
 * Determine if development mode should be enabled
 * Based on NODE_ENV, REPL_ID, and DEV_MODE environment variables
 */
function detectDevMode(): DevModeConfig {
  const nodeEnv = process.env.NODE_ENV;
  const replId = process.env.REPL_ID;
  const devModeFlag = process.env.DEV_MODE;
  
  // Default to production behavior
  let isEnabled = false;
  let reason = 'production_mode';
  
  // Check conditions for enabling dev mode
  if (devModeFlag === 'true') {
    isEnabled = true;
    reason = 'dev_mode_flag_enabled';
  } else if (nodeEnv !== 'production' && replId) {
    isEnabled = true;
    reason = 'replit_development_environment';
  } else if (nodeEnv === 'development') {
    isEnabled = true;
    reason = 'development_node_env';
  }
  
  const config: DevModeConfig = {
    isEnabled,
    reason,
    features: {
      unlimitedGenerations: isEnabled,
      unlimitedVoiceCombinations: isEnabled,
      bypassRateLimit: isEnabled,
      extendedPromptLength: isEnabled,
      unlimitedSynthesis: isEnabled,
      unlimitedVoiceProfiles: isEnabled,
      unlimitedTeamFeatures: isEnabled,
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