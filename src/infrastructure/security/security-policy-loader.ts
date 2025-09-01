/**
 * Security Policy Loader - Centralized security configuration management
 * Loads and manages security policies from external configuration files
 */

import * as fs from 'fs/promises';
import * as yaml from 'js-yaml';
import * as path from 'path';
import { logger } from '../logging/logger.js';

export interface DangerousPattern {
  pattern: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  action: 'warn' | 'block' | 'sanitize' | 'redact';
  flags?: string;
}

export interface SecurityPolicies {
  inputValidation: {
    dangerousPatterns: DangerousPattern[];
    allowedCommands: string[];
    sanitizationRules: {
      maxInputLength: number;
      allowSpecialChars: boolean;
      stripHtml: boolean;
      normalizeWhitespace: boolean;
      removeControlChars: boolean;
      safeCharacterPattern: string;
    };
  };
  authentication: {
    e2b: {
      requireAuthentication: boolean;
      sessionTimeout: number;
      requireMFA: boolean;
      allowAnonymousRead: boolean;
      maxExecutionsPerSession: number;
    };
    api: {
      jwtExpiresIn: string;
      refreshTokenExpiresIn: string;
      maxConcurrentSessions: number;
      requireHttps: boolean;
      allowCors: boolean;
      rateLimitRequests: number;
      rateLimitWindowMs: number;
    };
    cli: {
      requireAuth: boolean;
      sessionPersistence: boolean;
      autoRefresh: boolean;
      deviceTrust: boolean;
      localTokenStorage: boolean;
      sessionTimeoutMinutes: number;
    };
  };
  executionSecurity: {
    e2b: {
      sandboxMode: string;
      networkAccess: boolean;
      fileSystemWrite: boolean;
      processSpawning: boolean;
      maxMemoryMB: number;
      maxCpuPercent: number;
      executionTimeoutSeconds: number;
      allowedLanguages: string[];
    };
    mcp: {
      validateConnections: boolean;
      requireAuthentication: boolean;
      auditAllCalls: boolean;
      maxConnectionsPerClient: number;
      connectionTimeoutSeconds: number;
      allowedServers: string[];
      blockedServers: string[];
    };
  };
  rateLimiting: {
    authentication: {
      maxAttempts: number;
      windowMinutes: number;
      blockDurationMinutes: number;
    };
    api: {
      requestsPerMinute: number;
      burstAllowance: number;
      globalLimit: number;
      perUserLimit: number;
    };
  };
}

export class SecurityPolicyLoader {
  private static instance: SecurityPolicyLoader;
  private static policies: SecurityPolicies | null = null;
  private static lastLoadTime: number = 0;
  private static readonly CACHE_TTL = 300000; // 5 minutes

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SecurityPolicyLoader {
    if (!SecurityPolicyLoader.instance) {
      SecurityPolicyLoader.instance = new SecurityPolicyLoader();
    }
    return SecurityPolicyLoader.instance;
  }

  /**
   * Load security policies from configuration file
   */
  async loadPolicies(environment: string = 'production'): Promise<SecurityPolicies> {
    const now = Date.now();

    // Return cached policies if still valid
    if (
      SecurityPolicyLoader.policies &&
      now - SecurityPolicyLoader.lastLoadTime < SecurityPolicyLoader.CACHE_TTL
    ) {
      return SecurityPolicyLoader.policies;
    }

    try {
      const configPath = path.join(process.cwd(), 'config', 'security-policies.yaml');
      const fileContent = await fs.readFile(configPath, 'utf-8');
      const config = yaml.load(fileContent) as any;

      // Apply environment-specific overrides
      const basePolicies = {
        inputValidation: config.inputValidation,
        authentication: config.authentication,
        executionSecurity: config.executionSecurity,
        rateLimiting: config.rateLimiting,
      };

      // Apply environment overrides if they exist
      if (config.environments?.[environment]) {
        const envOverrides = config.environments[environment];
        SecurityPolicyLoader.policies = this.mergeDeep(basePolicies, envOverrides);
      } else {
        SecurityPolicyLoader.policies = basePolicies;
      }

      SecurityPolicyLoader.lastLoadTime = now;
      logger.info(`🔒 Security policies loaded for environment: ${environment}`);

      return SecurityPolicyLoader.policies;
    } catch (error) {
      logger.error(`❌ Failed to load security policies: ${error}`);

      // Return fallback policies
      return this.getFallbackPolicies();
    }
  }

  /**
   * Get compiled dangerous patterns as RegExp objects
   */
  async getDangerousPatterns(): Promise<RegExp[]> {
    const policies = await this.loadPolicies();

    return policies.inputValidation.dangerousPatterns.map(pattern => {
      try {
        return new RegExp(pattern.pattern, pattern.flags || 'g');
      } catch (error) {
        logger.warn(`⚠️ Invalid security pattern: ${pattern.pattern} - ${error}`);
        return new RegExp('__INVALID_PATTERN__', 'g'); // Safe fallback
      }
    });
  }

