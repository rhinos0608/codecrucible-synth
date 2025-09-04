/**
 * StreamingManager Integration Tests
 * Following AI Coding Grimoire - Real Implementation First
 * Tests with actual streaming operations and real token generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  StreamingManager,
  StreamToken,
  StreamConfig,
  StreamMetrics,
} from '../../src/core/streaming/streaming-manager.js';
import { EventEmitter } from 'events';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises';

describe('StreamingManager Real Integration Tests', () => {
  let streamingManager: StreamingManager;
  let tempDir: string;
  let testEventEmitter: EventEmitter;

  beforeEach(async () => {
    // Create temporary directory for test isolation
    tempDir = await mkdtemp(join(tmpdir(), 'streaming-test-'));

    // Create real event emitter for testing
    testEventEmitter = new EventEmitter();

    // Initialize StreamingManager with real configuration
    streamingManager = new StreamingManager({
      chunkSize: 10, // Small chunks for predictable testing
      delayMs: 10, // Fast for testing
      enableMetrics: true,
      enableSession: true,
      sessionDir: tempDir,
    });
  });

  afterEach(async () => {
    // Cleanup resources
    if (streamingManager) {
      await streamingManager.cleanup();
    }

    // Remove temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Real Token Streaming', () => {
    it('should stream real content progressively', async () => {
      const testContent =
        'This is a real test of streaming content that will be chunked progressively.';
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      const result = await streamingManager.startStream(testContent, onToken);

      // Verify streaming completed
      expect(result).toBe(testContent);

      // Verify tokens were generated
      expect(receivedTokens.length).toBeGreaterThan(0);

      // Verify content reconstruction
      const reconstructedContent = receivedTokens.map(t => t.content).join('');
      expect(reconstructedContent).toBe(testContent);

      // Verify token properties
      receivedTokens.forEach((token, index) => {
        expect(token.content).toBeDefined();
        expect(typeof token.timestamp).toBe('number');
        expect(token.index).toBe(index);
        expect(typeof token.isComplete).toBe('boolean');
      });

      // Last token should be marked as complete
      expect(receivedTokens[receivedTokens.length - 1].isComplete).toBe(true);
    });

    it('should handle empty content gracefully', async () => {
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      const result = await streamingManager.startStream('', onToken);

      expect(result).toBe('');
      expect(receivedTokens.length).toBe(1); // Should still emit one completion token
      expect(receivedTokens[0].isComplete).toBe(true);
    });

    it('should respect custom streaming configuration', async () => {
      const customConfig: StreamConfig = {
        chunkSize: 5,
        delayMs: 5,
        enableMetrics: true,
      };

      const testContent = 'Short test content';
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      const startTime = Date.now();
      await streamingManager.startStream(testContent, onToken, customConfig);
      const endTime = Date.now();

      // Should have multiple tokens due to small chunk size
      expect(receivedTokens.length).toBeGreaterThan(1);

      // Should take some time due to delays
      expect(endTime - startTime).toBeGreaterThan(receivedTokens.length * customConfig.delayMs!);
    });

    it('should handle large content efficiently', async () => {
      // Generate large content (1MB of text)
      const largeContent = 'A'.repeat(1024 * 1024);
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      const startTime = Date.now();
      const result = await streamingManager.startStream(largeContent, onToken, {
        chunkSize: 1024, // 1KB chunks
        delayMs: 1, // Minimal delay
      });
      const endTime = Date.now();

      expect(result).toBe(largeContent);
      expect(receivedTokens.length).toBeGreaterThan(100); // Should be chunked
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify content integrity
      const reconstructed = receivedTokens.map(t => t.content).join('');
      expect(reconstructed).toBe(largeContent);
    }, 10000);
  });

  describe('Real Session Management', () => {
    it('should create and persist real sessions', async () => {
      const sessionId = await streamingManager.createSession();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      // Verify session file was created
      const sessionFile = join(tempDir, `${sessionId}.json`);
      const sessionData = JSON.parse(await readFile(sessionFile, 'utf-8'));

      expect(sessionData.id).toBe(sessionId);
      expect(sessionData.startTime).toBeDefined();
      expect(Array.isArray(sessionData.tokens)).toBe(true);
    });

    it('should add real tokens to session', async () => {
      const sessionId = await streamingManager.createSession();

      const testTokens: StreamToken[] = [
        { content: 'Hello', timestamp: Date.now(), index: 0, isComplete: false },
        { content: ' world', timestamp: Date.now(), index: 1, isComplete: true },
      ];

      for (const token of testTokens) {
        await streamingManager.addTokenToSession(sessionId, token);
      }

      const session = await streamingManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.tokens).toHaveLength(2);
      expect(session!.tokens[0].content).toBe('Hello');
      expect(session!.tokens[1].content).toBe(' world');
    });

    it('should retrieve session content correctly', async () => {
      const sessionId = await streamingManager.createSession();

      const testContent = 'Real session content test';
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      await streamingManager.startStream(testContent, onToken, { sessionId });

      const sessionContent = await streamingManager.getSessionContent(sessionId);
      expect(sessionContent).toBe(testContent);
    });

    it('should clean up sessions properly', async () => {
      const sessionId = await streamingManager.createSession();

      // Verify session exists
      const sessionBefore = await streamingManager.getSession(sessionId);
      expect(sessionBefore).toBeDefined();

      // Clean up session
      await streamingManager.cleanupSession(sessionId);

      // Verify session is removed
      const sessionAfter = await streamingManager.getSession(sessionId);
      expect(sessionAfter).toBeNull();
    });
  });

  describe('Real Metrics Collection', () => {
    it('should collect real streaming metrics', async () => {
      const testContent = 'Test content for metrics collection';
      const receivedTokens: StreamToken[] = [];

      const onToken = (token: StreamToken) => {
        receivedTokens.push(token);
      };

      const startTime = Date.now();
      await streamingManager.startStream(testContent, onToken, {
        enableMetrics: true,
        chunkSize: 5,
        delayMs: 10,
      });
      const endTime = Date.now();

      const metrics = streamingManager.getMetrics();

      expect(metrics).toBeDefined();
      expect(metrics.totalTokens).toBe(receivedTokens.length);
      expect(metrics.totalCharacters).toBe(testContent.length);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.throughput).toBeGreaterThan(0);
      expect(metrics.sessionsCreated).toBeGreaterThanOrEqual(0);

      // Timing should be reasonable
      expect(metrics.averageLatency).toBeLessThan(endTime - startTime);
    });

    it('should track multiple streams in metrics', async () => {
      const stream1Content = 'First stream content';
      const stream2Content = 'Second stream content is longer';

      const onToken = () => {}; // No-op token handler

      // Stream first content
      await streamingManager.startStream(stream1Content, onToken, { enableMetrics: true });

      const metricsAfterFirst = streamingManager.getMetrics();
      const firstTokenCount = metricsAfterFirst.totalTokens;
      const firstCharCount = metricsAfterFirst.totalCharacters;

      // Stream second content
      await streamingManager.startStream(stream2Content, onToken, { enableMetrics: true });

      const metricsAfterSecond = streamingManager.getMetrics();

      // Metrics should accumulate
      expect(metricsAfterSecond.totalTokens).toBeGreaterThan(firstTokenCount);
      expect(metricsAfterSecond.totalCharacters).toBeGreaterThan(firstCharCount);
      expect(metricsAfterSecond.totalCharacters).toBe(firstCharCount + stream2Content.length);
    });

    it('should reset metrics correctly', () => {
      // Get baseline metrics
      const initialMetrics = streamingManager.getMetrics();

      // Reset metrics
      streamingManager.resetMetrics();

      const resetMetrics = streamingManager.getMetrics();

      expect(resetMetrics.totalTokens).toBe(0);
      expect(resetMetrics.totalCharacters).toBe(0);
      expect(resetMetrics.averageLatency).toBe(0);
      expect(resetMetrics.throughput).toBe(0);
      expect(resetMetrics.sessionsCreated).toBe(0);
    });
  });

  describe('Real Error Handling', () => {
    it('should handle streaming errors gracefully', async () => {
      const receivedTokens: StreamToken[] = [];

      // Create a token handler that throws after a few tokens
      let tokenCount = 0;
      const errorOnToken = (token: StreamToken) => {
        receivedTokens.push(token);
        tokenCount++;
        if (tokenCount === 3) {
          throw new Error('Simulated token handler error');
        }
      };

      const testContent = 'This content will cause an error during streaming';

      await expect(streamingManager.startStream(testContent, errorOnToken)).rejects.toThrow(
        'Simulated token handler error'
      );

      // Should have received some tokens before error
      expect(receivedTokens.length).toBe(3);
    });

    it('should handle invalid session operations', async () => {
      const nonExistentSessionId = 'non-existent-session-id';

      // Should handle getting non-existent session
      const session = await streamingManager.getSession(nonExistentSessionId);
      expect(session).toBeNull();

      // Should handle getting content from non-existent session
      const content = await streamingManager.getSessionContent(nonExistentSessionId);
      expect(content).toBe('');

      // Should handle cleanup of non-existent session
      await expect(streamingManager.cleanupSession(nonExistentSessionId)).not.toThrow();
    });
  });

  describe('Real Performance', () => {
    it('should maintain consistent performance across multiple streams', async () => {
      const testContent = 'Performance test content for consistency measurement';
      const streamTimes: number[] = [];
      const onToken = () => {}; // No-op for performance testing

      // Run multiple streams and measure performance
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await streamingManager.startStream(testContent, onToken, {
          chunkSize: 10,
          delayMs: 1,
        });
        const endTime = Date.now();
        streamTimes.push(endTime - startTime);
      }

      // Calculate performance consistency
      const avgTime = streamTimes.reduce((a, b) => a + b) / streamTimes.length;
      const maxDeviation = Math.max(...streamTimes.map(t => Math.abs(t - avgTime)));

      // Performance should be reasonably consistent (within 50% deviation)
      expect(maxDeviation / avgTime).toBeLessThan(0.5);

      // All streams should complete in reasonable time
      expect(Math.max(...streamTimes)).toBeLessThan(1000); // Less than 1 second
    }, 10000);
  });
});
