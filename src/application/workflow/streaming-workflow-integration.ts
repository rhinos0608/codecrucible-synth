/**
 * Streaming Workflow Integration - Real-time AI Progress Display
 *
 * Integrates StreamingManager with AgenticWorkflowDisplay to show
 * users exactly what the AI is doing in real-time with progress indicators
 * and token-by-token generation visualization.
 *
 * Features:
 * - Real-time token streaming progress
 * - Live response generation display
 * - Tool execution streaming
 * - Performance metrics integration
 * - User-friendly progress visualization
 */

import { EventEmitter } from 'events';
import {
  StreamChunk,
  StreamConfig,
  StreamingManager,
} from '../../infrastructure/streaming/streaming-manager.js';
import { AgenticWorkflowDisplay } from './agentic-workflow-display.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface StreamingWorkflowConfig extends StreamConfig {
  showTokens?: boolean;
  showProgress?: boolean;
  updateInterval?: number; // ms between progress updates
  maxDisplayTokens?: number; // limit tokens shown in real-time
}

export interface StreamingProgress {
  sessionId: string;
  stepId: string;
  tokensGenerated: number;
  estimatedTotal: number;
  currentContent: string;
  throughput: number; // tokens per second
  elapsedTime: number; // milliseconds
}

/**
 * Integrates streaming responses with agentic workflow display
 */
export class StreamingWorkflowIntegration extends EventEmitter {
  private readonly streamingManager: StreamingManager;
  private readonly workflowDisplay: AgenticWorkflowDisplay;
  private readonly activeStreams: Map<string, StreamingProgress> = new Map();
  private config: StreamingWorkflowConfig;
  private readonly progressIntervals: Map<string, NodeJS.Timeout> = new Map();

  public constructor(
    streamingManager: StreamingManager,
    workflowDisplay: AgenticWorkflowDisplay,
    config: StreamingWorkflowConfig = {}
  ) {
    super();
    this.streamingManager = streamingManager;
    this.workflowDisplay = workflowDisplay;
    this.config = {
      showTokens: true,
      showProgress: true,
      updateInterval: 500,
      maxDisplayTokens: 100,
      ...config,
    };
  }

  /**
   * Start streaming a response with real-time workflow visualization
   */
  public async startStreamingWithWorkflow(
    sessionId: string,
    stepId: string,
    content: string,
    operationType: string = 'AI Response Generation'
  ): Promise<string> {
    logger.info(`🌊 Starting streaming workflow for ${operationType}`);

    const startTime = Date.now();
    // Removed unused variables: tokensGenerated, currentContent, lastUpdate

    // Initialize streaming progress tracking
    const streamProgress: StreamingProgress = {
      sessionId,
      stepId,
      tokensGenerated: 0,
      estimatedTotal: this.estimateTokensNeeded(content),
      currentContent: '',
      throughput: 0,
      elapsedTime: 0,
    };

    this.activeStreams.set(stepId, streamProgress);

    // Update workflow display with initial streaming state
    this.workflowDisplay.updateStepProgress(sessionId, stepId, 5, 'Initializing AI streaming...');

    // Set up progress interval for smooth updates
    const progressInterval = setInterval(() => {
      this.updateStreamingProgress(streamProgress, startTime);
    }, this.config.updateInterval);

    this.progressIntervals.set(stepId, progressInterval);

    try {
      // Start the actual stream with chunk processing
      const result = await this.streamingManager.startModernStream(
        content,
        (chunk: Readonly<StreamChunk>) => {
          this.handleStreamChunk(chunk, streamProgress, startTime);
        },
        this.config
      );

      // Complete the streaming workflow
      clearInterval(progressInterval);
      this.progressIntervals.delete(stepId);

      const finalElapsed = Date.now() - startTime;
      const { tokensGenerated } = streamProgress;
      const finalThroughput = tokensGenerated > 0 ? (tokensGenerated / finalElapsed) * 1000 : 0;

      this.workflowDisplay.updateStepProgress(
        sessionId,
        stepId,
        100,
        `Complete: ${tokensGenerated} tokens in ${(finalElapsed / 1000).toFixed(1)}s (${finalThroughput.toFixed(1)} tok/s)`
      );

      this.activeStreams.delete(stepId);

      logger.info(`✅ Streaming complete: ${tokensGenerated} tokens in ${finalElapsed}ms`);

      this.emit('streamingComplete', {
        sessionId,
        stepId,
        tokensGenerated,
        duration: finalElapsed,
        throughput: finalThroughput,
        result,
      });

      return result;
    } catch (error) {
      // Handle streaming errors
      clearInterval(progressInterval);
      this.progressIntervals.delete(stepId);
      this.activeStreams.delete(stepId);

      logger.error(`❌ Streaming failed: ${(error as Error).message}`);

      this.workflowDisplay.updateStepProgress(
        sessionId,
        stepId,
        0,
        `Error: ${(error as Error).message}`
      );

      throw error;
    }
  }

