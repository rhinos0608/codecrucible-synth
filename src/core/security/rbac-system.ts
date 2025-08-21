/**
 * Enterprise Role-Based Access Control (RBAC) System
 * Implements comprehensive authorization with hierarchical roles and fine-grained permissions
 */

import { SecretsManager } from './secrets-manager.js';
import { logger } from '../logger.js';
import crypto from 'crypto';

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  constraints?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  inherits?: string[];
  isSystem?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended';
  lastLogin?: Date;
  failedLoginAttempts: number;
  accountLocked?: boolean;
  lockoutExpires?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
  permissions: string[];
  roles: string[];
}

export interface AuthorizationContext {
  userId: string;
  sessionId: string;
  resource: string;
  action: string;
  data?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthorizationResult {
  granted: boolean;
  reason?: string;
  requiredPermissions: string[];
  userPermissions: string[];
  constraints?: Record<string, any>;
}

export class RBACSystem {
  private secretsManager: SecretsManager;
  private permissions: Map<string, Permission> = new Map();
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();
  private sessions: Map<string, Session> = new Map();
  private initialized = false;

  constructor(secretsManager?: SecretsManager) {
    this.secretsManager = secretsManager || new SecretsManager();
  }

  /**
   * Initialize RBAC system with default roles and permissions
   */
  async initialize(): Promise<void> {
    try {
      await this.loadFromStorage();
      await this.ensureSystemRolesAndPermissions();
      this.initialized = true;

      logger.info('RBAC system initialized', {
        permissions: this.permissions.size,
        roles: this.roles.size,
        users: this.users.size,
      });
    } catch (error) {
      logger.error('Failed to initialize RBAC system', error as Error);
      throw error;
    }
  }

  /**
   * Create a new permission
   */
  async createPermission(permission: Omit<Permission, 'id'>): Promise<string> {
    const id = this.generateId('perm');
    const newPermission: Permission = {
      id,
      ...permission,
    };

    this.permissions.set(id, newPermission);
    await this.savePermission(newPermission);

    logger.info('Permission created', { id, name: permission.name });
    return id;
  }

  /**
   * Create a new role
   */
  async createRole(role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const id = this.generateId('role');
    const now = new Date();

    // Validate permissions exist - ensure permissions is an array
    const permissions = Array.isArray(role.permissions) ? role.permissions : [];
    for (const permId of permissions) {
      if (!this.permissions.has(permId)) {
        throw new Error(`Permission ${permId} does not exist`);
      }
    }

    const newRole: Role = {
      id,
      createdAt: now,
      updatedAt: now,
      ...role,
      permissions, // Use validated permissions
    };

    // Validate inheritance hierarchy
    if (role.inherits) {
      for (const inheritedRoleId of role.inherits) {
        if (!this.roles.has(inheritedRoleId)) {
          throw new Error(`Inherited role ${inheritedRoleId} does not exist`);
        }
      }
    }

    this.roles.set(id, newRole);
    await this.saveRole(newRole);

    logger.info('Role created', { id, name: role.name });
    return id;
  }

