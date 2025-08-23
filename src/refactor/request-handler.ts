
import { ModelRequest, ModelResponse, ProjectContext, StreamToken } from "../core/types.js";
import { UnifiedModelClient } from "../core/client.js";

export class RequestHandler {
    private client: UnifiedModelClient;

    constructor(client: UnifiedModelClient) {
        this.client = client;
    }

    async synthesize(request: ModelRequest): Promise<ModelResponse> {
    // INTELLIGENT CACHING: Check cache with content-aware key generation
    const cacheKey = this.client.getCacheCoordinator().generateIntelligentCacheKey(request);
    const cached = await this.client.getCacheCoordinator().get(cacheKey);
    if (cached && this.client.getCacheCoordinator().shouldUseIntelligentCache(request)) {
      logger.debug('Returning cached response');
      return { 
        ...cached, 
        cached: true,
        model: cached.model || 'unknown',
        provider: cached.provider || 'unknown'
      } as ModelResponse;
    }

    let selectedProvider = request.provider;
    let routingDecision = null;

    // HYBRID ROUTING: Use intelligent router if available and no provider specified
    if (!selectedProvider && this.client.getHybridRouter()) {
      try {
        const taskType = this.client.inferTaskType(request.prompt || '');
        const complexity = this.client.analyzeComplexity(request.prompt || '', request);

        routingDecision = await this.client.getHybridRouter().routeTask(
          taskType,
          request.prompt || '',
          this.client.convertToTaskMetrics(complexity, request)
        );
        selectedProvider = routingDecision.selectedLLM === 'lm-studio' ? 'lm-studio' : 'ollama';

        logger.info(
          `🤖 Hybrid routing: ${taskType} task → ${selectedProvider} (confidence: ${routingDecision.confidence})`
        );
      } catch (error) {
        logger.warn('Hybrid routing failed, using fallback:', error);
        selectedProvider = 'ollama'; // Default fallback
      }
    }

    // Get available tools for function calling - only for compatible models
    // Try enhanced tool integration first, fallback to local tools
    const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
    const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
    const supportsTools = this.client.modelSupportsTools((selectedProvider || 'ollama') as ProviderType, request.model);
    const tools = supportsTools && toolIntegration ? toolIntegration.getLLMFunctions() : [];

    // DEBUG: Log tool integration status
    logger.debug('Tool debug info', {
      provider: selectedProvider,
      model: request.model,
      supportsTools,
    });
    logger.debug('Tool integration status', {
      hasIntegration: !!toolIntegration,
      toolCount: tools.length,
    });
    if (tools.length > 0) {
      logger.debug('Available tools', { tools: tools.map(t => t.function.name) });
    }

    const modelRequest: ModelRequest = {
      prompt: request.prompt || '',
      model: request.model,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      stream: request.stream,
      provider: selectedProvider,
      tools: tools,
      abortSignal: request.abortSignal, // Add abort signal for timeout handling
    };

    const startTime = Date.now();
    const response = await this.processRequestWithHybrid(modelRequest, routingDecision);
    const responseTime = Date.now() - startTime;

    // Record performance for hybrid learning
    if (routingDecision && this.client.getHybridRouter()) {
      const requestId = this.client.generateRequestId();
      this.client.getHybridRouter().recordPerformance(requestId, {
        success: !!response.content,
        responseTime,
        qualityScore: this.client.assessQuality(response.content),
        taskType: this.client.inferTaskType(request.prompt || ''),
        errorType: response.error ? 'generation-failed' : undefined,
      });
    }

    const result: ModelResponse = {
      content: response.content,
      model: response.model || 'unknown',
      provider: selectedProvider as string,
      metadata: {
        tokens: response.metadata?.tokens || 0,
        latency: responseTime,
        quality: response.metadata?.quality,
      },
      usage: response.usage,
      cached: false,
    };

    // INTELLIGENT CACHING: Cache with content-aware TTL
    if (this.client.getCacheCoordinator().shouldUseIntelligentCache(request)) {
      this.client.getCacheCoordinator().set(cacheKey, result);
      logger.debug('Response cached with intelligent TTL');
    }

    return result;
  }

