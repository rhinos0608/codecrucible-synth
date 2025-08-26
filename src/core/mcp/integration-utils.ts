/**
 * Enhanced MCP Integration Utilities
 * 
 * Utility functions and helpers for the enhanced MCP integration system
 */

import { logger } from '../logger.js';

/**
 * Validate MCP server configuration
 */
export function validateMCPServerConfig(config: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.id || typeof config.id !== 'string') {
    errors.push('Server ID is required and must be a string');
  }
  
  if (!config.name || typeof config.name !== 'string') {
    errors.push('Server name is required and must be a string');
  }
  
  if (!config.endpoint && !config.qualifiedName) {
    errors.push('Server endpoint or qualifiedName is required');
  }
  
  if (config.capabilities && !Array.isArray(config.capabilities)) {
    errors.push('Capabilities must be an array');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Format server performance metrics for display
 */
export function formatPerformanceMetrics(metrics: any): string {
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };
  
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;
  
  return [
    `Response Time: ${formatTime(metrics.avgResponseTime)}`,
    `Success Rate: ${formatPercent(metrics.successRate)}`,
    `Availability: ${formatPercent(metrics.availability)}`,
    `Error Rate: ${formatPercent(metrics.errorRate)}`,
  ].join(' | ');
}

/**
 * Calculate server health score
 */
export function calculateServerHealthScore(metrics: {
  responseTime: number;
  errorRate: number;
  availability: number;
  successRate: number;
}): number {
  // Weight factors for health score calculation
  const weights = {
    responseTime: 0.25,
    errorRate: 0.25,
    availability: 0.3,
    successRate: 0.2,
  };
  
  // Normalize metrics to 0-100 scale (higher is better)
  const normalizedResponseTime = Math.max(0, 100 - (metrics.responseTime / 100));
  const normalizedErrorRate = Math.max(0, 100 - (metrics.errorRate * 5));
  const normalizedAvailability = metrics.availability;
  const normalizedSuccessRate = metrics.successRate;
  
  const healthScore = 
    normalizedResponseTime * weights.responseTime +
    normalizedErrorRate * weights.errorRate +
    normalizedAvailability * weights.availability +
    normalizedSuccessRate * weights.successRate;
  
  return Math.round(Math.max(0, Math.min(100, healthScore)));
}

/**
 * Parse capability requirements from natural language
 */
export function parseCapabilityRequirements(description: string): string[] {
  const capabilities: string[] = [];
  const text = description.toLowerCase();
  
  // Capability mapping patterns
  const patterns = [
    { pattern: /search|find|look|query/, capability: 'web-search' },
    { pattern: /file|document|read|write/, capability: 'filesystem' },
    { pattern: /git|version|commit/, capability: 'version-control' },
    { pattern: /terminal|command|execute/, capability: 'terminal' },
    { pattern: /test|verify|validate/, capability: 'testing' },
    { pattern: /analyze|analysis|examine/, capability: 'analysis' },
    { pattern: /generate|create|build/, capability: 'generation' },
    { pattern: /translate|convert|transform/, capability: 'transformation' },
    { pattern: /monitor|track|observe/, capability: 'monitoring' },
    { pattern: /security|safe|secure/, capability: 'security' },
  ];
  
  patterns.forEach(({ pattern, capability }) => {
    if (pattern.test(text) && !capabilities.includes(capability)) {
      capabilities.push(capability);
    }
  });
  
  return capabilities.length > 0 ? capabilities : ['general'];
}

/**
 * Create connection retry configuration
 */
export function createRetryConfig(
  complexity: 'simple' | 'moderate' | 'complex' = 'moderate'
): any {
  const configs = {
    simple: {
      maxRetries: 2,
      backoffStrategy: 'linear',
      baseDelay: 1000,
      maxDelay: 5000,
      retryOn: 'timeout',
    },
    moderate: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      baseDelay: 1000,
      maxDelay: 10000,
      retryOn: 'all',
    },
    complex: {
      maxRetries: 5,
      backoffStrategy: 'adaptive',
      baseDelay: 500,
      maxDelay: 30000,
      retryOn: 'all',
    },
  };
  
  return configs[complexity];
}

