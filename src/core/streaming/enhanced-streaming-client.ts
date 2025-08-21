/**
 * Enhanced Streaming Client for Real-Time Response Delivery
 * Implements progressive token streaming with backpressure handling
 */

import { EventEmitter } from 'events';
import { Readable, Transform, pipeline } from 'stream';
import { logger } from '../logger.js';

export interface StreamConfig {
  chunkSize?: number;
  bufferSize?: number;
  enableBackpressure?: boolean;
  timeout?: number;
  encoding?: BufferEncoding;
}

export interface StreamToken {
  content: string;
  timestamp: number;
  index: number;
  finished?: boolean;
  metadata?: Record<string, any>;
}

export interface StreamMetrics {
  tokensStreamed: number;
  streamDuration: number;
  averageLatency: number;
  throughput: number;
  backpressureEvents: number;
}

/**
 * Transform stream for processing AI response tokens
 */
class TokenTransformStream extends Transform {
  private tokenIndex = 0;
  private startTime = Date.now();

  constructor(options: any = {}) {
    super({
      ...options,
      objectMode: true,
    });
  }

  _transform(chunk: any, encoding: string, callback: Function): void {
    try {
      const token: StreamToken = {
        content: chunk.toString(),
        timestamp: Date.now(),
        index: this.tokenIndex++,
        finished: false,
      };

      this.push(token);
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback: Function): void {
    // Send final token
    const finalToken: StreamToken = {
      content: '',
      timestamp: Date.now(),
      index: this.tokenIndex,
      finished: true,
      metadata: {
        totalTokens: this.tokenIndex,
        duration: Date.now() - this.startTime,
      },
    };

    this.push(finalToken);
    callback();
  }
}

/**
 * Enhanced Streaming Client with real-time response capabilities
 */
export class EnhancedStreamingClient extends EventEmitter {
  private config: Required<StreamConfig>;
  private activeStreams: Map<string, Readable> = new Map();
  private metrics: Map<string, StreamMetrics> = new Map();
  private bufferManager: BufferManager;

  constructor(config: StreamConfig = {}) {
    super();

    this.config = {
      chunkSize: config.chunkSize || 64, // Characters per chunk
      bufferSize: config.bufferSize || 1024 * 16, // 16KB buffer
      enableBackpressure: config.enableBackpressure !== false,
      timeout: config.timeout || 60000, // 60 seconds
      encoding: config.encoding || 'utf8',
    };

    this.bufferManager = new BufferManager(this.config.bufferSize);
    this.setupEventHandlers();
  }

  /**
   * Setup internal event handlers
   */
  private setupEventHandlers(): void {
    this.on('stream-start', (id: string) => {
      logger.debug(`Stream started: ${id}`);
      this.initializeMetrics(id);
    });

    this.on('stream-end', (id: string) => {
      logger.debug(`Stream ended: ${id}`);
      this.finalizeMetrics(id);
    });

    this.on('stream-error', (id: string, error: Error) => {
      logger.error(`Stream error ${id}:`, error);
      this.cleanupStream(id);
    });
  }

  /**
   * Create a streaming response for AI generation
   */
  async createStream(
    prompt: string,
    generateFn: (prompt: string) => AsyncGenerator<string>
  ): Promise<string> {
    const streamId = this.generateStreamId();
    const startTime = Date.now();

    try {
      this.emit('stream-start', streamId);

      // Create readable stream from async generator
      const readable = Readable.from(generateFn(prompt));
      this.activeStreams.set(streamId, readable);

      // Create transform stream for token processing
      const tokenTransform = new TokenTransformStream();

      // Collect all tokens
      const tokens: StreamToken[] = [];

      // Setup pipeline with backpressure handling
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Stream timeout'));
          this.cleanupStream(streamId);
        }, this.config.timeout);

        pipeline(readable, tokenTransform, async error => {
          clearTimeout(timeout);

          if (error) {
            this.emit('stream-error', streamId, error);
            reject(error);
          } else {
            const content = tokens.map(t => t.content).join('');
            this.emit('stream-end', streamId);
            resolve(content);
          }

          this.cleanupStream(streamId);
        });

