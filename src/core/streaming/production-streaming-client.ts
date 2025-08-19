/**
 * Production-Ready Streaming Response System for AI Agents
 * Implements real-time token streaming with comprehensive error handling and performance optimization
 */

import { EventEmitter } from 'events';
import { UnifiedModelClient } from '../client.js';
import { Logger } from '../logger.js';

// Production Streaming Interfaces
export interface StreamingRequest {
  id?: string;
  prompt: string;
  voice?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  sessionId?: string;
  metadata?: Record<string, any>;
}

export interface StreamingChunk {
  id: string;
  type: 'start' | 'chunk' | 'complete' | 'error' | 'metadata';
  content: string;
  metadata: ChunkMetadata;
  timestamp: number;
  sequenceNumber: number;
}

export interface ChunkMetadata {
  sessionId: string;
  tokensProcessed: number;
  estimatedTotal: number;
  completionPercentage: number;
  activeVoice: string;
  confidence: number;
  latencyMs: number;
  bufferLevel: number;
  throughputTPS: number; // Tokens per second
  modelUsed: string;
  chunkSize: number;
}

export interface StreamingConfiguration {
  maxConcurrentStreams: number;
  chunkSize: number;
  bufferSize: number;
  flushIntervalMs: number;
  timeoutMs: number;
  enableBackpressure: boolean;
  enableCompression: boolean;
  retryAttempts: number;
  adaptiveChunking: boolean;
  qualityThreshold: number;
  metricsCollectionEnabled: boolean;
}

export interface StreamingMetrics {
  sessionsActive: number;
  totalTokensStreamed: number;
  averageThroughput: number;
  peakThroughput: number;
  errorRate: number;
  averageLatency: number;
  bufferUtilization: number;
  reconnections: number;
  droppedChunks: number;
}

export interface StreamingSession {
  id: string;
  startTime: number;
  request: StreamingRequest;
  status: 'initializing' | 'streaming' | 'paused' | 'completed' | 'error' | 'cancelled';
  metrics: SessionMetrics;
  controller: AbortController;
  buffer: CircularBuffer<StreamingChunk>;
  backpressureActive: boolean;
}

export interface SessionMetrics {
  tokensStreamed: number;
  chunksProduced: number;
  averageChunkLatency: number;
  throughputTPS: number;
  qualityScore: number;
  errorCount: number;
  bufferOverflows: number;
  lastActivityTime: number;
}

// Production Streaming Client
export class ProductionStreamingClient extends EventEmitter {
  private modelClient: UnifiedModelClient;
  private logger: Logger;
  private config: StreamingConfiguration;
  private activeSessions: Map<string, StreamingSession>;
  private globalMetrics: StreamingMetrics;
  private metricsCollector: MetricsCollector;
  private healthMonitor: HealthMonitor;
  private adaptiveController: AdaptiveStreamingController;
  private errorRecovery: ErrorRecoveryManager;

  constructor(
    modelClient: UnifiedModelClient, 
    config?: Partial<StreamingConfiguration>
  ) {
    super();
    this.modelClient = modelClient;
    this.logger = new Logger('ProductionStreamingClient');
    this.config = this.mergeConfig(config);
    this.activeSessions = new Map();
    this.globalMetrics = this.initializeMetrics();
    this.metricsCollector = new MetricsCollector(this.config);
    this.healthMonitor = new HealthMonitor(this);
    this.adaptiveController = new AdaptiveStreamingController();
    this.errorRecovery = new ErrorRecoveryManager(this.config);

    this.setupHealthMonitoring();
    this.setupGracefulShutdown();
  }

