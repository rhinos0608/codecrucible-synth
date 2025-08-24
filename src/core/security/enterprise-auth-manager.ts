/**
 * Enterprise Authentication Manager
 * Handles authentication, session management, and token-based access control
 */

import * as jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { RBACSystem, Session, User } from './production-rbac-system.js';
import { SecretsManager } from './secrets-manager.js';
import { InputSanitizer } from '../security/input-sanitizer.js';
import { logger } from '../logger.js';

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  refreshTokenExpiresIn: string;
  sessionTimeout: number;
  maxConcurrentSessions: number;
  enforceIpBinding: boolean;
  requireMFA: boolean;
  passwordPolicy: {
    minLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    preventReuse: number;
  };
  rateLimiting: {
    maxAttempts: number;
    windowMs: number;
    blockDuration: number;
  };
}

export interface AuthRequest {
  username: string;
  password: string;
  mfaCode?: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
}

export interface AuthResult {
  success: boolean;
  user?: User;
  session?: Session;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  error?: string;
  requiresMFA?: boolean;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: User;
  session?: Session;
  permissions?: string[];
  error?: string;
}

export interface APIKeyConfig {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  expiresAt?: Date;
  lastUsed?: Date;
  usageCount: number;
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

export class EnterpriseAuthManager {
  private config: AuthConfig;
  private rbac: RBACSystem;
  private secretsManager: SecretsManager;
  private rateLimitTracker = new Map<string, { count: number; resetTime: number }>();
  private apiKeys = new Map<string, APIKeyConfig>();
  private activeSessions = new Map<string, Session>();

  constructor(rbac: RBACSystem, secretsManager: SecretsManager, config: Partial<AuthConfig> = {}) {
    this.rbac = rbac;
    this.secretsManager = secretsManager;
    this.config = {
      jwtSecret: process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex'),
      jwtExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxConcurrentSessions: 5,
      enforceIpBinding: true,
      requireMFA: false,
      passwordPolicy: {
        minLength: 12,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 5,
      },
      rateLimiting: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        blockDuration: 30 * 60 * 1000, // 30 minutes
      },
      ...config,
    };
  }

