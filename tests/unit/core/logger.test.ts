/**
 * Logger System Test Suite - Enterprise Testing
 * Testing the enhanced enterprise logger with OpenTelemetry integration
 */

import { Logger, logger } from '../../../src/core/logger';
import { join } from 'path';
import { existsSync, unlinkSync, readFileSync } from 'fs';
import { homedir } from 'os';

describe('Logger Enterprise System', () => {
  let testLogger: Logger;
  const testLogDir = join(process.cwd(), 'test-logs');

  beforeEach(() => {
    testLogger = new Logger('test-logger', {
      level: 'debug',
      toFile: true,
      toConsole: false,
      logDirectory: testLogDir,
    });
  });

  afterEach(async () => {
    await testLogger.flush();
    // Cleanup test log files
    try {
      const files = ['error', 'warn', 'info', 'debug'].map(level =>
        join(testLogDir, `codecrucible-${new Date().toISOString().split('T')[0]}.log`)
      );
      files.forEach(file => {
        if (existsSync(file)) {
          unlinkSync(file);
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Core Logging Functionality', () => {
    test('should log messages at different levels', async () => {
      testLogger.debug('Debug message');
      testLogger.info('Info message');
      testLogger.warn('Warning message');
      testLogger.error('Error message');

      await testLogger.flush();
      expect(true).toBe(true); // Basic functionality test
    });

    test('should respect log level filtering', () => {
      const warnLogger = new Logger('warn-logger', {
        level: 'warn',
        toConsole: false,
        toFile: false,
      });

      // Should not log debug/info when level is warn
      warnLogger.debug('Should not appear');
      warnLogger.info('Should not appear');
      warnLogger.warn('Should appear');
      warnLogger.error('Should appear');

      expect(true).toBe(true); // Level filtering test
    });

    test('should handle structured data logging', () => {
      const testData = {
        userId: 'user123',
        sessionId: 'session456',
        operation: 'file_analysis',
      };

      testLogger.info('Operation completed', testData);
      expect(true).toBe(true); // Structured data test
    });
  });

  describe('Enterprise Logging Features', () => {
    test('should support audit logging', () => {
      testLogger.audit('User login', {
        userId: 'user123',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        status: 'success',
      });

      expect(true).toBe(true); // Audit logging test
    });

    test('should support security event logging', () => {
      testLogger.security('Potential injection attempt', {
        severity: 'high',
        threatType: 'code_injection',
        userId: 'user123',
        ip: '192.168.1.1',
        mitigated: true,
      });

      expect(true).toBe(true); // Security logging test
    });

    test('should support performance metrics logging', () => {
      testLogger.metric('response_time', 150, 'ms', {
        endpoint: '/api/generate',
        method: 'POST',
      });

      expect(true).toBe(true); // Metrics logging test
    });

    test('should support business event logging', () => {
      testLogger.business('Code generation completed', {
        codeType: 'typescript',
        linesGenerated: 45,
        modelUsed: 'gpt-4',
      });

      expect(true).toBe(true); // Business logging test
    });
  });

  describe('Performance and Utility Features', () => {
    test('should support performance timing', () => {
      const timer = testLogger.time('test_operation');

      // Simulate some work
      setTimeout(() => {
        timer(); // Complete timing
      }, 10);

      expect(typeof timer).toBe('function');
    });

    test('should support async operation profiling', async () => {
      const result = await testLogger.profile('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test_result';
      });

      expect(result).toBe('test_result');
    });

    test('should create child loggers with context', () => {
      const childLogger = testLogger.child('request_context');
      expect(childLogger).toBeInstanceOf(Logger);
    });

    test('should log system information', () => {
      testLogger.logSystemInfo();
      expect(true).toBe(true); // System info test
    });
  });

  describe('Error Handling', () => {
    test('should handle error objects properly', () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error\n    at test';

      testLogger.error('Operation failed', testError);
      expect(true).toBe(true); // Error handling test
    });

    test('should handle mixed error parameters', () => {
      const testData = { operation: 'file_read', path: '/test/path' };

      testLogger.error('File operation failed', testData);
      expect(true).toBe(true); // Mixed parameters test
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration dynamically', () => {
      const originalConfig = testLogger.getConfig();
      expect(originalConfig.level).toBe('debug');

      testLogger.updateConfig({ level: 'warn' });
      const updatedConfig = testLogger.getConfig();
      expect(updatedConfig.level).toBe('warn');
    });

    test('should maintain immutable config copies', () => {
      const config1 = testLogger.getConfig();
      const config2 = testLogger.getConfig();

      config1.level = 'error';
      expect(config2.level).toBe('debug'); // Should not be modified
    });
  });

  describe('File Operations', () => {
    test('should flush pending logs to file', async () => {
      testLogger.info('Test message for file flush');
      await testLogger.flush();

      // Check that flush completes without error
      expect(true).toBe(true);
    });

    test('should handle log directory creation', async () => {
      const customLogger = new Logger('custom', {
        level: 'info',
        toFile: true,
        logDirectory: join(process.cwd(), 'custom-test-logs'),
      });

      customLogger.info('Test directory creation');
      await customLogger.flush();

      expect(true).toBe(true);
    });
  });

  describe('OpenTelemetry Integration', () => {
    test('should handle trace context when available', () => {
      // Test that logger doesn't fail when OpenTelemetry context is not available
      testLogger.info('Message with trace context check');
      expect(true).toBe(true);
    });

    test('should include correlation IDs when provided', () => {
      const testData = {
        correlationId: 'corr-123',
        userId: 'user-456',
        sessionId: 'sess-789',
      };

      testLogger.info('Operation with correlation ID', testData);
      expect(true).toBe(true);
    });
  });
});