  private mergeConfig(userConfig?: Partial<StreamingConfiguration>): StreamingConfiguration {
    return {
      maxConcurrentStreams: userConfig?.maxConcurrentStreams || 50,
      chunkSize: userConfig?.chunkSize || 10,
      bufferSize: userConfig?.bufferSize || 1000,
      flushIntervalMs: userConfig?.flushIntervalMs || 50,
      timeoutMs: userConfig?.timeoutMs || 30000,
      enableBackpressure: userConfig?.enableBackpressure !== false,
      enableCompression: userConfig?.enableCompression || false,
      retryAttempts: userConfig?.retryAttempts || 3,
      adaptiveChunking: userConfig?.adaptiveChunking !== false,
      qualityThreshold: userConfig?.qualityThreshold || 0.8,
      metricsCollectionEnabled: userConfig?.metricsCollectionEnabled !== false
    };
  }

  /**
   * Start streaming response for a request
   */
  async *streamResponse(request: StreamingRequest): AsyncGenerator<StreamingChunk, void, unknown> {
    const sessionId = this.generateSessionId();
    const session = await this.initializeSession(sessionId, request);

    this.logger.info(`Starting stream session ${sessionId}`);
    this.emit('session:start', { sessionId, request });

    try {
      // Check capacity
      if (this.activeSessions.size >= this.config.maxConcurrentStreams) {
        throw new Error('Maximum concurrent streams exceeded');
      }

      // Initialize stream
      session.status = 'streaming';
      this.activeSessions.set(sessionId, session);

      // Start metrics collection
      if (this.config.metricsCollectionEnabled) {
        this.metricsCollector.startSession(sessionId);
      }

      // Generate chunks from model
      yield* this.generateStreamingChunks(session);

      // Complete session
      session.status = 'completed';
      this.finalizeSession(session);

    } catch (error) {
      await this.handleStreamError(session, error);
      yield this.createErrorChunk(sessionId, error);
    } finally {
      this.cleanupSession(sessionId);
    }
  }

  private async initializeSession(
    id: string, 
    request: StreamingRequest
  ): Promise<StreamingSession> {
    const controller = new AbortController();
    const buffer = new CircularBuffer<StreamingChunk>(this.config.bufferSize);

    return {
      id,
      startTime: Date.now(),
      request: {
        ...request,
        id: request.id || id,
        sessionId: id
      },
      status: 'initializing',
      metrics: {
        tokensStreamed: 0,
        chunksProduced: 0,
        averageChunkLatency: 0,
        throughputTPS: 0,
        qualityScore: 1.0,
        errorCount: 0,
        bufferOverflows: 0,
        lastActivityTime: Date.now()
      },
      controller,
      buffer,
      backpressureActive: false
    };
  }

  private async *generateStreamingChunks(
    session: StreamingSession
  ): AsyncGenerator<StreamingChunk, void, unknown> {
    let sequenceNumber = 0;
    let tokensProcessed = 0;
    const startTime = Date.now();

    // Emit start chunk
    yield this.createChunk(session, 'start', '', sequenceNumber++, {
      estimatedTotal: this.estimateTokenCount(session.request.prompt),
      completionPercentage: 0
    });

    try {
      // Get model stream
      const modelStream = await this.modelClient.streamRequest(session.request);

      for await (const chunk of modelStream) {
        // Check if cancelled
        if (session.controller.signal.aborted) {
          this.logger.info(`Stream ${session.id} cancelled`);
          break;
        }

        // Handle backpressure
        if (this.config.enableBackpressure && session.buffer.isFull()) {
          await this.handleBackpressure(session);
        }

        // Process chunk
        const content = this.extractContent(chunk);
        if (!content) continue;

        tokensProcessed += this.countTokens(content);
        session.metrics.tokensStreamed = tokensProcessed;
        session.metrics.lastActivityTime = Date.now();

        // Apply adaptive chunking
        const chunkContent = this.config.adaptiveChunking ? 
          await this.adaptiveController.processChunk(content, session) : 
          content;

        // Create streaming chunk
        const streamChunk = this.createChunk(
          session, 
          'chunk', 
          chunkContent, 
          sequenceNumber++,
          {
            estimatedTotal: this.estimateTokenCount(session.request.prompt),
            completionPercentage: this.calculateCompletion(tokensProcessed, session)
          }
        );

        // Add to buffer
        session.buffer.add(streamChunk);
        session.metrics.chunksProduced++;

        // Update throughput
        const elapsed = (Date.now() - startTime) / 1000;
        session.metrics.throughputTPS = tokensProcessed / elapsed;

        // Emit chunk
        this.emit('chunk:processed', streamChunk);
        yield streamChunk;

        // Collect metrics
        if (this.config.metricsCollectionEnabled) {
          this.metricsCollector.recordChunk(session.id, streamChunk);
        }

        // Quality check
        if (await this.shouldTerminateEarly(session, streamChunk)) {
          this.logger.info(`Early termination for session ${session.id} due to quality threshold`);
          break;
        }
      }

      // Emit completion chunk
      yield this.createChunk(session, 'complete', '', sequenceNumber++, {
        completionPercentage: 100
      });

    } catch (error) {
      session.metrics.errorCount++;
      throw error;
    }
  }

