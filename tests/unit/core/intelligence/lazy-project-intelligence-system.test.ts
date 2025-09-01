import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LazyProjectIntelligenceSystem } from '../../../../src/core/intelligence/lazy-project-intelligence.js';

describe('LazyProjectIntelligenceSystem cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears cleanup interval on dispose', async () => {
    const before = jest.getTimerCount();
    const system = new LazyProjectIntelligenceSystem();
    expect(jest.getTimerCount()).toBeGreaterThan(before);
    await system.dispose();
    expect(jest.getTimerCount()).toBe(before);
  });
});
