export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    banDuration: number;
  };
  inputValidation: {
    enabled: boolean;
    maxInputSize: number;
    sanitizeInputs: boolean;
    blockSuspiciousPatterns: boolean;
  };
  auditLogging: {
    enabled: boolean;
    auditAllOperations: boolean;
    sensitiveDataRedaction: boolean;
    logRetentionDays: number;
  };
}

export interface ProductionHardeningConfig {
  security: SecurityConfig;
}

export interface ProductionStats {
  uptime: number;
  totalOperations: number;
  successRate: number;
  averageResponseTime: number;
  resourceUsage: {
    memory: {
      current: number;
      peak: number;
      utilizationPercent: number;
    };
  };
}