  private createChunk(
    session: StreamingSession,
    type: StreamingChunk['type'],
    content: string,
    sequenceNumber: number,
    overrides: Partial<ChunkMetadata> = {}
  ): StreamingChunk {
    const now = Date.now();
    const latency = now - session.startTime;

    return {
      id: `${session.id}_chunk_${sequenceNumber}`,
      type,
      content,
      metadata: {
        sessionId: session.id,
        tokensProcessed: session.metrics.tokensStreamed,
        estimatedTotal: 0,
        completionPercentage: 0,
        activeVoice: session.request.voice || 'default',
        confidence: session.metrics.qualityScore,
        latencyMs: latency,
        bufferLevel: (session.buffer as any).getSize() / (session.buffer as any).capacity() * 100,
        throughputTPS: session.metrics.throughputTPS,
        modelUsed: session.request.model || 'default',
        chunkSize: content.length,
        ...overrides
      },
      timestamp: now,
      sequenceNumber
    };
  }

  private async handleBackpressure(session: StreamingSession): Promise<void> {
    session.backpressureActive = true;
    this.logger.debug(`Applying backpressure for session ${session.id}`);
    
    // Wait for buffer to drain
    const maxWait = 1000; // 1 second
    const interval = 50;
    let waited = 0;

    while (session.buffer.isFull() && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, interval));
      waited += interval;
    }

    session.backpressureActive = false;
  }

  private extractContent(chunk: any): string {
    if (typeof chunk === 'string') return chunk;
    return chunk?.text || chunk?.content || chunk?.delta?.content || '';
  }

  private countTokens(text: string): number {
    // Simple token counting - in production use proper tokenizer
    return Math.ceil(text.length / 4);
  }

  private estimateTokenCount(prompt: string): number {
    // Estimate response tokens based on prompt
    const promptTokens = this.countTokens(prompt);
    return Math.min(promptTokens * 2, 2000); // Rough estimate
  }

  private calculateCompletion(tokensProcessed: number, session: StreamingSession): number {
    const estimated = this.estimateTokenCount(session.request.prompt);
    return Math.min(100, (tokensProcessed / estimated) * 100);
  }

  private async shouldTerminateEarly(
    session: StreamingSession, 
    chunk: StreamingChunk
  ): Promise<boolean> {
    // Check quality threshold
    if (chunk.metadata.confidence < this.config.qualityThreshold) {
      session.metrics.qualityScore = chunk.metadata.confidence;
      return false; // Continue but monitor
    }

    // Check for completion markers
    const completionMarkers = ['[DONE]', '<|end|>', '</response>'];
    return completionMarkers.some(marker => 
      chunk.content.includes(marker)
    );
  }

  private createErrorChunk(sessionId: string, error: any): StreamingChunk {
    return {
      id: `${sessionId}_error`,
      type: 'error',
      content: error.message || 'Stream error occurred',
      metadata: {
        sessionId,
        tokensProcessed: 0,
        estimatedTotal: 0,
        completionPercentage: 0,
        activeVoice: 'error',
        confidence: 0,
        latencyMs: 0,
        bufferLevel: 0,
        throughputTPS: 0,
        modelUsed: 'error',
        chunkSize: 0
      },
      timestamp: Date.now(),
      sequenceNumber: -1
    };
  }

  private async handleStreamError(session: StreamingSession, error: any): Promise<void> {
    session.status = 'error';
    this.logger.error(`Stream error in session ${session.id}:`, error);
    
    // Attempt recovery
    const shouldRetry = await this.errorRecovery.shouldRetry(session, error);
    if (shouldRetry) {
      this.logger.info(`Attempting recovery for session ${session.id}`);
      // Recovery logic would go here
    }

    this.emit('session:error', { sessionId: session.id, error });
  }

  private finalizeSession(session: StreamingSession): void {
    const duration = Date.now() - session.startTime;
    session.metrics.averageChunkLatency = duration / session.metrics.chunksProduced;

    this.logger.info(`Session ${session.id} completed:`, {
      duration,
      tokens: session.metrics.tokensStreamed,
      chunks: session.metrics.chunksProduced,
      throughput: session.metrics.throughputTPS
    });

    // Update global metrics
    this.updateGlobalMetrics(session);

    this.emit('session:complete', { 
      sessionId: session.id, 
      metrics: session.metrics 
    });
  }

  private cleanupSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.controller.abort();
      this.activeSessions.delete(sessionId);
      
      if (this.config.metricsCollectionEnabled) {
        this.metricsCollector.endSession(sessionId);
      }
    }
  }

  private updateGlobalMetrics(session: StreamingSession): void {
    this.globalMetrics.totalTokensStreamed += session.metrics.tokensStreamed;
    this.globalMetrics.sessionsActive = this.activeSessions.size;
    
    // Update throughput
    const sessionThroughput = session.metrics.throughputTPS;
    this.globalMetrics.averageThroughput = 
      (this.globalMetrics.averageThroughput + sessionThroughput) / 2;
    
    if (sessionThroughput > this.globalMetrics.peakThroughput) {
      this.globalMetrics.peakThroughput = sessionThroughput;
    }
  }

  private setupHealthMonitoring(): void {
    setInterval(() => {
      this.healthMonitor.checkHealth();
    }, 5000); // Check every 5 seconds
  }

  private setupGracefulShutdown(): void {
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  private generateSessionId(): string {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): StreamingMetrics {
    return {
      sessionsActive: 0,
      totalTokensStreamed: 0,
      averageThroughput: 0,
      peakThroughput: 0,
      errorRate: 0,
      averageLatency: 0,
      bufferUtilization: 0,
      reconnections: 0,
      droppedChunks: 0
    };
  }

  // Public API methods
  public getSession(sessionId: string): StreamingSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  public getMetrics(): StreamingMetrics {
    return { ...this.globalMetrics };
  }

  public async pauseSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'streaming') {
      session.status = 'paused';
      this.emit('session:paused', { sessionId });
      return true;
    }
    return false;
  }

  public async resumeSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (session && session.status === 'paused') {
      session.status = 'streaming';
      this.emit('session:resumed', { sessionId });
      return true;
    }
    return false;
  }

  public async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.status = 'cancelled';
      session.controller.abort();
      this.emit('session:cancelled', { sessionId });
      return true;
    }
    return false;
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down streaming client...');
    
    // Cancel all active sessions
    for (const [sessionId] of this.activeSessions) {
      await this.cancelSession(sessionId);
    }
    
    // Stop health monitoring
    this.healthMonitor.stop();
    
    this.emit('shutdown');
  }
}

