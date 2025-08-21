/**
 * Authentication Middleware for CLI Security
 * Integrates enterprise authentication with CLI request processing
 */

import {
  EnterpriseAuthManager,
  AuthRequest,
  TokenValidationResult,
} from '../security/enterprise-auth-manager.js';
import { RBACSystem } from '../security/rbac-system.js';
import { SecretsManager } from '../security/secrets-manager.js';
import { logger } from '../logger.js';
import { CLIError, CLIExitCode } from '../types.js';

export interface AuthenticatedRequest {
  userId?: string;
  username?: string;
  permissions?: string[];
  sessionId?: string;
  authenticated: boolean;
  authMethod?: 'token' | 'apikey' | 'interactive' | 'none';
}

export interface AuthMiddlewareConfig {
  enabled: boolean;
  requireAuth: boolean;
  allowedUnauthenticatedCommands: string[];
  tokenHeader?: string;
  apiKeyHeader?: string;
  sessionTimeout: number;
}

export class AuthMiddleware {
  private authManager: EnterpriseAuthManager;
  private config: AuthMiddlewareConfig;
  private isInitialized = false;

  constructor(
    private rbacSystem: RBACSystem,
    private secretsManager: SecretsManager,
    config: Partial<AuthMiddlewareConfig> = {}
  ) {
    this.config = {
      enabled: process.env.NODE_ENV === 'production' || process.env.AUTH_ENABLED === 'true',
      requireAuth: process.env.REQUIRE_AUTH === 'true',
      allowedUnauthenticatedCommands: [
        'help',
        'version',
        'status',
        'login',
        'register',
        'reset-password',
      ],
      tokenHeader: 'x-auth-token',
      apiKeyHeader: 'x-api-key',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      ...config,
    };

    this.authManager = new EnterpriseAuthManager(this.rbacSystem, this.secretsManager, {
      sessionTimeout: this.config.sessionTimeout,
      requireMFA: process.env.REQUIRE_MFA === 'true',
    });
  }

  /**
   * Initialize authentication middleware
   */
  async initialize(): Promise<void> {
    try {
      if (this.config.enabled) {
        // Initialize secrets manager
        await this.secretsManager.initialize();

        // Initialize RBAC system
        await this.rbacSystem.initialize();

        // Create default admin user if none exists
        await this.ensureDefaultAdminUser();

        logger.info('Authentication middleware initialized', {
          enabled: this.config.enabled,
          requireAuth: this.config.requireAuth,
        });
      } else {
        logger.info('Authentication middleware disabled');
      }

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize authentication middleware', error as Error);
      throw error;
    }
  }

  /**
   * Authenticate CLI request
   */
  async authenticateRequest(
    command: string,
    headers?: Record<string, string>,
    ipAddress?: string,
    interactive = false
  ): Promise<AuthenticatedRequest> {
    try {
      // If auth is disabled, allow all requests
      if (!this.config.enabled) {
        return {
          authenticated: true,
          authMethod: 'none',
        };
      }

      // Check if command is allowed without authentication
      if (!this.config.requireAuth && this.isUnauthenticatedCommandAllowed(command)) {
        return {
          authenticated: true,
          authMethod: 'none',
        };
      }

      // Try token authentication first
      if (headers && headers[this.config.tokenHeader!]) {
        const tokenResult = await this.authenticateWithToken(
          headers[this.config.tokenHeader!],
          ipAddress
        );

        if (tokenResult.authenticated) {
          return tokenResult;
        }
      }

      // Try API key authentication
      if (headers && headers[this.config.apiKeyHeader!]) {
        const apiKeyResult = await this.authenticateWithAPIKey(headers[this.config.apiKeyHeader!]);

        if (apiKeyResult.authenticated) {
          return apiKeyResult;
        }
      }

      // Interactive authentication for CLI
      if (interactive) {
        const interactiveResult = await this.authenticateInteractive(ipAddress);
        if (interactiveResult.authenticated) {
          return interactiveResult;
        }
      }

      // Authentication required but not provided
      throw new CLIError(
        'Authentication required. Use --login or provide authentication headers.',
        CLIExitCode.AUTHENTICATION_REQUIRED
      );
    } catch (error) {
      if (error instanceof CLIError) {
        throw error;
      }

      logger.error('Authentication error', error as Error);
      throw new CLIError('Authentication system error', CLIExitCode.AUTHENTICATION_FAILED);
    }
  }

