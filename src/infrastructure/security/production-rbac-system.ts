/**
 * Production RBAC System with JWT Authentication
 * Replaces the stub RBAC system with enterprise-grade security
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { ProductionDatabaseManager } from '../../database/production-database-manager.js';
import { SecretsManager } from './secrets-manager.js';
import { logger } from '../logging/logger.js';
import { EventEmitter } from 'events';

export interface JWTPayload {
  sub: string; // user id
  username: string;
  roles: string[];
  permissions: string[];
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
  sessionId: string;
}

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface AuthorizationRequest {
  userId: string;
  sessionId: string;
  resource: string;
  action: string;
  context?: {
    ipAddress?: string;
    userAgent?: string;
    data?: unknown;
  };
}

export interface AuthorizationResponse {
  granted: boolean;
  reason?: string;
  requiredPermissions: readonly string[];
  userPermissions: readonly string[];
  riskScore?: number;
  constraints?: Record<string, unknown>;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  passwordHash: string;
  salt: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  failedLoginAttempts: number;
  accountLocked: boolean;
  lockoutExpires?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  constraints?: Record<string, unknown>;
  isSystem: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissionIds: string[];
  inheritedRoleIds: string[];
  isSystem: boolean;
}

export class ProductionRBACSystem extends EventEmitter {
  private readonly db: ProductionDatabaseManager;
  private readonly secretsManager: SecretsManager;
  private jwtSecret: string;
  private jwtRefreshSecret: string;
  private readonly saltRounds: number = 12;
  private readonly maxLoginAttempts: number = 5;
  private readonly lockoutDurationMs: number = 30 * 60 * 1000; // 30 minutes
  private readonly accessTokenExpiryMs: number = 15 * 60 * 1000; // 15 minutes
  private readonly refreshTokenExpiryMs: number = 7 * 24 * 60 * 60 * 1000; // 7 days
  private readonly revokedTokens: Set<string> = new Set();

  // Cache for frequently accessed permissions and roles
  private readonly permissionCache: Map<string, Permission> = new Map();
  private readonly roleCache: Map<string, Role> = new Map();
  private readonly userPermissionCache: Map<string, string[]> = new Map();
  private readonly cacheExpiryMs: number = 5 * 60 * 1000; // 5 minutes

  private cacheCleanupInterval: NodeJS.Timeout | null = null;

  public constructor(db: ProductionDatabaseManager, secretsManager: SecretsManager) {
    super();
    this.db = db;
    this.secretsManager = secretsManager;
    this.jwtSecret = ''; // Will be loaded from secrets
    this.jwtRefreshSecret = ''; // Will be loaded from secrets
  }

  /**
   * Initialize RBAC system
   */
  public async initialize(): Promise<void> {
    try {
      await this.loadJWTSecrets();
      await this.ensureSystemRoles();

      this.startCacheCleanup();
      logger.info('Production RBAC system initialized');
    } catch (error) {
      logger.error(
        'Failed to initialize RBAC system:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Load JWT secrets from secure storage
   */
  private async loadJWTSecrets(): Promise<void> {
    try {
      this.jwtSecret =
        (await this.secretsManager.getSecret('jwt_access_secret')) ??
        (await this.generateAndStoreSecret('jwt_access_secret'));

      this.jwtRefreshSecret =
        (await this.secretsManager.getSecret('jwt_refresh_secret')) ??
        (await this.generateAndStoreSecret('jwt_refresh_secret'));
    } catch (error) {
      logger.error(
        'Failed to load JWT secrets:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Generate and store new JWT secret
   */
  private async generateAndStoreSecret(key: string): Promise<string> {
    const secret = crypto.randomBytes(64).toString('hex');
    await this.secretsManager.storeSecret(key, secret, {
      description: `JWT secret for ${key}`,
      tags: ['jwt', 'security'],
    });
    return secret;
  }

  /**
   * Register new user with secure password hashing
   */
  public async registerUser(
    userData: Readonly<{
      username: string;
      email?: string;
      password: string;
      roles?: string[];
      metadata?: Record<string, unknown>;
    }>
  ): Promise<string> {
    try {
      // Validate password strength
      this.validatePasswordStrength(userData.password);

      // Check if username already exists
      const existingUser = await this.db.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [userData.username, userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('Username or email already exists');
      }

      // Generate salt and hash password
      const salt = await bcrypt.genSalt(this.saltRounds);
      const passwordHash = await bcrypt.hash(userData.password, salt);

      // Validate roles exist
      const roles = userData.roles ?? ['user'];
      await this.validateRoles(roles);

      // Insert user
      const result = await this.db.query(
        `INSERT INTO users (username, email, password_hash, salt, roles, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          userData.username,
          userData.email,
          passwordHash,
          salt,
          JSON.stringify(roles),
          JSON.stringify(userData.metadata ?? {}),
        ]
      );

      const userId: string = result.rows[0]?.id as string;

      // Log security event
      await this.logSecurityEvent({
        userId,
        eventType: 'user_registration',
        severity: 'medium',
        outcome: 'success',
        description: `User ${userData.username} registered`,
      });

      logger.info(`User registered: ${userData.username}`, { userId });
      return userId;
    } catch (error) {
      logger.error(
        'User registration failed:',
        error instanceof Error ? error : new Error(String(error))
      );
      throw error;
    }
  }

  /**
   * Authenticate user with advanced security checks
   */
  public async authenticate(
    username: string,
    password: string,
    context: Readonly<{
      ipAddress?: string;
      userAgent?: string;
      deviceId?: string;
    }> = {}
  ): Promise<AuthenticationResult> {
    try {
      // Get user from database
      const userResult = await this.db.query('SELECT * FROM users WHERE username = $1', [username]);

      if (userResult.rows.length === 0) {
        await this.logSecurityEvent({
          eventType: 'login_failure',
          severity: 'medium',
          outcome: 'failure',
          sourceIp: context.ipAddress,
          description: `Login attempt for non-existent user: ${username}`,
        });

        // Simulate password verification to prevent timing attacks
        await bcrypt.hash('dummy', this.saltRounds);

        return { success: false, error: 'Invalid credentials' };
      }

      const user = this.mapDatabaseUser(userResult.rows[0] as any);

      // Check account status
      if (user.status !== 'active') {
        await this.logSecurityEvent({
          userId: user.id,
          eventType: 'login_failure',
          severity: 'high',
          outcome: 'blocked',
          sourceIp: context.ipAddress,
          description: `Login attempt for ${user.status} account: ${username}`,
        });

        return { success: false, error: 'Account not active' };
      }

      // Check account lockout
      if (user.accountLocked && user.lockoutExpires && user.lockoutExpires > new Date()) {
        const remainingMs = user.lockoutExpires.getTime() - Date.now();

        await this.logSecurityEvent({
          userId: user.id,
          eventType: 'login_failure',
          severity: 'high',
          outcome: 'blocked',
          sourceIp: context.ipAddress,
          description: `Login attempt for locked account: ${username}`,
        });

        return {
          success: false,
          error: `Account locked. Try again in ${Math.ceil(remainingMs / 60000)} minutes`,
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.passwordHash);

      if (!passwordValid) {
        await this.handleFailedLogin(user, context);
        return { success: false, error: 'Invalid credentials' };
      }

      // Reset failed login attempts on successful authentication
      if (user.failedLoginAttempts > 0) {
        await this.db.query(
          'UPDATE users SET failed_login_attempts = 0, account_locked = false, lockout_expires = NULL WHERE id = $1',
          [user.id]
        );
      }

      // Create session and tokens
      const sessionId = crypto.randomUUID();
      const userPermissions = await this.getUserPermissions(user.id);

      const accessToken = this.generateAccessToken({
        sub: user.id,
        username: user.username,
        roles: user.roles,
        permissions: userPermissions,
        sessionId,
      });

      const refreshToken = this.generateRefreshToken({
        sub: user.id,
        sessionId,
      });

      // Store session in database
      await this.db.query(
        `INSERT INTO user_sessions 
         (id, user_id, session_token, refresh_token, expires_at, ip_address, user_agent, permissions, roles)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          sessionId,
          user.id,
          accessToken,
          refreshToken,
          new Date(Date.now() + this.refreshTokenExpiryMs),
          context.ipAddress,
          context.userAgent,
          JSON.stringify(userPermissions),
          JSON.stringify(user.roles),
        ]
      );

      // Update last login
      await this.db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

      // Log successful login
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'login_success',
        severity: 'low',
        outcome: 'success',
        sourceIp: context.ipAddress,
        description: `Successful login: ${username}`,
      });

      this.emit('user:authenticated', { user, sessionId, context });

      return {
        success: true,
        user,
        accessToken,
        refreshToken,
        expiresIn: this.accessTokenExpiryMs,
      };
    } catch (error) {
      logger.error(
        'Authentication error:',
        error instanceof Error ? error : new Error(String(error))
      );
      return { success: false, error: 'Authentication service error' };
    }
  }

  /**
   * Authorize user action with advanced permission checking
   */
  public async authorize(request: Readonly<AuthorizationRequest>): Promise<AuthorizationResponse> {
    try {
      // Get user permissions from cache or database
      const userPermissions = await this.getUserPermissions(request.userId);

      // Find required permissions for this resource/action
      const requiredPermissions = await this.getRequiredPermissions(
        request.resource,
        request.action
      );

      // Check if user has required permissions
      const hasAllPermissions = requiredPermissions.every(required =>
        userPermissions.some(userPerm => this.permissionMatches(userPerm, required))
      );

      // Calculate risk score based on context
      const riskScore = this.calculateRiskScore(request);

      // Apply dynamic constraints
      const constraintCheck = await this.evaluateConstraints(userPermissions, request, riskScore);

      const granted = hasAllPermissions && constraintCheck.allowed && riskScore < 0.8;

      // Log authorization decision
      await this.logSecurityEvent({
        userId: request.userId,
        sessionId: request.sessionId,
        eventType: granted ? 'data_access' : 'permission_denied',
        severity: granted ? 'low' : 'medium',
        outcome: granted ? 'success' : 'blocked',
        sourceIp: request.context?.ipAddress,
        resource: request.resource,
        description: `Authorization ${granted ? 'granted' : 'denied'} for ${request.resource}:${request.action}`,
        details: {
          requiredPermissions,
          userPermissions: userPermissions.slice(0, 10), // Limit for performance
          riskScore,
        },
      });

      if (granted) {
        this.emit('authorization:granted', request);
      } else {
        this.emit('authorization:denied', request);
      }

      return {
        granted,
        reason: !granted
          ? !hasAllPermissions
            ? 'Insufficient permissions'
            : !constraintCheck.allowed
              ? constraintCheck.reason
              : 'High risk score detected'
          : undefined,
        requiredPermissions,
        userPermissions,
        riskScore,
        constraints: constraintCheck.appliedConstraints,
      };
    } catch (error) {
      logger.error(
        'Authorization error:',
        error instanceof Error ? error : new Error(String(error))
      );

      // Fail secure - deny access on error
      return {
        granted: false,
        reason: 'Authorization service error',
        requiredPermissions: [],
        userPermissions: [],
      };
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(refreshToken: string): Promise<AuthenticationResult> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as {
        jti: string;
        sessionId: string;
        sub: string;
      };

      if (this.revokedTokens.has(payload.jti)) {
        return { success: false, error: 'Token revoked' };
      }

      // Get session from database
      const sessionResult = await this.db.query(
        'SELECT * FROM user_sessions WHERE id = $1 AND refresh_token = $2',
        [payload.sessionId, refreshToken]
      );

      if (sessionResult.rows.length === 0) {
        return { success: false, error: 'Invalid session' };
      }

      const [session] = sessionResult.rows;

      if (new Date() > session.expires_at) {
        // Clean up expired session
        await this.db.query('DELETE FROM user_sessions WHERE id = $1', [session.id]);
        return { success: false, error: 'Session expired' };
      }

      // Get fresh user data and permissions
      const userResult = await this.db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);

      if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
        return { success: false, error: 'User not active' };
      }

      const user = this.mapDatabaseUser(userResult.rows[0] as any);
      const userPermissions = await this.getUserPermissions(user.id);

      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        sub: user.id,
        username: user.username,
        roles: user.roles,
        permissions: userPermissions,
        sessionId: String(session.id),
      });

      // Update session
      await this.db.query(
        'UPDATE user_sessions SET session_token = $1, last_activity = NOW() WHERE id = $2',
        [newAccessToken, session.id]
      );

      return {
        success: true,
        user,
        accessToken: newAccessToken,
        refreshToken, // Keep same refresh token
        expiresIn: this.accessTokenExpiryMs,
      };
    } catch (error) {
      logger.error(
        'Token refresh failed:',
        error instanceof Error ? error : new Error(String(error))
      );
      return { success: false, error: 'Invalid refresh token' };
    }
  }

  /**
   * Revoke user session
   */
  public async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'DELETE FROM user_sessions WHERE id = $1 RETURNING session_token',
        [sessionId]
      );

      if (result.rows.length > 0) {
        // Add token to revocation list
        const token: string = result.rows[0]?.session_token as string;
        this.revokedTokens.add(this.extractJTI(token));

        logger.info(`Session revoked: ${sessionId}`);
        return true;
      }

      return false;
    } catch (error) {
      logger.error(
        'Session revocation failed:',
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  /**
   * Verify JWT token and extract payload
   */
  public async verifyToken(token: string): Promise<JWTPayload | null> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as JWTPayload;

      if (this.revokedTokens.has(payload.jti)) {
        return null;
      }

      // Verify session still exists
      const sessionResult = await this.db.query(
        'SELECT expires_at FROM user_sessions WHERE id = $1',
        [payload.sessionId]
      );

      if (sessionResult.rows.length === 0 || new Date() > sessionResult.rows[0].expires_at) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Get user permissions with caching
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    // Check cache first
    const cached = this.userPermissionCache.get(userId);
    if (cached !== undefined) {
      return cached;
    }

    // Get user roles
    const userResult = await this.db.query('SELECT roles FROM users WHERE id = $1', [userId]);

    if (!Array.isArray(userResult.rows) || userResult.rows.length === 0) {
      return [];
    }

    interface UserRolesRow {
      roles: string | string[] | null;
    }
    const [row] = userResult.rows as UserRolesRow[];
    const rolesRaw = row.roles;
    const roles: readonly string[] = Array.isArray(rolesRaw)
      ? rolesRaw
      : typeof rolesRaw === 'string'
        ? (JSON.parse(rolesRaw) as readonly string[])
        : [];

    const allPermissions = new Set<string>();

    // Recursively collect permissions from roles and inherited roles
    const processedRoles = new Set<string>();

    const collectPermissions = async (roleNames: readonly string[]): Promise<void> => {
      for (const roleName of roleNames) {
        if (processedRoles.has(roleName)) continue;
        processedRoles.add(roleName);

        const roleResult = await this.db.query(
          'SELECT permission_ids, inherited_role_ids FROM roles WHERE name = $1',
          [roleName]
        );

        if (!Array.isArray(roleResult.rows) || roleResult.rows.length === 0) continue;

        const [role] = roleResult.rows as [
          { permission_ids: string | null; inherited_role_ids: string | null },
        ];

        const permissionIdsRaw = role.permission_ids;
        const inheritedRoleIdsRaw = role.inherited_role_ids;

        const permissionIds: readonly string[] = Array.isArray(permissionIdsRaw)
          ? permissionIdsRaw
          : typeof permissionIdsRaw === 'string'
            ? (JSON.parse(permissionIdsRaw) as readonly string[])
            : [];

        const inheritedRoleIds: readonly string[] = Array.isArray(inheritedRoleIdsRaw)
          ? inheritedRoleIdsRaw
          : typeof inheritedRoleIdsRaw === 'string'
            ? (JSON.parse(inheritedRoleIdsRaw) as readonly string[])
            : [];

        // Add direct permissions
        for (const id of permissionIds) {
          allPermissions.add(id);
        }

        // Process inherited roles
        if (Array.isArray(inheritedRoleIds) && inheritedRoleIds.length > 0) {
          const inheritedRoleResult = await this.db.query(
            'SELECT name FROM roles WHERE id = ANY($1)',
            [inheritedRoleIds]
          );

          const inheritedRoleNames: readonly string[] = Array.isArray(inheritedRoleResult.rows)
            ? inheritedRoleResult.rows.map(r => (r as { name: string }).name)
            : [];
          await collectPermissions(inheritedRoleNames);
        }
      }
    };

    await collectPermissions(roles);

    const permissions = Array.from(allPermissions);

    // Cache for 5 minutes
    this.userPermissionCache.set(userId, permissions);
    setTimeout(() => {
      this.userPermissionCache.delete(userId);
    }, this.cacheExpiryMs);

    return permissions;
  }

  /**
   * Private helper methods
   */
  private generateAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp' | 'jti'>): string {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        ...payload,
        iat: now,
        exp: now + Math.floor(this.accessTokenExpiryMs / 1000),
        jti,
      },
      this.jwtSecret,
      { algorithm: 'HS256' }
    );
  }

  private generateRefreshToken(payload: { sub: string; sessionId: string }): string {
    const jti = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        ...payload,
        iat: now,
        exp: now + Math.floor(this.refreshTokenExpiryMs / 1000),
        jti,
      },
      this.jwtRefreshSecret,
      { algorithm: 'HS256' }
    );
  }

  private extractJTI(token: string): string {
    try {
      const decoded = jwt.decode(token);
      if (
        decoded &&
        typeof decoded === 'object' &&
        'jti' in decoded &&
        typeof (decoded as { jti?: unknown }).jti === 'string'
      ) {
        return (decoded as { jti: string }).jti;
      }
      return '';
    } catch {
      return '';
    }
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      throw new Error('Password must contain uppercase, lowercase, number, and special character');
    }
  }

  private async validateRoles(roles: string[]): Promise<void> {
    const result = await this.db.query('SELECT name FROM roles WHERE name = ANY($1)', [roles]);

    const validRoles = (result.rows as Array<{ name: string }>).map(
      (r: { name: string }) => r.name
    );
    const invalidRoles = roles.filter(role => !validRoles.includes(role));

    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
    }
  }

  private async handleFailedLogin(
    user: User,
    context: { ipAddress?: string; userAgent?: string }
  ): Promise<void> {
    const newAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newAttempts >= this.maxLoginAttempts;

    await this.db.query(
      `UPDATE users 
       SET failed_login_attempts = $1, 
           account_locked = $2, 
           lockout_expires = $3
       WHERE id = $4`,
      [
        newAttempts,
        shouldLock,
        shouldLock ? new Date(Date.now() + this.lockoutDurationMs) : null,
        user.id,
      ]
    );

    await this.logSecurityEvent({
      userId: user.id,
      eventType: 'login_failure',
      severity: shouldLock ? 'high' : 'medium',
      outcome: 'failure',
      sourceIp: context.ipAddress,
      description: shouldLock
        ? `Account locked after ${this.maxLoginAttempts} failed attempts: ${user.username}`
        : `Failed login attempt ${newAttempts}/${this.maxLoginAttempts}: ${user.username}`,
    });
  }

  // Define a type for the user row returned from the database
  private mapDatabaseUser(
    row: Readonly<{
      id: string;
      username: string;
      email?: string;
      password_hash: string;
      salt: string;
      roles: string | string[] | null;
      status: 'active' | 'inactive' | 'suspended';
      last_login?: Date | null;
      failed_login_attempts: number;
      account_locked: boolean;
      lockout_expires?: Date | null;
      metadata: string | null;
      created_at: Date;
      updated_at: Date;
    }>
  ): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      passwordHash: row.password_hash,
      salt: row.salt,
      roles: Array.isArray(row.roles)
        ? row.roles
        : typeof row.roles === 'string'
          ? (JSON.parse(row.roles) as string[])
          : [],
      status: row.status,
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
      failedLoginAttempts: row.failed_login_attempts,
      accountLocked: row.account_locked,
      lockoutExpires: row.lockout_expires ? new Date(row.lockout_expires) : undefined,
      metadata: row.metadata
        ? typeof row.metadata === 'string'
          ? (JSON.parse(row.metadata) as Record<string, unknown>)
          : {}
        : {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private async getRequiredPermissions(
    resource: string,
    action: string
  ): Promise<readonly string[]> {
    const result = await this.db.query(
      "SELECT id FROM permissions WHERE resource = $1 AND (action = $2 OR action = '*')",
      [resource, action]
    );

    return (result.rows as unknown as ReadonlyArray<Readonly<{ id: string }>>).map(
      (r: Readonly<{ id: string }>) => r.id
    );
  }

  private permissionMatches(userPermissionId: string, requiredPermissionId: string): boolean {
    return userPermissionId === requiredPermissionId;
  }

  private calculateRiskScore(request: Readonly<AuthorizationRequest>): number {
    let risk = 0;

    // IP-based risk (simplified)
    if (request.context?.ipAddress) {
      if (
        request.context.ipAddress.startsWith('10.') ||
        request.context.ipAddress.startsWith('192.168.')
      ) {
        risk += 0.1; // Internal network
      } else {
        risk += 0.3; // External network
      }
    }

    // Time-based risk
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      risk += 0.2; // Off-hours access
    }

    // Action-based risk
    if (request.action === 'delete' || request.action === 'admin') {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  private evaluateConstraints(
    _permissions: readonly string[],
    _request: Readonly<AuthorizationRequest>,
    riskScore: number
  ): {
    allowed: boolean;
    reason?: string;
    appliedConstraints?: Record<string, unknown>;
  } {
    // Simplified constraint evaluation
    // In production, this would be much more sophisticated

    if (riskScore > 0.7) {
      return {
        allowed: false,
        reason: 'High risk score detected',
        appliedConstraints: { riskScore },
      };
    }

    return { allowed: true };
  }

  private async logSecurityEvent(
    event: Readonly<{
      userId?: string;
      sessionId?: string;
      eventType: string;
      severity: string;
      outcome: string;
      sourceIp?: string;
      userAgent?: string;
      resource?: string;
      description: string;
      details?: Record<string, unknown>;
    }>
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO security_audit_log 
         (user_id, session_id, event_type, severity, outcome, source_ip, user_agent, resource, description, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          event.userId ?? null,
          event.sessionId ?? null,
          event.eventType,
          event.severity,
          event.outcome,
          event.sourceIp ?? null,
          event.userAgent ?? null,
          event.resource ?? null,
          event.description,
          JSON.stringify(event.details ?? {}),
        ]
      );
    } catch (error) {
      logger.error(
        'Failed to log security event:',
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  private async ensureSystemRoles(): Promise<void> {
    // Create default system roles if they don't exist
    const systemRoles = [
      { name: 'admin', description: 'System administrator' },
      { name: 'user', description: 'Standard user' },
      { name: 'viewer', description: 'Read-only access' },
    ];

    for (const role of systemRoles) {
      const exists = await this.db.query('SELECT id FROM roles WHERE name = $1', [role.name]);

      if (exists.rows.length === 0) {
        await this.db.query(
          'INSERT INTO roles (name, description, is_system) VALUES ($1, $2, true)',
          [role.name, role.description]
        );
      }
    }
  }

  private startCacheCleanup(): void {
    // Clean up revoked tokens every hour
    this.cacheCleanupInterval = setInterval(
      () => {
        this.revokedTokens.clear();
        this.userPermissionCache.clear();
        this.permissionCache.clear();
        this.roleCache.clear();
      },
      60 * 60 * 1000
    );
  }

  // Removed unused stopCacheCleanup method to resolve unused declaration error.

  /**
   * Check if user has specific permission
   */
  public async hasPermission(
    userId: string,
    permission: string,
    _resource?: string
  ): Promise<boolean> {
    try {
      const userPermissions = await this.getUserPermissions(userId);
      return userPermissions.includes(permission) || userPermissions.includes('*');
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Create new user
   */
  public async createUser(userData: {
    username: string;
    email: string;
    password?: string;
  }): Promise<User> {
    const hashedPassword = userData.password
      ? await bcrypt.hash(userData.password, this.saltRounds)
      : null;

    const query = `
      INSERT INTO users (username, email, password_hash, status, roles, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, 'active', '["user"]', '{}', NOW(), NOW())
      RETURNING *
    `;

    const result = await this.db.query(query, [userData.username, userData.email, hashedPassword]);

    return this.mapDatabaseUser(
      result.rows[0] as {
        id: string;
        username: string;
        email?: string;
        password_hash: string;
        salt: string;
        roles: string | string[] | null;
        status: 'active' | 'inactive' | 'suspended';
        last_login?: Date | null;
        failed_login_attempts: number;
        account_locked: boolean;
        lockout_expires?: Date | null;
        metadata: string | null;
        created_at: Date;
        updated_at: Date;
      }
    );
  }

  public async assignRoleToUser(userId: string, role: string): Promise<void> {
    const query = `
      INSERT INTO user_roles (user_id, role)
      VALUES ($1, $2)
      ON CONFLICT (user_id, role) DO NOTHING
    `;

    await this.db.query(query, [userId, role]);
    logger.info('Role assigned to user', { userId, role });
  }

  public async getUsers(): Promise<
    Array<{
      id: string;
      username: string;
      email?: string;
      status: string;
      createdAt: Date;
      lastLogin?: Date;
    }>
  > {
    const query = `
      SELECT id, username, email, status, created_at, last_login
      FROM users
      WHERE status != 'deleted'
      ORDER BY username ASC
    `;

    const result = await this.db.query(query);
    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows.map((row: any) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      status: row.status,
      createdAt: new Date(row.created_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined,
    }));
  }

  public shutdown(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
      this.cacheCleanupInterval = null;
    }

    this.removeAllListeners();
    logger.info('Production RBAC system shutdown');
  }
}

export default ProductionRBACSystem;
export { ProductionRBACSystem as RBACSystem };

// Type aliases for backward compatibility
export interface Session {
  id: string;
  userId: string;
  ipAddress: string;
  userAgent?: string;
  createdAt: Date;
  lastActivity: Date;
  expiresAt: Date;
  isActive: boolean;
  permissions: string[];
  roles: string[];
  refreshToken?: string;
}

export interface AuthorizationContext {
  userId: string;
  sessionId: string;
  resource: string;
  action: string;
  data?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: Date;
}
