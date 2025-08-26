/**
 * Stream Processing Manager - Centralizes streaming request processing
 * Extracted from UnifiedModelClient to provide focused streaming capabilities
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';
import { createHash } from 'crypto';
import { ModelRequest, ModelResponse, ProjectContext } from '../../domain/types/index.js';
import { ISecurityValidator } from '../security/security-validator.js';
import { ICacheCoordinator } from '../../core/caching/cache-coordinator.js';
import { IStreamingManager } from './streaming-manager.js';
import { StreamToken } from '../../domain/types/core-types.js';
import { getErrorMessage } from '../../utils/error-utils.js';

export interface StreamProcessingConfig {
  validateSecurity: boolean;
  enableCaching: boolean;
  requestTimeoutMs: number;
}

export interface IStreamProcessingManager {
  /**
   * Process a streaming request with security validation and caching
   */
  processStreamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse>;

  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}

export class StreamProcessingManager extends EventEmitter implements IStreamProcessingManager {
  private readonly config: StreamProcessingConfig;
  private readonly securityValidator: ISecurityValidator;
  private readonly cacheCoordinator: ICacheCoordinator;
  private readonly streamingManager: IStreamingManager;
  private readonly processRequestDelegate: (
    request: ModelRequest,
    context?: ProjectContext
  ) => Promise<ModelResponse>;
  private readonly generateRequestId: () => string;

  constructor(
    securityValidator: ISecurityValidator,
    cacheCoordinator: ICacheCoordinator,
    streamingManager: IStreamingManager,
    processRequestDelegate: (
      request: ModelRequest,
      context?: ProjectContext
    ) => Promise<ModelResponse>,
    generateRequestId: () => string,
    config?: Partial<StreamProcessingConfig>
  ) {
    super();

    this.securityValidator = securityValidator;
    this.cacheCoordinator = cacheCoordinator;
    this.streamingManager = streamingManager;
    this.processRequestDelegate = processRequestDelegate;
    this.generateRequestId = generateRequestId;

    this.config = {
      validateSecurity: true,
      enableCaching: true,
      requestTimeoutMs: 30000,
      ...config,
    };

    logger.debug('StreamProcessingManager initialized', { config: this.config });
  }

  /**
   * Process a streaming request with security validation and caching
   */
  async processStreamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse> {
    const requestId = this.generateRequestId();
    logger.info(`🌊 Streaming request ${requestId}`, {
      prompt: `${request.prompt.substring(0, 100)  }...`,
    });

    this.emit('stream-request-started', { requestId, prompt: request.prompt.substring(0, 100) });

    try {
      // Security validation if enabled
      if (this.config.validateSecurity) {
        const validation = await this.securityValidator.validateRequest(request);
        if (!validation.isValid) {
          const error = new Error(`Security validation failed: ${validation.reason}`);
          this.emit('stream-request-failed', { requestId, error: error.message });
          throw error;
        }

        // Use sanitized input if available
        if (validation.sanitizedInput) {
          request.prompt = validation.sanitizedInput;
        }
      }

      // Check semantic cache first if enabled
      if (this.config.enableCaching) {
        const promptKey = `ai:prompt:${createHash('sha256').update(request.prompt).digest('hex')}`;
        const cachedResponse = await this.cacheCoordinator.get(promptKey);

        if (cachedResponse?.hit) {
          logger.debug('Cache hit for streaming request', {
            source: cachedResponse.source,
            similarity: cachedResponse.similarity,
          });

          // Simulate streaming from cached response
          await this.simulateStreamFromCache(cachedResponse.response, onToken);

          this.emit('stream-request-completed', {
            requestId,
            fromCache: true,
            source: cachedResponse.source,
          });

          return cachedResponse.response;
        }
      }

      // No cache hit, process with streaming
      const streamConfig = {
        onToken,
        enableBackpressure: true,
        bufferSize: 1024,
      };

      // Fallback to regular processing since streamProcess not available
      const response = await this.processRequestDelegate(request, context);

      this.emit('stream-request-completed', {
        requestId,
        fromCache: false,
        responseLength: response.content?.length,
      });

      return response;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      logger.error('Stream request failed', { requestId, error: errorMessage });
      this.emit('stream-request-failed', { requestId, error: errorMessage });
      throw error;
    }
  }

  /**
   * Simulate streaming from cached response
   */
  private async simulateStreamFromCache(
    response: ModelResponse,
    onToken: (token: StreamToken) => void
  ): Promise<void> {
    if (!response.content) {
      return;
    }

    const content = response.content;
    const chunkSize = 10; // Characters per chunk

    for (let i = 0; i < content.length; i += chunkSize) {
      const chunk = content.slice(i, i + chunkSize);
      onToken({
        content: chunk,
        timestamp: Date.now(),
        index: i,
        finished: i + chunkSize >= content.length,
        metadata: { source: 'cache-simulation', position: i },
      });

      // Small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.removeAllListeners();
    logger.debug('StreamProcessingManager cleaned up');
  }
}