  /**
   * Authenticate with JWT token
   */
  private async authenticateWithToken(
    token: string,
    ipAddress?: string
  ): Promise<AuthenticatedRequest> {
    try {
      const validation = await this.authManager.validateToken(token, ipAddress);

      if (!validation.valid) {
        return {
          authenticated: false,
          authMethod: 'token',
        };
      }

      return {
        authenticated: true,
        authMethod: 'token',
        userId: validation.user?.id,
        username: validation.user?.username,
        permissions: validation.permissions,
        sessionId: validation.session?.id,
      };
    } catch (error) {
      logger.debug('Token authentication failed', { error: (error as Error).message });
      return {
        authenticated: false,
        authMethod: 'token',
      };
    }
  }

  /**
   * Authenticate with API key
   */
  private async authenticateWithAPIKey(apiKey: string): Promise<AuthenticatedRequest> {
    try {
      const validation = await this.authManager.validateAPIKey(apiKey);

      if (!validation.valid) {
        return {
          authenticated: false,
          authMethod: 'apikey',
        };
      }

      return {
        authenticated: true,
        authMethod: 'apikey',
        permissions: validation.apiKey?.permissions,
        userId: 'api-user', // API keys don't have specific users
        username: validation.apiKey?.name,
      };
    } catch (error) {
      logger.debug('API key authentication failed', { error: (error as Error).message });
      return {
        authenticated: false,
        authMethod: 'apikey',
      };
    }
  }

  /**
   * Interactive authentication for CLI
   */
  private async authenticateInteractive(ipAddress?: string): Promise<AuthenticatedRequest> {
    try {
      const inquirer = await import('inquirer');

      console.log(chalk.blue('\n🔐 Authentication Required\n'));

      const credentials = await inquirer.default.prompt([
        {
          type: 'input',
          name: 'username',
          message: 'Username:',
          validate: (input: string) => input.length > 0 || 'Username is required',
        },
        {
          type: 'password',
          name: 'password',
          message: 'Password:',
          mask: '*',
          validate: (input: string) => input.length > 0 || 'Password is required',
        },
      ]);

      const authRequest: AuthRequest = {
        username: credentials.username,
        password: credentials.password,
        ipAddress,
        userAgent: 'CodeCrucible-CLI',
      };

      const authResult = await this.authManager.authenticate(authRequest);

      if (!authResult.success) {
        console.log(chalk.red(`\n❌ Authentication failed: ${authResult.error}\n`));
        return {
          authenticated: false,
          authMethod: 'interactive',
        };
      }

      // Handle MFA if required
      if (authResult.requiresMFA) {
        const mfaPrompt = await inquirer.default.prompt([
          {
            type: 'input',
            name: 'mfaCode',
            message: 'MFA Code (6 digits):',
            validate: (input: string) => /^\d{6}$/.test(input) || 'MFA code must be 6 digits',
          },
        ]);

        const mfaAuthRequest = {
          ...authRequest,
          mfaCode: mfaPrompt.mfaCode,
        };

        const mfaResult = await this.authManager.authenticate(mfaAuthRequest);

        if (!mfaResult.success) {
          console.log(chalk.red(`\n❌ MFA authentication failed: ${mfaResult.error}\n`));
          return {
            authenticated: false,
            authMethod: 'interactive',
          };
        }

        // Use MFA result
        authResult.user = mfaResult.user;
        authResult.session = mfaResult.session;
        authResult.accessToken = mfaResult.accessToken;
      }

      console.log(chalk.green(`\n✅ Welcome, ${authResult.user?.username}!\n`));

      // Store session for subsequent requests
      if (authResult.accessToken) {
        await this.storeSessionToken(authResult.accessToken);
      }

      return {
        authenticated: true,
        authMethod: 'interactive',
        userId: authResult.user?.id,
        username: authResult.user?.username,
        permissions: authResult.session?.permissions,
        sessionId: authResult.session?.id,
      };
    } catch (error) {
      logger.error('Interactive authentication failed', error as Error);
      return {
        authenticated: false,
        authMethod: 'interactive',
      };
    }
  }

