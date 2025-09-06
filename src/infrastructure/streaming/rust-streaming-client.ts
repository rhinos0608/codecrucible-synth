/**
 * Rust Streaming Client
 *
 * TypeScript interface for true streaming from Rust executor
 * Eliminates memory accumulation by processing chunks incrementally
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { outputConfig } from '../../utils/output-config.js';
import {
  loadRustExecutorSafely,
  createFallbackRustExecutor,
} from '../../utils/rust-module-loader.js';
import type {
  StreamChunk,
  StreamProcessor,
  StreamSession,
  StreamOptions,
  StreamEvent,
} from './stream-chunk-protocol.js';

// Load the Rust executor with cross-platform support
const rustModuleResult = loadRustExecutorSafely();
const RustExecutor = rustModuleResult.available ? rustModuleResult.module.RustExecutor : null;

if (rustModuleResult.available) {
  logger.info(`🦀 Rust executor loaded from: ${rustModuleResult.binaryPath}`);
} else {
  logger.warn(`⚠️ Rust executor not available: ${rustModuleResult.error}`);
}

/**
 * High-performance streaming client backed by Rust
 */
export class RustStreamingClient extends EventEmitter {
  private rustExecutor: any | null = null;
  private activeSessions: Map<string, StreamSession> = new Map();
  private processors: Map<string, StreamProcessor> = new Map();
  private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  private readonly SESSION_TIMEOUT_MS = 300000; // 5 minutes timeout

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent streams

