/**
 * Rust Streaming Client
 *
 * TypeScript interface for true streaming from Rust executor
 * Eliminates memory accumulation by processing chunks incrementally
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { outputConfig } from '../../utils/output-config.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';
import { loadRustExecutorSafely } from '../../utils/rust-module-loader.js';
import type {
  StreamChunk,
  StreamEvent,
  StreamOptions,
  StreamProcessor,
  StreamSession,
} from './stream-chunk-protocol.js';

// Import the complete interface from rust-module-loader
import type { RustExecutorModule } from '../../utils/rust-module-loader.js';

// Load the Rust executor with cross-platform support
const rustModuleResult = loadRustExecutorSafely();
const RustExecutor =
  rustModuleResult.available && rustModuleResult.module
    ? rustModuleResult.module.RustExecutor
    : null;

if (rustModuleResult.available) {
  logger.info(`🦀 Rust executor loaded from: ${rustModuleResult.binaryPath}`);
} else {
  logger.warn(`⚠️ Rust executor not available: ${rustModuleResult.error}`);
}

/**
 * High-performance streaming client backed by Rust
 */
export class RustStreamingClient extends EventEmitter {
  private readonly rustExecutor: InstanceType<RustExecutorModule['RustExecutor']> | null = null;
  private readonly activeSessions: Map<string, StreamSession> = new Map();
  private readonly processors: Map<string, StreamProcessor> = new Map();
  private readonly sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isInitialized = false;
  private readonly SESSION_TIMEOUT_MS = 300000; // 5 minutes timeout

  public constructor() {
    super();
    this.setMaxListeners(100); // Allow many concurrent streams

    if (RustExecutor) {
      this.rustExecutor = new RustExecutor();
      // Initialize asynchronously in background
      this.initializeRustExecutor();
    } else {
      logger.warn('🔄 Rust executor unavailable - streaming will use TypeScript fallback');
    }
  }

  private async initializeRustExecutor(): Promise<void> {
    if (!this.rustExecutor) return;

    try {
      const initSuccess = await this.rustExecutor.initialize();
      this.isInitialized = initSuccess;

      // Check if runtime is available
      if (typeof this.rustExecutor.is_runtime_available === 'function') {
        const runtimeAvailable = this.rustExecutor.is_runtime_available();
        logger.info('🦀 Rust streaming client initialized', {
          initSuccess,
          runtimeAvailable,
          hasRuntimeStats: typeof this.rustExecutor.get_runtime_stats === 'function',
        });

        if (typeof this.rustExecutor.get_runtime_stats === 'function') {
          try {
            const stats = this.rustExecutor.get_runtime_stats();
            logger.debug('Rust runtime stats:', JSON.parse(stats));
          } catch (e) {
            const errorInfo = toErrorOrUndefined(e);
            logger.warn(
              'Failed to get runtime stats:',
              errorInfo
                ? { message: errorInfo.message, name: errorInfo.name }
                : { error: String(e) }
            );
          }
        }
      } else {
        logger.info('🦀 Rust streaming client initialized (legacy runtime)');
      }
    } catch (error) {
      logger.error('Failed to initialize Rust executor:', toErrorOrUndefined(error));
      this.isInitialized = false;
    }
  }

  /**
   * Check if Rust streaming is available
   */
  public isRustAvailable(): boolean {
    return this.isInitialized && this.rustExecutor !== null;
  }

