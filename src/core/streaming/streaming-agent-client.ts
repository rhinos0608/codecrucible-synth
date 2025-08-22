/**
 * Streaming Response Architecture for real-time AI agent responses
 * Implements progressive feedback with token-level streaming
 */

import { EventEmitter } from 'events';
import { UnifiedModelClient } from '../client.js';
import { ExecutionRequest, ExecutionResponse, ModelResponse } from '../types.js';
import { Logger } from '../logger.js';

// Streaming Response Types
export interface StreamingResponse {
  id: string;
  type: 'progress' | 'partial' | 'complete' | 'error' | 'metadata';
  chunk: string;
  metadata: StreamMetadata;
  timestamp: number;
}

export interface StreamMetadata {
  tokensProcessed: number;
  estimatedCompletion: number;
  activeVoice: string;
  confidence: number;
  latency: number;
  bufferSize?: number;
  chunkIndex?: number;
  totalChunks?: number;
}

export interface StreamingConfig {
  bufferSize: number;
  flushInterval: number;
  enableBackpressure: boolean;
  maxConcurrentStreams: number;
  tokenBatching: boolean;
  batchSize: number;
  compressionEnabled: boolean;
  adaptiveStreaming: boolean;
}

export interface StreamingSession {
  id: string;
  request: ExecutionRequest;
  startTime: number;
  status: 'active' | 'paused' | 'completed' | 'error';
  metrics: StreamingMetrics;
  buffer: StreamBuffer;
  tokensProcessed: number;
}

export interface StreamingMetrics {
  totalTokens: number;
  tokensPerSecond: number;
  averageLatency: number;
  peakLatency: number;
  bufferUtilization: number;
  droppedChunks: number;
  reconnections: number;
}

export interface StreamBuffer {
  chunks: StreamingResponse[];
  maxSize: number;
  currentSize: number;
  overflow: 'drop' | 'backpressure' | 'expand';
}

// Advanced Streaming Client
export class StreamingAgentClient extends EventEmitter {
  private modelClient: UnifiedModelClient;
  private logger: Logger;
  private config: StreamingConfig;
  private activeSessions: Map<string, StreamingSession>;
  private streamBuffers: Map<string, StreamBuffer>;
  private metricsCollector: StreamingMetricsCollector;
  private backpressureController: BackpressureController;
  private adaptiveController: AdaptiveStreamingController;

  constructor(modelClient: UnifiedModelClient, config?: Partial<StreamingConfig>) {
    super();
    // Increase max listeners to prevent memory leak warnings for legitimate use cases
    this.setMaxListeners(50);

    this.modelClient = modelClient;
    this.logger = new Logger('StreamingAgentClient');
    this.config = this.initializeConfig(config);
    this.activeSessions = new Map();
    this.streamBuffers = new Map();
    this.metricsCollector = new StreamingMetricsCollector();
    this.backpressureController = new BackpressureController(this.config);
    this.adaptiveController = new AdaptiveStreamingController();
  }

  private initializeConfig(config?: Partial<StreamingConfig>): StreamingConfig {
    return {
      bufferSize: config?.bufferSize || 1024,
      flushInterval: config?.flushInterval || 100,
      enableBackpressure: config?.enableBackpressure !== false,
      maxConcurrentStreams: config?.maxConcurrentStreams || 10,
      tokenBatching: config?.tokenBatching !== false,
      batchSize: config?.batchSize || 5,
      compressionEnabled: config?.compressionEnabled || false,
      adaptiveStreaming: config?.adaptiveStreaming !== false,
    };
  }

  /**
   * Execute request with streaming response
   */
  async *executeStreaming(
    request: ExecutionRequest
  ): AsyncGenerator<StreamingResponse, void, unknown> {
    const sessionId = this.generateSessionId();
    const session = this.createSession(sessionId, request);

    this.logger.info(`Starting streaming session`, { sessionId });
    this.emit('stream:start', { sessionId, request });

    try {
      // Initialize streaming
      const stream = await this.initializeStream(request, sessionId);

      // Process stream with adaptive control
      yield* this.processStream(stream, session);

      // Complete session
      this.completeSession(session);
    } catch (error) {
      this.handleStreamError(session, error);
      yield this.createErrorResponse(sessionId, error);
    } finally {
      this.cleanupSession(sessionId);
    }
  }

