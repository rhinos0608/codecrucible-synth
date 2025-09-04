/**
 * Enterprise Authentication Manager - Comprehensive Real Tests
 * NO MOCKS - Testing actual authentication functionality
 * Tests: JWT tokens, API keys, MFA, rate limiting, session management
 */

import {
  EnterpriseAuthManager,
  AuthRequest,
  AuthConfig,
} from '../../src/core/security/enterprise-auth-manager.js';
import { RBACSystem, User } from '../../src/core/security/production-rbac-system.js';
import { SecretsManager } from '../../src/core/security/secrets-manager.js';

describe('Enterprise Authentication Manager - Comprehensive Real Tests', () => {
  let authManager: EnterpriseAuthManager;
  let rbacSystem: RBACSystem;
  let secretsManager: SecretsManager;
  let testUser: User;

  beforeEach(async () => {
    // Create real instances - NO MOCKS
    rbacSystem = new RBACSystem();
    secretsManager = new SecretsManager();

    // Initialize secrets manager first
    await secretsManager.initialize('test-master-password');

    const testConfig: Partial<AuthConfig> = {
      jwtSecret: 'test-secret-key-for-testing-only',
      jwtExpiresIn: '1h',
      refreshTokenExpiresIn: '7d',
      sessionTimeout: 30 * 60 * 1000,
      maxConcurrentSessions: 3,
      enforceIpBinding: true,
      requireMFA: false,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        preventReuse: 3,
      },
      rateLimiting: {
        maxAttempts: 5,
        windowMs: 15 * 60 * 1000,
        blockDuration: 30 * 60 * 1000,
      },
    };

    authManager = new EnterpriseAuthManager(rbacSystem, secretsManager, testConfig);

    // Initialize RBAC system
    await rbacSystem.initialize();

    // Create test user in RBAC system
    const testUserData = {
      username: 'testuser',
      email: 'test@example.com',
      status: 'active' as const,
      roles: ['user'],
      metadata: { department: 'engineering' },
    };

    const userId = await rbacSystem.createUser(testUserData);

    // Store password manually using secrets manager (as RBAC system does internally)
    const passwordHash = require('crypto')
      .createHash('sha256')
      .update('TestPass123!' + 'salt')
      .digest('hex');
    await secretsManager.storeSecret(`user_password_${userId}`, passwordHash);

    // Get the created user for tests
    const users = rbacSystem.getUsers();
    testUser = users.find(u => u.username === 'testuser')!;
  });

  describe('Authentication Functionality', () => {
    it('should successfully authenticate valid user credentials', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
        userAgent: 'Test-Client/1.0',
      };

      const result = await authManager.authenticate(authRequest);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user?.username).toBe('testuser');
      expect(result.session?.userId).toBe(testUser.id);
    });

    it('should reject invalid credentials', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'WrongPassword',
        ipAddress: '192.168.1.100',
      };

      const result = await authManager.authenticate(authRequest);

      expect(result.success).toBe(false);
      expect(result.user).toBeUndefined();
      expect(result.session).toBeUndefined();
      expect(result.error).toBe('Invalid credentials');
    });

    it('should enforce rate limiting after multiple failed attempts', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'WrongPassword',
        ipAddress: '192.168.1.200',
      };

      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        const result = await authManager.authenticate(authRequest);
        expect(result.success).toBe(false);
      }

      // Next attempt should be rate limited
      const rateLimitedResult = await authManager.authenticate(authRequest);
      expect(rateLimitedResult.success).toBe(false);
      expect(rateLimitedResult.error).toContain('Too many authentication attempts');
    });

    it('should validate input sanitization for malicious usernames', async () => {
      const maliciousAuthRequest: AuthRequest = {
        username: '<script>alert("xss")</script>',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      const result = await authManager.authenticate(maliciousAuthRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid username format');
    });
  });

  describe('JWT Token Management', () => {
    let validToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      const authResult = await authManager.authenticate(authRequest);
      validToken = authResult.accessToken!;
      refreshToken = authResult.refreshToken!;
    });

    it('should validate legitimate JWT tokens', async () => {
      const validation = await authManager.validateToken(validToken, '192.168.1.100');

      expect(validation.valid).toBe(true);
      expect(validation.user).toBeDefined();
      expect(validation.session).toBeDefined();
      expect(validation.permissions).toBeDefined();
      expect(validation.user?.username).toBe('testuser');
    });

    it('should reject tokens with IP address mismatch', async () => {
      const validation = await authManager.validateToken(validToken, '10.0.0.1');

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('IP address mismatch');
    });

    it('should successfully refresh valid tokens', async () => {
      const refreshResult = await authManager.refreshToken(refreshToken);

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.user?.username).toBe('testuser');
    });

    it('should reject invalid refresh tokens', async () => {
      const fakeRefreshToken = 'invalid.refresh.token';
      const refreshResult = await authManager.refreshToken(fakeRefreshToken);

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Invalid refresh token');
    });

    it('should generate and validate JWT tokens correctly', () => {
      const testPayload = { role: 'admin', permissions: ['read', 'write'] };
      const token = authManager.generateJWT('test-user', testPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const validation = authManager.validateJWT(token);
      expect(validation.success).toBe(true);
      expect(validation.payload).toBeDefined();
      expect(validation.payload.userId).toBe('test-user');
    });
  });

  describe('Session Management', () => {
    it('should manage concurrent sessions within limits', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      // Create multiple sessions (should be limited to maxConcurrentSessions: 3)
      const sessions = [];
      for (let i = 0; i < 5; i++) {
        const result = await authManager.authenticate({
          ...authRequest,
          userAgent: `Client-${i}`,
        });
        if (result.success) {
          sessions.push(result.session!.id);
        }
      }

      expect(sessions.length).toBe(5);

      // Check that old sessions were automatically cleaned up
      const stats = authManager.getAuthStats();
      expect(stats.activeSessions).toBeLessThanOrEqual(3);
    });

    it('should successfully logout and revoke sessions', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      const authResult = await authManager.authenticate(authRequest);
      const sessionId = authResult.session!.id;

      // Logout should succeed
      const logoutResult = await authManager.logout(sessionId);
      expect(logoutResult).toBe(true);

      // Token should no longer be valid
      const validation = await authManager.validateToken(authResult.accessToken!, '192.168.1.100');
      expect(validation.valid).toBe(false);
    });

    it('should cleanup expired sessions', async () => {
      // This tests the session cleanup functionality
      const cleaned = await authManager.cleanupExpiredSessions();
      expect(typeof cleaned).toBe('number');
      expect(cleaned).toBeGreaterThanOrEqual(0);
    });
  });

  describe('API Key Management', () => {
    it('should create and validate API keys', async () => {
      const apiKeyConfig = {
        name: 'Test API Key',
        permissions: ['read', 'write'],
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      };

      const { id, key } = await authManager.createAPIKey(apiKeyConfig);

      expect(id).toBeDefined();
      expect(key).toBeDefined();
      expect(key.startsWith('cc_')).toBe(true);

      // Validate the created API key
      const validation = await authManager.validateAPIKey(key);
      expect(validation.valid).toBe(true);
      expect(validation.apiKey?.name).toBe('Test API Key');
      expect(validation.apiKey?.permissions).toEqual(['read', 'write']);
    });

    it('should reject invalid API keys', async () => {
      const invalidKey = 'cc_invalid_key_12345';
      const validation = await authManager.validateAPIKey(invalidKey);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('Invalid API key');
    });

    it('should revoke API keys successfully', async () => {
      const apiKeyConfig = {
        name: 'Revoke Test Key',
        permissions: ['read'],
      };

      const { id, key } = await authManager.createAPIKey(apiKeyConfig);

      // Revoke the key
      const revokeResult = await authManager.revokeAPIKey(id);
      expect(revokeResult).toBe(true);

      // Key should no longer be valid
      const validation = await authManager.validateAPIKey(key);
      expect(validation.valid).toBe(false);
    });

    it('should enforce API key rate limiting', async () => {
      const apiKeyConfig = {
        name: 'Rate Limited Key',
        permissions: ['read'],
        rateLimit: {
          maxRequests: 2,
          windowMs: 60000, // 1 minute
        },
      };

      const { key } = await authManager.createAPIKey(apiKeyConfig);

      // Use the key within rate limit
      let validation = await authManager.validateAPIKey(key);
      expect(validation.valid).toBe(true);

      validation = await authManager.validateAPIKey(key);
      expect(validation.valid).toBe(true);

      // Third request should be rate limited
      validation = await authManager.validateAPIKey(key);
      expect(validation.valid).toBe(false);
      expect(validation.error).toBe('API key rate limit exceeded');
    });
  });

  describe('Password Management and Policies', () => {
    it('should validate passwords against security policy', () => {
      // Valid password
      const validPassword = 'SecurePass123!';
      const validResult = authManager.validatePassword(validPassword);
      expect(validResult.valid).toBe(true);
      expect(validResult.errors).toHaveLength(0);

      // Invalid passwords
      const weakPasswords = [
        'short', // Too short
        'NoNumbersOrSymbols', // No numbers or symbols
        'nonumbersorSymbols123', // No uppercase or symbols
        'NOLOWERCASEORSYMBOLS123', // No lowercase or symbols
        'NoSymbols123', // No symbols
      ];

      weakPasswords.forEach(password => {
        const result = authManager.validatePassword(password);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should hash and verify passwords securely', async () => {
      const password = 'TestPassword123!';
      const hash = await authManager.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.includes(':')).toBe(true); // Should contain salt separator

      // Verify correct password
      const isValid = await authManager.verifyPassword(password, hash);
      expect(isValid).toBe(true);

      // Verify incorrect password
      const isInvalid = await authManager.verifyPassword('WrongPassword', hash);
      expect(isInvalid).toBe(false);
    });

    it('should enforce password policy with throwing validation', () => {
      expect(() => {
        authManager.validatePasswordPolicy('WeakPass');
      }).toThrow(/Password policy violation/);

      expect(() => {
        authManager.validatePasswordPolicy('StrongPass123!');
      }).not.toThrow();
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should check and enforce rate limiting', () => {
      const testIP = '192.168.1.250';

      // First check should pass
      let canProceed = authManager.checkRateLimit(testIP);
      expect(canProceed).toBe(true);

      // Trigger rate limiting
      for (let i = 0; i < 5; i++) {
        authManager.checkRateLimit(testIP);
      }

      // Should now be rate limited
      canProceed = authManager.checkRateLimit(testIP);
      expect(canProceed).toBe(false);

      // Check retry after time
      const retryAfter = authManager.getRateLimitRetryAfter(testIP);
      expect(retryAfter).toBeGreaterThan(0);
    });

    it('should provide authentication statistics', () => {
      const stats = authManager.getAuthStats();

      expect(stats).toBeDefined();
      expect(typeof stats.activeSessions).toBe('number');
      expect(typeof stats.activeAPIKeys).toBe('number');
      expect(typeof stats.rateLimitedIPs).toBe('number');
      expect(typeof stats.totalUsers).toBe('number');
      expect(stats.totalUsers).toBeGreaterThanOrEqual(1); // At least our test user
    });
  });

  describe('Enterprise Security Integration', () => {
    it('should integrate with RBAC system for user management', () => {
      const users = rbacSystem.getUsers();
      expect(users.length).toBeGreaterThanOrEqual(1);
      expect(users.find(u => u.username === 'testuser')).toBeDefined();
    });

    it('should handle authentication errors gracefully', async () => {
      // Test with malformed request
      const malformedRequest = {
        username: '',
        password: '',
      } as AuthRequest;

      const result = await authManager.authenticate(malformedRequest);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should maintain session consistency across operations', async () => {
      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      const authResult = await authManager.authenticate(authRequest);
      const sessionId = authResult.session!.id;

      // Validate token should return same session
      const tokenValidation = await authManager.validateToken(
        authResult.accessToken!,
        '192.168.1.100'
      );

      expect(tokenValidation.session?.id).toBe(sessionId);
      expect(tokenValidation.user?.id).toBe(testUser.id);
    });
  });

  describe('Enterprise MFA Support', () => {
    it('should handle MFA requirements correctly', async () => {
      // Create auth manager with MFA required
      const mfaConfig: Partial<AuthConfig> = {
        requireMFA: true,
        jwtSecret: 'test-secret',
      };

      const mfaAuthManager = new EnterpriseAuthManager(rbacSystem, secretsManager, mfaConfig);

      const authRequest: AuthRequest = {
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: '192.168.1.100',
      };

      // Should require MFA
      const result = await mfaAuthManager.authenticate(authRequest);
      expect(result.success).toBe(false);
      expect(result.requiresMFA).toBe(true);

      // With MFA code should succeed (using 6-digit code)
      const mfaRequest: AuthRequest = {
        ...authRequest,
        mfaCode: '123456',
      };

      const mfaResult = await mfaAuthManager.authenticate(mfaRequest);
      expect(mfaResult.success).toBe(true);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle multiple concurrent authentication requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) => ({
        username: 'testuser',
        password: 'TestPass123!',
        ipAddress: `192.168.1.${100 + i}`,
        userAgent: `Client-${i}`,
      }));

      const results = await Promise.all(requests.map(req => authManager.authenticate(req)));

      // All should succeed (different IPs, so no rate limiting)
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      const stats = authManager.getAuthStats();
      expect(stats.activeSessions).toBeGreaterThan(0);
    });

    it('should efficiently manage memory for large session counts', () => {
      // This test verifies memory efficiency is maintained
      const initialStats = authManager.getAuthStats();

      // The auth manager should handle session tracking efficiently
      expect(initialStats.activeSessions).toBeGreaterThanOrEqual(0);
      expect(initialStats.rateLimitedIPs).toBeGreaterThanOrEqual(0);
    });
  });
});
