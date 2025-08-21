/**
 * Simple Enterprise Integration Tests
 * Tests basic integration between enterprise components
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { SecretsManager } from '../../../src/core/security/secrets-manager.js';
import { RBACSystem } from '../../../src/core/security/rbac-system.js';
import { EnterpriseAuthManager } from '../../../src/core/security/enterprise-auth-manager.js';
import { ErrorHandler } from '../../../src/core/error-handling/structured-error-system.js';

describe('Simple Enterprise Integration Tests', () => {
  let secretsManager: SecretsManager;
  let rbacSystem: RBACSystem;
  let authManager: EnterpriseAuthManager;

  beforeEach(async () => {
    secretsManager = new SecretsManager();
    rbacSystem = new RBACSystem();
    authManager = new EnterpriseAuthManager();
  });

  describe('Basic Security Integration', () => {
    test('should integrate secrets management with authentication', async () => {
      // Store a secret
      const apiKey = 'test-api-key-12345';
      await secretsManager.encryptSecret('api-key', apiKey);

      // Verify secret can be retrieved
      const decrypted = await secretsManager.decryptSecret('api-key');
      expect(decrypted).toBe(apiKey);

      // Generate JWT for access
      const token = authManager.generateJWT('test-user', { permissions: ['read:secrets'] });
      expect(token).toBeDefined();

      // Validate JWT
      const validation = authManager.validateJWT(token);
      expect(validation.success).toBe(true);
    });

    test('should integrate RBAC with authentication', async () => {
      // Create permission and role
      const readPerm = rbacSystem.createPermission('read', 'documents', 'Read access');
      const userRole = rbacSystem.createRole('user', 'Standard User', [readPerm.id]);
      
      // Create user and assign role
      const user = rbacSystem.createUser('testuser', 'test@example.com', 'Test User');
      rbacSystem.assignRole(user.id, userRole.id);

      // Verify permissions
      expect(rbacSystem.hasPermission(user.id, readPerm.id)).toBe(true);

      // Create session
      const sessionId = rbacSystem.createSession(user.id, '192.168.1.100');
      expect(rbacSystem.validateSession(sessionId, '192.168.1.100')).toBe(true);
    });

    test('should integrate error handling across systems', async () => {
      // Test error handling with wrapped function
      const wrappedFunction = ErrorHandler.wrapWithErrorHandling(
        async () => {
          throw new Error('Test error');
        }
      );

      const result = await wrappedFunction();
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.category).toBeDefined();
      }

      // Verify error statistics
      const stats = ErrorHandler.getErrorStatistics();
      expect(stats.total).toBeGreaterThan(0);
    });
  });

  describe('Enterprise Features Integration', () => {
    test('should handle enterprise authentication flow', async () => {
      // Test password validation
      expect(() => authManager.validatePasswordPolicy('weak')).toThrow();
      expect(() => authManager.validatePasswordPolicy('StrongP@ssw0rd!')).not.toThrow();

      // Test rate limiting
      const ip = '192.168.1.100';
      for (let i = 0; i < 6; i++) {
        const allowed = authManager.checkRateLimit(ip);
        if (i < 5) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }
    });

    test('should handle role hierarchy', async () => {
      // Create permission hierarchy
      const readPerm = rbacSystem.createPermission('read', 'data', 'Read data');
      const writePerm = rbacSystem.createPermission('write', 'data', 'Write data');
      const adminPerm = rbacSystem.createPermission('admin', 'system', 'Admin access');

      // Create role hierarchy
      const userRole = rbacSystem.createRole('user', 'Basic User', [readPerm.id]);
      const editorRole = rbacSystem.createRole('editor', 'Editor', [writePerm.id], [userRole.id]);
      const adminRole = rbacSystem.createRole('admin', 'Administrator', [adminPerm.id], [editorRole.id]);

      // Create admin user
      const admin = rbacSystem.createUser('admin', 'admin@example.com', 'Admin User');
      rbacSystem.assignRole(admin.id, adminRole.id);

      // Admin should inherit all permissions
      expect(rbacSystem.hasPermission(admin.id, readPerm.id)).toBe(true);
      expect(rbacSystem.hasPermission(admin.id, writePerm.id)).toBe(true);
      expect(rbacSystem.hasPermission(admin.id, adminPerm.id)).toBe(true);
    });

    test('should handle concurrent operations safely', async () => {
      const operations = [];
      
      // Create multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(
          secretsManager.encryptSecret(`secret-${i}`, `value-${i}`),
          Promise.resolve(rbacSystem.createUser(`user-${i}`, `user${i}@test.com`, `User ${i}`)),
          Promise.resolve(authManager.generateJWT(`user-${i}`, { test: true }))
        );
      }

      // Execute all operations
      const results = await Promise.allSettled(operations);
      
      // Most should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(20); // At least 2/3 should succeed
    });
  });
});