  /**
   * Process stream with adaptive control and buffering
   */
  private async *processStream(
    stream: AsyncIterable<any>,
    session: StreamingSession
  ): AsyncGenerator<StreamingResponse, void, unknown> {
    const buffer = this.getOrCreateBuffer(session.id);
    let chunkIndex = 0;
    let tokensProcessed = 0;

    for await (const chunk of stream) {
      // Apply backpressure if needed
      if (this.config.enableBackpressure) {
        await this.backpressureController.checkPressure(buffer);
      }

      // Process chunk
      const processed = await this.processChunk(chunk, session);
      tokensProcessed += processed.tokens || 1;

      // Create streaming response
      const response: StreamingResponse = {
        id: session.id,
        type: 'partial',
        chunk: processed.content,
        metadata: {
          tokensProcessed,
          estimatedCompletion: this.estimateCompletion(session, tokensProcessed),
          activeVoice: processed.voice || session.request.voice || 'default',
          confidence: processed.confidence || 0.95,
          latency: Date.now() - session.startTime,
          chunkIndex: chunkIndex++,
          bufferSize: buffer.currentSize,
        },
        timestamp: Date.now(),
      };

      // Apply adaptive streaming if enabled
      if (this.config.adaptiveStreaming) {
        await this.adaptiveController.adapt(response, session);
      }

      // Buffer management
      this.addToBuffer(buffer, response);

      // Update metrics
      this.updateMetrics(session, response);

      // Emit progress event
      this.emit('stream:chunk', response);

      yield response;

      // Batch tokens if configured
      if (this.config.tokenBatching && chunkIndex % this.config.batchSize === 0) {
        yield* this.flushBatch(session.id);
      }
    }

    // Final completion response
    yield this.createCompletionResponse(session, tokensProcessed);
  }

  /**
   * Process individual chunk with transformation
   */
  private async processChunk(chunk: any, session: StreamingSession): Promise<any> {
    // Apply compression if enabled
    if (this.config.compressionEnabled) {
      chunk = await this.compressChunk(chunk);
    }

    // Transform chunk based on session configuration
    return {
      content: chunk.text || chunk.content || chunk,
      tokens: chunk.tokens || 1,
      voice: chunk.voice,
      confidence: chunk.confidence,
    };
  }

  /**
   * Create streaming session
   */
  private createSession(id: string, request: ExecutionRequest): StreamingSession {
    const session: StreamingSession = {
      id,
      request,
      startTime: Date.now(),
      status: 'active',
      tokensProcessed: 0,
      metrics: {
        totalTokens: 0,
        tokensPerSecond: 0,
        averageLatency: 0,
        peakLatency: 0,
        bufferUtilization: 0,
        droppedChunks: 0,
        reconnections: 0,
      },
      buffer: {
        chunks: [],
        maxSize: this.config.bufferSize,
        currentSize: 0,
        overflow: 'backpressure',
      },
    };

    this.activeSessions.set(id, session);
    return session;
  }

  /**
   * Initialize stream from model client
   */
  private async *initializeStream(
    request: ExecutionRequest,
    sessionId: string
  ): AsyncGenerator<any, void, unknown> {
    // Create streaming request
    const streamRequest = {
      prompt: request.input || '',
      ...request,
      streaming: true,
      sessionId,
    };

    let fullResponse = '';

    // Get stream from model client with token handler
    const response = await this.modelClient.streamRequest(
      streamRequest,
      token => {
        // Token will be handled by the session
        this.handleToken(sessionId, token);
        fullResponse += token.content || '';
        return token; // Yield the token
      },
      { workingDirectory: '.', config: {}, files: [] }
    );

    // Yield the complete response at the end
    yield { content: fullResponse, isComplete: true };
  }

