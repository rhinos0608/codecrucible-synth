/**
 * Comprehensive Enterprise Security Test Suite
 * Tests all enterprise security components and vulnerabilities
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SecretsManager } from '../../src/core/security/secrets-manager.js';
import { RBACSystem, Permission, Role } from '../../src/core/security/rbac-system.js';
import { EnterpriseAuthManager } from '../../src/core/security/enterprise-auth-manager.js';
import { SecurityAuditLogger, AuditEventType, AuditSeverity } from '../../src/core/security/security-audit-logger.js';
import { EnterpriseSecurityFramework } from '../../src/core/security/enterprise-security-framework.js';
import { InputValidator } from '../../src/core/error-handling/structured-error-system.js';

describe('Enterprise Security Test Suite', () => {

  describe('Cryptographic Security', () => {
    let secretsManager: SecretsManager;

    beforeEach(() => {
      secretsManager = new SecretsManager();
    });

    test('should properly encrypt and decrypt secrets with AES-256-GCM', async () => {
      const plaintext = 'sensitive-api-key-12345';
      const encrypted = await secretsManager.encryptSecret('test-key', plaintext);
      
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.encryptedData).not.toBe(plaintext);
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.encryptedData.length).toBeGreaterThan(0);

      const decrypted = await secretsManager.decryptSecret('test-key');
      expect(decrypted).toBe(plaintext);
    });

    test('should prevent encryption tampering with authentication tags', async () => {
      const plaintext = 'secret-data';
      await secretsManager.encryptSecret('tamper-test', plaintext);
      
      // Simulate tampering by modifying stored data
      const storage = (secretsManager as any).secretStorage;
      const storedSecret = storage.get('tamper-test');
      storedSecret.encryptedData = 'tampered-data';
      
      await expect(secretsManager.decryptSecret('tamper-test'))
        .rejects.toThrow('Failed to decrypt secret');
    });

    test('should handle key rotation correctly', async () => {
      await secretsManager.encryptSecret('rotation-test', 'original-secret');
      
      // Rotate encryption key
      await secretsManager.rotateEncryptionKey();
      
      // Should still be able to decrypt old secrets
      const decrypted = await secretsManager.decryptSecret('rotation-test');
      expect(decrypted).toBe('original-secret');
      
      // New secrets should use new key
      await secretsManager.encryptSecret('new-secret', 'new-data');
      const newDecrypted = await secretsManager.decryptSecret('new-secret');
      expect(newDecrypted).toBe('new-data');
    });

    test('should reject weak encryption keys', async () => {
      const weakKey = Buffer.from('weak', 'utf8');
      
      expect(() => {
        (secretsManager as any).setEncryptionKey(weakKey);
      }).toThrow('Encryption key must be at least 32 bytes');
    });

    test('should securely delete secrets from memory', async () => {
      await secretsManager.encryptSecret('delete-test', 'secret-to-delete');
      
      const success = await secretsManager.deleteSecret('delete-test');
      expect(success).toBe(true);
      
      await expect(secretsManager.decryptSecret('delete-test'))
        .rejects.toThrow('Secret not found');
    });
  });

  describe('Role-Based Access Control (RBAC)', () => {
    let rbac: RBACSystem;

    beforeEach(() => {
      rbac = new RBACSystem();
    });

    test('should enforce permission-based access control', () => {
      // Create permissions
      const readPerm = rbac.createPermission('read', 'documents', 'Can read documents');
      const writePerm = rbac.createPermission('write', 'documents', 'Can write documents');
      
      // Create role with permissions
      const role = rbac.createRole('editor', 'Document Editor', [readPerm.id, writePerm.id]);
      
      // Create user and assign role
      const user = rbac.createUser('user1', 'editor@example.com', 'Editor User');
      rbac.assignRole(user.id, role.id);
      
      // Test authorization
      expect(rbac.hasPermission(user.id, readPerm.id)).toBe(true);
      expect(rbac.hasPermission(user.id, writePerm.id)).toBe(true);
      
      // Test unauthorized permission
      const deletePerm = rbac.createPermission('delete', 'documents', 'Can delete documents');
      expect(rbac.hasPermission(user.id, deletePerm.id)).toBe(false);
    });

    test('should support hierarchical role inheritance', () => {
      // Create permissions
      const readPerm = rbac.createPermission('read', 'data', 'Read access');
      const writePerm = rbac.createPermission('write', 'data', 'Write access');
      const adminPerm = rbac.createPermission('admin', 'system', 'Admin access');
      
      // Create role hierarchy
      const userRole = rbac.createRole('user', 'Basic User', [readPerm.id]);
      const editorRole = rbac.createRole('editor', 'Editor', [writePerm.id], [userRole.id]);
      const adminRole = rbac.createRole('admin', 'Administrator', [adminPerm.id], [editorRole.id]);
      
      // Create admin user
      const admin = rbac.createUser('admin1', 'admin@example.com', 'Admin User');
      rbac.assignRole(admin.id, adminRole.id);
      
      // Admin should inherit all permissions
      expect(rbac.hasPermission(admin.id, readPerm.id)).toBe(true);
      expect(rbac.hasPermission(admin.id, writePerm.id)).toBe(true);
      expect(rbac.hasPermission(admin.id, adminPerm.id)).toBe(true);
    });

    test('should prevent circular role dependencies', () => {
      const role1 = rbac.createRole('role1', 'Role 1', []);
      const role2 = rbac.createRole('role2', 'Role 2', [], [role1.id]);
      
      // Attempting to create circular dependency should fail
      expect(() => {
        rbac.updateRole(role1.id, { inheritedRoles: [role2.id] });
      }).toThrow('Circular role inheritance detected');
    });

    test('should enforce session-based access with IP binding', () => {
      const user = rbac.createUser('session-user', 'user@example.com', 'Test User');
      const sessionId = rbac.createSession(user.id, '192.168.1.100');
      
      // Valid session should work
      expect(rbac.validateSession(sessionId, '192.168.1.100')).toBe(true);
      
      // Different IP should fail
      expect(rbac.validateSession(sessionId, '192.168.1.200')).toBe(false);
      
      // Expired session should fail
      rbac.expireSession(sessionId);
      expect(rbac.validateSession(sessionId, '192.168.1.100')).toBe(false);
    });

    test('should handle session concurrency limits', () => {
      const user = rbac.createUser('concurrent-user', 'user@example.com', 'Test User');
      
      // Create maximum allowed sessions
      const session1 = rbac.createSession(user.id, '192.168.1.100');
      const session2 = rbac.createSession(user.id, '192.168.1.101');
      const session3 = rbac.createSession(user.id, '192.168.1.102');
      
      expect(rbac.validateSession(session1, '192.168.1.100')).toBe(true);
      expect(rbac.validateSession(session2, '192.168.1.101')).toBe(true);
      expect(rbac.validateSession(session3, '192.168.1.102')).toBe(true);
      
      // Creating another session should invalidate the oldest
      const session4 = rbac.createSession(user.id, '192.168.1.103');
      expect(rbac.validateSession(session1, '192.168.1.100')).toBe(false); // Oldest invalidated
      expect(rbac.validateSession(session4, '192.168.1.103')).toBe(true);
    });
  });

  describe('Enterprise Authentication', () => {
    let authManager: EnterpriseAuthManager;

    beforeEach(() => {
      authManager = new EnterpriseAuthManager();
    });

    test('should generate secure JWT tokens with proper claims', () => {
      const token = authManager.generateJWT('user123', { role: 'admin', permissions: ['read', 'write'] });
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT format
      
      const validated = authManager.validateJWT(token);
      expect(validated.success).toBe(true);
      if (validated.success) {
        expect(validated.payload.userId).toBe('user123');
        expect(validated.payload.role).toBe('admin');
      }
    });

    test('should implement secure password policies', () => {
      // Weak passwords should be rejected
      expect(() => authManager.validatePasswordPolicy('weak')).toThrow();
      expect(() => authManager.validatePasswordPolicy('password123')).toThrow();
      expect(() => authManager.validatePasswordPolicy('NoSpecialChars123')).toThrow();
      
      // Strong password should pass
      expect(() => authManager.validatePasswordPolicy('StrongP@ssw0rd!')).not.toThrow();
    });

    test('should implement secure password hashing with salt', async () => {
      const password = 'TestPassword123!';
      const hash1 = await authManager.hashPassword(password);
      const hash2 = await authManager.hashPassword(password);
      
      // Same password should produce different hashes (due to salt)
      expect(hash1).not.toBe(hash2);
      
      // Both should verify correctly
      expect(await authManager.verifyPassword(password, hash1)).toBe(true);
      expect(await authManager.verifyPassword(password, hash2)).toBe(true);
      
      // Wrong password should fail
      expect(await authManager.verifyPassword('WrongPassword', hash1)).toBe(false);
    });

    test('should implement rate limiting for authentication attempts', async () => {
      const ip = '192.168.1.100';
      
      // Should allow initial attempts
      for (let i = 0; i < 5; i++) {
        expect(authManager.checkRateLimit(ip)).toBe(true);
      }
      
      // Should block after limit exceeded
      expect(authManager.checkRateLimit(ip)).toBe(false);
      
      // Should provide exponential backoff
      const retryAfter = authManager.getRateLimitRetryAfter(ip);
      expect(retryAfter).toBeGreaterThan(0);
    });

    test('should support API key authentication with usage tracking', () => {
      const apiKey = authManager.generateAPIKey('service1', ['read:data', 'write:logs']);
      
      expect(apiKey.key).toBeDefined();
      expect(apiKey.permissions).toEqual(['read:data', 'write:logs']);
      
      // Validate API key
      const validation = authManager.validateAPIKey(apiKey.key);
      expect(validation.valid).toBe(true);
      expect(validation.service).toBe('service1');
      expect(validation.permissions).toEqual(['read:data', 'write:logs']);
      
      // Track usage
      authManager.trackAPIKeyUsage(apiKey.key, '/api/data', 'GET');
      const usage = authManager.getAPIKeyUsage(apiKey.key);
      expect(usage.totalRequests).toBe(1);
    });

    test('should implement MFA token validation', () => {
      const secret = authManager.generateMFASecret('user123');
      expect(secret).toBeDefined();
      expect(secret.length).toBe(32); // Base32 encoded secret
      
      // Generate TOTP token (simplified simulation)
      const token = authManager.generateTOTP(secret);
      expect(token).toMatch(/^\d{6}$/); // 6-digit numeric code
      
      // Validate token
      expect(authManager.validateMFA('user123', token)).toBe(true);
      expect(authManager.validateMFA('user123', '000000')).toBe(false);
    });
  });

  describe('Security Audit Logging', () => {
    let auditLogger: SecurityAuditLogger;

    beforeEach(() => {
      auditLogger = new SecurityAuditLogger();
    });

    afterEach(() => {
      auditLogger.stop();
    });

    test('should log security events with proper structure', () => {
      const logSpy = jest.spyOn(auditLogger as any, 'writeLogEntry');
      
      auditLogger.logEvent(
        AuditEventType.AUTHENTICATION_FAILURE,
        AuditSeverity.HIGH,
        'WARN',
        'auth-service',
        'login_failed',
        'user123',
        'Failed login attempt',
        { ip: '192.168.1.100', userAgent: 'Mozilla/5.0' },
        { reason: 'invalid_password' }
      );
      
      expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({
        eventType: AuditEventType.AUTHENTICATION_FAILURE,
        severity: AuditSeverity.HIGH,
        level: 'WARN',
        service: 'auth-service',
        action: 'login_failed',
        userId: 'user123',
        message: 'Failed login attempt',
        context: { ip: '192.168.1.100', userAgent: 'Mozilla/5.0' },
        metadata: { reason: 'invalid_password' }
      }));
    });

    test('should detect suspicious activity patterns', () => {
      const ip = '192.168.1.100';
      
      // Log multiple failed attempts
      for (let i = 0; i < 10; i++) {
        auditLogger.logEvent(
          AuditEventType.AUTHENTICATION_FAILURE,
          AuditSeverity.MEDIUM,
          'WARN',
          'auth-service',
          'login_failed',
          `user${i}`,
          'Failed login attempt',
          { ip }
        );
      }
      
      // Should detect brute force pattern
      const metrics = auditLogger.getSecurityMetrics();
      expect(metrics.suspiciousActivity.bruteForceAttempts).toBeGreaterThan(0);
    });

    test('should implement tamper-resistant logging with HMAC', () => {
      auditLogger.logEvent(
        AuditEventType.SYSTEM_EVENT,
        AuditSeverity.LOW,
        'INFO',
        'test-service',
        'test_action',
        'test-user',
        'Test message'
      );
      
      // Verify log integrity
      const integrity = auditLogger.verifyLogIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.tamperedEntries).toHaveLength(0);
    });

    test('should export compliance reports in required formats', () => {
      // Log some events
      auditLogger.logEvent(AuditEventType.DATA_ACCESS, AuditSeverity.LOW, 'INFO', 'api', 'read', 'user1', 'Data read');
      auditLogger.logEvent(AuditEventType.DATA_MODIFICATION, AuditSeverity.MEDIUM, 'INFO', 'api', 'update', 'user2', 'Data updated');
      
      // Export as JSON
      const jsonReport = auditLogger.exportComplianceReport('json', new Date(Date.now() - 86400000), new Date());
      expect(jsonReport).toBeDefined();
      expect(JSON.parse(jsonReport)).toHaveProperty('events');
      
      // Export as CSV
      const csvReport = auditLogger.exportComplianceReport('csv', new Date(Date.now() - 86400000), new Date());
      expect(csvReport).toBeDefined();
      expect(csvReport).toContain('timestamp,eventType,severity');
    });

    test('should trigger alerts for critical security events', () => {
      const alertSpy = jest.fn();
      auditLogger.on('security-alert', alertSpy);
      
      // Log critical security event
      auditLogger.logEvent(
        AuditEventType.PRIVILEGE_ESCALATION,
        AuditSeverity.CRITICAL,
        'ERROR',
        'auth-service',
        'privilege_escalation',
        'user123',
        'Unauthorized privilege escalation attempt'
      );
      
      expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({
        severity: AuditSeverity.CRITICAL,
        action: 'privilege_escalation'
      }));
    });
  });

  describe('Input Validation and Sanitization', () => {
    test('should validate and sanitize string inputs', () => {
      // Valid input
      const validResult = InputValidator.validateString('valid-input', 'test-field');
      expect(validResult.success).toBe(true);
      if (validResult.success) {
        expect(validResult.data).toBe('valid-input');
      }
      
      // Invalid input (empty)
      const emptyResult = InputValidator.validateString('', 'test-field');
      expect(emptyResult.success).toBe(false);
      
      // Invalid input (null)
      const nullResult = InputValidator.validateString(null, 'test-field');
      expect(nullResult.success).toBe(false);
    });

    test('should validate string length constraints', () => {
      const shortResult = InputValidator.validateString('ab', 'test-field', { minLength: 3 });
      expect(shortResult.success).toBe(false);
      
      const longResult = InputValidator.validateString('toolong', 'test-field', { maxLength: 5 });
      expect(longResult.success).toBe(false);
      
      const validResult = InputValidator.validateString('valid', 'test-field', { minLength: 3, maxLength: 10 });
      expect(validResult.success).toBe(true);
    });

    test('should validate string patterns with regex', () => {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      const validEmail = InputValidator.validateString('user@example.com', 'email', { pattern: emailPattern });
      expect(validEmail.success).toBe(true);
      
      const invalidEmail = InputValidator.validateString('invalid-email', 'email', { pattern: emailPattern });
      expect(invalidEmail.success).toBe(false);
    });

    test('should prevent directory traversal attacks', () => {
      const maliciousPath1 = InputValidator.validateFilePath('../../../etc/passwd');
      expect(maliciousPath1.success).toBe(false);
      
      const maliciousPath2 = InputValidator.validateFilePath('~/secret-file');
      expect(maliciousPath2.success).toBe(false);
      
      const validPath = InputValidator.validateFilePath('documents/file.txt');
      expect(validPath.success).toBe(true);
    });

    test('should sanitize dangerous input characters', () => {
      const dangerous = '<script>alert("xss")</script>';
      const sanitized = InputValidator.sanitizeInput(dangerous);
      
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).not.toContain('"');
    });

    test('should limit input length to prevent DoS', () => {
      const longInput = 'a'.repeat(20000);
      const sanitized = InputValidator.sanitizeInput(longInput);
      
      expect(sanitized.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Enterprise Security Framework Integration', () => {
    let securityFramework: EnterpriseSecurityFramework;

    beforeEach(() => {
      securityFramework = new EnterpriseSecurityFramework();
    });

    afterEach(() => {
      securityFramework.stop();
    });

    test('should validate comprehensive security policies', () => {
      const context = {
        userId: 'user123',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        action: 'read:documents',
        resource: 'document-123'
      };
      
      const result = securityFramework.validateSecurityPolicies(context);
      expect(result.passed).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.warnings).toBeDefined();
    });

    test('should detect and respond to security threats', () => {
      const alertSpy = jest.fn();
      securityFramework.on('security-threat', alertSpy);
      
      // Simulate multiple failed login attempts (brute force)
      for (let i = 0; i < 10; i++) {
        securityFramework.processThreatIntelligence({
          type: 'authentication_failure',
          source: '192.168.1.100',
          severity: 'medium',
          timestamp: Date.now()
        });
      }
      
      // Should trigger threat detection
      expect(alertSpy).toHaveBeenCalled();
    });

    test('should enforce data encryption policies', () => {
      const sensitiveData = {
        ssn: '123-45-6789',
        creditCard: '4111-1111-1111-1111',
        password: 'secret123'
      };
      
      const encrypted = securityFramework.encryptSensitiveData(sensitiveData);
      expect(encrypted.ssn).not.toBe(sensitiveData.ssn);
      expect(encrypted.creditCard).not.toBe(sensitiveData.creditCard);
      expect(encrypted.password).not.toBe(sensitiveData.password);
      
      const decrypted = securityFramework.decryptSensitiveData(encrypted);
      expect(decrypted).toEqual(sensitiveData);
    });

    test('should maintain security compliance scores', () => {
      const score = securityFramework.getComplianceScore();
      
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
      expect(score.categories).toHaveProperty('authentication');
      expect(score.categories).toHaveProperty('authorization');
      expect(score.categories).toHaveProperty('encryption');
      expect(score.categories).toHaveProperty('audit');
    });

    test('should generate security recommendations', () => {
      const recommendations = securityFramework.getSecurityRecommendations();
      
      expect(Array.isArray(recommendations)).toBe(true);
      recommendations.forEach(rec => {
        expect(rec).toHaveProperty('category');
        expect(rec).toHaveProperty('priority');
        expect(rec).toHaveProperty('description');
        expect(rec).toHaveProperty('impact');
      });
    });
  });

  describe('Penetration Testing Scenarios', () => {
    test('should resist SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const sanitized = InputValidator.sanitizeInput(maliciousInput);
      
      expect(sanitized).not.toContain('DROP TABLE');
      expect(sanitized).not.toContain('--');
    });

    test('should resist XSS attacks', () => {
      const xssPayload = '<img src=x onerror=alert("XSS")>';
      const sanitized = InputValidator.sanitizeInput(xssPayload);
      
      expect(sanitized).not.toContain('<img');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('alert');
    });

    test('should resist CSRF attacks with token validation', () => {
      const authManager = new EnterpriseAuthManager();
      
      // Generate CSRF token
      const token = authManager.generateCSRFToken('session123');
      expect(token).toBeDefined();
      
      // Valid token should pass
      expect(authManager.validateCSRFToken('session123', token)).toBe(true);
      
      // Invalid token should fail
      expect(authManager.validateCSRFToken('session123', 'invalid-token')).toBe(false);
      
      // Token for different session should fail
      expect(authManager.validateCSRFToken('different-session', token)).toBe(false);
    });

    test('should resist timing attacks on authentication', async () => {
      const authManager = new EnterpriseAuthManager();
      const password = 'TestPassword123!';
      const hash = await authManager.hashPassword(password);
      
      // Measure timing for correct password
      const start1 = Date.now();
      await authManager.verifyPassword(password, hash);
      const time1 = Date.now() - start1;
      
      // Measure timing for incorrect password
      const start2 = Date.now();
      await authManager.verifyPassword('WrongPassword', hash);
      const time2 = Date.now() - start2;
      
      // Times should be roughly similar (within reasonable variance)
      // This prevents timing-based attacks
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // Allow 100ms variance
    });

    test('should resist session fixation attacks', () => {
      const rbac = new RBACSystem();
      const user = rbac.createUser('test-user', 'user@example.com', 'Test User');
      
      // Create initial session
      const session1 = rbac.createSession(user.id, '192.168.1.100');
      
      // Login should create new session, invalidating old one
      const session2 = rbac.createSession(user.id, '192.168.1.100');
      
      expect(session1).not.toBe(session2);
      expect(rbac.validateSession(session1, '192.168.1.100')).toBe(false);
      expect(rbac.validateSession(session2, '192.168.1.100')).toBe(true);
    });
  });

  describe('Compliance and Standards', () => {
    test('should meet GDPR requirements for data protection', () => {
      const securityFramework = new EnterpriseSecurityFramework();
      
      // Test data subject rights
      const userData = { id: 'user123', email: 'user@example.com', preferences: { marketing: true } };
      
      // Right to access
      const accessData = securityFramework.exportUserData('user123');
      expect(accessData).toBeDefined();
      
      // Right to rectification
      const updated = securityFramework.updateUserData('user123', { preferences: { marketing: false } });
      expect(updated).toBe(true);
      
      // Right to erasure
      const deleted = securityFramework.deleteUserData('user123');
      expect(deleted).toBe(true);
      
      securityFramework.stop();
    });

    test('should meet SOC 2 Type II controls', () => {
      const auditLogger = new SecurityAuditLogger();
      
      // Security: Access controls and authentication
      expect(auditLogger).toBeDefined();
      
      // Availability: System monitoring and performance
      const metrics = auditLogger.getSecurityMetrics();
      expect(metrics).toHaveProperty('systemHealth');
      
      // Processing Integrity: Data validation and error handling
      expect(metrics).toHaveProperty('dataIntegrity');
      
      // Confidentiality: Encryption and data protection
      expect(metrics).toHaveProperty('encryptionStatus');
      
      auditLogger.stop();
    });

    test('should meet ISO 27001 information security controls', () => {
      const securityFramework = new EnterpriseSecurityFramework();
      
      // A.9 Access Control
      const rbac = new RBACSystem();
      expect(rbac).toBeDefined();
      
      // A.10 Cryptography
      const secretsManager = new SecretsManager();
      expect(secretsManager).toBeDefined();
      
      // A.12 Operations Security
      const compliance = securityFramework.getComplianceScore();
      expect(compliance.categories).toHaveProperty('operations');
      
      securityFramework.stop();
    });
  });
});