    async processRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    logger.debug('processRequest started');

    // PERFORMANCE: Temporarily bypass semantic cache to fix hanging
    logger.debug('Bypassing semantic cache (disabled for debugging)');
    // const cacheKey = `${request.prompt}::${request.model || 'default'}`;
    // const cachedResponse = await semanticCache.getCachedResponse(
    //   request.prompt,
    //   context?.files?.map(f => f.path) || []
    // );
    logger.debug('Cache bypass complete');
    const requestId = this.client.generateRequestId();
    logger.info(`📨 Processing request ${requestId}`, {
      prompt: request.prompt.substring(0, 100) + '...',
    });

    // CRITICAL SECURITY: ALWAYS validate input - cannot be bypassed
    logger.debug('Starting security validation');
    const validation = await this.client.getSecurityValidator().validateRequest(request);
    logger.debug('Security validation complete');
    if (!validation.isValid) {
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Use sanitized input if available
    if (validation.sanitizedInput) {
      request.prompt = validation.sanitizedInput;
    }

    // Determine execution strategy
    const strategy = this.client.determineExecutionStrategy(request, context);
    logger.info(
      `🎯 Using execution strategy: ${strategy.mode} with provider: ${strategy.provider}`
    );

    // Register process with active process manager
    const estimatedMemory = this.client.estimateMemoryUsage(request);
    const process = this.client.getProcessManager().registerProcess({
      type: this.client.getProcessType(request),
      modelName: this.client.getCurrentModel() || 'unknown',
      estimatedMemoryUsage: estimatedMemory,
      priority: this.client.getRequestPriority(request),
      promise: Promise.resolve(), // Will be updated below
    });

    try {
      // Execute with fallback chain and register abort signal
      const resultPromise = this.executeWithFallback(
        requestId,
        request,
        context,
        strategy,
        process.abortController.signal
      );

      // Update the process promise
      process.promise = resultPromise;

      const result = await resultPromise;

      // Unregister successful process
      this.client.getProcessManager().unregisterProcess(process.id);

      return result;
    } catch (error) {
      // Unregister failed process
      this.client.getProcessManager().unregisterProcess(process.id);

      // Check if error was due to abort signal
      if (process.abortController.signal.aborted) {
        throw new Error('Request terminated due to resource constraints');
      }

      throw error;
    }
  }

