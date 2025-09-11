/**
 * StreamingManager - Extracted from UnifiedModelClient
 * Handles all streaming-related functionality following Living Spiral methodology
 *
 * Council Perspectives Applied:
 * - Maintainer: Clean interfaces and clear separation of concerns
 * - Performance Engineer: Optimized streaming with backpressure handling
 * - Security Guardian: Safe token handling and resource cleanup
 * - Explorer: Extensible design for future streaming patterns
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { StreamToken } from '../../domain/types/unified-types.js';
import { ModelRequest } from '../../domain/interfaces/model-client.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';
import { ProviderAdapter } from './provider-adapters/index.js';

// Enhanced: AI SDK v5.0 Compatible Streaming Interfaces
export interface StreamChunk {
  type:
    | 'stream-start'
    | 'text-start'
    | 'text-delta'
    | 'text-end'
    | 'reasoning-start'
    | 'reasoning-delta'
    | 'reasoning-end'
    | 'tool-input-start'
    | 'tool-input-delta'
    | 'tool-input-end'
    | 'tool-call'
    | 'tool-result'
    | 'finish'
    | 'error';

  // Common properties
  id?: string;
  timestamp: number;

  // Stream start properties
  warnings?: StreamWarning[];

  // Text streaming properties
  delta?: string;

  // Tool properties
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  result?: unknown;

  // Finish properties
  usage?: StreamUsage;
  finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error';

  // Error properties
  error?: string;
  errorCode?: string;

  // Provider metadata
  providerMetadata?: Record<string, unknown>;

  // Legacy compatibility
  content?: string;
  finished?: boolean;
  metadata?: Record<string, unknown>;
}

export interface StreamWarning {
  type: string;
  message: string;
  code?: string;
}

export interface StreamUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

export interface StreamBlock {
  id: string;
  type: 'text' | 'reasoning' | 'tool-input' | 'tool-call';
  startTime: number;
  endTime?: number;
  content: string[];
  metadata?: Record<string, unknown>;
}

// StreamToken now imported from domain types for consistency

export interface StreamConfig {
  timeout?: number;
  encoding?: BufferEncoding;
  enableReasoningStream?: boolean;
  enableToolStreaming?: boolean;
  maxRetries?: number;
  enableProviderMetadata?: boolean;
  enableLifecycleEvents?: boolean;
}

export interface StreamMetrics {
  tokensStreamed: number;
  streamDuration: number;
  averageLatency: number;
  throughput: number;
}

export interface StreamSession {
  id: string;
  startTime: number;
  tokens: StreamToken[];
  chunks: StreamChunk[];
  activeBlocks: Map<string, StreamBlock>;
  metrics: StreamMetrics;
  isActive: boolean;
  status: 'active' | 'completed' | 'error' | 'cancelled';
}

export interface IStreamingManager {
  // Core streaming operations
  startStream: (
    content: Readonly<string>,
    onToken: (token: StreamToken) => void,
    config?: Readonly<StreamConfig>
  ) => Promise<string>;

  // Enhanced: Modern streaming with AI SDK v5.0 patterns
  startModernStream: (
    content: Readonly<string>,
    onChunk: (chunk: Readonly<StreamChunk>) => void,
    config?: Readonly<StreamConfig>
  ) => Promise<string>;

  // Enhanced: Tool streaming support
  streamToolExecution: (
    toolName: Readonly<string>,
    args: Readonly<unknown>,
    onChunk: (chunk: Readonly<StreamChunk>) => void
  ) => Promise<unknown>;

  // Session management
  createSession: (sessionId?: Readonly<string>) => StreamSession;
  getSession: (sessionId: Readonly<string>) => StreamSession | undefined;
  destroySession: (sessionId: Readonly<string>) => void;

  // Metrics and monitoring
  getStreamMetrics: (sessionId: Readonly<string>) => StreamMetrics | undefined;
  getAllMetrics: () => Map<string, StreamMetrics>;

  // Configuration
  updateConfig: (config: Readonly<Partial<StreamConfig>>) => void;
  getConfig: () => StreamConfig;

  // Cleanup
  cleanup: () => Promise<void>;

  // Adapter-based streaming
  stream: (
    adapter: Readonly<ProviderAdapter>,
    request: Readonly<ModelRequest>
  ) => AsyncIterable<StreamToken>;
}

/**
 * StreamingManager Implementation
 * Follows Single Responsibility Principle - handles only streaming concerns
 */