  private handleToken(sessionId: string, token: any): any {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      // Process token for this session
      session.tokensProcessed++;
    }
    return token;
  }

  /**
   * Estimate completion percentage
   */
  private estimateCompletion(session: StreamingSession, tokensProcessed: number): number {
    // Simple estimation based on average response length
    const estimatedTotal = session.request.maxTokens || 1000;
    return Math.min(100, (tokensProcessed / estimatedTotal) * 100);
  }

  /**
   * Buffer management
   */
  private getOrCreateBuffer(sessionId: string): StreamBuffer {
    if (!this.streamBuffers.has(sessionId)) {
      this.streamBuffers.set(sessionId, {
        chunks: [],
        maxSize: this.config.bufferSize,
        currentSize: 0,
        overflow: 'backpressure',
      });
    }
    return this.streamBuffers.get(sessionId)!;
  }

  private addToBuffer(buffer: StreamBuffer, response: StreamingResponse): void {
    if (buffer.currentSize >= buffer.maxSize) {
      switch (buffer.overflow) {
        case 'drop':
          buffer.chunks.shift();
          break;
        case 'expand':
          buffer.maxSize *= 1.5;
          break;
        case 'backpressure':
          // Handled by backpressure controller
          break;
      }
    }

    buffer.chunks.push(response);
    buffer.currentSize++;
  }

  /**
   * Flush batch of tokens
   */
  private async *flushBatch(sessionId: string): AsyncGenerator<StreamingResponse> {
    const buffer = this.streamBuffers.get(sessionId);
    if (!buffer || buffer.chunks.length === 0) return;

    const batch = buffer.chunks.splice(0, this.config.batchSize);
    const combinedChunk = batch.map(r => r.chunk).join('');

    yield {
      id: sessionId,
      type: 'partial',
      chunk: combinedChunk,
      metadata: batch[batch.length - 1].metadata,
      timestamp: Date.now(),
    };
  }

  /**
   * Update streaming metrics
   */
  private updateMetrics(session: StreamingSession, response: StreamingResponse): void {
    const metrics = session.metrics;
    const latency = response.metadata.latency;

    metrics.totalTokens++;
    metrics.tokensPerSecond = metrics.totalTokens / ((Date.now() - session.startTime) / 1000);
    metrics.averageLatency =
      (metrics.averageLatency * (metrics.totalTokens - 1) + latency) / metrics.totalTokens;
    metrics.peakLatency = Math.max(metrics.peakLatency, latency);
    metrics.bufferUtilization = response.metadata.bufferSize! / this.config.bufferSize;

    this.metricsCollector.record(session.id, metrics);
  }

  /**
   * Complete streaming session
   */
  private completeSession(session: StreamingSession): void {
    session.status = 'completed';
    this.logger.info(`Streaming session completed`, {
      sessionId: session.id,
      metrics: session.metrics,
    });
    this.emit('stream:complete', { sessionId: session.id, metrics: session.metrics });
  }

  /**
   * Handle stream errors
   */
  private handleStreamError(session: StreamingSession, error: any): void {
    session.status = 'error';
    this.logger.error(`Streaming error`, { sessionId: session.id, error });
    this.emit('stream:error', { sessionId: session.id, error });
  }

  /**
   * Create error response
   */
  private createErrorResponse(sessionId: string, error: any): StreamingResponse {
    return {
      id: sessionId,
      type: 'error',
      chunk: error.message || 'Stream error occurred',
      metadata: {
        tokensProcessed: 0,
        estimatedCompletion: 0,
        activeVoice: 'error',
        confidence: 0,
        latency: 0,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Create completion response
   */
  private createCompletionResponse(
    session: StreamingSession,
    totalTokens: number
  ): StreamingResponse {
    return {
      id: session.id,
      type: 'complete',
      chunk: '',
      metadata: {
        tokensProcessed: totalTokens,
        estimatedCompletion: 100,
        activeVoice: session.request.voice || 'default',
        confidence: 1,
        latency: Date.now() - session.startTime,
      },
      timestamp: Date.now(),
    };
  }

  /**
   * Cleanup session resources
   */
  private cleanupSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.streamBuffers.delete(sessionId);
    this.metricsCollector.cleanup(sessionId);
  }

  /**
   * Compress chunk for transmission
   */
  private async compressChunk(chunk: any): Promise<any> {
    // Simple compression placeholder
    return chunk;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active session information
   */
  getSession(sessionId: string): StreamingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Pause streaming session
   */
  pauseSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'active') {
      session.status = 'paused';
      this.emit('stream:paused', { sessionId });
      return true;
    }
    return false;
  }

  /**
   * Resume streaming session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'active';
      this.emit('stream:resumed', { sessionId });
      return true;
    }
    return false;
  }

  /**
   * Cancel streaming session
   */
  cancelSession(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.handleStreamError(session, new Error('Session cancelled'));
      this.cleanupSession(sessionId);
      return true;
    }
    return false;
  }
}

