import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RateLimiter } from '../../../../src/infrastructure/security/rate-limiter.js';

describe('RateLimiter timer cleanup', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('clears sliding window cleanup interval on stop', () => {
    const limiter = new RateLimiter({
      algorithm: 'sliding-window',
      windowMs: 60000,
      maxRequests: 10,
    });

    const cleanupSpy = jest.spyOn(limiter as any, 'cleanupSlidingWindows');

    // Trigger initial cleanup
    jest.advanceTimersByTime(60000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    // Stop the limiter and ensure no further cleanup
    limiter.stop();
    jest.advanceTimersByTime(60000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it('stops memory store cleanup timer on stop', () => {
    const limiter = new RateLimiter({
      algorithm: 'fixed-window',
      windowMs: 60000,
      maxRequests: 10,
    });

    const store: any = (limiter as any).store;
    const cleanupSpy = jest.spyOn(store, 'cleanup');

    // Trigger initial cleanup
    jest.advanceTimersByTime(60000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);

    // Stop the limiter and ensure no further cleanup
    limiter.stop();
    jest.advanceTimersByTime(60000);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
