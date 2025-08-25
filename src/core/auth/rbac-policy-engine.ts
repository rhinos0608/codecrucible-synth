/**
 * Role-Based Access Control (RBAC) Policy Engine
 * Implements enterprise-grade authorization with policies and conditions
 */

import { logger } from '../logger.js';
import { Policy, PolicyContext, Role, Permission, User } from './auth-types.js';

export class RBACPolicyEngine {
  private policies: Policy[] = [];
  private roles = new Map<string, Role>();
  private permissions = new Map<string, Permission>();

  constructor() {
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    // Default permissions
    const permissions: Permission[] = [
      { id: 'read:own', name: 'Read Own Resources', resource: 'user:*', action: 'read' },
      { id: 'read:public', name: 'Read Public Resources', resource: 'public:*', action: 'read' },
      { id: 'write:own', name: 'Write Own Resources', resource: 'user:*', action: 'write' },
      { id: 'admin:all', name: 'Full Admin Access', resource: '*', action: '*' },
      { id: 'analyze:code', name: 'Analyze Code', resource: 'analysis:*', action: 'read' },
      { id: 'generate:code', name: 'Generate Code', resource: 'generation:*', action: 'write' },
      { id: 'manage:voices', name: 'Manage Voice Systems', resource: 'voices:*', action: '*' },
      { id: 'view:metrics', name: 'View Metrics', resource: 'metrics:*', action: 'read' },
      { id: 'manage:config', name: 'Manage Configuration', resource: 'config:*', action: '*' },
    ];

    permissions.forEach(perm => this.permissions.set(perm.id, perm));

    // Default roles
    const roles: Role[] = [
      {
        id: 'guest',
        name: 'Guest User',
        description: 'Limited read-only access',
        permissions: permissions[1] ? [permissions[1]] : [], // read:public only
      },
      {
        id: 'user',
        name: 'Regular User',
        description: 'Standard user with basic AI features',
        permissions: [permissions[0], permissions[1], permissions[4], permissions[5]].filter(
          Boolean
        ), // read own/public, analyze, generate
      },
      {
        id: 'developer',
        name: 'Developer',
        description: 'Developer with enhanced code generation capabilities',
        permissions: [
          permissions[0],
          permissions[1],
          permissions[2],
          permissions[4],
          permissions[5],
          permissions[6],
        ].filter(Boolean),
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: permissions[3] ? [permissions[3]] : [], // admin:all covers everything
      },
      {
        id: 'analyst',
        name: 'Data Analyst',
        description: 'Read access with metrics viewing',
        permissions: [permissions[0], permissions[1], permissions[4], permissions[7]],
      },
    ];

    roles.forEach(role => this.roles.set(role.id, role));

    // Default policies
    this.policies = [
      {
        effect: 'allow',
        principal: ['user', 'developer', 'admin'],
        action: ['read'],
        resource: ['user:*'],
        condition: { 'user.owns_resource': true },
      },
      {
        effect: 'allow',
        principal: ['admin'],
        action: ['*'],
        resource: ['*'],
      },
      {
        effect: 'deny',
        principal: ['*'],
        action: ['delete'],
        resource: ['system:*'],
      },
      {
        effect: 'allow',
        principal: ['developer', 'admin'],
        action: ['write'],
        resource: ['generation:*', 'analysis:*'],
      },
      {
        effect: 'deny',
        principal: ['guest'],
        action: ['write'],
        resource: ['*'],
      },
      {
        effect: 'allow',
        principal: ['analyst', 'admin'],
        action: ['read'],
        resource: ['metrics:*', 'logs:*'],
      },
    ];

    logger.info('RBAC Policy Engine initialized', {
      policies: this.policies.length,
      roles: this.roles.size,
      permissions: this.permissions.size,
    });
  }

  /**
   * Evaluate authorization for a given context
   */
  authorize(context: PolicyContext): boolean {
    try {
      const applicablePolicies = this.getApplicablePolicies(context);

      // Log authorization attempt
      logger.debug('Authorization evaluation', {
        principal: context.principal,
        action: context.action,
        resource: context.resource,
        applicablePolicies: applicablePolicies.length,
      });

      // Check for explicit deny first (deny overrides allow)
      const hasDeny = applicablePolicies.some(
        policy =>
          policy.effect === 'deny' && this.evaluateConditions(policy.condition, context.environment)
      );

      if (hasDeny) {
        logger.warn('Authorization denied by explicit policy', context);
        return false;
      }

      // Check for explicit allow
      const hasAllow = applicablePolicies.some(
        policy =>
          policy.effect === 'allow' &&
          this.evaluateConditions(policy.condition, context.environment)
      );

      const authorized = hasAllow;

      if (authorized) {
        logger.info('Authorization granted', {
          principal: context.principal,
          action: context.action,
          resource: context.resource,
        });
      } else {
        logger.warn('Authorization denied - no matching allow policy', context);
      }

      return authorized;
    } catch (error) {
      logger.error('Authorization evaluation failed', error as Error, context);
      return false; // Fail secure
    }
  }

  /**
   * Get applicable policies for a context
   */
  private getApplicablePolicies(context: PolicyContext): Policy[] {
    return this.policies.filter(
      policy =>
        this.matchesPrincipal(policy.principal, context.principal) &&
        this.matchesAction(policy.action, context.action) &&
        this.matchesResource(policy.resource, context.resource)
    );
  }