// Backpressure Controller
class BackpressureController {
  private config: StreamingConfig;
  private pressureThreshold: number = 0.8;

  constructor(config: StreamingConfig) {
    this.config = config;
  }

  async checkPressure(buffer: StreamBuffer): Promise<void> {
    const utilization = buffer.currentSize / buffer.maxSize;

    if (utilization > this.pressureThreshold) {
      // Apply backpressure
      await this.applyBackpressure(utilization);
    }
  }

  private async applyBackpressure(utilization: number): Promise<void> {
    // Calculate delay based on utilization
    const delay = Math.floor((utilization - this.pressureThreshold) * 1000);
    await new Promise(resolve => setTimeout(resolve, delay));
  }
}

// Adaptive Streaming Controller
class AdaptiveStreamingController {
  private history: Map<string, number[]> = new Map();
  private adaptationThreshold: number = 0.1;

  async adapt(response: StreamingResponse, session: StreamingSession): Promise<void> {
    const sessionHistory = this.getOrCreateHistory(session.id);
    sessionHistory.push(response.metadata.latency);

    if (sessionHistory.length >= 10) {
      const avgLatency = sessionHistory.reduce((a, b) => a + b, 0) / sessionHistory.length;
      const variance = this.calculateVariance(sessionHistory, avgLatency);

      if (variance > this.adaptationThreshold) {
        await this.adjustStreamingParameters(session, avgLatency, variance);
      }

      // Keep only recent history
      sessionHistory.splice(0, sessionHistory.length - 20);
    }
  }

  private getOrCreateHistory(sessionId: string): number[] {
    if (!this.history.has(sessionId)) {
      this.history.set(sessionId, []);
    }
    return this.history.get(sessionId)!;
  }

  private calculateVariance(values: number[], mean: number): number {
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private async adjustStreamingParameters(
    session: StreamingSession,
    avgLatency: number,
    variance: number
  ): Promise<void> {
    // Adjust buffer size based on variance
    if (variance > 0.2) {
      session.buffer.maxSize = Math.min(session.buffer.maxSize * 1.2, 2048);
    } else if (variance < 0.05) {
      session.buffer.maxSize = Math.max(session.buffer.maxSize * 0.8, 256);
    }
  }
}

// Streaming Metrics Collector
class StreamingMetricsCollector {
  private metrics: Map<string, StreamingMetrics[]> = new Map();

  record(sessionId: string, metrics: StreamingMetrics): void {
    if (!this.metrics.has(sessionId)) {
      this.metrics.set(sessionId, []);
    }
    this.metrics.get(sessionId)!.push({ ...metrics });
  }

  getMetrics(sessionId: string): StreamingMetrics[] | undefined {
    return this.metrics.get(sessionId);
  }

  cleanup(sessionId: string): void {
    this.metrics.delete(sessionId);
  }

  getAggregatedMetrics(): Map<string, StreamingMetrics> {
    const aggregated = new Map<string, StreamingMetrics>();

    this.metrics.forEach((sessionMetrics, sessionId) => {
      if (sessionMetrics.length > 0) {
        const latest = sessionMetrics[sessionMetrics.length - 1];
        aggregated.set(sessionId, latest);
      }
    });

    return aggregated;
  }
}
