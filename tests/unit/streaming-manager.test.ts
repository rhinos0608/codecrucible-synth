/**
 * StreamingManager Unit Tests
 * Following Living Spiral TDD methodology
 * Tests extracted streaming functionality for quality assurance
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StreamingManager, StreamToken, StreamConfig } from '../../src/core/streaming/streaming-manager.js';

describe('StreamingManager', () => {
  let streamingManager: StreamingManager;
  let mockOnToken: jest.MockedFunction<(token: StreamToken) => void>;

  beforeEach(() => {
    streamingManager = new StreamingManager();
    mockOnToken = jest.fn();
  });

  afterEach(async () => {
    await streamingManager.cleanup();
  });

  describe('Configuration Management', () => {
    it('should initialize with default configuration', () => {
      const config = streamingManager.getConfig();
      expect(config.chunkSize).toBe(50);
      expect(config.bufferSize).toBe(1024);
      expect(config.enableBackpressure).toBe(true);
      expect(config.timeout).toBe(30000);
      expect(config.encoding).toBe('utf8');
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<StreamConfig> = {
        chunkSize: 100,
        timeout: 60000,
      };
      
      const manager = new StreamingManager(customConfig);
      const config = manager.getConfig();
      
      expect(config.chunkSize).toBe(100);
      expect(config.timeout).toBe(60000);
      expect(config.bufferSize).toBe(1024); // Should keep default
    });

    it('should update configuration dynamically', () => {
      streamingManager.updateConfig({ chunkSize: 75 });
      const config = streamingManager.getConfig();
      expect(config.chunkSize).toBe(75);
    });
  });

  describe('Session Management', () => {
    it('should create unique sessions', () => {
      const session1 = streamingManager.createSession();
      const session2 = streamingManager.createSession();
      
      expect(session1.id).not.toBe(session2.id);
      expect(session1.isActive).toBe(true);
      expect(session2.isActive).toBe(true);
    });

    it('should create session with custom ID', () => {
      const customId = 'test-session-123';
      const session = streamingManager.createSession(customId);
      
      expect(session.id).toBe(customId);
      expect(streamingManager.getSession(customId)).toBe(session);
    });

    it('should throw error for duplicate session IDs', () => {
      const sessionId = 'duplicate-test';
      streamingManager.createSession(sessionId);
      
      expect(() => {
        streamingManager.createSession(sessionId);
      }).toThrow(`Session ${sessionId} already exists`);
    });

    it('should destroy sessions properly', () => {
      const session = streamingManager.createSession();
      const sessionId = session.id;
      
      expect(streamingManager.getSession(sessionId)).toBeDefined();
      
      streamingManager.destroySession(sessionId);
      
      expect(streamingManager.getSession(sessionId)).toBeUndefined();
    });
  });

  describe('Streaming Operations', () => {
    it('should stream content token by token', async () => {
      const content = 'Hello world this is a test message';
      
      await streamingManager.startStream(content, mockOnToken);
      
      // Verify tokens were emitted
      expect(mockOnToken).toHaveBeenCalled();
      expect(mockOnToken.mock.calls.length).toBeGreaterThan(1);
      
      // Verify token structure
      const firstCall = mockOnToken.mock.calls[0];
      const token = firstCall[0] as StreamToken;
      
      expect(token).toHaveProperty('content');
      expect(token).toHaveProperty('timestamp');
      expect(token).toHaveProperty('index');
      expect(token).toHaveProperty('metadata');
      expect(token.index).toBe(0);
    });

    it('should mark final token as finished', async () => {
      const content = 'Short content';
      
      await streamingManager.startStream(content, mockOnToken);
      
      // Find the last token
      const lastCall = mockOnToken.mock.calls[mockOnToken.mock.calls.length - 1];
      const lastToken = lastCall[0] as StreamToken;
      
      expect(lastToken.finished).toBe(true);
    });

    it('should return complete content after streaming', async () => {
      const content = 'Test content for streaming';
      
      const result = await streamingManager.startStream(content, mockOnToken);
      
      expect(result).toBe(content);
    });

    it('should handle backpressure when enabled', async () => {
      const content = 'This is a longer content string that will be tokenized into multiple chunks to trigger backpressure handling mechanisms properly';
      
      const startTime = Date.now();
      await streamingManager.startStream(content, mockOnToken);
      const endTime = Date.now();
      
      // Should take some time due to backpressure delays and processing
      expect(endTime - startTime).toBeGreaterThan(40);
    });
  });

  describe('Metrics Tracking', () => {
    it('should track streaming metrics', async () => {
      const content = 'Test content for metrics tracking with multiple words';
      
      await streamingManager.startStream(content, mockOnToken);
      
      // Wait for metrics to be properly calculated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metrics = streamingManager.getAllMetrics();
      expect(metrics.size).toBeGreaterThan(0);
      
      const sessionMetrics = Array.from(metrics.values())[0];
      expect(sessionMetrics.tokensStreamed).toBeGreaterThan(0);
      expect(sessionMetrics.streamDuration).toBeGreaterThan(0);
    });

    it('should calculate throughput correctly', async () => {
      const content = 'Test content with more words for better metrics calculation';
      
      await streamingManager.startStream(content, mockOnToken);
      
      // Wait for metrics to be properly calculated
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const metrics = streamingManager.getAllMetrics();
      const sessionMetrics = Array.from(metrics.values())[0];
      
      expect(sessionMetrics.throughput).toBeGreaterThan(0);
      expect(sessionMetrics.averageLatency).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should cleanup on stream failure', async () => {
      const content = 'Test content';
      
      // Mock onToken to throw error
      const errorOnToken = jest.fn().mockImplementation(() => {
        throw new Error('Token processing failed');
      });
      
      await expect(
        streamingManager.startStream(content, errorOnToken)
      ).rejects.toThrow();
      
      // Session should be cleaned up
      const metrics = streamingManager.getAllMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('Cleanup Operations', () => {
    it('should cleanup all sessions and resources', async () => {
      // Create multiple sessions
      streamingManager.createSession('session1');
      streamingManager.createSession('session2');
      
      expect(streamingManager.getAllMetrics().size).toBe(2);
      
      await streamingManager.cleanup();
      
      expect(streamingManager.getAllMetrics().size).toBe(0);
      expect(streamingManager.getSession('session1')).toBeUndefined();
      expect(streamingManager.getSession('session2')).toBeUndefined();
    });
  });

  describe('Event Emission', () => {
    it('should emit token events during streaming', async () => {
      const tokenEventSpy = jest.fn();
      streamingManager.on('token', tokenEventSpy);
      
      const content = 'Test content for events';
      await streamingManager.startStream(content, mockOnToken);
      
      expect(tokenEventSpy).toHaveBeenCalled();
    });

    it('should emit session lifecycle events', () => {
      const sessionCreatedSpy = jest.fn();
      const sessionDestroyedSpy = jest.fn();
      
      streamingManager.on('session-created', sessionCreatedSpy);
      streamingManager.on('session-destroyed', sessionDestroyedSpy);
      
      const session = streamingManager.createSession();
      expect(sessionCreatedSpy).toHaveBeenCalledWith(session.id);
      
      streamingManager.destroySession(session.id);
      expect(sessionDestroyedSpy).toHaveBeenCalledWith(session.id);
    });
  });
});