    async streamRequest(
    request: ModelRequest,
    onToken: (token: StreamToken) => void,
    context?: ProjectContext
  ): Promise<ModelResponse> {
    const requestId = this.client.generateRequestId();
    logger.info(`🌊 Streaming request ${requestId}`, {
      prompt: request.prompt.substring(0, 100) + '...',
    });

    // CRITICAL SECURITY: ALWAYS validate input - cannot be bypassed
    const validation = await this.client.getSecurityValidator().validateRequest(request);
    if (!validation.isValid) {
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Use sanitized input if available
    if (validation.sanitizedInput) {
      request.prompt = validation.sanitizedInput;
    }

    // Check semantic cache first
    const promptKey = `ai:prompt:${createHash('sha256').update(request.prompt).digest('hex')}`;
    const cachedResponse = await this.client.getCacheCoordinator().get(promptKey);

    if (cachedResponse?.hit) {
      logger.debug('Cache hit for streaming request', {
        source: cachedResponse.source,
        similarity: cachedResponse.similarity,
      });

      // Stream cached response progressively using StreamingManager
      await this.client.getStreamingManager().startStream(cachedResponse.value, onToken, this.client.getConfig().streaming);

      return {
        content: cachedResponse.value,
        model: request.model || this.client.getCurrentModel() || 'cached',
        cached: true,
        processingTime: 0,
        streamed: true,
      } as ModelResponse;
    }

    // Determine execution strategy for streaming
    const strategy = this.client.determineExecutionStrategy(request, context);
    logger.info(`🌊 Streaming strategy: ${strategy.mode} with provider: ${strategy.provider}`);

    // Register process with active process manager
    const estimatedMemory = this.client.estimateMemoryUsage(request);
    const process = this.client.getProcessManager().registerProcess({
      type: 'streaming',
      modelName: this.client.getCurrentModel() || 'unknown',
      estimatedMemoryUsage: estimatedMemory,
      priority: this.client.getRequestPriority(request),
      promise: Promise.resolve(),
    });

    try {
      let fullResponse = '';
      const startTime = Date.now();

      // Real provider integration for streaming
      let responseContent: string;

      try {
        // Use hybrid routing to get real response from available providers
        if (!this.client.getHybridRouter()) {
          throw new Error('Hybrid router not initialized');
        }
        const routingDecision = await this.client.getHybridRouter().routeTask(
          'code_generation',
          request.prompt,
          {
            requiresDeepAnalysis: false,
            estimatedProcessingTime: 10000,
          }
        );
        const providerResponse = await this.processRequestWithHybrid(request, routingDecision);
        responseContent = providerResponse.content || '';

        if (!responseContent) {
          throw new Error('Provider returned empty content');
        }
      } catch (error) {
        // Graceful fallback to available providers
        logger.warn('Primary provider failed, attempting fallback', error);
        const availableProviders = this.client.getProviderManager().getProviders();
        const fallbackProviderType = availableProviders.keys().next().value;

        if (fallbackProviderType) {
          const fallbackProvider = this.client.getProviderManager().selectProvider(fallbackProviderType);
          if (fallbackProvider) {
            const fallbackResponse = await fallbackProvider.processRequest(request, context);
            responseContent =
              fallbackResponse.content || 'Unable to generate response - all providers unavailable';
          } else {
            responseContent =
              'No AI providers are currently available. Please check your configuration.';
          }
        } else {
          responseContent =
            'No AI providers are currently available. Please check your configuration.';
        }
      }

      // Stream the real response using StreamingManager
      await this.client.getStreamingManager().startStream(
        responseContent,
        (token: StreamToken) => {
          fullResponse += token.content;
          onToken(token);
        },
        this.client.getConfig().streaming
      );

      const finalResponse: ModelResponse = {
        content: fullResponse,
        model: strategy.provider || this.client.getCurrentModel() || 'unknown',
        cached: false,
        processingTime: Date.now() - startTime,
        streamed: true,
      };

      // Cache the successful streaming response (temporarily disabled due to TS error)
      // TODO: Fix cache metadata structure and re-enable caching

      // Unregister successful process
      this.client.getProcessManager().unregisterProcess(process.id);

      logger.info(`✅ Streaming completed for request ${requestId}`, {
        responseLength: fullResponse.length,
        processingTime: finalResponse.processingTime,
      });

      return finalResponse;
    } catch (error) {
      // Unregister failed process
      this.client.getProcessManager().unregisterProcess(process.id);

      // Check if error was due to abort signal
      if (process.abortController.signal.aborted) {
        throw new Error('Streaming request terminated due to resource constraints');
      }

      logger.error(`❌ Streaming failed for request ${requestId}:`, error);
      throw error;
    }
  }

    
  async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: { mode: any; provider: any; timeout: any; complexity: any; },
    abortSignal?: AbortSignal
  ): Promise<ModelResponse> {
    return this.client.getRequestExecutionManager().executeWithFallback(
      requestId,
      request,
      context,
      strategy,
      abortSignal
    );
  }


    
  async queueRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    return this.client.getRequestProcessingCoreManager().queueRequest(
      request,
      this.client.getActiveRequests().size,
      (req, ctx) => this.processRequest(req, ctx),
      context
    );
  }


    
  async processRequestWithHybrid(request: any, routingDecision: any): Promise<any> {
    const selectedProvider = request.provider || 'ollama';

    try {
      // Ensure providers are initialized before attempting to use them
      const availableProviders = this.client.getProviderManager().getProviders();
      if (availableProviders.size === 0) {
        logger.warn('No providers available, attempting to initialize');
        await this.client.initializeProvidersAsync();
      }
      
      // Get the appropriate provider
      const provider = this.client.getProviderManager().selectProvider(selectedProvider);
      if (!provider) {
        throw new Error(`Provider ${selectedProvider} not available`);
      }

      // DEBUG: Log request before sending to provider
      logger.debug('Hybrid debug: Sending to provider', {
        provider: selectedProvider,
        toolCount: request.tools?.length || 0,
      });
      if (request.tools?.length > 0) {
        logger.debug('Hybrid debug: Tool names', {
          toolNames: request.tools.map((t: any) => t.function?.name || t.name || 'unnamed'),
        });
      }

      // Process the request with timeout handling
      const processRequest = async () => {
        if (request.abortSignal?.aborted) {
          throw new Error('Request was aborted');
        }
        return await provider.processRequest(request);
      };

      // Add timeout protection at provider level
      const response = await Promise.race([
        processRequest(),
        new Promise((_, reject) => {
          if (request.abortSignal) {
            request.abortSignal.addEventListener('abort', () => {
              reject(new Error('Request timed out'));
            });
          }
        })
      ]);

      // Check if response contains tool calls that need to be executed
      if (response.toolCalls && response.toolCalls.length > 0) {
        logger.debug('Tool execution: Found tool calls', { count: response.toolCalls.length });

        const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
        const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
        if (toolIntegration) {
          try {
            const toolResults = [];

            // Execute each tool call
            for (const toolCall of response.toolCalls) {
              logger.debug('Executing tool', {
                toolName: toolCall.name || toolCall.function?.name,
              });

              // Convert to expected format if needed
              const formattedToolCall = {
                function: {
                  name: toolCall.name || toolCall.function?.name,
                  arguments: JSON.stringify(
                    toolCall.arguments || toolCall.function?.arguments || {}
                  ),
                },
              };

              const result = await toolIntegration.executeToolCall(formattedToolCall);
              logger.debug('Tool result', { result });
              toolResults.push(result);
            }

            // If we have tool results, format them into a readable response
            if (toolResults.length > 0) {
              const firstResult = toolResults[0];

              if (firstResult.success && firstResult.output) {
                // Return the actual tool result as the content
                const content = firstResult.output.content || firstResult.output;
                response.content = content;
                response.metadata = {
                  ...response.metadata,
                  toolExecuted: true,
                  toolResults: toolResults.map(r => ({
                    success: r.success,
                    executionTime: r.metadata?.executionTime,
                  })),
                };
              } else {
                response.content = `Tool execution failed: ${firstResult.error || 'Unknown error'}`;
              }
            }
          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Tool execution error', error);
            response.content = `Tool execution error: ${errorMessage}`;
          }
        } else {
          logger.warn('Tool integration not available for execution');
        }
      }

      // Add hybrid routing metadata
      if (response.metadata) {
        response.metadata.hybridRouting = routingDecision;
        response.metadata.selectedProvider = selectedProvider;
      }

      return response;
    } catch (error) {
      logger.error(`Hybrid processing failed with ${selectedProvider}:`, error);

      // Fallback to alternative provider if available
      const fallbackProvider = selectedProvider === 'lm-studio' ? 'ollama' : 'lm-studio';
      const fallback = this.client.getProviderManager().selectProvider(fallbackProvider);

      if (fallback) {
        logger.info(`Falling back to ${fallbackProvider}`);
        const fallbackResponse = await fallback.processRequest(request);

        if (fallbackResponse.metadata) {
          fallbackResponse.metadata.hybridRouting = {
            ...routingDecision,
            fallbackUsed: true,
            originalProvider: selectedProvider,
            actualProvider: fallbackProvider,
          };
        }

        return fallbackResponse;
      }

      throw error;
    }
  }

}