/**
 * Estimate request complexity based on parameters
 */
export function estimateRequestComplexity(
  capability: string,
  parameters: any
): 'low' | 'medium' | 'high' {
  // Base complexity by capability type
  const capabilityComplexity: { [key: string]: number } = {
    'web-search': 2,
    'filesystem': 1,
    'version-control': 2,
    'terminal': 3,
    'analysis': 4,
    'generation': 5,
    'ai-processing': 5,
    'data-processing': 3,
  };
  
  let complexity = capabilityComplexity[capability] || 2;
  
  // Adjust based on parameters
  if (parameters) {
    const paramCount = Object.keys(parameters).length;
    complexity += Math.floor(paramCount / 3);
    
    // Check for complex parameter types
    Object.values(parameters).forEach((value: any) => {
      if (Array.isArray(value) && value.length > 10) complexity += 1;
      if (typeof value === 'object' && value !== null) complexity += 1;
      if (typeof value === 'string' && value.length > 1000) complexity += 1;
    });
  }
  
  if (complexity <= 2) return 'low';
  if (complexity <= 4) return 'medium';
  return 'high';
}

/**
 * Generate unique request ID
 */
export function generateRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Format duration in human-readable format
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(1)}s`;
  } else if (milliseconds < 3600000) {
    return `${(milliseconds / 60000).toFixed(1)}m`;
  } else {
    return `${(milliseconds / 3600000).toFixed(1)}h`;
  }
}

/**
 * Create performance summary
 */
export function createPerformanceSummary(metrics: any[]): any {
  if (metrics.length === 0) {
    return {
      totalRequests: 0,
      avgResponseTime: 0,
      successRate: 0,
      errorRate: 0,
      availability: 0,
    };
  }
  
  const total = metrics.length;
  const successful = metrics.filter(m => m.success || m.successRate > 50).length;
  
  return {
    totalRequests: total,
    avgResponseTime: metrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / total,
    successRate: (successful / total) * 100,
    errorRate: metrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) / total,
    availability: metrics.reduce((sum, m) => sum + (m.availability || 100), 0) / total,
    timeRange: {
      start: new Date(Math.min(...metrics.map(m => m.timestamp?.getTime() || Date.now()))),
      end: new Date(Math.max(...metrics.map(m => m.timestamp?.getTime() || Date.now()))),
    },
  };
}

/**
 * Filter servers by capability and quality criteria
 */
export function filterServersByQuality(
  servers: any[],
  criteria: {
    minReliability?: number;
    minPerformance?: number;
    requiredCapabilities?: string[];
    maxResponseTime?: number;
  }
): any[] {
  return servers.filter(server => {
    // Check reliability
    if (criteria.minReliability && server.reliability < criteria.minReliability) {
      return false;
    }
    
    // Check performance
    if (criteria.minPerformance && server.performance < criteria.minPerformance) {
      return false;
    }
    
    // Check capabilities
    if (criteria.requiredCapabilities && criteria.requiredCapabilities.length > 0) {
      const serverCapabilities = server.capabilities || [];
      const hasAllCapabilities = criteria.requiredCapabilities.every(cap =>
        serverCapabilities.some((serverCap: any) => 
          typeof serverCap === 'string' ? serverCap === cap : serverCap.name === cap
        )
      );
      if (!hasAllCapabilities) {
        return false;
      }
    }
    
    // Check response time
    if (criteria.maxResponseTime && server.avgResponseTime > criteria.maxResponseTime) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort servers by priority score
 */
export function sortServersByPriority(
  servers: any[],
  weights: {
    reliability?: number;
    performance?: number;
    popularity?: number;
    responseTime?: number;
  } = {}
): any[] {
  const defaultWeights = {
    reliability: 0.4,
    performance: 0.3,
    popularity: 0.2,
    responseTime: 0.1,
  };
  
  const finalWeights = { ...defaultWeights, ...weights };
  
  return servers
    .map(server => ({
      ...server,
      priorityScore: 
        (server.reliability || 0) * finalWeights.reliability +
        (server.performance || 0) * finalWeights.performance +
        (server.popularity || 0) * finalWeights.popularity +
        Math.max(0, 100 - (server.avgResponseTime || 0) / 100) * finalWeights.responseTime,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Validate voice capability mapping
 */
export function validateVoiceCapabilityMapping(mapping: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!mapping.voiceId || typeof mapping.voiceId !== 'string') {
    errors.push('Voice ID is required and must be a string');
  }
  
  if (!mapping.voiceName || typeof mapping.voiceName !== 'string') {
    errors.push('Voice name is required and must be a string');
  }
  
  if (!Array.isArray(mapping.preferredCapabilities)) {
    errors.push('Preferred capabilities must be an array');
  }
  
  if (!Array.isArray(mapping.expertCapabilities)) {
    errors.push('Expert capabilities must be an array');
  }
  
  if (mapping.reliabilityWeight && (mapping.reliabilityWeight < 0 || mapping.reliabilityWeight > 1)) {
    errors.push('Reliability weight must be between 0 and 1');
  }
  
  if (mapping.performanceWeight && (mapping.performanceWeight < 0 || mapping.performanceWeight > 1)) {
    errors.push('Performance weight must be between 0 and 1');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create health check configuration
 */
export function createHealthCheckConfig(serverType: string): any {
  const configs: { [key: string]: any } = {
    'web-service': {
      interval: 30000,
      timeout: 5000,
      retries: 3,
      healthPath: '/health',
    },
    'mcp-server': {
      interval: 60000,
      timeout: 10000,
      retries: 2,
      checkMethod: 'list-tools',
    },
    'database': {
      interval: 120000,
      timeout: 15000,
      retries: 1,
      checkMethod: 'ping',
    },
    'default': {
      interval: 60000,
      timeout: 10000,
      retries: 2,
      checkMethod: 'basic',
    },
  };
  
  return configs[serverType] || configs.default;
}

/**
 * Log performance metrics in structured format
 */
export function logPerformanceMetrics(
  operation: string,
  metrics: any,
  context?: any
): void {
  logger.info(`Performance metrics for ${operation}`, {
    operation,
    responseTime: metrics.responseTime,
    success: metrics.success,
    errorRate: metrics.errorRate,
    serverId: context?.serverId,
    voiceId: context?.voiceId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create error context for debugging
 */
export function createErrorContext(
  operation: string,
  error: Error,
  context?: any
): any {
  return {
    operation,
    errorMessage: error.message,
    errorStack: error.stack,
    timestamp: new Date().toISOString(),
    context: context || {},
    nodeVersion: process.version,
    platform: process.platform,
  };
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'key', 'auth'];
  const sanitized = { ...data };
  
  const sanitizeObject = (obj: any): any => {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const result: any = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        result[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        result[key] = sanitizeObject(obj[key]);
      } else {
        result[key] = obj[key];
      }
    }
    
    return result;
  };
  
  return sanitizeObject(sanitized);
}

/**
 * Default export of all utilities
 */
export default {
  validateMCPServerConfig,
  formatPerformanceMetrics,
  calculateServerHealthScore,
  parseCapabilityRequirements,
  createRetryConfig,
  estimateRequestComplexity,
  generateRequestId,
  formatDuration,
  createPerformanceSummary,
  filterServersByQuality,
  sortServersByPriority,
  validateVoiceCapabilityMapping,
  createHealthCheckConfig,
  logPerformanceMetrics,
  createErrorContext,
  sanitizeLogData,
};