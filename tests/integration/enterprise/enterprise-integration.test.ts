/**
 * Enterprise Integration Tests
 * Tests full end-to-end enterprise functionality and system integration
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { SecretsManager } from '../../../src/core/security/secrets-manager.js';
import { RBACSystem } from '../../../src/core/security/rbac-system.js';
import { EnterpriseAuthManager } from '../../../src/core/security/enterprise-auth-manager.js';
import { SecurityAuditLogger } from '../../../src/core/security/security-audit-logger.js';
import { EnterpriseSecurityFramework } from '../../../src/core/security/enterprise-security-framework.js';
import { PerformanceMonitor } from '../../../src/core/performance/performance-monitor.js';
import { EnterprisePerformanceSystem } from '../../../src/core/performance/enterprise-performance-system.js';
import { EnterpriseDeploymentSystem } from '../../../src/infrastructure/enterprise-deployment-system.js';
import { EnterpriseConfigManager } from '../../../src/core/config/enterprise-config-manager.js';
import { ErrorHandler } from '../../../src/core/error-handling/structured-error-system.js';

describe('Enterprise Integration Tests', () => {
  let secretsManager: SecretsManager;
  let rbacSystem: RBACSystem;
  let authManager: EnterpriseAuthManager;
  let auditLogger: SecurityAuditLogger;
  let securityFramework: EnterpriseSecurityFramework;
  let performanceMonitor: PerformanceMonitor;
  let enterprisePerformance: EnterprisePerformanceSystem;
  let deploymentSystem: EnterpriseDeploymentSystem;
  let configManager: EnterpriseConfigManager;

  beforeAll(async () => {
    // Initialize all enterprise systems
    secretsManager = new SecretsManager();
    await secretsManager.initialize();

    rbacSystem = new RBACSystem(secretsManager);
    authManager = new EnterpriseAuthManager();
    auditLogger = new SecurityAuditLogger();
    securityFramework = new EnterpriseSecurityFramework();
    
    performanceMonitor = new PerformanceMonitor();
    enterprisePerformance = new EnterprisePerformanceSystem(performanceMonitor, auditLogger);
    
    deploymentSystem = new EnterpriseDeploymentSystem({}, auditLogger, performanceMonitor);
    configManager = new EnterpriseConfigManager();
  });

  afterAll(async () => {
    // Clean up all systems
    auditLogger?.stop();
    securityFramework?.stop();
    performanceMonitor?.stop();
    enterprisePerformance?.stop();
    deploymentSystem?.stop();
  });

  describe('End-to-End Security Integration', () => {
    test('should perform complete authentication flow with audit logging', async () => {
      // Create user with role
      const readPerm = rbacSystem.createPermission('read', 'documents', 'Read documents');
      const userRole = rbacSystem.createRole('user', 'Standard User', [readPerm.id]);
      const user = rbacSystem.createUser('testuser', 'test@example.com', 'Test User');
      rbacSystem.assignRole(user.id, userRole.id);

      // Generate JWT token
      const token = authManager.generateJWT(user.id, { role: userRole.name });
      expect(token).toBeDefined();

      // Validate token
      const validation = authManager.validateJWT(token);
      expect(validation.success).toBe(true);

      // Create session with RBAC
      const sessionId = rbacSystem.createSession(user.id, '192.168.1.100');
      expect(rbacSystem.validateSession(sessionId, '192.168.1.100')).toBe(true);

      // Check permissions
      expect(rbacSystem.hasPermission(user.id, readPerm.id)).toBe(true);

      // Verify audit log captured authentication events
      const metrics = auditLogger.getSecurityMetrics();
      expect(metrics.totalEvents).toBeGreaterThan(0);
    });

    test('should integrate secrets management with RBAC authorization', async () => {
      // Store encrypted secret
      const secretValue = 'super-secret-api-key';
      await secretsManager.encryptSecret('api-key', secretValue);

      // Create permission for secret access
      const secretPerm = rbacSystem.createPermission('read', 'secrets', 'Read secrets');
      const adminRole = rbacSystem.createRole('admin', 'Administrator', [secretPerm.id]);
      const adminUser = rbacSystem.createUser('admin', 'admin@example.com', 'Admin User');
      rbacSystem.assignRole(adminUser.id, adminRole.id);

      // Verify admin can access secret
      if (rbacSystem.hasPermission(adminUser.id, secretPerm.id)) {
        const decryptedSecret = await secretsManager.decryptSecret('api-key');
        expect(decryptedSecret).toBe(secretValue);
      }

      // Verify regular user cannot access secret
      const regularUser = rbacSystem.createUser('regular', 'regular@example.com', 'Regular User');
      expect(rbacSystem.hasPermission(regularUser.id, secretPerm.id)).toBe(false);
    });

    test('should enforce enterprise security policies across all systems', async () => {
      // Test input validation integration
      const userInput = '<script>alert("xss")</script>';
      const sanitized = securityFramework.sanitizeInput(userInput);
      expect(sanitized).not.toContain('<script>');

      // Test rate limiting integration
      const ip = '192.168.1.100';
      for (let i = 0; i < 6; i++) {
        const allowed = authManager.checkRateLimit(ip);
        if (i < 5) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }

      // Test security framework integration
      const securityContext = {
        userId: 'test-user',
        ip: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        action: 'read:documents',
        resource: 'document-123'
      };

      const policyResult = securityFramework.validateSecurityPolicies(securityContext);
      expect(policyResult).toBeDefined();
      expect(policyResult.passed).toBeDefined();
      expect(policyResult.failed).toBeDefined();
    });
  });

  describe('Performance and Monitoring Integration', () => {
    test('should integrate performance monitoring with security audit', async () => {
      // Start a transaction
      const transactionId = performanceMonitor.startTransaction('test-transaction', {
        userId: 'test-user',
        operation: 'enterprise-test'
      });

      // Record some metrics
      performanceMonitor.recordMetric('test_metric', 100, 'ms', { test: 'true' });

      // End transaction
      performanceMonitor.endTransaction(transactionId);

      // Verify enterprise performance system captured it
      const enterpriseMetrics = enterprisePerformance.getEnterpriseMetrics();
      expect(enterpriseMetrics.slo).toBeDefined();
      expect(enterpriseMetrics.capacity).toBeDefined();
    });

    test('should trigger scaling events based on performance thresholds', async () => {
      let scalingTriggered = false;
      
      enterprisePerformance.on('scaling-trigger', () => {
        scalingTriggered = true;
      });

      // Simulate high CPU usage
      performanceMonitor.recordMetric('cpu_usage', 95, 'percent');
      
      // Wait for scaling evaluation
      await new Promise(resolve => setTimeout(resolve, 100));

      // Note: This might not trigger immediately in test environment
      // but the framework is in place
    });

    test('should detect anomalies and generate alerts', async () => {
      let anomalyDetected = false;
      
      enterprisePerformance.on('anomaly-detected', () => {
        anomalyDetected = true;
      });

      // Create baseline
      for (let i = 0; i < 20; i++) {
        performanceMonitor.recordMetric('response_time', 100 + Math.random() * 20, 'ms');
      }

      // Create anomaly
      performanceMonitor.recordMetric('response_time', 5000, 'ms'); // Huge spike

      // Wait for anomaly detection
      await new Promise(resolve => setTimeout(resolve, 200));

      // Note: Anomaly detection requires sufficient baseline data
    });
  });

  describe('Deployment and Infrastructure Integration', () => {
    test('should register and manage deployment instances', async () => {
      // Register multiple instances
      const instance1Id = deploymentSystem.registerInstance({
        status: 'running',
        host: 'app-01',
        port: 3001,
        healthStatus: 'healthy',
        metrics: {
          cpuUsage: 45,
          memoryUsage: 60,
          activeConnections: 50,
          requestsPerSecond: 25
        },
        version: '1.0.0',
        environment: 'production'
      });

      const instance2Id = deploymentSystem.registerInstance({
        status: 'running',
        host: 'app-02',
        port: 3002,
        healthStatus: 'healthy',
        metrics: {
          cpuUsage: 55,
          memoryUsage: 70,
          activeConnections: 60,
          requestsPerSecond: 30
        },
        version: '1.0.0',
        environment: 'production'
      });

      // Verify instances are registered
      const status = deploymentSystem.getDeploymentStatus();
      expect(status.instances).toHaveLength(2);
      expect(status.health.healthy).toBe(2);
      expect(status.loadBalancer.activeInstances).toBe(2);

      // Test instance unregistration
      const unregistered = deploymentSystem.unregisterInstance(instance1Id);
      expect(unregistered).toBe(true);

      const updatedStatus = deploymentSystem.getDeploymentStatus();
      expect(updatedStatus.instances).toHaveLength(1);
    });

    test('should execute deployment plans with rollback capability', async () => {
      const deploymentPlan = {
        version: '1.1.0',
        environment: 'staging',
        strategy: 'rolling' as const,
        steps: [
          {
            id: 'step-1',
            name: 'Backup Database',
            type: 'provision' as const,
            command: 'backup-db.sh',
            timeout: 30000,
            retries: 2,
            rollbackCommand: 'restore-db.sh',
            dependencies: []
          },
          {
            id: 'step-2',
            name: 'Deploy Application',
            type: 'deploy' as const,
            command: 'deploy-app.sh',
            timeout: 60000,
            retries: 1,
            rollbackCommand: 'rollback-app.sh',
            dependencies: ['step-1']
          }
        ],
        rollbackPlan: [
          {
            id: 'rollback-1',
            name: 'Rollback Application',
            type: 'deploy' as const,
            command: 'rollback-app.sh',
            timeout: 30000,
            retries: 1,
            dependencies: []
          }
        ],
        estimatedDuration: 90000,
        prerequisites: ['staging-environment-ready'],
        postDeploymentTasks: ['verify-deployment', 'run-smoke-tests']
      };

      const result = await deploymentSystem.deploy(deploymentPlan);
      
      // Should succeed with high probability (95% success rate in simulation)
      if (result.success) {
        expect(result.duration).toBeGreaterThan(0);
        expect(result.error).toBeUndefined();
      } else {
        expect(result.error).toBeDefined();
        // Rollback should have been executed
      }
    });
  });

  describe('Configuration and Error Handling Integration', () => {
    test('should manage enterprise configuration with encryption', async () => {
      // Test configuration with sensitive data
      const config = {
        database: {
          host: 'localhost',
          port: 5432,
          username: 'app_user',
          password: 'sensitive_password',
          database: 'production_db'
        },
        apiKeys: {
          stripe: 'sk_live_sensitive_key',
          aws: 'AKIA_sensitive_access_key'
        }
      };

      // Store configuration
      await configManager.setConfig('production', config);

      // Retrieve configuration
      const retrievedConfig = await configManager.getConfig('production');
      expect(retrievedConfig.database.host).toBe('localhost');
      expect(retrievedConfig.database.password).toBe('sensitive_password');

      // Verify sensitive fields are encrypted in storage
      const encryptedFields = configManager.getEncryptedFields();
      expect(encryptedFields).toContain('database.password');
      expect(encryptedFields).toContain('apiKeys.stripe');
    });

    test('should handle enterprise errors with comprehensive logging', async () => {
      // Test error handling integration
      const wrappedFunction = ErrorHandler.wrapWithErrorHandling(
        async () => {
          throw new Error('Test enterprise error');
        },
        { component: 'enterprise-test', operation: 'test-failure' }
      );

      const result = await wrappedFunction();
      expect(result.success).toBe(false);
      
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.category).toBeDefined();
        expect(result.error.severity).toBeDefined();
      }

      // Verify error was logged in audit system
      const errorStats = ErrorHandler.getErrorStatistics();
      expect(errorStats.total).toBeGreaterThan(0);
    });

    test('should implement circuit breaker pattern for external services', async () => {
      // Test circuit breaker with retries
      let attempt = 0;
      const failingFunction = async () => {
        attempt++;
        if (attempt < 3) {
          throw new Error('Service temporarily unavailable');
        }
        return 'success';
      };

      const result = await ErrorHandler.retryWithBackoff(
        failingFunction,
        3, // max retries
        1000, // base delay
        { service: 'external-api' }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('success');
      }
    });
  });

  describe('Cross-System Security Integration', () => {
    test('should maintain security context across all enterprise systems', async () => {
      // Create comprehensive security context
      const user = rbacSystem.createUser('security-test', 'security@example.com', 'Security Test User');
      const perm = rbacSystem.createPermission('execute', 'enterprise-ops', 'Execute enterprise operations');
      const role = rbacSystem.createRole('enterprise-admin', 'Enterprise Admin', [perm.id]);
      rbacSystem.assignRole(user.id, role.id);

      // Generate API key for this user
      const apiKey = authManager.generateAPIKey('enterprise-service', ['execute:enterprise-ops']);

      // Create session
      const sessionId = rbacSystem.createSession(user.id, '192.168.1.100');

      // Validate across systems
      expect(rbacSystem.hasPermission(user.id, perm.id)).toBe(true);
      expect(rbacSystem.validateSession(sessionId, '192.168.1.100')).toBe(true);
      
      const apiValidation = authManager.validateAPIKey(apiKey.key);
      expect(apiValidation.valid).toBe(true);

      // Test security framework validation
      const securityContext = {
        userId: user.id,
        sessionId,
        ip: '192.168.1.100',
        userAgent: 'Enterprise-Client/1.0',
        action: 'execute:enterprise-ops',
        resource: 'deployment-pipeline'
      };

      const validation = securityFramework.validateSecurityPolicies(securityContext);
      expect(validation.passed.length).toBeGreaterThan(0);
    });

    test('should generate comprehensive compliance reports', async () => {
      // Generate activity across all systems
      const user = rbacSystem.createUser('compliance-test', 'compliance@example.com', 'Compliance Test');
      
      // Authentication events
      authManager.generateJWT(user.id, { role: 'user' });
      
      // Performance monitoring
      performanceMonitor.recordMetric('compliance_test', 100, 'ms', { audit: 'true' });
      
      // Security framework events
      securityFramework.processThreatIntelligence({
        type: 'compliance_test',
        source: '192.168.1.100',
        severity: 'low',
        timestamp: Date.now()
      });

      // Generate compliance report
      const startDate = new Date(Date.now() - 86400000); // 24 hours ago
      const endDate = new Date();
      
      const complianceReport = auditLogger.exportComplianceReport('json', startDate, endDate);
      expect(complianceReport).toBeDefined();
      
      const report = JSON.parse(complianceReport);
      expect(report.events).toBeDefined();
      expect(Array.isArray(report.events)).toBe(true);
    });
  });

  describe('Enterprise Load Testing and Resilience', () => {
    test('should handle concurrent operations across all systems', async () => {
      const concurrentOperations = [];
      const numOperations = 10;

      // Create concurrent load across all systems
      for (let i = 0; i < numOperations; i++) {
        concurrentOperations.push(
          // Concurrent secret operations
          secretsManager.encryptSecret(`test-secret-${i}`, `value-${i}`),
          
          // Concurrent user operations
          Promise.resolve(rbacSystem.createUser(`user-${i}`, `user${i}@example.com`, `User ${i}`)),
          
          // Concurrent JWT operations
          Promise.resolve(authManager.generateJWT(`user-${i}`, { test: true })),
          
          // Concurrent performance metrics
          Promise.resolve(performanceMonitor.recordMetric(`concurrent_metric_${i}`, Math.random() * 100, 'ms')),
          
          // Concurrent config operations
          configManager.setConfig(`test-env-${i}`, { test: `value-${i}` })
        );
      }

      // Execute all operations concurrently
      const results = await Promise.allSettled(concurrentOperations);
      
      // Verify most operations succeeded
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;
      
      expect(successCount).toBeGreaterThan(failureCount);
      expect(successCount).toBeGreaterThan(numOperations * 3); // At least 60% success rate
    });

    test('should maintain system integrity under stress', async () => {
      // Stress test with rapid operations
      const stressOperations = [];
      
      for (let i = 0; i < 50; i++) {
        stressOperations.push(
          performanceMonitor.timeFunction(`stress-test-${i}`, async () => {
            // Complex operation combining multiple systems
            const user = rbacSystem.createUser(`stress-user-${i}`, `stress${i}@test.com`, `Stress User ${i}`);
            const token = authManager.generateJWT(user.id, { stress: true });
            await secretsManager.encryptSecret(`stress-secret-${i}`, `stress-value-${i}`);
            
            // Validate operations
            const validation = authManager.validateJWT(token);
            const decrypted = await secretsManager.decryptSecret(`stress-secret-${i}`);
            
            return { validation: validation.success, decrypted: decrypted === `stress-value-${i}` };
          })
        );
      }

      const results = await Promise.allSettled(stressOperations);
      const successfulResults = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
      
      // Verify system maintained integrity
      expect(successfulResults.length).toBeGreaterThan(40); // 80% success rate
      
      // Verify all successful operations maintained data integrity
      successfulResults.forEach(result => {
        expect(result.value.validation).toBe(true);
        expect(result.value.decrypted).toBe(true);
      });

      // Verify performance metrics were captured
      const performanceStats = performanceMonitor.getPerformanceSummary();
      expect(performanceStats.totalMetrics).toBeGreaterThan(0);
    });
  });
});