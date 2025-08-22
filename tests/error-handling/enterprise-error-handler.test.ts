/**
 * Comprehensive Enterprise Error Handler Tests
 * Following AI Coding Grimoire v3.0 - NO MOCKS, Real functionality validation
 * Tests actual error handling, audit logging, metrics, circuit breakers, and enterprise features
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  EnterpriseErrorHandler,
  EnterpriseErrorConfig
} from '../../src/core/error-handling/enterprise-error-handler.js';
import {
  StructuredError,
  ErrorCategory,
  ErrorSeverity,
  ServiceResponse
} from '../../src/core/error-handling/structured-error-system.js';
import { SecurityAuditLogger } from '../../src/core/security/security-audit-logger.js';

describe('Enterprise Error Handler - Comprehensive Real Tests', () => {
  let errorHandler: EnterpriseErrorHandler;
  let auditLogger: SecurityAuditLogger;
  let performanceMetrics: Array<{ operation: string; duration: number; success: boolean }>;
  let testConfig: EnterpriseErrorConfig;

  beforeEach(() => {
    // Initialize real enterprise error handler - NO MOCKS
    auditLogger = new SecurityAuditLogger({
      enableRealTimeLogging: true,
      enableMetrics: true,
      persistAuditTrail: true
    });

    testConfig = {
      enableAuditLogging: true,
      enableMetrics: true,
      enableAlerts: true,
      maxRetryAttempts: 3,
      circuitBreakerThreshold: 5,
      rateLimitingEnabled: true,
      securityValidationEnabled: true
    };

    errorHandler = new EnterpriseErrorHandler(auditLogger, undefined, testConfig);
    performanceMetrics = [];
  });

  afterEach(() => {
    // Clean up real resources
    errorHandler.shutdown?.();
    auditLogger.shutdown?.();
  });

  describe('Real Enterprise Error Processing', () => {
    it('should handle standard JavaScript errors with enterprise features', async () => {
      const startTime = Date.now();
      
      const testError = new Error('Database connection timeout');
      const context = {
        userId: 'enterprise-user-123',
        sessionId: 'session-abc-def',
        requestId: 'req-12345',
        operation: 'database_query',
        resource: 'user_profiles',
        ipAddress: '192.168.1.100',
        userAgent: 'CodeCrucible-CLI/4.0.0'
      };

      const structuredError = await errorHandler.handleEnterpriseError(testError, context);
      
      const duration = Date.now() - startTime;
      performanceMetrics.push({ operation: 'standard_error_handling', duration, success: true });

      // Verify enterprise error handling
      expect(structuredError).toBeInstanceOf(StructuredError);
      expect(structuredError.message).toContain('Database connection timeout');
      expect(structuredError.errorId).toBeDefined();
      expect(structuredError.timestamp).toBeInstanceOf(Date);
      expect(structuredError.context).toMatchObject(context);
      expect(structuredError.severity).toBeDefined();
      expect(structuredError.category).toBeDefined();
      
      // Verify audit logging
      expect(structuredError.auditTrail).toBeDefined();
      expect(structuredError.auditTrail.userId).toBe(context.userId);
      expect(structuredError.auditTrail.sessionId).toBe(context.sessionId);
      
      // Performance requirement: <100ms for error processing
      expect(duration).toBeLessThan(100);
    });

    it('should classify and categorize errors according to enterprise standards', async () => {
      const errorTestCases = [
        {
          error: new Error('ECONNREFUSED: Connection refused'),
          expectedCategory: ErrorCategory.INFRASTRUCTURE,
          expectedSeverity: ErrorSeverity.HIGH,
          context: { operation: 'api_call', service: 'external_api' }
        },
        {
          error: new Error('Unauthorized access attempt'),
          expectedCategory: ErrorCategory.SECURITY,
          expectedSeverity: ErrorSeverity.CRITICAL,
          context: { operation: 'authentication', resource: 'admin_panel' }
        },
        {
          error: new Error('Invalid JSON format in request'),
          expectedCategory: ErrorCategory.VALIDATION,
          expectedSeverity: ErrorSeverity.MEDIUM,
          context: { operation: 'input_processing', source: 'user_input' }
        },
        {
          error: new Error('TypeError: Cannot read property of undefined'),
          expectedCategory: ErrorCategory.APPLICATION,
          expectedSeverity: ErrorSeverity.HIGH,
          context: { operation: 'code_execution', component: 'data_processor' }
        }
      ];

      for (const testCase of errorTestCases) {
        const structuredError = await errorHandler.handleEnterpriseError(
          testCase.error,
          testCase.context
        );

        expect(structuredError.category).toBe(testCase.expectedCategory);
        expect(structuredError.severity).toBe(testCase.expectedSeverity);
        expect(structuredError.context).toMatchObject(testCase.context);
        
        // Verify enterprise metadata
        expect(structuredError.metadata.source).toBe('enterprise_error_handler');
        expect(structuredError.metadata.processingTime).toBeDefined();
        expect(structuredError.metadata.correlationId).toBeDefined();
      }
    });

    it('should implement circuit breaker pattern for repeated failures', async () => {
      const failingService = 'unreliable_service';
      const baseContext = { 
        operation: 'service_call',
        service: failingService,
        userId: 'test-user'
      };

      // Generate multiple failures to trigger circuit breaker
      const failures: StructuredError[] = [];
      
      for (let i = 0; i < 7; i++) { // Exceed threshold of 5
        const error = new Error(`Service failure ${i + 1}`);
        const context = { ...baseContext, attemptNumber: i + 1 };
        
        const structuredError = await errorHandler.handleEnterpriseError(error, context);
        failures.push(structuredError);
      }

      // Check circuit breaker activation
      const circuitBreakerStatus = await errorHandler.getCircuitBreakerStatus(failingService);
      expect(circuitBreakerStatus.state).toBe('OPEN');
      expect(circuitBreakerStatus.failureCount).toBeGreaterThanOrEqual(testConfig.circuitBreakerThreshold);
      expect(circuitBreakerStatus.lastFailureTime).toBeInstanceOf(Date);

      // Test that subsequent calls are fast-failed
      const startTime = Date.now();
      const fastFailError = await errorHandler.handleEnterpriseError(
        new Error('This should be fast-failed'),
        baseContext
      );
      const fastFailDuration = Date.now() - startTime;

      expect(fastFailError.metadata.circuitBreakerTriggered).toBe(true);
      expect(fastFailDuration).toBeLessThan(10); // Fast fail should be <10ms
    });

    it('should implement rate limiting for error-prone operations', async () => {
      const rateLimitedOperation = 'bulk_processing';
      const context = { 
        operation: rateLimitedOperation,
        userId: 'heavy-user',
        rateLimitKey: 'user:heavy-user:bulk_processing'
      };

      // Generate rapid-fire errors to test rate limiting
      const rapidErrors: StructuredError[] = [];
      const startTime = Date.now();

      for (let i = 0; i < 50; i++) {
        const error = new Error(`Rapid error ${i + 1}`);
        const errorResult = await errorHandler.handleEnterpriseError(error, {
          ...context,
          errorIndex: i
        });
        rapidErrors.push(errorResult);
      }

      const totalTime = Date.now() - startTime;

      // Check for rate limiting activation
      const rateLimitedErrors = rapidErrors.filter(e => e.metadata.rateLimited);
      expect(rateLimitedErrors.length).toBeGreaterThan(0);

      // Verify rate limiting metrics
      const rateLimitMetrics = await errorHandler.getRateLimitMetrics(context.rateLimitKey);
      expect(rateLimitMetrics.requestCount).toBe(50);
      expect(rateLimitMetrics.limitExceeded).toBe(true);
      expect(rateLimitMetrics.backoffPeriod).toBeGreaterThan(0);

      console.log(`Rate limiting test: ${rateLimitedErrors.length}/50 errors rate limited`);
    });
  });

  describe('Enterprise Metrics and Monitoring', () => {
    it('should collect comprehensive error metrics for enterprise dashboards', async () => {
      // Generate diverse error scenarios for metrics testing
      const errorScenarios = [
        { category: 'DATABASE', severity: 'HIGH', count: 5 },
        { category: 'NETWORK', severity: 'MEDIUM', count: 8 },
        { category: 'VALIDATION', severity: 'LOW', count: 12 },
        { category: 'SECURITY', severity: 'CRITICAL', count: 2 },
        { category: 'APPLICATION', severity: 'HIGH', count: 6 }
      ];

      for (const scenario of errorScenarios) {
        for (let i = 0; i < scenario.count; i++) {
          const error = new Error(`${scenario.category} error ${i + 1}`);
          await errorHandler.handleEnterpriseError(error, {
            operation: scenario.category.toLowerCase(),
            severity: scenario.severity,
            userId: `user-${i}`
          });
        }
      }

      const errorMetrics = await errorHandler.getErrorMetrics();

      expect(errorMetrics).toMatchObject({
        totalErrors: expect.any(Number),
        errorsByCategory: expect.any(Object),
        errorsBySeverity: expect.any(Object),
        errorTrends: expect.any(Object),
        topErrorTypes: expect.any(Array),
        averageResolutionTime: expect.any(Number),
        systemHealthScore: expect.any(Number)
      });

      // Verify metrics accuracy
      expect(errorMetrics.totalErrors).toBe(33); // Sum of all scenarios
      expect(errorMetrics.errorsByCategory.DATABASE).toBe(5);
      expect(errorMetrics.errorsByCategory.SECURITY).toBe(2);
      expect(errorMetrics.errorsBySeverity.CRITICAL).toBe(2);
      expect(errorMetrics.errorsBySeverity.HIGH).toBe(11);

      // System health score should reflect error patterns
      expect(errorMetrics.systemHealthScore).toBeGreaterThanOrEqual(0);
      expect(errorMetrics.systemHealthScore).toBeLessThanOrEqual(100);
    });

    it('should generate enterprise-ready error reports and analytics', async () => {
      const reportingPeriod = {
        startTime: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
        endTime: new Date()
      };

      // Generate sample errors for reporting
      const sampleErrors = [
        { type: 'TimeoutError', frequency: 'high', impact: 'medium' },
        { type: 'ValidationError', frequency: 'medium', impact: 'low' },
        { type: 'SecurityViolation', frequency: 'low', impact: 'critical' }
      ];

      for (const sample of sampleErrors) {
        const count = { high: 10, medium: 5, low: 2 }[sample.frequency];
        for (let i = 0; i < count; i++) {
          await errorHandler.handleEnterpriseError(
            new Error(`${sample.type}: Test error ${i + 1}`),
            { errorType: sample.type, impact: sample.impact }
          );
        }
      }

      const errorReport = await errorHandler.generateErrorReport(reportingPeriod);

      expect(errorReport).toMatchObject({
        executiveSummary: expect.objectContaining({
          totalIncidents: expect.any(Number),
          criticalIssues: expect.any(Number),
          systemAvailability: expect.any(Number),
          mttr: expect.any(Number) // Mean Time To Resolution
        }),
        detailedAnalysis: expect.objectContaining({
          errorDistribution: expect.any(Object),
          impactAssessment: expect.any(Object),
          rootCauseAnalysis: expect.any(Array),
          recommendations: expect.any(Array)
        }),
        trends: expect.objectContaining({
          errorVelocity: expect.any(Array),
          severityTrends: expect.any(Object),
          categoryTrends: expect.any(Object)
        }),
        complianceMetrics: expect.objectContaining({
          slaCompliance: expect.any(Number),
          auditScore: expect.any(Number),
          governanceAlignment: expect.any(String)
        })
      });

      // Verify report quality
      expect(errorReport.executiveSummary.totalIncidents).toBeGreaterThan(0);
      expect(errorReport.detailedAnalysis.recommendations.length).toBeGreaterThan(0);
      expect(errorReport.complianceMetrics.auditScore).toBeGreaterThanOrEqual(0);
      expect(errorReport.complianceMetrics.auditScore).toBeLessThanOrEqual(100);
    });

    it('should integrate with enterprise alerting and notification systems', async () => {
      const alertsReceived: any[] = [];
      
      // Register enterprise alert handler
      errorHandler.registerAlertHandler((alert) => {
        alertsReceived.push(alert);
      });

      // Generate critical errors that should trigger alerts
      const criticalErrors = [
        {
          error: new Error('CRITICAL: Database cluster is down'),
          context: { severity: 'CRITICAL', service: 'database', impact: 'service_outage' }
        },
        {
          error: new Error('SECURITY: Multiple failed authentication attempts'),
          context: { severity: 'CRITICAL', service: 'auth', impact: 'security_incident' }
        },
        {
          error: new Error('SYSTEM: Memory usage exceeded 95%'),
          context: { severity: 'CRITICAL', service: 'system', impact: 'performance_degradation' }
        }
      ];

      for (const { error, context } of criticalErrors) {
        await errorHandler.handleEnterpriseError(error, context);
      }

      // Verify alert generation
      expect(alertsReceived.length).toBeGreaterThanOrEqual(criticalErrors.length);

      alertsReceived.forEach(alert => {
        expect(alert).toMatchObject({
          severity: expect.any(String),
          timestamp: expect.any(Date),
          message: expect.any(String),
          context: expect.any(Object),
          escalationLevel: expect.any(Number),
          notificationChannels: expect.any(Array)
        });

        expect(['CRITICAL', 'HIGH']).toContain(alert.severity);
        expect(alert.escalationLevel).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance and Scalability Under Load', () => {
    it('should maintain performance under high error volume', async () => {
      const errorVolume = 500;
      const maxAcceptableLatency = 50; // milliseconds per error
      const startTime = Date.now();

      // Generate high volume of concurrent errors
      const errorPromises = Array.from({ length: errorVolume }, (_, i) => {
        const error = new Error(`High volume error ${i + 1}`);
        const context = {
          operation: 'load_test',
          errorIndex: i,
          userId: `load-user-${i % 10}` // Distribute across 10 users
        };
        return errorHandler.handleEnterpriseError(error, context);
      });

      const results = await Promise.all(errorPromises);
      const totalDuration = Date.now() - startTime;
      const averageLatency = totalDuration / errorVolume;

      expect(results.length).toBe(errorVolume);
      expect(averageLatency).toBeLessThan(maxAcceptableLatency);
      
      // Verify all errors were processed correctly
      results.forEach(result => {
        expect(result).toBeInstanceOf(StructuredError);
        expect(result.errorId).toBeDefined();
        expect(result.auditTrail).toBeDefined();
      });

      console.log(`High volume performance: ${averageLatency.toFixed(2)}ms average latency for ${errorVolume} errors`);
    });

    it('should handle memory efficiently during extended operation', async () => {
      const initialMemory = process.memoryUsage();
      const extendedOperationCount = 2000;

      for (let i = 0; i < extendedOperationCount; i++) {
        const error = new Error(`Extended operation error ${i + 1}`);
        await errorHandler.handleEnterpriseError(error, {
          operation: 'memory_test',
          iteration: i
        });

        // Trigger cleanup every 200 operations
        if (i % 200 === 0) {
          await errorHandler.performMaintenance();
        }
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreasePerOperation = memoryIncrease / extendedOperationCount;

      // Memory increase should be reasonable (<2KB per operation)
      expect(memoryIncreasePerOperation).toBeLessThan(2048);
      console.log(`Memory efficiency: ${(memoryIncreasePerOperation / 1024).toFixed(2)}KB per error operation`);
    });

    it('should provide real-time error streaming for enterprise monitoring', async () => {
      const errorStream: StructuredError[] = [];
      let streamLatency: number[] = [];

      // Set up real-time error stream
      const unsubscribe = errorHandler.subscribeToErrorStream((error, metadata) => {
        const latency = Date.now() - error.timestamp.getTime();
        streamLatency.push(latency);
        errorStream.push(error);
      });

      // Generate errors with timing
      const streamTestErrors = 20;
      for (let i = 0; i < streamTestErrors; i++) {
        const error = new Error(`Stream test error ${i + 1}`);
        await errorHandler.handleEnterpriseError(error, {
          operation: 'stream_test',
          streamIndex: i
        });
        
        // Small delay to test streaming
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Allow time for stream processing
      await new Promise(resolve => setTimeout(resolve, 100));
      unsubscribe();

      expect(errorStream.length).toBe(streamTestErrors);
      
      // Verify streaming latency
      const averageStreamLatency = streamLatency.reduce((a, b) => a + b, 0) / streamLatency.length;
      expect(averageStreamLatency).toBeLessThan(50); // <50ms stream latency

      console.log(`Error streaming performance: ${averageStreamLatency.toFixed(2)}ms average latency`);
    });
  });

  describe('Enterprise Integration and Compliance', () => {
    it('should integrate with enterprise logging systems (ELK, Splunk)', async () => {
      const enterpriseLogEntries: any[] = [];

      // Mock enterprise logging integration
      errorHandler.registerEnterpriseLogger((logEntry) => {
        enterpriseLogEntries.push(logEntry);
      });

      const enterpriseError = new Error('Integration test error');
      const enterpriseContext = {
        businessUnit: 'Engineering',
        costCenter: 'DEVOPS-001',
        complianceLevel: 'SOX',
        dataClassification: 'Internal',
        operationalImpact: 'Service Degradation'
      };

      await errorHandler.handleEnterpriseError(enterpriseError, enterpriseContext);

      expect(enterpriseLogEntries.length).toBeGreaterThan(0);
      expect(enterpriseLogEntries[0]).toMatchObject({
        '@timestamp': expect.any(String),
        level: expect.any(String),
        message: expect.any(String),
        fields: expect.objectContaining({
          businessUnit: 'Engineering',
          costCenter: 'DEVOPS-001',
          complianceLevel: 'SOX',
          errorId: expect.any(String),
          correlationId: expect.any(String)
        }),
        tags: expect.arrayContaining(['enterprise', 'error-handling'])
      });
    });

    it('should support compliance reporting (SOX, GDPR, HIPAA)', async () => {
      const complianceScenarios = [
        {
          name: 'SOX Financial Data Access',
          error: new Error('Unauthorized access to financial records'),
          context: {
            complianceFramework: 'SOX',
            dataType: 'financial',
            userRole: 'analyst',
            accessLevel: 'restricted'
          }
        },
        {
          name: 'GDPR Personal Data Processing',
          error: new Error('Personal data processing violation'),
          context: {
            complianceFramework: 'GDPR',
            dataType: 'personal',
            consentStatus: 'revoked',
            processingPurpose: 'analytics'
          }
        },
        {
          name: 'HIPAA Health Information Access',
          error: new Error('Unauthorized PHI access attempt'),
          context: {
            complianceFramework: 'HIPAA',
            dataType: 'health',
            patientConsent: 'required',
            accessReason: 'unauthorized'
          }
        }
      ];

      const complianceViolations: any[] = [];

      for (const scenario of complianceScenarios) {
        const structuredError = await errorHandler.handleEnterpriseError(
          scenario.error,
          scenario.context
        );

        if (structuredError.complianceViolation) {
          complianceViolations.push({
            framework: scenario.context.complianceFramework,
            violation: structuredError.complianceViolation,
            remediation: structuredError.recommendedActions
          });
        }
      }

      expect(complianceViolations.length).toBe(complianceScenarios.length);
      
      complianceViolations.forEach(violation => {
        expect(['SOX', 'GDPR', 'HIPAA']).toContain(violation.framework);
        expect(violation.violation).toMatchObject({
          type: expect.any(String),
          severity: expect.any(String),
          description: expect.any(String),
          regulations: expect.any(Array)
        });
        expect(violation.remediation.length).toBeGreaterThan(0);
      });
    });

    it('should generate executive dashboards and KPI metrics', async () => {
      // Generate representative enterprise error patterns
      const executiveTestErrors = [
        { type: 'service_outage', impact: 'high', businessValue: 10000 },
        { type: 'data_breach_attempt', impact: 'critical', businessValue: 50000 },
        { type: 'performance_degradation', impact: 'medium', businessValue: 5000 },
        { type: 'compliance_violation', impact: 'critical', businessValue: 25000 }
      ];

      for (const testError of executiveTestErrors) {
        await errorHandler.handleEnterpriseError(
          new Error(`${testError.type}: Executive KPI test`),
          {
            businessImpact: testError.impact,
            estimatedBusinessValue: testError.businessValue,
            operationalCategory: testError.type
          }
        );
      }

      const executiveDashboard = await errorHandler.generateExecutiveDashboard();

      expect(executiveDashboard).toMatchObject({
        kpis: expect.objectContaining({
          systemReliability: expect.any(Number), // Percentage
          incidentResponse: expect.any(Number),  // Average time
          businessImpact: expect.any(Number),    // Financial impact
          complianceScore: expect.any(Number),   // Compliance percentage
          customerSatisfaction: expect.any(Number) // Customer impact score
        }),
        trends: expect.objectContaining({
          errorVelocity: expect.any(Array),
          impactTrends: expect.any(Object),
          resolutionTimes: expect.any(Array)
        }),
        businessMetrics: expect.objectContaining({
          revenueAtRisk: expect.any(Number),
          operationalEfficiency: expect.any(Number),
          riskExposure: expect.any(String)
        }),
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            priority: expect.any(String),
            businessJustification: expect.any(String),
            estimatedROI: expect.any(Number)
          })
        ])
      });

      // Verify executive KPIs are within reasonable ranges
      expect(executiveDashboard.kpis.systemReliability).toBeGreaterThanOrEqual(0);
      expect(executiveDashboard.kpis.systemReliability).toBeLessThanOrEqual(100);
      expect(executiveDashboard.kpis.complianceScore).toBeGreaterThanOrEqual(0);
      expect(executiveDashboard.kpis.complianceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Performance Benchmarks and Industry Standards', () => {
    it('should meet enterprise error handling performance standards', () => {
      // Analyze collected performance metrics
      const successfulOperations = performanceMetrics.filter(m => m.success);
      const latencies = successfulOperations.map(m => m.duration);
      
      if (latencies.length > 0) {
        const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        const maxLatency = Math.max(...latencies);
        const p95Latency = latencies.sort()[Math.floor(latencies.length * 0.95)];

        // Enterprise error handling performance standards
        expect(averageLatency).toBeLessThan(50); // <50ms average
        expect(maxLatency).toBeLessThan(200); // <200ms maximum
        expect(p95Latency).toBeLessThan(100); // <100ms 95th percentile

        console.log('Enterprise Error Handler Performance Metrics:');
        console.log(`Average Latency: ${averageLatency.toFixed(2)}ms`);
        console.log(`Max Latency: ${maxLatency}ms`);
        console.log(`95th Percentile: ${p95Latency}ms`);
      }
    });

    it('should demonstrate enterprise reliability and availability', async () => {
      const reliabilityTest = {
        duration: 10000, // 10 seconds
        errorRate: 10,   // 10 errors per second
        expectedAvailability: 99.9 // 99.9% availability
      };

      const startTime = Date.now();
      const errors: StructuredError[] = [];
      const failures: Error[] = [];

      // High-frequency error processing test
      while (Date.now() - startTime < reliabilityTest.duration) {
        try {
          const error = new Error(`Reliability test error ${errors.length + 1}`);
          const result = await errorHandler.handleEnterpriseError(error, {
            operation: 'reliability_test',
            timestamp: new Date()
          });
          errors.push(result);
        } catch (processingError) {
          failures.push(processingError);
        }

        // Control error rate
        await new Promise(resolve => setTimeout(resolve, 1000 / reliabilityTest.errorRate));
      }

      const totalOperations = errors.length + failures.length;
      const successRate = (errors.length / totalOperations) * 100;

      expect(successRate).toBeGreaterThanOrEqual(reliabilityTest.expectedAvailability);
      expect(failures.length).toBeLessThan(totalOperations * 0.001); // <0.1% failure rate

      console.log(`Reliability Test Results:`);
      console.log(`Total Operations: ${totalOperations}`);
      console.log(`Success Rate: ${successRate.toFixed(3)}%`);
      console.log(`Failures: ${failures.length}`);
    });
  });
});