  /**
   * Stream file content with true chunked processing
   */
  public async streamFile(
    filePath: string,
    processor: Readonly<StreamProcessor>,
    options?: Readonly<Partial<StreamOptions>>
  ): Promise<string> {
    if (!this.isRustAvailable()) {
      throw new Error('Rust executor not available for streaming');
    }

    const streamOptions = this.createStreamOptions('fileAnalysis', options);
    const sessionId = `stream_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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
      const chunkCallback = (chunk: unknown): void => {
        void this.handleChunk(sessionId, chunk);
      };

      // Start streaming from Rust
      let rustStreamId = '';
      if (this.rustExecutor) {
        rustStreamId = this.rustExecutor.stream_file(
          filePath,
          streamOptions.chunkSize,
          streamOptions.contextType,
          chunkCallback
        );
      } else {
        throw new Error('Rust executor not available for streaming');
      }

      logger.info(`✅ Rust stream started: ${rustStreamId} for session ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('❌ Rust file streaming failed:', toErrorOrUndefined(error));
      session.state = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      await processor.onError(session.error, session);
      throw error;
    }
  }

  /**
   * Stream command output with real-time processing
   */
  public async streamCommand(
    command: string,
    args: readonly string[],
    processor: Readonly<StreamProcessor>,
    options?: Readonly<Partial<StreamOptions>>
  ): Promise<string> {
    if (!this.isRustAvailable()) {
      throw new Error('Rust executor not available for streaming');
    }

    const streamOptions = this.createStreamOptions('commandOutput', options);
    const sessionId = `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

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
      const chunkCallback = (chunk: unknown): void => {
        void this.handleChunk(sessionId, chunk);
      };

      // Start streaming from Rust
      let rustStreamId = '';
      if (this.rustExecutor) {
        rustStreamId = this.rustExecutor.stream_command(
          command,
          [...args],
          streamOptions.chunkSize,
          chunkCallback
        );
      } else {
        throw new Error('Rust executor not available for streaming');
      }

      logger.info(`✅ Rust command stream started: ${rustStreamId} for session ${sessionId}`);
      return sessionId;
    } catch (error) {
      logger.error('❌ Rust command streaming failed:', toErrorOrUndefined(error));
      session.state = 'error';
      session.error = error instanceof Error ? error.message : String(error);
      await processor.onError(session.error ?? 'Unknown error', session);
      throw error;
    }
  }

  /**
   * Handle incoming chunks from Rust with EPIPE protection
   */
  private async handleChunk(sessionId: string, rawChunk: unknown): Promise<void> {
    // Type guard for rawChunk
    function isStreamChunkLike(obj: unknown): obj is StreamChunk {
      if (typeof obj !== 'object' || obj === null) return false;
      const o = obj as Record<string, unknown>;
      return (
        typeof o.streamId === 'string' &&
        typeof o.sequence === 'number' &&
        typeof o.contentType === 'string' &&
        'data' in o &&
        typeof o.size === 'number' &&
        typeof o.metadata === 'object' &&
        o.metadata !== null
      );
    }

    const session = this.activeSessions.get(sessionId);
    const processor = this.processors.get(sessionId);

    if (!session || !processor) {
      logger.warn(`Received chunk for unknown session: ${sessionId} - terminating orphaned stream`);
      // Terminate orphaned streams to prevent EPIPE
      if (this.rustExecutor?.terminateStream) {
        try {
          this.rustExecutor.terminateStream(sessionId);
        } catch (error) {
          logger.debug(`Failed to terminate orphaned stream ${sessionId}:`, { error });
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
      if (!isStreamChunkLike(rawChunk)) {
        throw new Error('Received chunk with invalid structure');
      }

      const chunk: StreamChunk = {
        streamId: rawChunk.streamId,
        sequence: rawChunk.sequence,
        contentType: rawChunk.contentType,
        data: rawChunk.data,
        size: rawChunk.size,
        metadata: {
          source: rawChunk.metadata.source,
          isLast: !!rawChunk.metadata.isLast,
          progress: typeof rawChunk.metadata.progress === 'number' ? rawChunk.metadata.progress : 0,
          totalSize:
            typeof rawChunk.metadata.totalSize === 'number' ? rawChunk.metadata.totalSize : 0,
          error: typeof rawChunk.metadata.error === 'string' ? rawChunk.metadata.error : undefined,
          encoding:
            typeof rawChunk.metadata.encoding === 'string' ? rawChunk.metadata.encoding : undefined,
          mimeType:
            typeof rawChunk.metadata.mimeType === 'string' ? rawChunk.metadata.mimeType : undefined,
          compression:
            typeof rawChunk.metadata.compression === 'string'
              ? rawChunk.metadata.compression
              : undefined,
        },
        timing: {
          generatedAt: rawChunk.timing.generatedAt,
          sentAt: rawChunk.timing.sentAt,
          rustProcessingTime: rawChunk.timing.rustProcessingTime,
        },
        resourceUsage: rawChunk.resourceUsage ?? undefined,
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
      logger.error(`Error processing chunk for session ${sessionId}:`, toErrorOrUndefined(error));
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
    processor: Readonly<StreamProcessor>,
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
              error instanceof Error ? error : new Error(String(error))
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
        logger.warn(`Failed to terminate Rust stream ${sessionId}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.activeSessions.delete(sessionId);
    this.processors.delete(sessionId);

    logger.debug(`🧹 Cleaned up session: ${sessionId}`);
  }

  /**
   * Get active session statistics
   */
  public getActiveSessionStats(): Array<{ sessionId: string; stats: StreamSession['stats'] }> {
    return Array.from(this.activeSessions.entries()).map(
      ([sessionId, session]: readonly [string, Readonly<StreamSession>]) => ({
        sessionId,
        stats: session.stats,
      })
    );
  }

  /**
   * Cancel a streaming session
   */
  public async cancelStream(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return Promise.resolve(false);

    session.state = 'cancelled';
    this.cleanupSession(sessionId);

    const cancelledEvent: StreamEvent = {
      type: 'cancelled',
      streamId: sessionId,
      timestamp: Date.now(),
    };
    this.emit('streamEvent', cancelledEvent);

    return Promise.resolve(true);
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
      case 'searchResults':
        // No special handling for searchResults, use defaults
        break;
      case 'default':
        // No special handling for default, use defaults
        break;
      default:
        // Ensure exhaustive switch; do nothing
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
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Cleanup all resources
   */
  public async cleanup(): Promise<void> {
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
