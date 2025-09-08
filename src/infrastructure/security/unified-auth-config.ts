/**
 * Unified Authentication Configuration Manager
 * Consolidates all authentication settings from security policies
 * Replaces scattered authentication configuration across multiple files
 */

import { SecurityPolicyLoader } from './security-policy-loader.js';
import { logger } from '../logging/logger.js';
import crypto from 'crypto';
import yaml from 'js-yaml';

export interface UnifiedAuthConfig {
  // JWT Configuration
  jwt: {
    secret: string;
    expiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
    audience: string;
  };

  // Session Management
  session: {
    timeout: number;
    maxConcurrentSessions: number;
    persistentStorage: boolean;
    autoRefresh: boolean;
  };

  // Password Policy
  password: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
    maxAge: number;
  };

  // Multi-Factor Authentication
  mfa: {
    required: boolean;
    methods: string[];
    backupCodes: boolean;
    gracePeriod: number;
  };

  // Rate Limiting
  rateLimiting: {
    maxAttempts: number;
    windowMinutes: number;
    blockDurationMinutes: number;
    progressiveDelay: boolean;
  };

  // Service-Specific Settings
  services: {
    e2b: {
      requireAuth: boolean;
      sessionTimeout: number;
      maxExecutions: number;
    };
    api: {
      requireHttps: boolean;
      allowCors: boolean;
      bearerTokenRequired: boolean;
    };
    cli: {
      requireAuth: boolean;
      localTokenStorage: boolean;
      deviceTrust: boolean;
    };
    mcp: {
      requireAuth: boolean;
      validateConnections: boolean;
    };
  };
}

export class UnifiedAuthConfigManager {
  private static instance: UnifiedAuthConfigManager;
  private static config: UnifiedAuthConfig | null = null;
  private static lastLoadTime: number = 0;
  private static readonly CACHE_TTL = 300000; // 5 minutes

  private readonly policyLoader: SecurityPolicyLoader;

  private constructor() {
    this.policyLoader = SecurityPolicyLoader.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): UnifiedAuthConfigManager {
    if (UnifiedAuthConfigManager.instance === undefined) {
      UnifiedAuthConfigManager.instance = new UnifiedAuthConfigManager();
    }
    return UnifiedAuthConfigManager.instance;
  }

  /**
   * Load unified authentication configuration
   */
  public async loadConfig(environment: string = 'production'): Promise<UnifiedAuthConfig> {
    const now = Date.now();

    // Return cached config if still valid
    if (
      UnifiedAuthConfigManager.config &&
      now - UnifiedAuthConfigManager.lastLoadTime < UnifiedAuthConfigManager.CACHE_TTL
    ) {
      return UnifiedAuthConfigManager.config;
    }

    try {
      // Load base security policies
      const policies = await this.policyLoader.loadPolicies(environment);

      // Build unified configuration
      UnifiedAuthConfigManager.config = {
        jwt: {
          secret: process.env.JWT_SECRET ?? this.generateSecretKey(),
          expiresIn: policies.authentication.api.jwtExpiresIn,
          refreshExpiresIn: policies.authentication.api.refreshTokenExpiresIn,
          issuer: 'codecrucible-synth',
          audience: 'codecrucible-users',
        },

        session: {
          timeout: policies.authentication.e2b.sessionTimeout,
          maxConcurrentSessions: policies.authentication.api.maxConcurrentSessions,
          persistentStorage: policies.authentication.cli.sessionPersistence,
          autoRefresh: policies.authentication.cli.autoRefresh,
        },

        password: {
          minLength: 12,
          requireUppercase: true,
          requireLowercase: true,
          requireNumbers: true,
          requireSymbols: true,
          preventReuse: 5,
          maxAge: 90,
        },

        mfa: {
          required: policies.authentication.e2b.requireMFA,
          methods: ['totp', 'sms'],
          backupCodes: true,
          gracePeriod: 7, // days
        },

        rateLimiting: {
          maxAttempts: policies.rateLimiting.authentication.maxAttempts,
          windowMinutes: policies.rateLimiting.authentication.windowMinutes,
          blockDurationMinutes: policies.rateLimiting.authentication.blockDurationMinutes,
          progressiveDelay: true,
        },

        services: {
          e2b: {
            requireAuth: policies.authentication.e2b.requireAuthentication,
            sessionTimeout: policies.authentication.e2b.sessionTimeout,
            maxExecutions: policies.authentication.e2b.maxExecutionsPerSession,
          },
          api: {
            requireHttps: policies.authentication.api.requireHttps,
            allowCors: policies.authentication.api.allowCors,
            bearerTokenRequired: true,
          },
          cli: {
            requireAuth: policies.authentication.cli.requireAuth,
            localTokenStorage: policies.authentication.cli.localTokenStorage,
            deviceTrust: policies.authentication.cli.deviceTrust,
          },
          mcp: {
            requireAuth: policies.executionSecurity.mcp.requireAuthentication,
            validateConnections: policies.executionSecurity.mcp.validateConnections,
          },
        },
      };

      UnifiedAuthConfigManager.lastLoadTime = now;
      logger.info(`🔒 Unified authentication configuration loaded for environment: ${environment}`);

      return UnifiedAuthConfigManager.config;
    } catch (error) {
      logger.error(`❌ Failed to load unified auth config: ${(error as Error).message}`);
      return this.getFallbackConfig();
    }
  }