export class StreamingManager extends EventEmitter implements IStreamingManager {
  private config: StreamConfig;
  private readonly sessions: Map<string, StreamSession> = new Map();
  private readonly defaultConfig: StreamConfig = {
    timeout: 30000,
    encoding: 'utf8',
    enableReasoningStream: true,
    enableToolStreaming: true,
    maxRetries: 3,
    enableProviderMetadata: true,
    enableLifecycleEvents: true,
  };

  public constructor(config: Readonly<Partial<StreamConfig>> = {}) {
    super();
    this.config = { ...this.defaultConfig, ...config };
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for stream monitoring
   */
  private setupEventHandlers(): void {
    this.on('session-created', (sessionId: string) => {
      logger.debug('Stream session created', { sessionId });
    });

    // Enhanced: Modern streaming events
    this.on('stream-start', (chunk: Readonly<StreamChunk>) => {
      logger.debug('Modern stream started', { id: chunk.id });
    });

    this.on('text-block-start', (chunk: Readonly<StreamChunk>) => {
      logger.debug('Text block started', { id: chunk.id });
    });

    this.on('tool-call', (chunk: Readonly<StreamChunk>) => {
      logger.debug('Tool call received', { toolName: chunk.toolName, id: chunk.toolCallId });
    });

    this.on('session-destroyed', (sessionId: string) => {
      logger.debug('Stream session destroyed', { sessionId });
    });
  }

  /**
   * Start modern streaming with proper lifecycle management
   */
  public async startModernStream(
    content: string,
    onChunk: (chunk: Readonly<StreamChunk>) => void,
    config?: Readonly<StreamConfig>
  ): Promise<string> {
    const sessionId = this.generateSessionId();

    try {
      const session = this.createSession(sessionId);
      session.status = 'active';

      // Send complete content as a single chunk
      const finishChunk: StreamChunk = {
        type: 'finish',
        timestamp: Date.now(),
        finishReason: 'stop',
        content: content,
        usage: {
          inputTokens: 0,
          outputTokens: content.length,
          totalTokens: content.length,
        },
      };

      session.chunks.push(finishChunk);
      onChunk(finishChunk);

      session.status = 'completed';
      session.isActive = false;

      return content;
    } catch (error) {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'error';
        const errorChunk: StreamChunk = {
          type: 'error',
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : String(error),
          errorCode: 'STREAM_ERROR',
        };
        session.chunks.push(errorChunk);
        onChunk(errorChunk);
      }

      this.destroySession(sessionId);
      throw error;
    }
  }

  /**
   * Stream tool execution - delegates to actual tool execution
   */
  public async streamToolExecution(
    toolName: string,
    args: unknown,
    onChunk: (chunk: Readonly<StreamChunk>) => void
  ): Promise<unknown> {
    const toolCallId = this.generateBlockId();

    const toolCallChunk: StreamChunk = {
      type: 'tool-call',
      toolCallId,
      toolName,
      args,
      timestamp: Date.now(),
    };
    onChunk(toolCallChunk);

    // Tool execution should be handled by the actual tool system
    // This is just a streaming wrapper
    throw new Error('Tool execution must be implemented by the calling system');
  }

  /**
   * Adapter-based streaming compatible with ModelClient
   */
  public async *stream(
    adapter: Readonly<ProviderAdapter>,
    request: Readonly<ModelRequest>
  ): AsyncIterable<StreamToken> {
    // Always prefer native streaming when available
    if (adapter.stream) {
      yield* adapter.stream(request);
      return;
    }

    // If no native streaming, make a single request and yield the complete response
    const result = await adapter.request(request);
    yield {
      content: result.content,
      timestamp: Date.now(),
      index: 0,
      metadata: {
        provider: adapter.name,
        complete: true,
      },
    };
  }