        // Handle token events
        tokenTransform.on('data', (token: StreamToken) => {
          tokens.push(token);
          this.emit('token', token);
          this.updateMetrics(streamId, token);

          // Handle backpressure if enabled
          if (this.config.enableBackpressure && this.bufferManager.shouldPause()) {
            readable.pause();
            this.emit('backpressure', streamId);

            // Resume after buffer drains
            setTimeout(() => {
              readable.resume();
              this.emit('resume', streamId);
            }, 100);
          }
        });
      });
    } catch (error) {
      this.emit('stream-error', streamId, error as Error);
      this.cleanupStream(streamId);
      throw error;
    }
  }

  /**
   * Stream response with progressive rendering
   */
  async streamResponse(
    prompt: string,
    onToken: (token: StreamToken) => void,
    generateFn: (prompt: string) => AsyncGenerator<string>
  ): Promise<void> {
    const streamId = this.generateStreamId();

    try {
      this.emit('stream-start', streamId);

      let tokenIndex = 0;
      const startTime = Date.now();

      // Stream tokens progressively
      for await (const chunk of generateFn(prompt)) {
        const token: StreamToken = {
          content: chunk,
          timestamp: Date.now(),
          index: tokenIndex++,
          finished: false,
        };

        // Call token handler
        onToken(token);

        // Emit token event
        this.emit('token', token);

        // Update metrics
        this.updateMetrics(streamId, token);

        // Handle backpressure
        if (this.config.enableBackpressure && this.bufferManager.shouldPause()) {
          await this.handleBackpressure(streamId);
        }
      }

      // Send final token
      const finalToken: StreamToken = {
        content: '',
        timestamp: Date.now(),
        index: tokenIndex,
        finished: true,
        metadata: {
          totalTokens: tokenIndex,
          duration: Date.now() - startTime,
        },
      };

      onToken(finalToken);
      this.emit('stream-end', streamId);
    } catch (error) {
      this.emit('stream-error', streamId, error as Error);
      throw error;
    } finally {
      this.cleanupStream(streamId);
    }
  }

  /**
   * Create chunked stream for large responses
   */
  createChunkedStream(content: string): Readable {
    const chunks = this.chunkContent(content);
    let index = 0;

    return new Readable({
      read() {
        if (index < chunks.length) {
          this.push(chunks[index++]);
        } else {
          this.push(null); // End stream
        }
      },
    });
  }

  /**
   * Chunk content into smaller pieces
   */
  private chunkContent(content: string): string[] {
    const chunks: string[] = [];
    const chunkSize = this.config.chunkSize;

    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }

    return chunks;
  }

  /**
   * Handle backpressure events
   */
  private async handleBackpressure(streamId: string): Promise<void> {
    const metrics = this.metrics.get(streamId);
    if (metrics) {
      metrics.backpressureEvents++;
    }

    this.emit('backpressure', streamId);

    // Wait for buffer to drain
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.bufferManager.shouldPause()) {
          clearInterval(checkInterval);
          this.emit('resume', streamId);
          resolve(undefined);
        }
      }, 50);
    });
  }

  /**
   * Initialize metrics for a stream
   */
  private initializeMetrics(streamId: string): void {
    this.metrics.set(streamId, {
      tokensStreamed: 0,
      streamDuration: 0,
      averageLatency: 0,
      throughput: 0,
      backpressureEvents: 0,
    });
  }

  /**
   * Update metrics during streaming
   */
  private updateMetrics(streamId: string, token: StreamToken): void {
    const metrics = this.metrics.get(streamId);
    if (!metrics) return;

    metrics.tokensStreamed++;

    // Calculate average latency
    if (metrics.tokensStreamed === 1) {
      metrics.averageLatency = 0;
    } else {
      const latency = token.timestamp - (this.lastTokenTime || token.timestamp);
      metrics.averageLatency =
        (metrics.averageLatency * (metrics.tokensStreamed - 1) + latency) / metrics.tokensStreamed;
    }

    this.lastTokenTime = token.timestamp;
  }

  private lastTokenTime?: number;

  /**
   * Finalize metrics when stream ends
   */
  private finalizeMetrics(streamId: string): void {
    const metrics = this.metrics.get(streamId);
    if (!metrics) return;

    const endTime = Date.now();
    const startTime = endTime - metrics.streamDuration;

    metrics.streamDuration = endTime - startTime;
    metrics.throughput = metrics.tokensStreamed / (metrics.streamDuration / 1000);

    logger.info('Stream metrics:', {
      streamId,
      ...metrics,
    });
  }

  /**
   * Cleanup stream resources
   */
  private cleanupStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.destroy();
      this.activeStreams.delete(streamId);
    }

    // Keep metrics for analysis (cleanup later)
    setTimeout(() => {
      this.metrics.delete(streamId);
    }, 60000); // Keep for 1 minute
  }

  /**
   * Generate unique stream ID
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current stream statistics
   */
  getStreamStats(): {
    activeStreams: number;
    totalMetrics: number;
    averageThroughput: number;
  } {
    const allMetrics = Array.from(this.metrics.values());
    const averageThroughput =
      allMetrics.length > 0
        ? allMetrics.reduce((sum, m) => sum + m.throughput, 0) / allMetrics.length
        : 0;

    return {
      activeStreams: this.activeStreams.size,
      totalMetrics: this.metrics.size,
      averageThroughput,
    };
  }

  /**
   * Abort a specific stream
   */
  abortStream(streamId: string): void {
    const stream = this.activeStreams.get(streamId);
    if (stream) {
      stream.destroy(new Error('Stream aborted'));
      this.cleanupStream(streamId);
      this.emit('stream-aborted', streamId);
    }
  }

  /**
   * Abort all active streams
   */
  abortAllStreams(): void {
    for (const streamId of this.activeStreams.keys()) {
      this.abortStream(streamId);
    }
  }

  /**
   * Cleanup and destroy
   */
  destroy(): void {
    this.abortAllStreams();
    this.metrics.clear();
    this.removeAllListeners();
    logger.info('Enhanced streaming client destroyed');
  }
}

/**
 * Buffer manager for backpressure handling
 */
class BufferManager {
  private currentSize = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  add(bytes: number): void {
    this.currentSize += bytes;
  }

  remove(bytes: number): void {
    this.currentSize = Math.max(0, this.currentSize - bytes);
  }

  shouldPause(): boolean {
    return this.currentSize >= this.maxSize * 0.8; // Pause at 80% capacity
  }

  reset(): void {
    this.currentSize = 0;
  }

  getUtilization(): number {
    return (this.currentSize / this.maxSize) * 100;
  }
}

// Export singleton instance
export const enhancedStreamingClient = new EnhancedStreamingClient();