  /**
   * Handle individual stream chunks and update progress
   */
  private handleStreamChunk(
    chunk: StreamChunk,
    progress: StreamingProgress,
    startTime: number
  ): void {
    const now = Date.now();
    progress.elapsedTime = now - startTime;

    switch (chunk.type) {
      case 'stream-start':
        logger.debug('🌊 Stream started');
        this.workflowDisplay.updateStepProgress(
          progress.sessionId,
          progress.stepId,
          10,
          'AI model responding...'
        );
        break;

      case 'text-delta':
        if (chunk.delta) {
          // Implement sliding window to prevent memory accumulation
          const maxContentLength = this.config.maxDisplayTokens ?? 1000;
          progress.currentContent += chunk.delta;
          
          // Trim content if it exceeds maximum length (sliding window)
          if (progress.currentContent.length > maxContentLength) {
            const trimStart = progress.currentContent.length - maxContentLength * 0.8; // Keep 80%
            progress.currentContent = '...' + progress.currentContent.slice(trimStart);
          }
          
          progress.tokensGenerated += this.estimateTokensInDelta(chunk.delta);

          // Show live content if enabled
          if (
            this.config.showTokens &&
            progress.currentContent.length <= maxContentLength
          ) {
            console.log(chunk.delta, { end: '' }); // Real-time token display
          }
        }
        break;

      case 'text-end':
        logger.debug('📝 Text generation complete');
        break;

      case 'tool-call':
        this.workflowDisplay.updateStepProgress(
          progress.sessionId,
          progress.stepId,
          (progress.tokensGenerated / progress.estimatedTotal) * 80,
          `Executing tool: ${chunk.toolName || 'unknown'}`
        );
        break;

      case 'finish':
        logger.debug('🏁 Stream finished');
        if (chunk.usage?.outputTokens) {
          progress.tokensGenerated = chunk.usage.outputTokens;
        }
        break;

      case 'error':
        logger.error(`❌ Stream error: ${chunk.error}`);
        break;

      default:
        // Handle other chunk types
        logger.debug(`📦 Chunk: ${chunk.type}`);
    }

    // Emit progress event for external listeners
    this.emit('streamingProgress', progress);
  }

  /**
   * Update streaming progress display
   */
  private updateStreamingProgress(progress: StreamingProgress, startTime: number): void {
    const now = Date.now();
    progress.elapsedTime = now - startTime;

    if (progress.elapsedTime > 0 && progress.tokensGenerated > 0) {
      progress.throughput = (progress.tokensGenerated / progress.elapsedTime) * 1000;
    }

    // Calculate progress percentage
    const progressPercent = Math.min(
      95, // Cap at 95% until completion
      Math.max(10, (progress.tokensGenerated / progress.estimatedTotal) * 80 + 10)
    );

    // Create progress message
    const throughputText =
      progress.throughput > 0 ? ` (${progress.throughput.toFixed(1)} tok/s)` : '';

    const message = `Generating: ${progress.tokensGenerated}/${progress.estimatedTotal} tokens${throughputText}`;

    this.workflowDisplay.updateStepProgress(
      progress.sessionId,
      progress.stepId,
      progressPercent,
      message
    );
  }

  /**
   * Estimate tokens needed based on input content
   */
  private estimateTokensNeeded(content: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    // Output is typically 1-3x input length for most tasks
    const inputTokens = Math.ceil(content.length / 4);
    return Math.max(50, inputTokens * 2); // Conservative estimate
  }

  /**
   * Estimate tokens in a delta chunk
   */
  private estimateTokensInDelta(delta: string): number {
    // Simple approximation for token counting
    return Math.max(1, Math.ceil(delta.length / 4));
  }

  /**
   * Get current streaming status for a step
   */
  getStreamingStatus(stepId: string): StreamingProgress | undefined {
    return this.activeStreams.get(stepId);
  }

  /**
   * Get all active streaming sessions
   */
  getActiveStreams(): StreamingProgress[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Stop streaming for a specific step
   */
  stopStreaming(stepId: string): void {
    const interval = this.progressIntervals.get(stepId);
    if (interval) {
      clearInterval(interval);
      this.progressIntervals.delete(stepId);
    }

    this.activeStreams.delete(stepId);
    logger.info(`🛑 Stopped streaming for step: ${stepId}`);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<StreamingWorkflowConfig>): void {
    this.config = { ...this.config, ...config };

    // Update streaming manager config too
    if (config.chunkSize || config.bufferSize || config.timeout) {
      this.streamingManager.updateConfig(config);
    }
  }

  /**
   * Cleanup all active streams
   */
  async cleanup(): Promise<void> {
    // Clear all progress intervals
    for (const [stepId, interval] of this.progressIntervals) {
      clearInterval(interval);
      logger.debug(`🧹 Cleared progress interval for ${stepId}`);
    }

    this.progressIntervals.clear();
    this.activeStreams.clear();

    // Cleanup streaming manager
    await this.streamingManager.cleanup();

    logger.info('🧹 Streaming workflow integration cleanup complete');
  }
}

// Export singleton instance for global use
export const streamingWorkflowIntegration = new StreamingWorkflowIntegration(
  new StreamingManager(),
  new AgenticWorkflowDisplay()
);