  /**
   * Get allowed commands set
   */
  async getAllowedCommands(): Promise<Set<string>> {
    const policies = await this.loadPolicies();
    return new Set(policies.inputValidation.allowedCommands);
  }

  /**
   * Get authentication configuration
   */
  async getAuthConfig(): Promise<SecurityPolicies['authentication']> {
    const policies = await this.loadPolicies();
    return policies.authentication;
  }

  /**
   * Get execution security configuration
   */
  async getExecutionConfig(): Promise<SecurityPolicies['executionSecurity']> {
    const policies = await this.loadPolicies();
    return policies.executionSecurity;
  }

  /**
   * Deep merge objects (for environment overrides)
   */
  private mergeDeep(target: any, source: any): any {
    const output = Object.assign({}, target);

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.mergeDeep(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * Check if value is an object
   */
  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }

  /**
   * Get fallback security policies if file loading fails
   */
  private getFallbackPolicies(): SecurityPolicies {
    logger.warn('🔒 Using fallback security policies - configuration file not available');

    return {
      inputValidation: {
        dangerousPatterns: [
          {
            pattern: '[;&|`$(){}[\\]\\\\]',
            description: 'Shell metacharacters',
            riskLevel: 'high',
            action: 'block',
          },
          {
            pattern: '\\.\\.',
            description: 'Directory traversal',
            riskLevel: 'high',
            action: 'block',
          },
        ],
        allowedCommands: ['/help', '/status', '/models'],
        sanitizationRules: {
          maxInputLength: 10000,
          allowSpecialChars: false,
          stripHtml: true,
          normalizeWhitespace: true,
          removeControlChars: true,
          safeCharacterPattern: '^[a-zA-Z0-9\\s\\-_.,!?\'\"@#%^&*()+=:;/\\\\]+$',
        },
      },
      authentication: {
        e2b: {
          requireAuthentication: true,
          sessionTimeout: 3600,
          requireMFA: false,
          allowAnonymousRead: false,
          maxExecutionsPerSession: 100,
        },
        api: {
          jwtExpiresIn: '1h',
          refreshTokenExpiresIn: '7d',
          maxConcurrentSessions: 5,
          requireHttps: true,
          allowCors: false,
          rateLimitRequests: 1000,
          rateLimitWindowMs: 900000,
        },
        cli: {
          requireAuth: true,
          sessionPersistence: true,
          autoRefresh: true,
          deviceTrust: false,
          localTokenStorage: true,
          sessionTimeoutMinutes: 480,
        },
      },
      executionSecurity: {
        e2b: {
          sandboxMode: 'strict',
          networkAccess: false,
          fileSystemWrite: true,
          processSpawning: false,
          maxMemoryMB: 512,
          maxCpuPercent: 50,
          executionTimeoutSeconds: 300,
          allowedLanguages: ['python', 'javascript', 'bash'],
        },
        mcp: {
          validateConnections: true,
          requireAuthentication: true,
          auditAllCalls: true,
          maxConnectionsPerClient: 10,
          connectionTimeoutSeconds: 30,
          allowedServers: [],
          blockedServers: [],
        },
      },
      rateLimiting: {
        authentication: {
          maxAttempts: 5,
          windowMinutes: 15,
          blockDurationMinutes: 30,
        },
        api: {
          requestsPerMinute: 60,
          burstAllowance: 20,
          globalLimit: 10000,
          perUserLimit: 1000,
        },
      },
    };
  }

  /**
   * Force reload policies (for testing or manual refresh)
   */
  async forceReload(environment: string = 'production'): Promise<SecurityPolicies> {
    SecurityPolicyLoader.policies = null;
    SecurityPolicyLoader.lastLoadTime = 0;
    return this.loadPolicies(environment);
  }

  /**
   * Validate a dangerous pattern for security
   */
  async validatePattern(
    input: string,
    patterns?: DangerousPattern[]
  ): Promise<{
    isValid: boolean;
    violations: string[];
    riskLevel: string;
  }> {
    const policies = await this.loadPolicies();
    const patternsToCheck = patterns || policies.inputValidation.dangerousPatterns;
    const violations: string[] = [];
    let highestRiskLevel = 'low';

    for (const patternConfig of patternsToCheck) {
      try {
        const regex = new RegExp(patternConfig.pattern, patternConfig.flags || 'gi');
        if (regex.test(input)) {
          violations.push(patternConfig.description);

          // Track highest risk level
          const riskLevels = ['low', 'medium', 'high', 'critical'];
          if (riskLevels.indexOf(patternConfig.riskLevel) > riskLevels.indexOf(highestRiskLevel)) {
            highestRiskLevel = patternConfig.riskLevel;
          }
        }
      } catch (error) {
        logger.warn(`⚠️ Error validating pattern ${patternConfig.pattern}: ${error}`);
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      riskLevel: highestRiskLevel,
    };
  }
}