  /**
   * Check if command is allowed without authentication
   */
  private isUnauthenticatedCommandAllowed(command: string): boolean {
    return this.config.allowedUnauthenticatedCommands.includes(command.toLowerCase());
  }

  /**
   * Store session token for subsequent requests
   */
  private async storeSessionToken(token: string): Promise<void> {
    try {
      // Store in a secure location (encrypted file or environment)
      const tokenPath = process.env.HOME || process.env.USERPROFILE;
      if (tokenPath) {
        const fs = await import('fs/promises');
        const path = await import('path');

        const tokenFile = path.join(tokenPath, '.codecrucible-session');
        await fs.writeFile(tokenFile, token, { mode: 0o600 });

        logger.debug('Session token stored');
      }
    } catch (error) {
      logger.warn('Failed to store session token', { error: (error as Error).message });
    }
  }

  /**
   * Load stored session token
   */
  async loadStoredToken(): Promise<string | null> {
    try {
      const tokenPath = process.env.HOME || process.env.USERPROFILE;
      if (!tokenPath) return null;

      const fs = await import('fs/promises');
      const path = await import('path');

      const tokenFile = path.join(tokenPath, '.codecrucible-session');
      const token = await fs.readFile(tokenFile, 'utf8');

      return token.trim();
    } catch {
      return null;
    }
  }

  /**
   * Validate permission for specific operation
   */
  async validatePermission(
    auth: AuthenticatedRequest,
    operation: string,
    resource?: string
  ): Promise<boolean> {
    try {
      if (!this.config.enabled || !auth.authenticated) {
        return !this.config.requireAuth;
      }

      if (!auth.userId || !auth.permissions) {
        return false;
      }

      // Check RBAC permissions
      const permissionId = resource ? `${operation}:${resource}` : operation;
      return this.rbacSystem.hasPermission(auth.userId, permissionId);
    } catch (error) {
      logger.error('Permission validation error', error as Error);
      return false;
    }
  }

  /**
   * Logout current session
   */
  async logout(sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        await this.authManager.logout(sessionId);
      }

      // Remove stored token
      const tokenPath = process.env.HOME || process.env.USERPROFILE;
      if (tokenPath) {
        const fs = await import('fs/promises');
        const path = await import('path');

        const tokenFile = path.join(tokenPath, '.codecrucible-session');
        await fs.unlink(tokenFile).catch(() => {}); // Ignore if file doesn't exist
      }

      logger.info('User logged out');
    } catch (error) {
      logger.error('Logout error', error as Error);
    }
  }

  /**
   * Ensure default admin user exists
   */
  private async ensureDefaultAdminUser(): Promise<void> {
    try {
      const users = this.rbacSystem.getUsers();
      const adminExists = users.some(
        user => user.roles.includes('admin') || user.username === 'admin'
      );

      if (!adminExists) {
        const defaultPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!@#';

        const adminUserId = await this.rbacSystem.createUser({
          username: 'admin',
          email: 'admin@codecrucible.local',
          roles: ['admin', 'developer'],
          status: 'active',
        });

        logger.warn('Default admin user created', {
          username: 'admin',
          message: 'Please change the default password immediately',
        });

        if (!process.env.DEFAULT_ADMIN_PASSWORD) {
          console.log(chalk.yellow('\n⚠️  Default admin user created with password: Admin123!@#'));
          console.log(chalk.yellow('   Please change this password immediately for security!\n'));
        }
      }
    } catch (error) {
      logger.error('Failed to ensure default admin user', error as Error);
    }
  }

  /**
   * Get authentication statistics
   */
  getAuthStats() {
    return this.authManager.getAuthStats();
  }

  /**
   * Check if authentication is enabled
   */
  isAuthEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if authentication is required
   */
  isAuthRequired(): boolean {
    return this.config.requireAuth;
  }
}

// Import chalk dynamically to avoid import issues
const chalk = await import('chalk').then(m => m.default);