  /**
   * Check if principal matches policy
   */
  private matchesPrincipal(policyPrincipal: string | string[], contextPrincipal: string): boolean {
    const principals = Array.isArray(policyPrincipal) ? policyPrincipal : [policyPrincipal];
    return principals.some(p => this.matchesPattern(p, contextPrincipal));
  }

  /**
   * Check if action matches policy
   */
  private matchesAction(policyAction: string | string[], contextAction: string): boolean {
    const actions = Array.isArray(policyAction) ? policyAction : [policyAction];
    return actions.some(a => this.matchesPattern(a, contextAction));
  }

  /**
   * Check if resource matches policy
   */
  private matchesResource(policyResource: string | string[], contextResource: string): boolean {
    const resources = Array.isArray(policyResource) ? policyResource : [policyResource];
    return resources.some(r => this.matchesPattern(r, contextResource));
  }

  /**
   * Pattern matching with wildcards
   */
  private matchesPattern(pattern: string, value: string): boolean {
    if (pattern === '*') return true;
    if (pattern === value) return true;

    if (pattern.includes('*')) {
      const regex = new RegExp(`^${  pattern.replace(/\*/g, '.*')  }$`);
      return regex.test(value);
    }

    return false;
  }

  /**
   * Evaluate policy conditions
   */
  private evaluateConditions(
    conditions: Record<string, any> | undefined,
    environment: Record<string, any>
  ): boolean {
    if (!conditions) return true;

    return Object.entries(conditions).every(([key, value]) => {
      switch (key) {
        case 'user.owns_resource':
          return environment.userId === environment.resourceOwnerId;

        case 'ip_address_in_range':
          return this.isIpInRange(environment.ipAddress, value);

        case 'time_between':
          return this.isTimeBetween(environment.currentTime, value.start, value.end);

        case 'user.has_role':
          return environment.userRoles?.includes(value);

        case 'request.has_header':
          return environment.headers?.[value.name] === value.value;

        case 'rate_limit.under_threshold':
          return environment.requestCount < value;

        default:
          // Direct equality check
          return environment[key] === value;
      }
    });
  }

  /**
   * Check if IP address is in range
   */
  private isIpInRange(ip: string, range: string): boolean {
    // Simplified IP range check - in production use proper CIDR library
    if (range === '*') return true;
    if (range === ip) return true;

    // Basic subnet check (e.g., 192.168.1.*)
    if (range.endsWith('*')) {
      const prefix = range.slice(0, -1);
      return ip.startsWith(prefix);
    }

    return false;
  }

  /**
   * Check if current time is between start and end
   */
  private isTimeBetween(current: Date, start: string, end: string): boolean {
    const currentTime = current.getHours() * 100 + current.getMinutes();
    const startTime = parseInt(start.replace(':', ''));
    const endTime = parseInt(end.replace(':', ''));

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Add a new policy
   */
  addPolicy(policy: Policy): void {
    this.policies.push(policy);
    logger.info('Policy added', { policy });
  }

  /**
   * Remove a policy
   */
  removePolicy(index: number): void {
    if (index >= 0 && index < this.policies.length) {
      const removed = this.policies.splice(index, 1);
      logger.info('Policy removed', { policy: removed[0] });
    }
  }

  /**
   * Get user permissions based on roles
   */
  getUserPermissions(user: User): Permission[] {
    const userPermissions: Permission[] = [];

    // Get permissions from user's roles
    for (const roleId of user.roles) {
      const role = this.roles.get(roleId);
      if (role) {
        userPermissions.push(...role.permissions);
      }
    }

    // Add direct user permissions
    for (const permId of user.permissions) {
      const permission = this.permissions.get(permId);
      if (permission) {
        userPermissions.push(permission);
      }
    }

    // Remove duplicates
    const uniquePermissions = userPermissions.filter(
      (perm, index, self) => index === self.findIndex(p => p.id === perm.id)
    );

    return uniquePermissions;
  }

  /**
   * Check if user has specific permission
   */
  userHasPermission(user: User, permissionId: string): boolean {
    const userPermissions = this.getUserPermissions(user);
    return userPermissions.some(perm => perm.id === permissionId);
  }

  /**
   * Express middleware for authorization
   */
  middleware(requiredAction: string, requiredResource: string) {
    return (req: any, res: any, next: any) => {
      try {
        // User should be attached by authentication middleware
        const user = req.user;
        if (!user) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_USER_CONTEXT',
          });
        }

        // Build authorization context
        const context: PolicyContext = {
          principal: user.userId,
          action: requiredAction,
          resource: requiredResource,
          environment: {
            userId: user.userId,
            userRoles: user.roles,
            ipAddress: req.ip,
            currentTime: new Date(),
            headers: req.headers,
            method: req.method,
            path: req.path,
          },
        };

        // Check authorization
        const authorized = this.authorize(context);

        if (!authorized) {
          return res.status(403).json({
            error: 'Insufficient permissions',
            code: 'INSUFFICIENT_PERMISSIONS',
            required: {
              action: requiredAction,
              resource: requiredResource,
            },
          });
        }

        next();
      } catch (error) {
        logger.error('Authorization middleware error', error as Error);
        return res.status(500).json({
          error: 'Internal authorization error',
          code: 'AUTHZ_INTERNAL_ERROR',
        });
      }
    };
  }

  /**
   * Get all policies (for admin interface)
   */
  getPolicies(): Policy[] {
    return [...this.policies];
  }

  /**
   * Get all roles (for admin interface)
   */
  getRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get all permissions (for admin interface)
   */
  getPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }
}