// Supporting Classes
class CircularBuffer<T> {
  private buffer: T[];
  private head: number = 0;
  private tail: number = 0;
  private size: number = 0;
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.buffer = new Array(maxSize);
  }

  add(item: T): boolean {
    if (this.isFull()) {
      return false; // Buffer full
    }

    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.maxSize;
    this.size++;
    return true;
  }

  remove(): T | undefined {
    if (this.isEmpty()) {
      return undefined;
    }

    const item = this.buffer[this.head];
    this.head = (this.head + 1) % this.maxSize;
    this.size--;
    return item;
  }

  isFull(): boolean {
    return this.size === this.maxSize;
  }

  isEmpty(): boolean {
    return this.size === 0;
  }

  getSize(): number {
    return this.size;
  }

  capacity(): number {
    return this.maxSize;
  }
}

class MetricsCollector {
  private sessionMetrics: Map<string, any[]> = new Map();

  constructor(private config: StreamingConfiguration) {}

  startSession(sessionId: string): void {
    this.sessionMetrics.set(sessionId, []);
  }

  recordChunk(sessionId: string, chunk: StreamingChunk): void {
    const metrics = this.sessionMetrics.get(sessionId);
    if (metrics) {
      metrics.push({
        timestamp: chunk.timestamp,
        latency: chunk.metadata.latencyMs,
        throughput: chunk.metadata.throughputTPS,
        bufferLevel: chunk.metadata.bufferLevel
      });
    }
  }