  /**
   * Authenticate user with comprehensive security checks
   */
  async authenticate(request: AuthRequest): Promise<AuthResult> {
    try {
      // Input validation
      const usernameValidation = InputSanitizer.sanitizePrompt(request.username);

      if (!usernameValidation.isValid) {
        return {
          success: false,
          error: 'Invalid username format',
        };
      }

      // Rate limiting check
      const rateLimitKey = request.ipAddress || 'unknown';
      if (this.isRateLimited(rateLimitKey)) {
        logger.warn('Authentication rate limited', {
          ipAddress: request.ipAddress,
          username: request.username,
        });

        return {
          success: false,
          error: 'Too many authentication attempts. Please try again later.',
        };
      }

      // Attempt authentication via RBAC
      const authResult = await this.rbac.authenticate(request.username, request.password, {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      });

      if (!authResult) {
        this.recordFailedAttempt(rateLimitKey);
        return {
          success: false,
          error: 'Invalid credentials',
        };
      }

      const { user } = authResult;
      const session = this.createSession(user, request.ipAddress);

      // MFA check if required
      if (this.config.requireMFA && !request.mfaCode) {
        return {
          success: false,
          requiresMFA: true,
          error: 'Multi-factor authentication required',
        };
      }

      if (this.config.requireMFA && request.mfaCode) {
        const mfaValid = await this.validateMFA(user?.id!, request.mfaCode);
        if (!mfaValid) {
          this.recordFailedAttempt(rateLimitKey);
          return {
            success: false,
            error: 'Invalid MFA code',
          };
        }
      }

      // Session management
      await this.manageUserSessions(user?.id!, session.id);

      // Generate JWT tokens
      const accessToken = this.generateAccessToken(user!, session);
      const refreshToken = this.generateRefreshToken(session);

      // Store session
      this.activeSessions.set(session.id, session);

      // Reset rate limiting on successful auth
      this.rateLimitTracker.delete(rateLimitKey);

      logger.info('User authenticated successfully', {
        userId: user?.id!,
        username: user?.username!,
        sessionId: session.id,
        ipAddress: request.ipAddress,
      });

      return {
        success: true,
        user,
        session,
        accessToken,
        refreshToken,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      logger.error('Authentication error', error as Error, {
        username: request.username,
        ipAddress: request.ipAddress,
      });

      return {
        success: false,
        error: 'Authentication system error',
      };
    }
  }

  /**
   * Validate JWT access token
   */
  async validateToken(token: string, ipAddress?: string): Promise<TokenValidationResult> {
    try {
      // Verify JWT signature and expiration
      const decoded = jwt.verify(token, this.config.jwtSecret) as any;

      // Get session info
      const session = this.activeSessions.get(decoded.sessionId);
      if (!session || session.expiresAt < new Date()) {
        return {
          valid: false,
          error: 'Session expired or invalid',
        };
      }

      // IP binding check
      if (this.config.enforceIpBinding && ipAddress && session.ipAddress !== ipAddress) {
        logger.warn('IP binding violation detected', {
          sessionId: session.id,
          expectedIp: session.ipAddress,
          actualIp: ipAddress,
        });

        return {
          valid: false,
          error: 'IP address mismatch',
        };
      }

      // Get user info
      const users = this.rbac.getUsers();
      const user = (await users).find(u => u.id === session.userId);
      if (!user || user?.status !== 'active') {
        return {
          valid: false,
          error: 'User not found or inactive',
        };
      }

      // Update session activity
      session.lastActivity = new Date();

      return {
        valid: true,
        user: user!,
        session,
        permissions: session.permissions,
      };
    } catch (error) {
      logger.debug('Token validation failed', { error: (error as Error).message });
      return {
        valid: false,
        error: 'Invalid token',
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      const decoded = jwt.verify(refreshToken, this.config.jwtSecret) as any;

      const session = this.activeSessions.get(decoded.sessionId);
      if (!session || session.refreshToken !== refreshToken) {
        return {
          success: false,
          error: 'Invalid refresh token',
        };
      }

      const users = this.rbac.getUsers();
      const user = (await users).find(u => u.id === session.userId);
      if (!user || user?.status !== 'active') {
        return {
          success: false,
          error: 'User not found or inactive',
        };
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user!, session);

      // Optionally rotate refresh token
      const newRefreshToken = this.generateRefreshToken(session);
      session.refreshToken = newRefreshToken;

      return {
        success: true,
        user: user!,
        session,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: session.expiresAt,
      };
    } catch (error) {
      logger.debug('Refresh token validation failed', { error: (error as Error).message });
      return {
        success: false,
        error: 'Invalid refresh token',
      };
    }
  }

  /**
   * Logout user session
   */
  async logout(sessionId: string): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return false;
      }

      // Remove from active sessions
      this.activeSessions.delete(sessionId);

      // Revoke in RBAC system
      await this.rbac.revokeSession(sessionId);

      logger.info('User logged out', {
        sessionId,
        userId: session.userId,
      });

      return true;
    } catch (error) {
      logger.error('Logout error', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * Create API key for programmatic access
   */
  async createAPIKey(
    config: Omit<APIKeyConfig, 'id' | 'key' | 'lastUsed' | 'usageCount'>
  ): Promise<{
    id: string;
    key: string;
  }> {
    try {
      const id = crypto.randomBytes(16).toString('hex');
      const key = `cc_${crypto.randomBytes(32).toString('hex')}`;
      const hashedKey = crypto.createHash('sha256').update(key).digest('hex');

      const apiKeyConfig: APIKeyConfig = {
        id,
        key: hashedKey, // Store hashed version
        usageCount: 0,
        ...config,
      };

      this.apiKeys.set(id, apiKeyConfig);

      // Store in secrets manager
      await this.secretsManager.storeSecret(`apikey_${id}`, JSON.stringify(apiKeyConfig), {
        description: `API Key: ${config.name}`,
        tags: ['apikey', 'auth'],
        expiresAt: config.expiresAt,
      });

      logger.info('API key created', {
        id,
        name: config.name,
        permissions: config.permissions.length,
      });

      return { id, key }; // Return unhashed key to user
    } catch (error) {
      logger.error('Failed to create API key', error as Error);
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(providedKey: string): Promise<{
    valid: boolean;
    apiKey?: APIKeyConfig;
    error?: string;
  }> {
    try {
      const hashedProvidedKey = crypto.createHash('sha256').update(providedKey).digest('hex');

      for (const [id, apiKey] of this.apiKeys.entries()) {
        if (apiKey.key === hashedProvidedKey) {
          // Check expiration
          if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
            return {
              valid: false,
              error: 'API key expired',
            };
          }

          // Check rate limiting
          if (apiKey.rateLimit) {
            const rateLimitKey = `apikey_${id}`;
            if (this.isAPIKeyRateLimited(rateLimitKey, apiKey.rateLimit)) {
              return {
                valid: false,
                error: 'API key rate limit exceeded',
              };
            }
            this.recordAPIKeyUsage(rateLimitKey);
          }

          // Update usage statistics
          apiKey.lastUsed = new Date();
          apiKey.usageCount++;

          return {
            valid: true,
            apiKey,
          };
        }
      }

      return {
        valid: false,
        error: 'Invalid API key',
      };
    } catch (error) {
      logger.error('API key validation error', error as Error);
      return {
        valid: false,
        error: 'API key validation failed',
      };
    }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId: string): Promise<boolean> {
    try {
      const apiKey = this.apiKeys.get(keyId);
      if (!apiKey) {
        return false;
      }

      this.apiKeys.delete(keyId);
      await this.secretsManager.deleteSecret(`apikey_${keyId}`);

      logger.info('API key revoked', {
        id: keyId,
        name: apiKey.name,
      });

      return true;
    } catch (error) {
      logger.error('Failed to revoke API key', error as Error, { keyId });
      return false;
    }
  }

  /**
   * Password validation against policy
   */
  validatePassword(
    password: string,
    username?: string
  ): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const policy = this.config.passwordPolicy;

    if (password.length < policy.minLength) {
      errors.push(`Password must be at least ${policy.minLength} characters long`);
    }

    if (policy.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (policy.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (policy.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (policy.requireSymbols && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
      errors.push('Password must contain at least one symbol');
    }

    if (username && password.toLowerCase().includes(username.toLowerCase())) {
      errors.push('Password cannot contain username');
    }

    // Check for common weak passwords
    const commonPasswords = ['password', '123456', 'admin', 'root', 'letmein'];
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate access token
   */
  private generateAccessToken(user: User, session: Session): string {
    try {
      const payload = {
        userId: user?.id!,
        username: user?.username!,
        sessionId: session.id,
        permissions: session.permissions,
        roles: session.roles,
        type: 'access',
      };

      const options = {
        expiresIn: this.config.jwtExpiresIn as any,
        issuer: 'codecrucible-auth',
        audience: 'codecrucible-api',
      };

      return jwt.sign(payload, this.config.jwtSecret as string, options as jwt.SignOptions);
    } catch (error) {
      logger.error('Failed to generate access token', error as Error);
      throw error;
    }
  }

  /**
   * Generate refresh token
   */
  private generateRefreshToken(session: Session): string {
    try {
      const payload = {
        sessionId: session.id,
        type: 'refresh',
      };

      const options = {
        expiresIn: this.config.refreshTokenExpiresIn as any,
        issuer: 'codecrucible-auth',
        audience: 'codecrucible-api',
      };

      return jwt.sign(payload, this.config.jwtSecret as string, options as jwt.SignOptions);
    } catch (error) {
      logger.error('Failed to generate refresh token', error as Error);
      throw error;
    }
  }

  /**
   * Validate MFA code (placeholder implementation)
   */
  private async validateMFA(userId: string, mfaCode: string): Promise<boolean> {
    // This is a placeholder - in a real implementation, you would:
    // 1. Get user's MFA secret from secure storage
    // 2. Validate TOTP code using a library like 'otplib'
    // 3. Check for replay attacks

    // For now, accept any 6-digit code
    return /^\d{6}$/.test(mfaCode);
  }

  /**
   * Manage concurrent sessions per user
   */
  private async manageUserSessions(userId: string, currentSessionId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId && session.id !== currentSessionId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Remove oldest sessions if limit exceeded
    if (userSessions.length >= this.config.maxConcurrentSessions) {
      const sessionsToRemove = userSessions.slice(this.config.maxConcurrentSessions - 1);
      for (const session of sessionsToRemove) {
        this.activeSessions.delete(session.id);
        await this.rbac.revokeSession(session.id);
      }

      logger.info('Concurrent session limit enforced', {
        userId,
        removedSessions: sessionsToRemove.length,
      });
    }
  }

  /**
   * Rate limiting methods
   */
  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker) {
      return false;
    }

    if (now > tracker.resetTime) {
      this.rateLimitTracker.delete(key);
      return false;
    }

    return tracker.count >= this.config.rateLimiting.maxAttempts;
  }

  private recordFailedAttempt(key: string): void {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker || now > tracker.resetTime) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + this.config.rateLimiting.windowMs,
      });
    } else {
      tracker.count++;
    }
  }

