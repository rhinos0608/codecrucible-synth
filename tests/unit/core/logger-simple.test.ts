/**
 * Logger System Test Suite - Enterprise Testing
 * Testing the enhanced enterprise logger system
 */

import { Logger } from '../../../src/core/logger';
import { join } from 'path';

describe('Logger Enterprise System', () => {
  let testLogger: Logger;
  const testLogDir = join(process.cwd(), 'test-logs');

  beforeEach(() => {
    testLogger = new Logger('test-logger', {
      level: 'debug',
      toFile: false, // Disable file logging for tests
      toConsole: false, // Disable console logging for tests
      logDirectory: testLogDir
    });
  });

  afterEach(async () => {
    await testLogger.flush();
  });

  describe('Core Logging Functionality', () => {
    test('should create logger with correct configuration', () => {
      expect(testLogger).toBeInstanceOf(Logger);
      const config = testLogger.getConfig();
      expect(config.level).toBe('debug');
      expect(config.toFile).toBe(false);
      expect(config.toConsole).toBe(false);
    });

    test('should log messages at different levels', () => {
      // These shouldn't throw since we're testing the interface
      expect(() => {
        testLogger.debug('Debug message');
        testLogger.info('Info message');
        testLogger.warn('Warning message');
        testLogger.error('Error message');
      }).not.toThrow();
    });

    test('should handle structured data logging', () => {
      const testData = {
        userId: 'user123',
        sessionId: 'session456',
        operation: 'file_analysis'
      };

      expect(() => {
        testLogger.info('Operation completed', testData);
      }).not.toThrow();
    });

    test('should update configuration dynamically', () => {
      const originalConfig = testLogger.getConfig();
      expect(originalConfig.level).toBe('debug');

      testLogger.updateConfig({ level: 'warn' });
      const updatedConfig = testLogger.getConfig();
      expect(updatedConfig.level).toBe('warn');
    });
  });

  describe('Enterprise Logging Features', () => {
    test('should support audit logging', () => {
      expect(() => {
        testLogger.audit('User login', {
          userId: 'user123',
          ip: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          status: 'success'
        });
      }).not.toThrow();
    });

    test('should support security event logging', () => {
      expect(() => {
        testLogger.security('Potential injection attempt', {
          severity: 'high',
          threatType: 'code_injection',
          userId: 'user123',
          ip: '192.168.1.1',
          mitigated: true
        });
      }).not.toThrow();
    });

    test('should support performance metrics logging', () => {
      expect(() => {
        testLogger.metric('response_time', 150, 'ms', {
          endpoint: '/api/generate',
          method: 'POST'
        });
      }).not.toThrow();
    });

    test('should support business event logging', () => {
      expect(() => {
        testLogger.business('Code generation completed', {
          codeType: 'typescript',
          linesGenerated: 45,
          modelUsed: 'gpt-4'
        });
      }).not.toThrow();
    });
  });

  describe('Performance and Utility Features', () => {
    test('should support performance timing', () => {
      const timer = testLogger.time('test_operation');
      expect(typeof timer).toBe('function');
      
      // Complete timing
      expect(() => timer()).not.toThrow();
    });

    test('should support async operation profiling', async () => {
      const result = await testLogger.profile('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 1));
        return 'test_result';
      });

      expect(result).toBe('test_result');
    });

    test('should create child loggers with context', () => {
      const childLogger = testLogger.child('request_context');
      expect(childLogger).toBeInstanceOf(Logger);
    });

    test('should log system information', () => {
      expect(() => {
        testLogger.logSystemInfo();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle error objects properly', () => {
      const testError = new Error('Test error message');
      testError.stack = 'Error: Test error\n    at test';
      
      expect(() => {
        testLogger.error('Operation failed', testError);
      }).not.toThrow();
    });

    test('should handle mixed error parameters', () => {
      const testData = { operation: 'file_read', path: '/test/path' };
      
      expect(() => {
        testLogger.error('File operation failed', testData);
      }).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    test('should maintain immutable config copies', () => {
      const config1 = testLogger.getConfig();
      const config2 = testLogger.getConfig();
      
      config1.level = 'error';
      expect(config2.level).toBe('debug'); // Should not be modified
    });

    test('should handle various log levels', () => {
      const levels = ['debug', 'info', 'warn', 'error'] as const;
      
      levels.forEach(level => {
        expect(() => {
          testLogger.updateConfig({ level });
          const config = testLogger.getConfig();
          expect(config.level).toBe(level);
        }).not.toThrow();
      });
    });
  });

  describe('File Operations', () => {
    test('should flush pending logs without error', async () => {
      testLogger.info('Test message for file flush');
      await expect(testLogger.flush()).resolves.not.toThrow();
    });
  });

  describe('OpenTelemetry Integration', () => {
    test('should handle trace context when available', () => {
      // Test that logger doesn't fail when OpenTelemetry context is not available
      expect(() => {
        testLogger.info('Message with trace context check');
      }).not.toThrow();
    });

    test('should include correlation IDs when provided', () => {
      const testData = {
        correlationId: 'corr-123',
        userId: 'user-456',
        sessionId: 'sess-789'
      };

      expect(() => {
        testLogger.info('Operation with correlation ID', testData);
      }).not.toThrow();
    });
  });
});