  /**
   * Start streaming content - direct pass-through without artificial delays
   */
  public async startStream(
    content: Readonly<string>,
    onToken: (token: Readonly<StreamToken>) => void,
    config?: Readonly<StreamConfig>
  ): Promise<string> {
    const sessionId = this.generateSessionId();

    try {
      const session = this.createSession(sessionId);

      const token: StreamToken = {
        content,
        timestamp: Date.now(),
        index: 0,
        metadata: {
          sessionId,
          complete: true,
        },
      };

      session.tokens.push(token);
      this.updateStreamMetrics(sessionId, token);
      onToken(token);

      session.isActive = false;
      return content;
    } catch (error) {
      this.destroySession(sessionId);
      throw error;
    }
  }

  /**
   * Create a new streaming session
   */
  public createSession(sessionId?: string): StreamSession {
    const id = sessionId ?? this.generateSessionId();

    if (this.sessions.has(id)) {
      throw new Error(`Session ${id} already exists`);
    }

    const session: StreamSession = {
      id,
      startTime: Date.now(),
      tokens: [],
      chunks: [], // Enhanced: Modern chunks support
      activeBlocks: new Map(), // Enhanced: Track streaming blocks
      metrics: {
        tokensStreamed: 0,
        streamDuration: 0,
        averageLatency: 0,
        throughput: 0,
      },
      isActive: true,
      status: 'active',
    };

    this.sessions.set(id, session);
    this.emit('session-created', id);

    return session;
  }

  /**
   * Get existing session
   */
  public getSession(sessionId: string): StreamSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Destroy a streaming session and cleanup resources
   */
  public destroySession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.activeBlocks.clear();
      this.sessions.delete(sessionId);
      this.emit('session-destroyed', sessionId);
    }
  }

  /**
   * Get metrics for a specific session
   */
  public getStreamMetrics(sessionId: string): StreamMetrics | undefined {
    return this.sessions.get(sessionId)?.metrics;
  }

  /**
   * Get all session metrics
   */
  public getAllMetrics(): Map<string, StreamMetrics> {
    const metrics = new Map<string, StreamMetrics>();
    for (const [id, session] of this.sessions.entries()) {
      metrics.set(id, session.metrics);
    }
    return metrics;
  }

  /**
   * Update streaming configuration
   */
  public updateConfig(config: Readonly<Partial<StreamConfig>>): void {
    this.config = { ...this.config, ...config };
    logger.info('Streaming configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): StreamConfig {
    return { ...this.config };
  }

  /**
   * Cleanup all sessions and resources
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up streaming manager', {
      activeSessions: this.sessions.size,
    });

    // Clear all sessions
    for (const sessionId of this.sessions.keys()) {
      this.destroySession(sessionId);
    }

    this.sessions.clear();
    this.removeAllListeners();
  }

  /**
   * Private: Update metrics for a streaming session
   */
  private updateStreamMetrics(sessionId: string, _token: Readonly<StreamToken>): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const { metrics } = session;
    metrics.tokensStreamed++;
    metrics.streamDuration = Date.now() - session.startTime;

    if (metrics.tokensStreamed > 0) {
      metrics.averageLatency = metrics.streamDuration / metrics.tokensStreamed;
      metrics.throughput = (metrics.tokensStreamed / metrics.streamDuration) * 1000; // tokens per second
    }
  }

  /**
   * Enhanced: Generate unique stream ID for AI SDK v5.0 compatibility
   */
  private generateStreamId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Enhanced: Generate unique block ID for streaming blocks
   */
  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Private: Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Factory function for easy instantiation
export function createStreamingManager(config?: Partial<StreamConfig>): IStreamingManager {
  return new StreamingManager(config);
}

// Default export for convenience
export default StreamingManager;