  private isAPIKeyRateLimited(
    key: string,
    rateLimit: { maxRequests: number; windowMs: number }
  ): boolean {
    const tracker = this.rateLimitTracker.get(key);
    const now = Date.now();

    if (!tracker) {
      return false;
    }

    if (now > tracker.resetTime) {
      this.rateLimitTracker.delete(key);
      return false;
    }

    return tracker.count >= rateLimit.maxRequests;
  }

  private recordAPIKeyUsage(key: string): void {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(key);

    if (!tracker || now > tracker.resetTime) {
      this.rateLimitTracker.set(key, {
        count: 1,
        resetTime: now + 15 * 60 * 1000, // Default 15 minutes
      });
    } else {
      tracker.count++;
    }
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    let cleaned = 0;
    const now = new Date();

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
        await this.rbac.revokeSession(sessionId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Expired sessions cleaned up', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Get authentication statistics
   */
  async getAuthStats(): Promise<{
    activeSessions: number;
    activeAPIKeys: number;
    rateLimitedIPs: number;
    totalUsers: number;
  }> {
    return {
      activeSessions: this.activeSessions.size,
      activeAPIKeys: this.apiKeys.size,
      rateLimitedIPs: this.rateLimitTracker.size,
      totalUsers: (await this.rbac.getUsers()).length,
    };
  }

  /**
   * Create a new session for authenticated user
   */
  private createSession(user: User | undefined, ipAddress?: string): Session {
    const sessionId = crypto.randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    return {
      id: sessionId,
      userId: user?.id || '',
      ipAddress: ipAddress || '',
      createdAt: now,
      lastActivity: now,
      expiresAt,
      isActive: true,
      permissions: [],
      roles: [],
      refreshToken: crypto.randomBytes(32).toString('hex'),
    };
  }

  /**
   * Public method to check rate limit for testing
   */
  checkRateLimit(ip: string): boolean {
    const isLimited = this.isRateLimited(ip);
    if (!isLimited) {
      // Record this as a failed attempt to trigger rate limiting
      this.recordFailedAttempt(ip);
    }
    return !isLimited;
  }

  /**
   * Get rate limit retry after time in seconds
   */
  getRateLimitRetryAfter(ip: string): number {
    const tracker = this.rateLimitTracker.get(ip);
    if (!tracker) return 0;

    const now = Date.now();
    return Math.max(0, Math.ceil((tracker.resetTime - now) / 1000));
  }

  /**
   * Generate JWT token (public method for testing)
   */
  generateJWT(userId: string, payload: any): string {
    return jwt.sign(
      {
        userId,
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      },
      this.config.jwtSecret,
      {
        issuer: 'codecrucible-auth',
        audience: 'codecrucible-api',
      }
    );
  }

  /**
   * Validate JWT token (public method for testing)
   */
  validateJWT(token: string): { success: boolean; payload?: any; error?: string } {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      return {
        success: true,
        payload: decoded,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Hash password using bcrypt-like method
   */
  async hashPassword(password: string): Promise<string> {
    // Using Node.js crypto for consistent hashing (in production, use bcrypt)
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, storedHash] = hash.split(':');
    const computedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');

    // Use timing-safe comparison to prevent timing attacks
    return this.timingSafeEqual(computedHash, storedHash);
  }

  /**
   * Validate password against policy (throws on failure)
   */
  validatePasswordPolicy(password: string, username?: string): void {
    const validation = this.validatePassword(password, username);
    if (!validation.valid) {
      throw new Error(`Password policy violation: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
