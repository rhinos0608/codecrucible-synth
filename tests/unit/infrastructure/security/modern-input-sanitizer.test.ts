/**
 * Comprehensive Modern Input Sanitizer Tests
 * Testing all security components: input sanitization, file path validation, consent management
 * Following Living Spiral Methodology - Security Guardian Perspective with Multi-Voice Validation
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import {
  ModernInputSanitizer,
  SanitizationResult,
  ConsentManager,
} from '../../../../src/infrastructure/security/modern-input-sanitizer.js';
import { ClaudeCodeSecurity, SecurityContext, SecurityDecision } from '../../../../src/infrastructure/security/claude-code-security.js';

// Mock implementations for testing
class MockClaudeCodeSecurity {
  private auditLog: SecurityContext[] = [];
  private policy: any = {};

  async evaluateSecurity(context: SecurityContext): Promise<SecurityDecision> {
    this.auditLog.push(context);

    // Simulate security evaluation logic
    if (context.userInput?.includes('dangerous-command')) {
      return {
        action: 'block',
        reason: 'Potentially dangerous command detected',
        confidence: 0.9,
        metadata: { riskLevel: 'high' },
      };
    }

    if (context.userInput?.includes('requires-consent')) {
      return {
        action: 'askUser',
        reason: 'Operation requires user consent',
        confidence: 0.7,
        metadata: { riskLevel: 'medium' },
      };
    }

    if (context.operation === 'file_access' && context.filePath?.includes('..')) {
      return {
        action: 'block',
        reason: 'Path traversal attempt detected',
        confidence: 0.95,
        metadata: { riskLevel: 'high' },
      };
    }

    return {
      action: 'allow',
      reason: 'Operation approved',
      confidence: 0.8,
      metadata: { riskLevel: 'low' },
    };
  }

  async requestUserConsent(context: SecurityContext, decision: SecurityDecision): Promise<any> {
    return {
      id: `consent_${Date.now()}`,
      message: `Do you want to allow this operation: ${context.operation}?`,
      options: [
        { label: 'Allow', value: 'allow' },
        { label: 'Deny', value: 'deny' },
      ],
    };
  }

  getAuditLog(limit?: number): SecurityContext[] {
    return limit ? this.auditLog.slice(-limit) : [...this.auditLog];
  }

  clearAuditLog(): void {
    this.auditLog = [];
  }

  updatePolicy(updates: any): void {
    this.policy = { ...this.policy, ...updates };
  }
}

class MockConsentManager extends EventEmitter implements ConsentManager {
  private responses = new Map<string, string>();
  private defaultResponse = 'Allow';

  setDefaultResponse(response: string): void {
    this.defaultResponse = response;
  }

  setResponse(requestId: string, response: string): void {
    this.responses.set(requestId, response);
  }

  async requestConsent(requestId: string, message: string, options: string[]): Promise<string> {
    const response = this.responses.get(requestId) || this.defaultResponse;
    
    this.emit('consent-requested', { requestId, message, options, response });
    
    // Simulate user response delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return response;
  }
}

describe('ModernInputSanitizer - Comprehensive Security Tests', () => {
  let mockSecurity: MockClaudeCodeSecurity;
  let mockConsentManager: MockConsentManager;

  beforeEach(() => {
    mockSecurity = new MockClaudeCodeSecurity();
    mockConsentManager = new MockConsentManager();

    // Mock the static security system
    (ModernInputSanitizer as any).securitySystem = mockSecurity;
    ModernInputSanitizer.setConsentManager(mockConsentManager);

    // Clear console spies
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    mockConsentManager.removeAllListeners();
    jest.restoreAllMocks();
  });

  describe('Basic Prompt Sanitization', () => {
    it('should sanitize basic prompts successfully', async () => {
      const prompt = 'Analyze this code and suggest improvements';
      const result = await ModernInputSanitizer.sanitizePrompt(prompt);

      expect(result.sanitized).toBe(prompt);
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.originalCommand).toBe(prompt);
      expect(result.securityDecision).toBeDefined();
      expect(result.securityDecision?.action).toBe('allow');
    });

    it('should handle prompts with control characters', async () => {
      const prompt = 'Test with\u0000null\u0001control\u0002characters\nand\ttabs';
      const result = await ModernInputSanitizer.sanitizePrompt(prompt);

      expect(result.sanitized).toBe('Test withnullcontrolcharacters\nand\ttabs');
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
    });

    it('should handle prompts exceeding length limit', async () => {
      const longPrompt = 'A'.repeat(50001);
      const result = await ModernInputSanitizer.sanitizePrompt(longPrompt);

      expect(result.sanitized).toHaveLength(50000);
      expect(result.isValid).toBe(true);
      expect(result.violations).toContain('Prompt too long (max 50000 characters)');
    });

    it('should handle dangerous commands', async () => {
      const dangerousPrompt = 'dangerous-command execute malicious code';
      const result = await ModernInputSanitizer.sanitizePrompt(dangerousPrompt);

      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('');
      expect(result.violations).toContain('Potentially dangerous command detected');
      expect(result.securityDecision?.action).toBe('block');
    });

    it('should handle prompts requiring consent', async () => {
      const consentPrompt = 'requires-consent operation';
      const result = await ModernInputSanitizer.sanitizePrompt(consentPrompt);

      expect(result.isValid).toBe(true);
      expect(result.requiresConsent).toBe(true);
      expect(result.securityDecision?.action).toBe('askUser');
    });

    it('should create security context correctly', async () => {
      const prompt = 'test prompt';
      const context = {
        operation: 'test_operation',
        filePath: '/test/path',
        command: 'test command',
        workingDirectory: '/test/dir',
      };

      await ModernInputSanitizer.sanitizePrompt(prompt, context);

      const auditLog = mockSecurity.getAuditLog();
      expect(auditLog).toHaveLength(1);
      
      const logEntry = auditLog[0];
      expect(logEntry.operation).toBe('test_operation');
      expect(logEntry.filePath).toBe('/test/path');
      expect(logEntry.command).toBe('test command');
      expect(logEntry.userInput).toBe(prompt);
      expect(logEntry.workingDirectory).toBe('/test/dir');
      expect(logEntry.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('Consent Management', () => {
    it('should handle consent workflow successfully', async () => {
      const consentPrompt = 'requires-consent operation with user approval';
      mockConsentManager.setDefaultResponse('Allow');

      const result = await ModernInputSanitizer.sanitizeWithConsent(consentPrompt);

      expect(result.isValid).toBe(true);
      expect(result.requiresConsent).toBe(false);
      expect(result.consentRequestId).toBeDefined();
    });

    it('should handle consent denial', async () => {
      const consentPrompt = 'requires-consent operation denied';
      mockConsentManager.setDefaultResponse('Deny');

      const result = await ModernInputSanitizer.sanitizeWithConsent(consentPrompt);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('User denied consent');
      expect(result.consentRequestId).toBeDefined();
    });

    it('should handle consent request failures gracefully', async () => {
      const consentPrompt = 'requires-consent operation with failure';
      
      // Mock consent manager to throw error
      mockConsentManager.requestConsent = jest.fn().mockRejectedValue(new Error('Consent failed'));

      const result = await ModernInputSanitizer.sanitizeWithConsent(consentPrompt);

      expect(result.isValid).toBe(true); // Should default to allowing
      expect(result.requiresConsent).toBe(true);
    });

    it('should emit consent events', async () => {
      const eventHandler = jest.fn();
      mockConsentManager.on('consent-requested', eventHandler);

      const consentPrompt = 'requires-consent operation with events';
      await ModernInputSanitizer.sanitizeWithConsent(consentPrompt);

      expect(eventHandler).toHaveBeenCalledWith({
        requestId: expect.any(String),
        message: expect.stringContaining('Do you want to allow'),
        options: ['Allow', 'Deny'],
        response: 'Allow',
      });
    });

    it('should handle operations without consent manager', async () => {
      ModernInputSanitizer.setConsentManager(null as any);

      const consentPrompt = 'requires-consent operation without manager';
      const result = await ModernInputSanitizer.sanitizeWithConsent(consentPrompt);

      expect(result.isValid).toBe(true);
      expect(result.requiresConsent).toBe(true);
      expect(result.consentRequestId).toBeUndefined();
    });
  });

  describe('File Path Validation', () => {
    it('should validate safe file paths', async () => {
      const safePath = 'readme.txt';
      const result = await ModernInputSanitizer.validateFilePath(safePath);

      expect(result.sanitized).toBe('readme.txt');
      expect(result.isValid).toBe(true);
      expect(result.violations).toEqual([]);
      expect(result.securityDecision?.action).toBe('allow');
    });

    it('should handle AI placeholder paths', async () => {
      const placeholderPath = '/path/to/filename.ext';
      const result = await ModernInputSanitizer.validateFilePath(placeholderPath);

      expect(result.sanitized).toBe('filename.ext');
      expect(result.isValid).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Converting AI placeholder path')
      );
    });

    it('should handle simple absolute paths', async () => {
      const absolutePath = '/README.md';
      const result = await ModernInputSanitizer.validateFilePath(absolutePath);

      expect(result.sanitized).toBe('README.md');
      expect(result.isValid).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Converting AI-generated absolute path')
      );
    });

    it('should handle complex absolute paths', async () => {
      const complexPath = '/home/user/project/src/main.js';
      const result = await ModernInputSanitizer.validateFilePath(complexPath);

      expect(result.sanitized).toBe('main.js');
      expect(result.isValid).toBe(true);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Converting complex absolute path')
      );
    });

    it('should normalize path separators', async () => {
      const windowsPath = 'folder\\subfolder\\file.txt';
      const result = await ModernInputSanitizer.validateFilePath(windowsPath);

      expect(result.sanitized).toBe('folder/subfolder/file.txt');
      expect(result.isValid).toBe(true);
    });

    it('should block dangerous path traversal attempts', async () => {
      const dangerousPath = '../../../etc/passwd';
      const result = await ModernInputSanitizer.validateFilePath(dangerousPath);

      expect(result.isValid).toBe(false);
      expect(result.violations).toContain('Path traversal attempt detected');
      expect(result.securityDecision?.action).toBe('block');
    });

    it('should create proper security context for file operations', async () => {
      const testPath = 'test/file.js';
      await ModernInputSanitizer.validateFilePath(testPath);

      const auditLog = mockSecurity.getAuditLog();
      const logEntry = auditLog[auditLog.length - 1];

      expect(logEntry.operation).toBe('file_access');
      expect(logEntry.filePath).toBe('test/file.js');
      expect(logEntry.userInput).toBe(testPath);
      expect(logEntry.workingDirectory).toBe(process.cwd());
    });

    it('should handle empty and whitespace-only paths', async () => {
      const emptyPath = '   ';
      const result = await ModernInputSanitizer.validateFilePath(emptyPath);

      expect(result.sanitized).toBe('');
      expect(result.isValid).toBe(true);
    });
  });

  describe('Voice Name Sanitization', () => {
    it('should allow valid voice names', () => {
      const validVoices = ['Explorer', 'MAINTAINER', 'analyzer', 'developer'];
      const result = ModernInputSanitizer.sanitizeVoiceNames(validVoices);

      expect(result).toEqual(['explorer', 'maintainer', 'analyzer', 'developer']);
    });

    it('should filter invalid voice names', () => {
      const mixedVoices = ['explorer', 'invalid-voice', 'maintainer', 'hacker123', 'designer'];
      const result = ModernInputSanitizer.sanitizeVoiceNames(mixedVoices);

      expect(result).toEqual(['explorer', 'maintainer', 'designer']);
    });

    it('should handle empty and whitespace voice names', () => {
      const problematicVoices = ['explorer', '', '   ', 'maintainer', 'voice with spaces'];
      const result = ModernInputSanitizer.sanitizeVoiceNames(problematicVoices);

      expect(result).toEqual(['explorer', 'maintainer']);
    });

    it('should handle special characters in voice names', () => {
      const specialVoices = ['explorer!', 'main@tainer', 'analy$er', 'dev-eloper'];
      const result = ModernInputSanitizer.sanitizeVoiceNames(specialVoices);

      expect(result).toEqual([]);
    });

    it('should be case insensitive', () => {
      const caseVariations = ['EXPLORER', 'Maintainer', 'aNaLyZeR', 'DEVELOPER'];
      const result = ModernInputSanitizer.sanitizeVoiceNames(caseVariations);

      expect(result).toEqual(['explorer', 'maintainer', 'analyzer', 'developer']);
    });

    it('should handle all valid voice names', () => {
      const allValidVoices = [
        'explorer', 'maintainer', 'analyzer', 'developer', 'implementor',
        'security', 'architect', 'designer', 'optimizer'
      ];
      const result = ModernInputSanitizer.sanitizeVoiceNames(allValidVoices);

      expect(result).toEqual(allValidVoices);
      expect(result).toHaveLength(9);
    });
  });

  describe('Slash Command Sanitization', () => {
    it('should allow valid slash commands', () => {
      const validCommands = [
        '/help',
        '/voices',
        '/voice explorer',
        '/mode dual',
        '/todo list',
        '/plan execute',
      ];

      for (const command of validCommands) {
        const result = ModernInputSanitizer.sanitizeSlashCommand(command);
        expect(result.isValid).toBe(true);
        expect(result.violations).toEqual([]);
        expect(result.sanitized).toBeTruthy();
      }
    });

    it('should reject unauthorized commands', () => {
      const unauthorizedCommands = [
        '/execute',
        '/hack',
        '/delete',
        '/system',
        '/admin',
      ];

      for (const command of unauthorizedCommands) {
        const result = ModernInputSanitizer.sanitizeSlashCommand(command);
        expect(result.isValid).toBe(false);
        expect(result.violations).toContain(`Unauthorized command: ${command}`);
        expect(result.sanitized).toBe('');
      }
    });

    it('should handle commands with arguments', () => {
      const commandWithArgs = '/voice explorer maintainer';
      const result = ModernInputSanitizer.sanitizeSlashCommand(commandWithArgs);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('/voice explorer maintainer');
    });

    it('should clean control characters from arguments', () => {
      const commandWithBadArgs = '/todo add task\u0000with\u0001bad\u0002chars';
      const result = ModernInputSanitizer.sanitizeSlashCommand(commandWithBadArgs);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('/todo add taskwithbadchars');
    });

    it('should handle case sensitivity', () => {
      const upperCaseCommand = '/HELP';
      const result = ModernInputSanitizer.sanitizeSlashCommand(upperCaseCommand);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('/help');
    });

    it('should handle commands without arguments', () => {
      const simpleCommand = '/voices';
      const result = ModernInputSanitizer.sanitizeSlashCommand(simpleCommand);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('/voices');
    });

    it('should handle empty and malformed commands', () => {
      const malformedCommands = ['', '/', ' ', 'notacommand', '/'];

      for (const command of malformedCommands) {
        const result = ModernInputSanitizer.sanitizeSlashCommand(command);
        expect(result.isValid).toBe(false);
      }
    });

    it('should preserve original command in result', () => {
      const originalCommand = '/voice Explorer Maintainer';
      const result = ModernInputSanitizer.sanitizeSlashCommand(originalCommand);

      expect(result.originalCommand).toBe(originalCommand);
    });
  });

  describe('Security Error Creation and Audit Logging', () => {
    it('should create security errors with metadata', () => {
      const result: SanitizationResult = {
        sanitized: '',
        isValid: false,
        violations: ['Dangerous operation', 'Path traversal'],
        originalCommand: 'dangerous-command ../../../etc',
        securityDecision: {
          action: 'block',
          reason: 'Multiple security violations',
          confidence: 0.95,
          metadata: { riskLevel: 'high' },
        },
      };

      const error = ModernInputSanitizer.createSecurityError(result, 'test context');

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Security review required for test context');
      expect(error.message).toContain('Dangerous operation, Path traversal');

      const metadata = (error as any).securityContext;
      expect(metadata.originalInput).toBe('dangerous-command ../../../etc');
      expect(metadata.violations).toEqual(['Dangerous operation', 'Path traversal']);
      expect(metadata.context).toBe('test context');
      expect(metadata.timestamp).toBeDefined();
    });

    it('should get audit log with limit', async () => {
      // Generate multiple security events
      await ModernInputSanitizer.sanitizePrompt('test1');
      await ModernInputSanitizer.sanitizePrompt('test2');
      await ModernInputSanitizer.sanitizePrompt('test3');

      const limitedLog = ModernInputSanitizer.getAuditLog(2);
      expect(limitedLog).toHaveLength(2);

      const fullLog = ModernInputSanitizer.getAuditLog();
      expect(fullLog).toHaveLength(3);
    });

    it('should clear audit log', async () => {
      await ModernInputSanitizer.sanitizePrompt('test before clear');
      expect(ModernInputSanitizer.getAuditLog()).toHaveLength(1);

      ModernInputSanitizer.clearAuditLog();
      expect(ModernInputSanitizer.getAuditLog()).toHaveLength(0);
    });

    it('should update security policy', () => {
      const policyUpdates = {
        maxPromptLength: 100000,
        allowedOperations: ['read', 'write', 'analyze'],
        riskThreshold: 0.8,
      };

      // Should not throw
      expect(() => {
        ModernInputSanitizer.updateSecurityPolicy(policyUpdates);
      }).not.toThrow();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle high-volume sanitization requests', async () => {
      const startTime = Date.now();
      const promises: Promise<SanitizationResult>[] = [];

      // Create many concurrent sanitization requests
      for (let i = 0; i < 100; i++) {
        promises.push(ModernInputSanitizer.sanitizePrompt(`Test prompt ${i}`));
      }

      const results = await Promise.all(promises);
      const endTime = Date.now();

      expect(results).toHaveLength(100);
      expect(results.every(r => r.isValid)).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle extremely long prompts efficiently', async () => {
      const longPrompt = 'A'.repeat(100000); // 100k characters
      const startTime = Date.now();

      const result = await ModernInputSanitizer.sanitizePrompt(longPrompt);
      const endTime = Date.now();

      expect(result.sanitized).toHaveLength(50000); // Truncated to limit
      expect(result.violations).toContain('Prompt too long (max 50000 characters)');
      expect(endTime - startTime).toBeLessThan(1000); // Should process quickly
    });

    it('should handle Unicode and emoji characters', async () => {
      const unicodePrompt = 'Test with 🚀 emojis and ñiño unicode chars ∑∆∫';
      const result = await ModernInputSanitizer.sanitizePrompt(unicodePrompt);

      expect(result.sanitized).toBe(unicodePrompt);
      expect(result.isValid).toBe(true);
    });

    it('should handle null and undefined inputs gracefully', async () => {
      // Note: These tests assume the function handles edge cases
      const nullResult = await ModernInputSanitizer.sanitizePrompt(null as any);
      expect(nullResult.isValid).toBe(false);

      const undefinedResult = await ModernInputSanitizer.sanitizePrompt(undefined as any);
      expect(undefinedResult.isValid).toBe(false);
    });

    it('should handle concurrent file path validations', async () => {
      const paths = [
        'file1.js',
        'file2.ts',
        '/path/to/file3.py',
        '../file4.txt',
        'folder/file5.md',
      ];

      const promises = paths.map(path => ModernInputSanitizer.validateFilePath(path));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(r => r.sanitized !== undefined)).toBe(true);
    });

    it('should maintain thread safety with concurrent operations', async () => {
      const operations = [
        () => ModernInputSanitizer.sanitizePrompt('test1'),
        () => ModernInputSanitizer.validateFilePath('test1.js'),
        () => ModernInputSanitizer.sanitizeSlashCommand('/help'),
        () => ModernInputSanitizer.sanitizeVoiceNames(['explorer']),
      ];

      const promises = Array.from({ length: 50 }, (_, i) =>
        operations[i % operations.length]()
      );

      const results = await Promise.allSettled(promises);
      
      expect(results.every(r => r.status === 'fulfilled')).toBe(true);
    });

    it('should handle memory cleanup properly', async () => {
      const initialMemory = process.memoryUsage();

      // Perform many operations
      for (let i = 0; i < 1000; i++) {
        await ModernInputSanitizer.sanitizePrompt(`Memory test ${i}`);
      }

      const finalMemory = process.memoryUsage();
      const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory growth should be reasonable (less than 10MB for this test)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Integration with Claude Code Security System', () => {
    it('should integrate properly with security evaluation system', async () => {
      const testPrompt = 'integration test prompt';
      const context = {
        operation: 'integration_test',
        command: 'test-command',
      };

      const result = await ModernInputSanitizer.sanitizePrompt(testPrompt, context);

      expect(result.securityDecision).toBeDefined();
      expect(result.securityDecision?.action).toBe('allow');
      expect(result.securityDecision?.confidence).toBeGreaterThan(0);

      const auditLog = ModernInputSanitizer.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);
      
      const lastEntry = auditLog[auditLog.length - 1];
      expect(lastEntry.operation).toBe('integration_test');
    });

    it('should handle security system errors gracefully', async () => {
      // Mock security system to throw error
      const originalEvaluate = mockSecurity.evaluateSecurity;
      mockSecurity.evaluateSecurity = jest.fn().mockRejectedValue(new Error('Security system error'));

      // Should handle error and default to safe behavior
      await expect(ModernInputSanitizer.sanitizePrompt('test')).resolves.toBeDefined();

      // Restore original method
      mockSecurity.evaluateSecurity = originalEvaluate;
    });

    it('should respect security policy updates', () => {
      const newPolicy = {
        strictMode: true,
        maxRiskLevel: 0.5,
        requiredApprovals: ['security', 'admin'],
      };

      expect(() => {
        ModernInputSanitizer.updateSecurityPolicy(newPolicy);
      }).not.toThrow();
    });

    it('should provide comprehensive audit information', async () => {
      await ModernInputSanitizer.sanitizePrompt('audit test', {
        operation: 'audit_operation',
        filePath: 'audit.log',
        command: 'audit-command',
        workingDirectory: '/audit/dir',
      });

      const auditLog = ModernInputSanitizer.getAuditLog(1);
      const entry = auditLog[0];

      expect(entry.operation).toBe('audit_operation');
      expect(entry.filePath).toBe('audit.log');
      expect(entry.command).toBe('audit-command');
      expect(entry.workingDirectory).toBe('/audit/dir');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });
  });
});