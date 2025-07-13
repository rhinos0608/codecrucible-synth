/**
 * Frontend Development Mode Detection
 * Following AI_INSTRUCTIONS.md security patterns for client-side dev mode
 * 
 * This module provides secure dev mode detection for frontend features
 * and ensures dev-only functionality is not accessible in production.
 */

interface DevModeConfig {
  isEnabled: boolean;
  reason: string;
  features: {
    showDevBadges: boolean;
    extendedLogging: boolean;
    debugPanels: boolean;
    unlimitedUIFeatures: boolean;
  };
  metadata: {
    environment: string;
    isDev: boolean;
    timestamp: string;
  };
}

/**
 * Detect if frontend development mode should be enabled
 * Based on Vite's import.meta.env.DEV and VITE_DEV_MODE
 * 
 * ⚠️ PRODUCTION DEPLOYMENT: Dev mode disabled for ProductLaunch
 * To re-enable: Set VITE_FORCE_PRODUCTION_MODE=false or remove the override
 */
function detectFrontendDevMode(): DevModeConfig {
  const isDev = import.meta.env.DEV;
  const devModeFlag = import.meta.env.VITE_DEV_MODE === 'true';
  const forceProduction = import.meta.env.VITE_FORCE_PRODUCTION_MODE !== 'false'; // Default to true for ProductLaunch
  
  // ProductLaunch override: Force production mode unless explicitly disabled
  if (forceProduction) {
    return {
      isEnabled: false,
      reason: 'forced_production_mode_for_deployment',
      features: {
        showDevBadges: false,
        extendedLogging: false,
        debugPanels: false,
        unlimitedUIFeatures: false,
      },
      metadata: {
        environment: 'production',
        isDev,
        timestamp: new Date().toISOString(),
      }
    };
  }
  
  // Default to production behavior
  let isEnabled = false;
  let reason = 'production_mode';
  
  // Check conditions for enabling dev mode (kept for future re-activation)
  if (devModeFlag) {
    isEnabled = true;
    reason = 'vite_dev_mode_flag';
  } else if (isDev) {
    isEnabled = true;
    reason = 'vite_development_mode';
  }
  
  const config: DevModeConfig = {
    isEnabled,
    reason,
    features: {
      showDevBadges: isEnabled,
      extendedLogging: isEnabled,
      debugPanels: isEnabled,
      unlimitedUIFeatures: isEnabled,
    },
    metadata: {
      environment: isEnabled ? 'development' : 'production',
      isDev,
      timestamp: new Date().toISOString(),
    }
  };
  
  // Log dev mode status in development
  if (isEnabled && console) {
    console.log('🔧 Frontend Dev Mode Enabled:', {
      reason,
      features: config.features,
      environment: config.metadata.environment
    });
  }
  
  return config;
}

// Singleton instance
let devModeConfig: DevModeConfig | null = null;

/**
 * Get the current frontend dev mode configuration
 * Cached for performance
 */
export function getFrontendDevModeConfig(): DevModeConfig {
  if (!devModeConfig) {
    devModeConfig = detectFrontendDevMode();
  }
  return devModeConfig;
}

/**
 * Check if frontend dev mode is enabled
 */
export function isFrontendDevModeEnabled(): boolean {
  return getFrontendDevModeConfig().isEnabled;
}

/**
 * Check if a specific frontend dev mode feature is enabled
 */
export function isFrontendDevModeFeatureEnabled(feature: keyof DevModeConfig['features']): boolean {
  return getFrontendDevModeConfig().features[feature];
}

/**
 * Create frontend dev mode badge component
 */
export function createDevModeBadge(): string {
  const config = getFrontendDevModeConfig();
  if (!config.isEnabled) return '';
  
  return 'DEV-GEN 🔧';
}

/**
 * Enhanced logging for development mode
 */
export function devLog(message: string, data?: any): void {
  const config = getFrontendDevModeConfig();
  
  if (config.features.extendedLogging && console) {
    console.log(`🔧 [DEV] ${message}`, data);
  }
}

/**
 * Debug information for development mode
 */
export function getDevModeDebugInfo(): Record<string, any> {
  const config = getFrontendDevModeConfig();
  
  if (!config.isEnabled) return {};
  
  return {
    devMode: config,
    environment: {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
      devModeFlag: import.meta.env.VITE_DEV_MODE,
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Conditional rendering wrapper for dev-only UI elements
 */
export function withDevMode<T>(component: T, fallback?: T): T | undefined {
  const config = getFrontendDevModeConfig();
  return config.isEnabled ? component : fallback;
}

/**
 * Validate that dev mode usage is appropriate on frontend
 */
export function validateFrontendDevModeUsage(context: string): void {
  const config = getFrontendDevModeConfig();
  
  if (config.isEnabled && import.meta.env.PROD) {
    console.warn('⚠️ Dev mode enabled in production build:', {
      context,
      reason: config.reason,
      environment: import.meta.env.MODE
    });
  }
}