import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { EnhancedToolIntegration } from '../../../../src/infrastructure/tools/enhanced-tool-integration.js';

describe('EnhancedToolIntegration cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears cache cleanup interval on dispose', () => {
    const before = jest.getTimerCount();
    
    // Create a mock base tool integration for testing
    const mockBaseIntegration = {
      executeToolCall: jest.fn().mockResolvedValue({ result: 'test' }),
      getLLMFunctions: jest.fn().mockResolvedValue([])
    } as any;
    
    const integration = new EnhancedToolIntegration(mockBaseIntegration);
    expect(jest.getTimerCount()).toBeGreaterThan(before);
    integration.dispose();
    expect(jest.getTimerCount()).toBe(before);
  });
});