  /**
   * Create a new user
   */
  async createUser(
    user: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'failedLoginAttempts'>
  ): Promise<string> {
    const id = this.generateId('user');
    const now = new Date();

    // Check if username already exists
    const existingUser = Array.from(this.users.values()).find(u => u.username === user.username);
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Validate roles exist - ensure roles is an array
    const roles = Array.isArray(user.roles) ? user.roles : [];
    for (const roleId of roles) {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role ${roleId} does not exist`);
      }
    }

    const newUser: User = {
      id,
      createdAt: now,
      updatedAt: now,
      failedLoginAttempts: 0,
      ...user,
      roles, // Use validated roles
    };

    this.users.set(id, newUser);
    await this.saveUser(newUser);

    logger.info('User created', { id, username: user.username });
    return id;
  }

  /**
   * Authenticate user and create session
   */
  async authenticate(
    username: string,
    password: string,
    context: {
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<{ session: Session; user: User } | null> {
    try {
      const user = Array.from(this.users.values()).find(u => u.username === username);
      if (!user || user.status !== 'active') {
        logger.warn('Authentication failed - user not found or inactive', { username });
        return null;
      }

      // Check account lockout
      if (user.accountLocked && user.lockoutExpires && user.lockoutExpires > new Date()) {
        logger.warn('Authentication failed - account locked', {
          username,
          lockoutExpires: user.lockoutExpires,
        });
        return null;
      }

      // Verify password (stored as hashed secret)
      const storedPasswordHash = await this.secretsManager.getSecret(`user_password_${user.id}`);
      const providedPasswordHash = this.hashPassword(password);

      if (!storedPasswordHash || storedPasswordHash !== providedPasswordHash) {
        await this.handleFailedLogin(user);
        logger.warn('Authentication failed - invalid password', { username });
        return null;
      }

      // Reset failed login attempts on successful auth
      if (user.failedLoginAttempts > 0) {
        user.failedLoginAttempts = 0;
        user.accountLocked = false;
        user.lockoutExpires = undefined;
        await this.saveUser(user);
      }

      // Create session
      const session = await this.createSession(user, context);

      // Update last login
      user.lastLogin = new Date();
      await this.saveUser(user);

      logger.info('User authenticated successfully', {
        username,
        sessionId: session.id,
        ipAddress: context.ipAddress,
      });

      return { session, user };
    } catch (error) {
      logger.error('Authentication error', error as Error, { username });
      return null;
    }
  }

  /**
   * Authorize an action
   */
  async authorize(context: AuthorizationContext): Promise<AuthorizationResult> {
    try {
      const session = this.sessions.get(context.sessionId);
      if (!session || session.expiresAt < new Date()) {
        return {
          granted: false,
          reason: 'Invalid or expired session',
          requiredPermissions: [],
          userPermissions: [],
        };
      }

      const user = this.users.get(session.userId);
      if (!user || user.status !== 'active') {
        return {
          granted: false,
          reason: 'User not found or inactive',
          requiredPermissions: [],
          userPermissions: [],
        };
      }

      // Update session activity
      session.lastActivity = new Date();

      // Get all user permissions (including inherited)
      const userPermissions = this.getUserPermissionObjects(user);

      // Find required permissions for this resource/action
      const requiredPermissions = this.getRequiredPermissions(context.resource, context.action);

      // Check if user has required permissions
      const hasPermissions = requiredPermissions.every(req =>
        userPermissions.some(userPerm => this.permissionMatches(userPerm, req))
      );

      // Apply constraints if specified
      const constraints = this.evaluateConstraints(userPermissions, context);

      const result: AuthorizationResult = {
        granted: hasPermissions && constraints.allowed,
        reason: !hasPermissions
          ? 'Insufficient permissions'
          : !constraints.allowed
            ? constraints.reason
            : undefined,
        requiredPermissions: requiredPermissions.map(p => p.id),
        userPermissions: userPermissions.map(p => p.id),
        constraints: constraints.appliedConstraints,
      };

      // Log authorization decision
      logger.debug('Authorization decision', {
        userId: user.id,
        resource: context.resource,
        action: context.action,
        granted: result.granted,
        reason: result.reason,
      });

      return result;
    } catch (error) {
      logger.error('Authorization error', error as Error, context);
      return {
        granted: false,
        reason: 'Authorization system error',
        requiredPermissions: [],
        userPermissions: [],
      };
    }
  }

  /**
   * Revoke session (logout)
   */
  async revokeSession(sessionId: string): Promise<boolean> {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return false;
      }

      this.sessions.delete(sessionId);
      await this.secretsManager.deleteSecret(`session_${sessionId}`);

      logger.info('Session revoked', { sessionId, userId: session.userId });
      return true;
    } catch (error) {
      logger.error('Failed to revoke session', error as Error, { sessionId });
      return false;
    }
  }

  /**
   * Get user permissions including inherited roles
   */
  private getUserPermissionObjects(user: User): Permission[] {
    if (!user || !user.roles) {
      return [];
    }

    const allPermissions = new Set<string>();
    const processedRoles = new Set<string>();

    const addRolePermissions = (roleId: string) => {
      if (processedRoles.has(roleId)) {
        return; // Prevent circular inheritance
      }
      processedRoles.add(roleId);

      const role = this.roles.get(roleId);
      if (!role) {
        return;
      }

      // Add role's direct permissions
      role.permissions.forEach(permId => allPermissions.add(permId));

      // Add inherited permissions
      if (role.inherits) {
        role.inherits.forEach(inheritedRoleId => addRolePermissions(inheritedRoleId));
      }
    };

    // Process all user roles - ensure roles is array
    const roles = Array.isArray(user.roles) ? user.roles : [];
    roles.forEach(roleId => addRolePermissions(roleId));

    // Convert permission IDs to Permission objects
    return Array.from(allPermissions)
      .map(permId => this.permissions.get(permId))
      .filter((perm): perm is Permission => !!perm);
  }

  /**
   * Get required permissions for resource/action
   */
  private getRequiredPermissions(resource: string, action: string): Permission[] {
    return Array.from(this.permissions.values()).filter(
      perm => perm.resource === resource && perm.action === action
    );
  }

  /**
   * Check if user permission matches required permission
   */
  private permissionMatches(userPerm: Permission, requiredPerm: Permission): boolean {
    return (
      userPerm.resource === requiredPerm.resource &&
      (userPerm.action === requiredPerm.action || userPerm.action === '*')
    );
  }

  /**
   * Evaluate permission constraints
   */
  private evaluateConstraints(
    permissions: Permission[],
    context: AuthorizationContext
  ): {
    allowed: boolean;
    reason?: string;
    appliedConstraints?: Record<string, any>;
  } {
    // This is a simplified constraint evaluation
    // In a real system, this would be much more sophisticated

    const relevantPermissions = permissions.filter(
      perm => perm.resource === context.resource && perm.constraints
    );

    for (const perm of relevantPermissions) {
      if (perm.constraints) {
        // Example: time-based constraints
        if (perm.constraints.allowedHours) {
          const currentHour = new Date().getHours();
          const { start, end } = perm.constraints.allowedHours;
          if (currentHour < start || currentHour > end) {
            return {
              allowed: false,
              reason: `Access not allowed outside hours ${start}-${end}`,
              appliedConstraints: perm.constraints,
            };
          }
        }

        // Example: IP-based constraints
        if (perm.constraints.allowedIPs && context.ipAddress) {
          const allowedIPs: string[] = perm.constraints.allowedIPs;
          if (!allowedIPs.includes(context.ipAddress)) {
            return {
              allowed: false,
              reason: 'Access not allowed from this IP address',
              appliedConstraints: perm.constraints,
            };
          }
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Create a new session
   */
  private async createSession(
    user: User,
    context: {
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<Session> {
    const sessionId = this.generateId('sess');
    const token = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const userPermissions = this.getUserPermissionObjects(user);

    const session: Session = {
      id: sessionId,
      userId: user.id,
      token,
      refreshToken,
      expiresAt,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      permissions: userPermissions.map(p => p.id),
      roles: user.roles,
    };

    this.sessions.set(sessionId, session);

    // Store session token securely
    await this.secretsManager.storeSecret(`session_${sessionId}`, JSON.stringify(session), {
      description: `Session for user ${user.username}`,
      tags: ['session', 'auth'],
      expiresAt,
    });

    return session;
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(user: User): Promise<void> {
    user.failedLoginAttempts++;

    // Lock account after 5 failed attempts
    if (user.failedLoginAttempts >= 5) {
      user.accountLocked = true;
      user.lockoutExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      logger.warn('Account locked due to failed login attempts', {
        userId: user.id,
        username: user.username,
        attempts: user.failedLoginAttempts,
      });
    }

    await this.saveUser(user);
  }

  /**
   * Ensure system roles and permissions exist
   */
  private async ensureSystemRolesAndPermissions(): Promise<void> {
    // Create system permissions
    const systemPermissions = [
      {
        name: 'ai_model_access',
        description: 'Access AI models',
        resource: 'ai_model',
        action: 'read',
      },
      {
        name: 'ai_model_execute',
        description: 'Execute AI models',
        resource: 'ai_model',
        action: 'execute',
      },
      { name: 'file_read', description: 'Read files', resource: 'file', action: 'read' },
      { name: 'file_write', description: 'Write files', resource: 'file', action: 'write' },
      {
        name: 'system_admin',
        description: 'System administration',
        resource: 'system',
        action: '*',
      },
      { name: 'user_management', description: 'Manage users', resource: 'user', action: '*' },
      {
        name: 'security_audit',
        description: 'Security auditing',
        resource: 'security',
        action: 'read',
      },
    ];

    for (const perm of systemPermissions) {
      const existing = Array.from(this.permissions.values()).find(p => p.name === perm.name);
      if (!existing) {
        await this.createPermission(perm);
      }
    }

    // Create system roles
    const adminRole = Array.from(this.roles.values()).find(r => r.name === 'admin');
    if (!adminRole) {
      const allPermissions = Array.from(this.permissions.keys());
      await this.createRole({
        name: 'admin',
        description: 'System administrator',
        permissions: allPermissions,
        isSystem: true,
      });
    }

    const userRole = Array.from(this.roles.values()).find(r => r.name === 'user');
    if (!userRole) {
      const userPermissions = Array.from(this.permissions.values())
        .filter(p => ['ai_model_access', 'ai_model_execute', 'file_read'].includes(p.name))
        .map(p => p.id);

      await this.createRole({
        name: 'user',
        description: 'Standard user',
        permissions: userPermissions,
        isSystem: true,
      });
    }
  }

  /**
   * Storage methods
   */
  private async loadFromStorage(): Promise<void> {
    // Implementation would load from persistent storage
    // For now, using in-memory storage
    logger.debug('RBAC data loaded from storage');
  }

  private async savePermission(permission: Permission): Promise<void> {
    await this.secretsManager.storeSecret(
      `rbac_permission_${permission.id}`,
      JSON.stringify(permission),
      { description: `Permission: ${permission.name}`, tags: ['rbac', 'permission'] }
    );
  }

  private async saveRole(role: Role): Promise<void> {
    await this.secretsManager.storeSecret(`rbac_role_${role.id}`, JSON.stringify(role), {
      description: `Role: ${role.name}`,
      tags: ['rbac', 'role'],
    });
  }

  private async saveUser(user: User): Promise<void> {
    const { ...userWithoutSensitive } = user;
    await this.secretsManager.storeSecret(
      `rbac_user_${user.id}`,
      JSON.stringify(userWithoutSensitive),
      { description: `User: ${user.username}`, tags: ['rbac', 'user'] }
    );
  }

  /**
   * Utility methods
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashPassword(password: string): string {
    return crypto
      .createHash('sha256')
      .update(password + 'salt')
      .digest('hex');
  }

  /**
   * Public getters for system introspection
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getUsers(): Omit<User, 'failedLoginAttempts' | 'accountLocked' | 'lockoutExpires'>[] {
    return Array.from(this.users.values()).map(user => {
      const { failedLoginAttempts, accountLocked, lockoutExpires, ...safeUser } = user;
      return safeUser;
    });
  }

  getActiveSessions(): Omit<Session, 'token' | 'refreshToken'>[] {
    return Array.from(this.sessions.values()).map(session => {
      const { token, refreshToken, ...safeSession } = session;
      return safeSession;
    });
  }

  // Convenience methods for tests
  createTestPermission(action: string, resource: string, description: string): Permission {
    const permission: Permission = {
      id: this.generateId('perm'),
      name: `${action}:${resource}`,
      description,
      resource,
      action,
    };
    this.permissions.set(permission.id, permission);
    return permission;
  }

  createTestRole(
    name: string,
    description: string,
    permissionIds: string[],
    inheritedRoleIds: string[] = []
  ): Role {
    const role: Role = {
      id: this.generateId('role'),
      name,
      description,
      permissions: permissionIds || [],
      inherits: inheritedRoleIds,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.roles.set(role.id, role);
    return role;
  }

  createTestUser(username: string, email: string, displayName: string): User {
    const user: User = {
      id: this.generateId('user'),
      username,
      email,
      roles: [],
      status: 'active',
      failedLoginAttempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: { displayName },
    };
    this.users.set(user.id, user);
    return user;
  }

  assignRole(userId: string, roleId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    if (!user.roles.includes(roleId)) {
      user.roles.push(roleId);
    }
    return true;
  }

  hasPermission(userId: string, permissionId: string): boolean {
    const user = this.users.get(userId);
    if (!user) return false;

    // Get all permissions from user's roles (including inherited)
    const userPermissions = this.getUserPermissions(userId);
    return userPermissions.includes(permissionId);
  }

  private getUserPermissions(userId: string): string[] {
    const user = this.users.get(userId);
    if (!user) return [];

    const permissions = new Set<string>();

    const addRolePermissions = (roleId: string) => {
      const role = this.roles.get(roleId);
      if (!role) return;

      // Add role's direct permissions
      role.permissions?.forEach(permId => permissions.add(permId));

      // Add inherited role permissions
      role.inherits?.forEach(inheritedRoleId => addRolePermissions(inheritedRoleId));
    };

    user.roles.forEach(roleId => addRolePermissions(roleId));
    return Array.from(permissions);
  }

  createTestSession(userId: string, ipAddress: string): string {
    const sessionId = this.generateId('session');
    const token = this.generateSecureToken();
    const refreshToken = this.generateSecureToken();

    const session: Session = {
      id: sessionId,
      userId,
      token,
      refreshToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress,
      permissions: this.getUserPermissions(userId),
      roles: this.users.get(userId)?.roles || [],
    };

    this.sessions.set(sessionId, session);

    // Clean up old sessions for this user (max 3 concurrent)
    this.cleanupUserSessions(userId);

    return sessionId;
  }

  validateSession(sessionId: string, ipAddress: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    // Check expiration
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return false;
    }

    // Check IP binding
    if (session.ipAddress !== ipAddress) {
      return false;
    }

    // Update last activity
    session.lastActivity = new Date();
    return true;
  }

  expireSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  updateRole(roleId: string, updates: Partial<Role>): Role | null {
    const role = this.roles.get(roleId);
    if (!role) return null;

    // Check for circular dependencies if updating inherited roles
    if (updates.inherits) {
      const hasCircularDependency = (
        checkRoleId: string,
        targetRoleId: string,
        visited = new Set()
      ): boolean => {
        if (visited.has(checkRoleId)) return true;
        if (checkRoleId === targetRoleId) return true;

        visited.add(checkRoleId);
        const checkRole = this.roles.get(checkRoleId);
        if (!checkRole?.inherits) return false;

        return checkRole.inherits.some(inheritedId =>
          hasCircularDependency(inheritedId, targetRoleId, new Set(visited))
        );
      };

      if (updates.inherits.some(inheritedId => hasCircularDependency(inheritedId, roleId))) {
        throw new Error('Circular role inheritance detected');
      }
    }

    Object.assign(role, updates, { updatedAt: new Date() });
    return role;
  }

  private cleanupUserSessions(userId: string): void {
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === userId)
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

    // Keep only the 3 most recent sessions
    userSessions.slice(3).forEach(session => {
      this.sessions.delete(session.id);
    });
  }
}