  /**
   * Get JWT configuration
   */
  public async getJwtConfig(): Promise<UnifiedAuthConfig['jwt']> {
    const config = await this.loadConfig();
    return config.jwt;
  }

  /**
   * Get session configuration
   */
  public async getSessionConfig(): Promise<UnifiedAuthConfig['session']> {
    const config = await this.loadConfig();
    return config.session;
  }

  /**
   * Get password policy
   */
  public async getPasswordPolicy(): Promise<UnifiedAuthConfig['password']> {
    const config = await this.loadConfig();
    return config.password;
  }

  /**
   * Get MFA configuration
   */
  public async getMfaConfig(): Promise<UnifiedAuthConfig['mfa']> {
    const config = await this.loadConfig();
    return config.mfa;
  }

  /**
   * Get rate limiting configuration
   */
  public async getRateLimitConfig(): Promise<UnifiedAuthConfig['rateLimiting']> {
    const config = await this.loadConfig();
    return config.rateLimiting;
  }

  /**
   * Get service-specific authentication settings
   */
  public async getServiceConfig(
    service: keyof UnifiedAuthConfig['services']
  ): Promise<
    UnifiedAuthConfig['services']['e2b'] |
    UnifiedAuthConfig['services']['api'] |
    UnifiedAuthConfig['services']['cli'] |
    UnifiedAuthConfig['services']['mcp']
  > {
    const config = await this.loadConfig();
    return config.services[service];
  }

  /**
   * Check if authentication is required for a specific service
   */
  public async isAuthRequired(service: keyof UnifiedAuthConfig['services']): Promise<boolean> {
    const serviceConfig = await this.getServiceConfig(service);

    // Type guard for requireAuth/requireAuthentication
    if ('requireAuth' in serviceConfig && typeof serviceConfig.requireAuth === 'boolean') {
      return serviceConfig.requireAuth;
    }
    if (
      'requireAuthentication' in serviceConfig &&
      typeof (serviceConfig as Record<string, unknown>).requireAuthentication === 'boolean'
    ) {
      return (serviceConfig as { requireAuthentication: boolean }).requireAuthentication;
    }
    return false;
  }

  /**
   * Get environment-specific overrides
   */
  public async getConfigForEnvironment(environment: string): Promise<UnifiedAuthConfig> {
    return this.loadConfig(environment);
  }

  /**
   * Force reload configuration (for testing or manual refresh)
   */
  public async forceReload(environment: string = 'production'): Promise<UnifiedAuthConfig> {
    UnifiedAuthConfigManager.config = null;
    UnifiedAuthConfigManager.lastLoadTime = 0;
    return this.loadConfig(environment);
  }

  /**
   * Validate current authentication configuration
   */
  public async validateConfig(): Promise<{ isValid: boolean; issues: string[] }> {
    const config = await this.loadConfig();
    const issues: string[] = [];

    // Validate JWT configuration
    if (!config.jwt.secret || config.jwt.secret.length < 32) {
      issues.push('JWT secret is too short (minimum 32 characters)');
    }

    // Validate password policy
    if (config.password.minLength < 8) {
      issues.push('Password minimum length is too short');
    }

    // Validate rate limiting
    if (config.rateLimiting.maxAttempts < 3) {
      issues.push('Rate limiting is too restrictive');
    }

    // Validate service configurations
    if (!config.services.e2b.requireAuth) {
      issues.push('E2B authentication is disabled (security risk)');
    }

    return {
      isValid: issues.length === 0,
      issues,
    };
  }
  /**
   * Generate a secure secret key if none provided
   */
  private generateSecretKey(): string {
    const key: string = crypto.randomBytes(64).toString('hex');
    logger.warn(
      '🔑 Generated new JWT secret key. Consider setting JWT_SECRET environment variable.'
    );
    return key;
  }
  /**
   * Get fallback configuration if loading fails
   */
  private getFallbackConfig(): UnifiedAuthConfig {
    logger.warn('🔒 Using fallback authentication configuration');

    return {
      jwt: {
        secret: this.generateSecretKey(),
        expiresIn: '1h',
        refreshExpiresIn: '7d',
        issuer: 'codecrucible-synth',
        audience: 'codecrucible-users',
      },
      session: {
        timeout: 3600,
        maxConcurrentSessions: 5,
        persistentStorage: true,
        autoRefresh: true,
      },
      password: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 5,
        maxAge: 90,
      },
      mfa: {
        required: false,
        methods: ['totp'],
        backupCodes: true,
        gracePeriod: 7,
      },
      rateLimiting: {
        maxAttempts: 5,
        windowMinutes: 15,
        blockDurationMinutes: 30,
        progressiveDelay: true,
      },
      services: {
        e2b: {
          requireAuth: true,
          sessionTimeout: 3600,
          maxExecutions: 100,
        },
        api: {
          requireHttps: true,
          allowCors: false,
          bearerTokenRequired: true,
        },
        cli: {
          requireAuth: true,
          localTokenStorage: true,
          deviceTrust: false,
        },
        mcp: {
          requireAuth: true,
          validateConnections: true,
        },
      },
    };
  }
  /**
   * Export configuration for external systems
   */
  public async exportConfig(format: 'json' | 'yaml' = 'json'): Promise<string> {
    const config = await this.loadConfig();

    if (format === 'yaml') {
      return yaml.dump(config, { indent: 2 });
    }

    return JSON.stringify(config, null, 2);
  }
}