    if (RustExecutor) {
      this.rustExecutor = new RustExecutor();
      this.rustExecutor.initialize();
      this.isInitialized = true;
      logger.info('🦀 Rust streaming client initialized');
    } else {
      logger.warn('🔄 Rust executor unavailable - streaming will use TypeScript fallback');
    }
  }

  /**
   * Check if Rust streaming is available
   */
  isRustAvailable(): boolean {
    return this.isInitialized && this.rustExecutor !== null;
  }

  /**
   * Stream file content with true chunked processing
   */
  async streamFile(
    filePath: string,
    processor: StreamProcessor,
    options?: Partial<StreamOptions>
  ): Promise<string> {
    if (!this.isRustAvailable()) {
      throw new Error('Rust executor not available for streaming');
    }

    const streamOptions = this.createStreamOptions('fileAnalysis', options);
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create session
    const session: StreamSession = {
      id: sessionId,
      state: 'initializing',
      options: streamOptions,
      stats: {
        chunksProcessed: 0,
        bytesStreamed: 0,
        startTime: Date.now(),
        avgChunkTime: 0,
        peakMemoryBytes: 0,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.processors.set(sessionId, processor);
    this.startSessionTimeout(sessionId);

    logger.info(`🚀 Starting Rust file stream: ${filePath} (session: ${sessionId})`);
    session.state = 'streaming';

    try {
      // Create callback for chunk processing
      const chunkCallback = (chunk: any) => {
        this.handleChunk(sessionId, chunk);
      };

      // Start streaming from Rust
      const rustStreamId = this.rustExecutor.streamFile(
        filePath,
        streamOptions.chunkSize,
        streamOptions.contextType,
        chunkCallback
      );

      logger.info(`✅ Rust stream started: ${rustStreamId} for session ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('❌ Rust file streaming failed:', error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      await processor.onError(session.error, session);
      throw error;
    }
  }

  /**
   * Stream command output with real-time processing
   */
  async streamCommand(
    command: string,
    args: string[],
    processor: StreamProcessor,
    options?: Partial<StreamOptions>
  ): Promise<string> {
    if (!this.isRustAvailable()) {
      throw new Error('Rust executor not available for streaming');
    }

    const streamOptions = this.createStreamOptions('commandOutput', options);
    const sessionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create session
    const session: StreamSession = {
      id: sessionId,
      state: 'initializing',
      options: streamOptions,
      stats: {
        chunksProcessed: 0,
        bytesStreamed: 0,
        startTime: Date.now(),
        avgChunkTime: 0,
        peakMemoryBytes: 0,
      },
    };

    this.activeSessions.set(sessionId, session);
    this.processors.set(sessionId, processor);
    this.startSessionTimeout(sessionId);

    logger.info(
      `🚀 Starting Rust command stream: ${command} ${args.join(' ')} (session: ${sessionId})`
    );
    session.state = 'streaming';

    try {
      // Create callback for chunk processing
      const chunkCallback = (chunk: any) => {
        this.handleChunk(sessionId, chunk);
      };

      // Start streaming from Rust
      const rustStreamId = this.rustExecutor.streamCommand(
        command,
        args,
        streamOptions.chunkSize,
        chunkCallback
      );

      logger.info(`✅ Rust command stream started: ${rustStreamId} for session ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('❌ Rust command streaming failed:', error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      await processor.onError(session.error, session);
      throw error;
    }
  }

  /**
   * Handle incoming chunks from Rust with EPIPE protection
   */
  private async handleChunk(sessionId: string, rawChunk: any): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    const processor = this.processors.get(sessionId);

    if (!session || !processor) {
      logger.warn(`Received chunk for unknown session: ${sessionId} - terminating orphaned stream`);
      // Terminate orphaned streams to prevent EPIPE
      if (this.rustExecutor && this.rustExecutor.terminateStream) {
        try {
          this.rustExecutor.terminateStream(sessionId);
        } catch (error) {
          logger.debug(`Failed to terminate orphaned stream ${sessionId}:`, error);
        }
      }
      return;
    }

    // Check if session is still active (prevent processing after cancellation)
    if (
      session.state === 'cancelled' ||
      session.state === 'error' ||
      session.state === 'completed'
    ) {
      logger.debug(`Ignoring chunk for ${session.state} session: ${sessionId}`);
      this.cleanupSession(sessionId);
      return;
    }

    const startTime = Date.now();

    // Reset timeout on activity to prevent killing active streams
    this.resetSessionTimeout(sessionId);

    try {
      // Convert raw chunk to StreamChunk interface
      const chunk: StreamChunk = {
        streamId: rawChunk.streamId,
        sequence: rawChunk.sequence,
        contentType: rawChunk.contentType,
        data: rawChunk.data,
        size: rawChunk.size,
        metadata: {
          source: rawChunk.metadata.source,
          isLast: rawChunk.metadata.isLast,
          progress: rawChunk.metadata.progress,
          totalSize: rawChunk.metadata.totalSize,
          error: rawChunk.metadata.error,
          encoding: rawChunk.metadata.encoding,
          mimeType: rawChunk.metadata.mimeType,
          compression: rawChunk.metadata.compression,
        },
        timing: {
          generatedAt: rawChunk.timing?.generatedAt || Date.now(),
          sentAt: rawChunk.timing?.sentAt || Date.now(),
          rustProcessingTime: rawChunk.timing?.rustProcessingTime || 0,
        },
        resourceUsage: rawChunk.resourceUsage,
      };

      // Update session stats
      session.stats.chunksProcessed++;
      session.stats.bytesStreamed += chunk.size;

      // Process chunk through processor
      await processor.processChunk(chunk);

      // Calculate performance metrics
      const chunkTime = Date.now() - startTime;
      session.stats.avgChunkTime =
        (session.stats.avgChunkTime * (session.stats.chunksProcessed - 1) + chunkTime) /
        session.stats.chunksProcessed;

      // Update peak memory if available
      if (
        chunk.resourceUsage?.memoryBytes &&
        chunk.resourceUsage.memoryBytes > session.stats.peakMemoryBytes
      ) {
        session.stats.peakMemoryBytes = chunk.resourceUsage.memoryBytes;
      }

      // Emit progress event
      const progressEvent: StreamEvent = {
        type: 'chunk',
        streamId: sessionId,
        timestamp: Date.now(),
        data: {
          sequence: chunk.sequence,
          progress: chunk.metadata.progress,
          bytesProcessed: session.stats.bytesStreamed,
        },
      };
      this.emit('streamEvent', progressEvent);

      // Handle stream completion
      if (chunk.metadata.isLast) {
        await this.completeSession(sessionId, processor, session);
      }

      // Handle errors
      if (chunk.metadata.error) {
        session.state = 'error';
        session.error = chunk.metadata.error;
        await processor.onError(chunk.metadata.error, session);
        this.cleanupSession(sessionId);
      }
    } catch (error) {
      logger.error(`Error processing chunk for session ${sessionId}:`, error);
      session.state = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      await processor.onError(session.error, session);
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Complete a streaming session
   */
  private async completeSession(
    sessionId: string,
    processor: StreamProcessor,
    session: StreamSession
  ): Promise<void> {
    session.state = 'completed';
    session.stats.endTime = Date.now();

    const totalTime = session.stats.endTime - session.stats.startTime;
    const throughput = session.stats.bytesStreamed / (totalTime / 1000); // bytes per second

    logger.info(`🏁 Stream completed: ${sessionId}`, {
      chunks: session.stats.chunksProcessed,
      bytes: session.stats.bytesStreamed,
      duration: totalTime,
      throughput: `${this.formatBytes(throughput)}/s`,
      avgChunkTime: `${session.stats.avgChunkTime.toFixed(2)}ms`,
    });

    await processor.onCompleted(session);

    const completedEvent: StreamEvent = {
      type: 'completed',
      streamId: sessionId,
      timestamp: Date.now(),
      data: session.stats,
    };
    this.emit('streamEvent', completedEvent);

    this.cleanupSession(sessionId);
  }

  /**
   * Start timeout for session to prevent indefinite hangs
   */
  private startSessionTimeout(sessionId: string): void {
    const timeout = setTimeout(() => {
      const session = this.activeSessions.get(sessionId);
      if (session && session.state === 'streaming') {
        logger.warn(
          `Session ${sessionId} timed out after ${this.SESSION_TIMEOUT_MS}ms - terminating`
        );
        session.state = 'error';
        session.error = 'Session timeout - stream abandoned';

        const processor = this.processors.get(sessionId);
        if (processor) {
          processor.onError(session.error, session).catch(error => {
            logger.error(
              `Error calling processor onError for timed out session ${sessionId}:`,
              error
            );
          });
        }

        this.cleanupSession(sessionId);
      }
    }, this.SESSION_TIMEOUT_MS);

    this.sessionTimeouts.set(sessionId, timeout);
  }

  /**
   * Clear session timeout
   */
  private clearSessionTimeout(sessionId: string): void {
    const timeout = this.sessionTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }
  }

  /**
   * Reset session timeout (called when activity is detected)
   */
  private resetSessionTimeout(sessionId: string): void {
    this.clearSessionTimeout(sessionId);
    this.startSessionTimeout(sessionId);
  }

  /**
   * Clean up session resources with proper Rust-side termination
   */
  private cleanupSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);

    // Clear session timeout to prevent memory leaks
    this.clearSessionTimeout(sessionId);

    // Tell Rust to terminate the stream before cleanup
    if (session && this.rustExecutor && this.isRustAvailable()) {
      try {
        // Terminate stream on Rust side to prevent EPIPE errors
        if (this.rustExecutor.terminateStream) {
          this.rustExecutor.terminateStream(sessionId);
        }
      } catch (error) {
        logger.warn(`Failed to terminate Rust stream ${sessionId}:`, error);
      }
    }

    this.activeSessions.delete(sessionId);
    this.processors.delete(sessionId);

    logger.debug(`🧹 Cleaned up session: ${sessionId}`);
  }

  /**
   * Get active session statistics
   */
  getActiveSessionStats(): Array<{ sessionId: string; stats: StreamSession['stats'] }> {
    return Array.from(this.activeSessions.entries()).map(([sessionId, session]) => ({
      sessionId,
      stats: session.stats,
    }));
  }

  /**
   * Cancel a streaming session
   */
  async cancelStream(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;

    session.state = 'cancelled';
    this.cleanupSession(sessionId);

    const cancelledEvent: StreamEvent = {
      type: 'cancelled',
      streamId: sessionId,
      timestamp: Date.now(),
    };
    this.emit('streamEvent', cancelledEvent);

    return true;
  }

  /**
   * Create stream options with adaptive defaults
   */
  private createStreamOptions(
    contextType: StreamOptions['contextType'],
    overrides?: Partial<StreamOptions>
  ): StreamOptions {
    const config = outputConfig.getConfig();

    const baseOptions: StreamOptions = {
      chunkSize: config.streamingChunkSize,
      compression: config.compressionEnabled,
      bufferSize: Math.min(config.maxBufferSize, 64 * 1024),
      timeoutMs: 30000,
      contextType,
      includeMetrics: true,
      ...overrides,
    };

    // Context-specific optimizations
    switch (contextType) {
      case 'fileAnalysis':
        baseOptions.chunkSize = Math.max(baseOptions.chunkSize, 32 * 1024); // Larger chunks for file analysis
        break;
      case 'commandOutput':
        baseOptions.chunkSize = Math.min(baseOptions.chunkSize, 8 * 1024); // Smaller chunks for real-time output
        baseOptions.compression = false; // Don't compress command output
        break;
      case 'codeGeneration':
        baseOptions.compression = false; // Preserve code formatting
        break;
    }

    return baseOptions;
  }

  /**
   * Format bytes for human-readable output
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    // Cancel all active sessions
    for (const sessionId of this.activeSessions.keys()) {
      await this.cancelStream(sessionId);
    }

    // Clear all remaining timeouts
    for (const [sessionId, timeout] of this.sessionTimeouts.entries()) {
      clearTimeout(timeout);
      this.sessionTimeouts.delete(sessionId);
    }

    this.removeAllListeners();
    logger.info('🧹 Rust streaming client cleaned up');
  }
}

// Export singleton instance
export const rustStreamingClient = new RustStreamingClient();