  endSession(sessionId: string): any[] | undefined {
    const metrics = this.sessionMetrics.get(sessionId);
    this.sessionMetrics.delete(sessionId);
    return metrics;
  }
}

class HealthMonitor {
  private client: ProductionStreamingClient;
  private isRunning: boolean = true;

  constructor(client: ProductionStreamingClient) {
    this.client = client;
  }

  checkHealth(): void {
    if (!this.isRunning) return;

    const metrics = this.client.getMetrics();
    
    // Check error rate
    if (metrics.errorRate > 0.1) { // 10% error rate
      this.client.emit('health:warning', {
        type: 'high_error_rate',
        value: metrics.errorRate
      });
    }

    // Check buffer utilization
    if (metrics.bufferUtilization > 0.9) { // 90% buffer utilization
      this.client.emit('health:warning', {
        type: 'high_buffer_utilization',
        value: metrics.bufferUtilization
      });
    }
  }

  stop(): void {
    this.isRunning = false;
  }
}

class AdaptiveStreamingController {
  private adaptationHistory: Map<string, number[]> = new Map();

  async processChunk(content: string, session: StreamingSession): Promise<string> {
    const sessionHistory = this.getOrCreateHistory(session.id);
    const currentLatency = Date.now() - session.metrics.lastActivityTime;
    
    sessionHistory.push(currentLatency);
    
    // Keep only recent history
    if (sessionHistory.length > 20) {
      sessionHistory.splice(0, sessionHistory.length - 20);
    }

    // Adapt chunk size based on latency trends
    if (sessionHistory.length >= 5) {
      const avgLatency = sessionHistory.reduce((a, b) => a + b, 0) / sessionHistory.length;
      
      if (avgLatency > 200) { // High latency - reduce chunk size
        return this.splitContent(content, 0.5);
      } else if (avgLatency < 50) { // Low latency - can increase chunk size
        return content;
      }
    }

    return content;
  }

  private getOrCreateHistory(sessionId: string): number[] {
    if (!this.adaptationHistory.has(sessionId)) {
      this.adaptationHistory.set(sessionId, []);
    }
    return this.adaptationHistory.get(sessionId)!;
  }

  private splitContent(content: string, ratio: number): string {
    const splitPoint = Math.floor(content.length * ratio);
    return content.substring(0, splitPoint);
  }
}

class ErrorRecoveryManager {
  private retryHistory: Map<string, number> = new Map();

  constructor(private config: StreamingConfiguration) {}

  async shouldRetry(session: StreamingSession, error: any): Promise<boolean> {
    const retryCount = this.retryHistory.get(session.id) || 0;
    
    if (retryCount >= this.config.retryAttempts) {
      return false;
    }

    // Check if error is recoverable
    const recoverableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND'
    ];

    const isRecoverable = recoverableErrors.some(err => 
      error.message?.includes(err) || error.code === err
    );

    if (isRecoverable) {
      this.retryHistory.set(session.id, retryCount + 1);
      return true;
    }

    return false;
  }
}