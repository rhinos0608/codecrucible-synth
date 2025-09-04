/**
 * Environment Configuration Utility
 * Centralizes all environment variable access with type safety and defaults
 */

export interface EnvironmentConfig {
  // AI Provider Endpoints
  ollamaEndpoint: string;
  lmStudioEndpoint: string;

  // Model Configuration
  modelMaxTokens: number;
  modelTemperature: number;

  // Timeout Configuration (milliseconds)
  requestTimeout: number;
  ollamaTimeout: number;
  lmStudioTimeout: number;
  toolExecutionTimeout: number;
  memoryMonitoringTimeout: number;
  cacheTtl: number;

  // Server Configuration
  serverPort: number;
  internalApiPort: number;

  // Performance Configuration
  maxConcurrentRequests: number;
  responseCacheSize: number;
  memoryWarningThreshold: number;

  // Security Configuration
  strictMode: boolean;
  validateInputs: boolean;
  enableRateLimiting: boolean;

  // Development Settings
  nodeEnv: string;
  logLevel: string;
  debugMode: boolean;

  // API Keys
  smitheryApiKey?: string;
  mcpTerminalApiKey?: string;
  mcpTaskManagerApiKey?: string;
  e2bApiKey?: string;
}

/**
 * Parse environment variable as number with fallback
 */
function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Parse environment variable as boolean with fallback
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

/**
 * Get configuration from environment variables with defaults
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  return {
    // AI Provider Endpoints
    ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
    lmStudioEndpoint: process.env.LM_STUDIO_ENDPOINT || 'http://localhost:1234',

    // Model Configuration
    modelMaxTokens: parseNumber(process.env.MODEL_MAX_TOKENS, 3000),
    modelTemperature: parseNumber(process.env.MODEL_TEMPERATURE, 0.7),

    // Timeout Configuration (milliseconds)
    requestTimeout: parseNumber(process.env.REQUEST_TIMEOUT, 30000),
    ollamaTimeout: parseNumber(process.env.OLLAMA_TIMEOUT, 110000),
    lmStudioTimeout: parseNumber(process.env.LM_STUDIO_TIMEOUT, 180000),
    toolExecutionTimeout: parseNumber(process.env.TOOL_EXECUTION_TIMEOUT, 30000),
    memoryMonitoringTimeout: parseNumber(process.env.MEMORY_MONITORING_TIMEOUT, 300000),
    cacheTtl: parseNumber(process.env.CACHE_TTL, 300000),

    // Server Configuration
    serverPort: parseNumber(process.env.SERVER_PORT, 3002),
    internalApiPort: parseNumber(process.env.INTERNAL_API_PORT, 3000),

    // Performance Configuration
    maxConcurrentRequests: parseNumber(process.env.MAX_CONCURRENT_REQUESTS, 10),
    responseCacheSize: parseNumber(process.env.RESPONSE_CACHE_SIZE, 100),
    memoryWarningThreshold: parseNumber(process.env.MEMORY_WARNING_THRESHOLD, 512),

    // Security Configuration
    strictMode: parseBoolean(process.env.STRICT_MODE, true),
    validateInputs: parseBoolean(process.env.VALIDATE_INPUTS, true),
    enableRateLimiting: parseBoolean(process.env.ENABLE_RATE_LIMITING, true),

    // Development Settings
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    debugMode: parseBoolean(process.env.DEBUG_MODE, false),

    // API Keys (optional)
    smitheryApiKey: process.env.SMITHERY_API_KEY,
    mcpTerminalApiKey: process.env.MCP_TERMINAL_API_KEY,
    mcpTaskManagerApiKey: process.env.MCP_TASK_MANAGER_API_KEY,
    e2bApiKey: process.env.E2B_API_KEY,
  };
}

/**
 * Singleton instance of environment configuration
 */
let cachedConfig: EnvironmentConfig | null = null;

/**
 * Get cached environment configuration
 */
export function getConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = getEnvironmentConfig();
  }
  return cachedConfig;
}

/**
 * Reset cached configuration (useful for testing)
 */
export function resetConfig(): void {
  cachedConfig = null;
}

/**
 * Validate that required environment variables are set
 */
export function validateRequiredConfig(): { valid: boolean; missing: string[] } {
  const config = getConfig();
  const missing: string[] = [];

  // Check for critical configuration fields
  const requiredFields: (keyof EnvironmentConfig)[] = [
    'ollamaEndpoint',
    'lmStudioEndpoint',
    'requestTimeout',
  ];

  for (const field of requiredFields) {
    if (!config[field]) {
      missing.push(field);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
