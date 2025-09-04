/**
 * Critical Security Tests - JWT Authenticator
 * Following Living Spiral Methodology - Security Guardian Perspective
 *
 * Test Coverage Areas:
 * - Token validation and signature verification
 * - Expiration handling and clock tolerance
 * - Refresh token rotation and security
 * - Session management and cleanup
 * - Malformed token handling
 * - Security attack scenarios (replay, timing, brute force)
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { JWTAuthenticator } from '../../../../src/core/auth/jwt-authenticator.js';
import { AuthConfig, User, AuthResult } from '../../../../src/core/auth/auth-types.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('JWTAuthenticator - Critical Security Tests', () => {
  let authenticator: JWTAuthenticator;
  let config: AuthConfig;
  let testUser: User;

  beforeEach(() => {
    // Secure test configuration
    config = {
      jwtSecret: 'test-secret-key-minimum-32-characters-for-security',
      refreshSecret: 'test-refresh-secret-key-minimum-32-characters',
      accessTokenTTL: 3600, // 1 hour
      refreshTokenTTL: 86400 * 7, // 7 days
      algorithms: ['HS256'],
      clockTolerance: 30,
      maxConcurrentSessions: 5,
      requireMFA: false,
      sessionTimeout: 86400,
    };

    testUser = {
      id: 'test-user-123',
      email: 'test@example.com',
      roles: ['user'],
      permissions: ['read'],
      isActive: true,
      lastLoginAt: new Date(),
      createdAt: new Date(),
    };

    authenticator = new JWTAuthenticator(config);

    // Clear all timers to prevent test interference
    jest.clearAllTimers();
  });

  afterEach(() => {
    // Cleanup any intervals created by the authenticator
    if (authenticator) {
      (authenticator as any).cleanupIntervalId &&
        clearInterval((authenticator as any).cleanupIntervalId);
    }
    jest.clearAllTimers();
  });

  describe('Token Generation Security', () => {
    it('should generate secure JWT tokens with proper structure', async () => {
      const result = await authenticator.generateTokens(testUser, '127.0.0.1', 'test-agent');

      expect(result.success).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.sessionId).toBeDefined();

      // Verify token structure
      const decoded = jwt.decode(result.accessToken!) as any;
      expect(decoded.sub).toBe(testUser.id);
      expect(decoded.email).toBe(testUser.email);
      expect(decoded.roles).toEqual(testUser.roles);
      expect(decoded.iat).toBeDefined();
      expect(decoded.exp).toBeDefined();
      expect(decoded.sessionId).toBeDefined();
    });

    it('should generate unique session IDs for concurrent logins', async () => {
      const results = await Promise.all([
        authenticator.generateTokens(testUser, '127.0.0.1', 'agent1'),
        authenticator.generateTokens(testUser, '127.0.0.2', 'agent2'),
        authenticator.generateTokens(testUser, '127.0.0.3', 'agent3'),
      ]);

      const sessionIds = results.map(r => r.sessionId);
      const uniqueIds = new Set(sessionIds);

      expect(uniqueIds.size).toBe(3);
      expect(sessionIds.every(id => id && id.length > 0)).toBe(true);
    });

    it('should enforce session limits to prevent resource exhaustion', async () => {
      const promises = [];

      // Generate max allowed sessions
      for (let i = 0; i < config.maxConcurrentSessions!; i++) {
        promises.push(authenticator.generateTokens(testUser, `127.0.0.${i}`, `agent${i}`));
      }

      const results = await Promise.all(promises);
      expect(results.every(r => r.success)).toBe(true);

      // Attempt to exceed limit
      const exceededResult = await authenticator.generateTokens(
        testUser,
        '192.168.1.1',
        'excess-agent'
      );

      expect(exceededResult.success).toBe(false);
      expect(exceededResult.error).toContain('session limit');
    });
  });

  describe('Token Validation Security', () => {
    let validToken: string;
    let sessionId: string;

    beforeEach(async () => {
      const result = await authenticator.generateTokens(testUser, '127.0.0.1', 'test-agent');
      validToken = result.accessToken!;
      sessionId = result.sessionId!;
    });

    it('should validate authentic tokens successfully', async () => {
      const validation = await authenticator.validateToken(validToken);

      expect(validation.valid).toBe(true);
      expect(validation.payload?.sub).toBe(testUser.id);
      expect(validation.payload?.sessionId).toBe(sessionId);
      expect(validation.error).toBeUndefined();
    });

    it('should reject tokens with invalid signatures', async () => {
      // Tamper with token signature
      const tamperedToken = validToken.slice(0, -5) + 'XXXXX';

      const validation = await authenticator.validateToken(tamperedToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('invalid signature');
      expect(validation.payload).toBeUndefined();
    });

    it('should reject expired tokens', async () => {
      // Create token with immediate expiration
      const expiredPayload = {
        sub: testUser.id,
        email: testUser.email,
        roles: testUser.roles,
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1, // 1 second ago
        sessionId: crypto.randomUUID(),
      };

      const expiredToken = jwt.sign(expiredPayload, config.jwtSecret);
      const validation = await authenticator.validateToken(expiredToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('expired');
    });

    it('should respect clock tolerance for near-expired tokens', async () => {
      const tolerance = config.clockTolerance!;

      // Create token expiring within tolerance window
      const nearExpiredPayload = {
        sub: testUser.id,
        email: testUser.email,
        roles: testUser.roles,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) - (tolerance - 10), // Within tolerance
        sessionId: crypto.randomUUID(),
      };

      const nearExpiredToken = jwt.sign(nearExpiredPayload, config.jwtSecret);
      const validation = await authenticator.validateToken(nearExpiredToken);

      expect(validation.valid).toBe(true);
    });

    it('should reject malformed tokens', async () => {
      const malformedTokens = [
        'not-a-jwt-token',
        'malformed.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid-payload.signature',
        '',
        null,
        undefined,
        'Bearer valid-token-but-with-bearer-prefix',
      ];

      for (const token of malformedTokens) {
        const validation = await authenticator.validateToken(token as any);
        expect(validation.valid).toBe(false);
        expect(validation.error).toBeDefined();
      }
    });

    it('should reject blacklisted tokens', async () => {
      // First validate token is valid
      let validation = await authenticator.validateToken(validToken);
      expect(validation.valid).toBe(true);

      // Blacklist the token
      await authenticator.revokeToken(validToken);

      // Now validation should fail
      validation = await authenticator.validateToken(validToken);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('blacklisted');
    });
  });

  describe('Refresh Token Security', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      const result = await authenticator.generateTokens(testUser, '127.0.0.1', 'test-agent');
      accessToken = result.accessToken!;
      refreshToken = result.refreshToken!;
    });

    it('should successfully refresh valid tokens', async () => {
      const refreshResult = await authenticator.refreshTokens(refreshToken);

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();

      // New tokens should be different from original
      expect(refreshResult.accessToken).not.toBe(accessToken);
      expect(refreshResult.refreshToken).not.toBe(refreshToken);
    });

    it('should invalidate old refresh token after use (rotation)', async () => {
      // Use refresh token once
      const refreshResult = await authenticator.refreshTokens(refreshToken);
      expect(refreshResult.success).toBe(true);

      // Attempt to reuse old refresh token (should fail)
      const reuseResult = await authenticator.refreshTokens(refreshToken);
      expect(reuseResult.success).toBe(false);
      expect(reuseResult.error).toContain('invalid');
    });

    it('should reject expired refresh tokens', async () => {
      // Create expired refresh token
      const expiredRefreshPayload = {
        sub: testUser.id,
        type: 'refresh',
        family: crypto.randomUUID(),
        iat: Math.floor(Date.now() / 1000) - 86400 * 8, // 8 days ago
        exp: Math.floor(Date.now() / 1000) - 1, // Expired
      };

      const expiredRefreshToken = jwt.sign(expiredRefreshPayload, config.refreshSecret);
      const refreshResult = await authenticator.refreshTokens(expiredRefreshToken);

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toContain('expired');
    });

    it('should reject malformed refresh tokens', async () => {
      const malformedTokens = [
        'invalid-refresh-token',
        accessToken, // Using access token as refresh token
        'eyJhbGciOiJIUzI1NiJ9.invalid.signature',
      ];

      for (const token of malformedTokens) {
        const refreshResult = await authenticator.refreshTokens(token);
        expect(refreshResult.success).toBe(false);
      }
    });
  });

  describe('Session Management Security', () => {
    it('should track and manage user sessions', async () => {
      const session1 = await authenticator.generateTokens(testUser, '127.0.0.1', 'agent1');
      const session2 = await authenticator.generateTokens(testUser, '127.0.0.2', 'agent2');

      const sessions = await authenticator.getUserSessions(testUser.id);

      expect(sessions.length).toBe(2);
      expect(sessions.map(s => s.id)).toContain(session1.sessionId);
      expect(sessions.map(s => s.id)).toContain(session2.sessionId);
    });

    it('should cleanup expired sessions automatically', async () => {
      // Create session with short TTL
      const shortLivedConfig = { ...config, sessionTimeout: 1 }; // 1 second
      const shortLivedAuth = new JWTAuthenticator(shortLivedConfig);

      await shortLivedAuth.generateTokens(testUser, '127.0.0.1', 'test');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Trigger cleanup
      await (shortLivedAuth as any).cleanupExpiredSessions();

      const sessions = await shortLivedAuth.getUserSessions(testUser.id);
      expect(sessions.length).toBe(0);
    });

    it('should revoke all user sessions on security event', async () => {
      // Create multiple sessions
      await authenticator.generateTokens(testUser, '127.0.0.1', 'agent1');
      await authenticator.generateTokens(testUser, '127.0.0.2', 'agent2');

      let sessions = await authenticator.getUserSessions(testUser.id);
      expect(sessions.length).toBe(2);

      // Revoke all sessions
      await authenticator.revokeAllUserSessions(testUser.id);

      sessions = await authenticator.getUserSessions(testUser.id);
      expect(sessions.length).toBe(0);
    });
  });

  describe('Security Attack Prevention', () => {
    it('should prevent timing attacks on token validation', async () => {
      const validToken = (await authenticator.generateTokens(testUser, '127.0.0.1', 'test'))
        .accessToken!;

      const invalidTokens = [
        'completely-invalid-token',
        validToken.slice(0, -1) + 'X', // Slightly modified
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
      ];

      // Measure timing for valid vs invalid tokens
      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = process.hrtime.bigint();
        await authenticator.validateToken(i % 2 === 0 ? validToken : invalidTokens[i % 3]);
        const end = process.hrtime.bigint();
        times.push(Number(end - start) / 1000000); // Convert to milliseconds
      }

      // Check that validation times don't vary significantly
      // This is a basic timing attack prevention check
      const avgTime = times.reduce((a, b) => a + b) / times.length;
      const maxVariation = Math.max(...times.map(t => Math.abs(t - avgTime)));

      expect(maxVariation).toBeLessThan(avgTime * 0.5); // Less than 50% variation
    });

    it('should handle high-frequency validation attempts gracefully', async () => {
      const validToken = (await authenticator.generateTokens(testUser, '127.0.0.1', 'test'))
        .accessToken!;

      // Simulate rapid validation attempts
      const promises = Array(100)
        .fill(null)
        .map(() => authenticator.validateToken(validToken));

      const results = await Promise.allSettled(promises);

      // All should complete without throwing errors
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
      expect(results.every(r => r.status === 'fulfilled' && (r.value as any).valid)).toBe(true);
    });

    it('should prevent JWT algorithm confusion attacks', async () => {
      // Create token with 'none' algorithm
      const noneAlgPayload = {
        sub: testUser.id,
        exp: Math.floor(Date.now() / 1000) + 3600,
        alg: 'none',
      };

      const noneAlgToken = jwt.sign(noneAlgPayload, '', { algorithm: 'none' });
      const validation = await authenticator.validateToken(noneAlgToken);

      expect(validation.valid).toBe(false);
      expect(validation.error).toBeDefined();
    });
  });

  describe('Configuration Security', () => {
    it('should enforce minimum security standards for secrets', () => {
      const weakConfigs = [
        { ...config, jwtSecret: 'weak' },
        { ...config, refreshSecret: 'short' },
        { ...config, jwtSecret: '' },
      ];

      for (const weakConfig of weakConfigs) {
        expect(() => new JWTAuthenticator(weakConfig)).toThrow();
      }
    });

    it('should validate algorithm whitelist', async () => {
      const restrictedConfig = {
        ...config,
        algorithms: ['HS256'], // Only allow HS256
      };

      const restrictedAuth = new JWTAuthenticator(restrictedConfig);

      // Create token with different algorithm
      const rsaToken = jwt.sign(
        { sub: testUser.id, exp: Math.floor(Date.now() / 1000) + 3600 },
        'rsa-private-key',
        { algorithm: 'RS256' }
      );

      const validation = await restrictedAuth.validateToken(rsaToken);
      expect(validation.valid).toBe(false);
    });
  });
});
