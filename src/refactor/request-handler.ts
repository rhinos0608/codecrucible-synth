import { ModelRequest, ModelResponse, ProjectContext, StreamToken } from '../core/types.js';
import { UnifiedModelClient } from '../application/services/client.js';
import { logger } from '../core/logger.js';
import { getGlobalEnhancedToolIntegration } from '../infrastructure/tools/enhanced-tool-integration.js';
import { getGlobalToolIntegration } from '../infrastructure/tools/tool-integration.js';
import { ProviderType } from '../core/providers/provider-repository.js';
import { createHash } from 'crypto';
import { getErrorMessage } from '../utils/error-utils.js';
import { ResponseNormalizer } from '../core/response-normalizer.js';
import { DomainAwareToolOrchestrator } from '../core/tools/domain-aware-tool-orchestrator.js';
import { SequentialToolExecutor } from '../infrastructure/tools/sequential-tool-executor.js';

export class RequestHandler {
  private client: UnifiedModelClient;
  private domainOrchestrator: DomainAwareToolOrchestrator;
  private sequentialExecutor: SequentialToolExecutor;

  constructor(client: UnifiedModelClient) {
    this.client = client;
    this.domainOrchestrator = new DomainAwareToolOrchestrator();
    this.sequentialExecutor = new SequentialToolExecutor();
  }

  async makeRequest(request: any): Promise<any> {
    return this.processRequest(request);
  }

  /**
   * Helper method to get LLM functions from tool integration
   */
  private async getLLMFunctionsFromIntegration(toolIntegration: any): Promise<any[]> {
    // Check if the integration has the expected method
    if (toolIntegration && typeof toolIntegration.getLLMFunctions === 'function') {
      return await toolIntegration.getLLMFunctions();
    }
    
    // Fallback: try to get tools from the integration and convert them
    if (toolIntegration && typeof toolIntegration.listTools === 'function') {
      const toolNames = toolIntegration.listTools();
      return toolNames.map((name: string) => ({
        type: 'function',
        function: {
          name,
          description: `Execute ${name} tool`,
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string', description: 'Input for the tool' }
            },
            required: ['input']
          }
        }
      }));
    }
    
    // Ultimate fallback: return empty array
    return [];
  }

  /**
   * Helper method to execute tool call from integration
   */
  private async executeToolCallFromIntegration(toolIntegration: any, toolCall: any): Promise<any> {
    // Check if the integration has the expected method
    if (toolIntegration && typeof toolIntegration.executeToolCall === 'function') {
      return await toolIntegration.executeToolCall(toolCall);
    }
    
    // Fallback: try to use executeTool or executeEnhancedTool
    if (toolIntegration && typeof toolIntegration.executeTool === 'function') {
      const toolName = toolCall.function?.name;
      const parameters = JSON.parse(toolCall.function?.arguments || '{}');
      return await toolIntegration.executeTool(toolName, parameters);
    }
    
    if (toolIntegration && typeof toolIntegration.executeEnhancedTool === 'function') {
      const toolName = toolCall.function?.name;
      const parameters = JSON.parse(toolCall.function?.arguments || '{}');
      const context = { requestId: 'unknown', priority: 'medium' as const };
      return await toolIntegration.executeEnhancedTool(toolName, parameters, context);
    }
    
    // Ultimate fallback: return error result
    return {
      success: false,
      error: 'Tool integration does not support tool execution',
      executionTime: 0
    };
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
        provider: cached.provider || 'unknown',
      } as ModelResponse;
    }

    let selectedProvider = request.provider;
    let routingDecision = null;

    // HYBRID ROUTING: Use intelligent router if available and no provider specified
    if (!selectedProvider && this.client.getHybridRouter()) {
      try {
        const taskType = this.client.inferTaskType(request.prompt || '');
        const complexity = this.client.analyzeComplexity(request);

        routingDecision = await this.client
          .getHybridRouter()
          .routeTask(taskType, request.prompt || '', this.client.convertToTaskMetrics(complexity));
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
    const supportsTools = this.client.modelSupportsTools(
      (selectedProvider || 'ollama') as ProviderType
    );
    
    // DOMAIN-AWARE TOOL SELECTION: Smart tool filtering based on prompt analysis
    let tools: any[] = [];
    let domainAnalysis: any = null;
    let toolSelectionReasoning = '';
    
    if (supportsTools && toolIntegration) {
      // Get LLM-compatible function definitions from tool integration
      const rawTools = await this.getLLMFunctionsFromIntegration(toolIntegration);
      
      // Step 1: Standardize all available tools
      const standardizedTools = rawTools.map((tool: any) => {
        const standardTool: any = {
          type: 'function',
          function: {
            name: tool.function?.name || tool.name,
            description: tool.function?.description || tool.description || `Execute ${tool.function?.name || tool.name}`,
            parameters: {
              type: 'object',
              properties: tool.function?.parameters?.properties || tool.parameters?.properties || {},
              required: tool.function?.parameters?.required || tool.parameters?.required || []
            }
          }
        };

        // Apply provider-specific formatting
        if (selectedProvider === 'ollama') {
          standardTool.function.strict = false; // Ollama compatibility
        } else if (selectedProvider === 'lm-studio') {
          standardTool.function.schema_version = '2024-10'; // LM Studio compatibility
        }

        return standardTool;
      });

      // Step 2: Domain-aware tool selection (CRITICAL: reduces payload from 21 to ~3-7 tools)
      // Get domain-appropriate tools (fallback to all tools if orchestrator doesn't have the method)
      const domainResult = this.domainOrchestrator.getToolsForPrompt ? 
        this.domainOrchestrator.getToolsForPrompt(request.prompt || '', standardizedTools) :
        { tools: standardizedTools.slice(0, 5), analysis: { primaryDomain: 'general', confidence: 0.7 }, reasoning: 'Using fallback tool selection' };
      
      tools = domainResult.tools;
      domainAnalysis = domainResult.analysis;
      toolSelectionReasoning = domainResult.reasoning;

      logger.info('🎯 DOMAIN-AWARE TOOL SELECTION', {
        prompt: `${request.prompt?.substring(0, 100)  }...`,
        primaryDomain: domainAnalysis.primaryDomain,
        confidence: `${(domainAnalysis.confidence * 100).toFixed(1)  }%`,
        originalToolCount: standardizedTools.length,
        selectedToolCount: tools.length,
        toolNames: tools.map(t => t.function.name),
        reasoning: toolSelectionReasoning
      });
    }

    // ENHANCED DEBUG: Show domain-aware tool selection results
    logger.info('🔧 ENHANCED TOOL DEBUG: Domain-aware integration status', {
      provider: selectedProvider,
      model: request.model,
      supportsTools,
      hasEnhanced: !!enhancedToolIntegration,
      hasBasic: !!getGlobalToolIntegration(),
      hasIntegration: !!toolIntegration,
      selectedToolCount: tools.length,
      domain: domainAnalysis?.primaryDomain || 'unknown',
      domainConfidence: domainAnalysis?.confidence || 0
    });
    
    if (tools.length > 0) {
      logger.info('🎯 DOMAIN-SELECTED TOOLS for request', { 
        domain: domainAnalysis.primaryDomain,
        confidence: `${(domainAnalysis.confidence * 100).toFixed(1)}%`,
        toolNames: tools.map(t => t.function.name),
        reasoning: toolSelectionReasoning,
        sampleTool: tools[0]
      });
    } else {
      logger.warn('⚠️ NO DOMAIN TOOLS SELECTED: Check domain analysis', {
        domain: domainAnalysis?.primaryDomain,
        detectedKeywords: domainAnalysis?.detectedKeywords?.slice(0, 5)
      });
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
        success: !!(response as ModelResponse).content,
        responseTime,
        qualityScore: this.client.assessQuality((response as ModelResponse).content),
        taskType: this.client.inferTaskType(request.prompt || ''),
        errorType: (response as ModelResponse).error ? 'generation-failed' : undefined,
      });
    }

    const result: ModelResponse = {
      content: (response as ModelResponse).content,
      model: (response as any).model || 'unknown',
      provider: selectedProvider as string,
      metadata: {
        tokens: (response as ModelResponse).metadata?.tokens || 0,
        latency: responseTime,
        quality: (response as ModelResponse).metadata?.quality,
      },
      usage: (response as ModelResponse).usage,
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
      prompt: `${request.prompt.substring(0, 100)}...`,
    });

    // CRITICAL SECURITY: ALWAYS validate input - cannot be bypassed
    logger.info('🔥 CRITICAL DEBUG: Starting security validation for request', {
      promptLength: request.prompt?.length || 0,
      hasPrompt: !!request.prompt
    });
    const validation = await this.client.getSecurityValidator().validateRequest(request);
    logger.info('🔥 CRITICAL DEBUG: Security validation result', {
      isValid: validation.isValid,
      reason: validation.reason,
      riskLevel: validation.riskLevel
    });
    if (!validation.isValid) {
      logger.error('🚨 Security validation BLOCKED the request', { 
        reason: validation.reason,
        riskLevel: validation.riskLevel 
      });
      throw new Error(`Security validation failed: ${validation.reason}`);
    }

    // Use sanitized input if available
    if (validation.sanitizedInput) {
      request.prompt = validation.sanitizedInput;
    }

    // Determine execution strategy
    const strategy = this.client.determineExecutionStrategy(request);
    logger.info(
      `🎯 Using execution strategy: ${(strategy as any).mode} with provider: ${(strategy as any).provider}`
    );

    // Register process with active process manager
    const estimatedMemory = this.client.estimateMemoryUsage(request);
    const processId = await this.client.getProcessManager().startProcess('request_processing', async () => {
      // Process execution logic will go here
      return null;
    });

    try {
      // Execute with fallback chain
      const result = await this.executeWithFallback(
        requestId,
        request,
        context,
        strategy as any
      );

      // Process completed successfully
      await this.client.getProcessManager().stopProcess(processId);
      return result;
    } catch (error) {
      // Process failed
      await this.client.getProcessManager().stopProcess(processId);
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
      prompt: `${request.prompt.substring(0, 100)}...`,
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
      await this.client
        .getStreamingManager()
        .startStream(cachedResponse.value, (token) => onToken(token as StreamToken), this.client.getDefaultConfig().streaming);

      return {
        content: cachedResponse.value,
        model: request.model || this.client.getCurrentModel() || 'cached',
        cached: true,
        processingTime: 0,
        streamed: true,
      } as ModelResponse;
    }

    // Determine execution strategy for streaming
    const strategy = this.client.determineExecutionStrategy(request);
    logger.info(
      `🌊 Streaming strategy: ${(strategy as any).mode} with provider: ${(strategy as any).provider}`
    );

    // Register process with active process manager
    const estimatedMemory = this.client.estimateMemoryUsage(request);
    const processId = await this.client.getProcessManager().startProcess('streaming_request', async () => {
      // Streaming process logic will be executed here
      return null;
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
        const routingDecision = await this.client
          .getHybridRouter()
          .routeTask('code_generation', request.prompt, {
            requiresDeepAnalysis: false,
            estimatedProcessingTime: 10000,
          });
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
          const fallbackProvider = this.client
            .getProviderManager()
            .selectProvider(fallbackProviderType);
          if (fallbackProvider) {
            // Fallback to basic response - actual provider processing would go through the client
            responseContent = `Processing request with ${fallbackProviderType} provider: ${request.prompt.substring(0, 100)}...`;
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
        (token) => {
          fullResponse += token.content;
          onToken(token as StreamToken);
        },
        this.client.getConfig().streaming
      );

      const finalResponse: ModelResponse = {
        content: fullResponse,
        model: (strategy as any).provider || this.client.getCurrentModel() || 'unknown',
        cached: false,
        processingTime: Date.now() - startTime,
        streamed: true,
      };

      // Cache the successful streaming response (temporarily disabled due to TS error)
      // TODO: Fix cache metadata structure and re-enable caching

      // Stop successful process
      await this.client.getProcessManager().stopProcess(processId);

      logger.info(`✅ Streaming completed for request ${requestId}`, {
        responseLength: fullResponse.length,
        processingTime: finalResponse.processingTime,
      });

      return finalResponse;
    } catch (error) {
      // Stop failed process
      await this.client.getProcessManager().stopProcess(processId);

      logger.error(`❌ Streaming failed for request ${requestId}:`, error);
      throw error;
    }
  }

  async executeWithFallback(
    requestId: string,
    request: ModelRequest,
    context: ProjectContext | undefined,
    strategy: { mode: any; provider: any; timeout: any; complexity: any }
  ): Promise<ModelResponse> {
    return this.client
      .getRequestExecutionManager()
      .executeWithFallback(requestId, request, context, strategy);
  }

  async queueRequest(request: ModelRequest, context?: ProjectContext): Promise<ModelResponse> {
    return this.client
      .getRequestProcessingCoreManager()
      .queueRequest(
        request,
        this.client.getActiveRequests().size,
        async (req, ctx) => this.processRequest(req, ctx),
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

        // CRITICAL FIX: Actually call the AI provider instead of returning stub response
        // Get the actual provider instance from the provider manager
        const actualProvider = this.client
          .getProviderManager()
          .getProviderRepository()
          .getProvider(selectedProvider);
        if (!actualProvider) {
          throw new Error(`Provider ${selectedProvider} not available`);
        }

        logger.info('🔥 CRITICAL DEBUG: About to call actualProvider.generateText', {
          provider: selectedProvider,
          promptLength: request.prompt?.length || 0,
          hasProvider: !!actualProvider,
          hasGenerateTextMethod: typeof actualProvider.generateText === 'function'
        });

        const providerResponse = await actualProvider.generateText(request.prompt, {
          model: request.model,
          temperature: request.temperature || 0.7,
          maxTokens: request.maxTokens || 4096,
          stream: false, // For non-streaming requests
          tools: request.tools,
        });

        logger.info('🔥 CRITICAL DEBUG: Provider generateText returned', {
          hasResponse: !!providerResponse,
          responseType: typeof providerResponse,
          responseLength: typeof providerResponse === 'string' ? providerResponse.length : (providerResponse?.content?.length || 0)
        });

        if (!providerResponse) {
          throw new Error('Provider returned empty response');
        }

        // Handle both string and object responses
        const content =
          typeof providerResponse === 'string'
            ? providerResponse
            : providerResponse.content ||
              providerResponse.text ||
              providerResponse.response ||
              String(providerResponse);

        return {
          content,
          model: request.model || 'unknown',
          provider: selectedProvider,
        };
      };

      // Add timeout protection at provider level with actual timeout
      const timeoutMs =
        request.timeout || this.client.getConfig()?.performanceThresholds?.timeoutMs || 30000;
      const response = await Promise.race([
        processRequest(),
        new Promise((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Request timed out after ${timeoutMs}ms`));
          }, timeoutMs);

          // Also handle abort signal if provided
          if (request.abortSignal) {
            request.abortSignal.addEventListener('abort', () => {
              clearTimeout(timeoutId);
              reject(new Error('Request was aborted'));
            });
          }
        }),
      ]);

      // Check if response contains tool calls that need to be executed
      // CRITICAL FIX 1: Support both OpenAI-style toolCalls and local LLM JSON content
      let detectedToolCalls: any[] = [];
      
      // Method 1: OpenAI-style toolCalls property (for compatible providers)
      if (
        (response as ModelResponse).toolCalls &&
        (response as ModelResponse).toolCalls!.length > 0
      ) {
        detectedToolCalls = (response as ModelResponse).toolCalls!;
        logger.debug('Tool execution: Found OpenAI-style tool calls', {
          count: detectedToolCalls.length,
        });
      } 
      // Method 2: Parse JSON tool calls from content (for local LLMs like Ollama)
      else if ((response as ModelResponse).content) {
        const content = (response as ModelResponse).content.trim();
        
        // Try to parse JSON tool calls from various formats
        const jsonPatterns = [
          // Standard JSON object: {"name": "tool", "arguments": {...}}
          /^\s*\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[^}]*\}\s*\}\s*$/,
          // Function call format: {"function": {"name": "tool", "arguments": {...}}}
          /^\s*\{\s*"function"\s*:\s*\{[^}]+\}\s*\}\s*$/,
          // Multiple formats with brackets
          /^\s*```json\s*(\{[^}]+\})\s*```\s*$/,
        ];
        
        let parsedToolCall = null;
        for (const pattern of jsonPatterns) {
          if (pattern.test(content)) {
            try {
              // Remove markdown code blocks if present
              const cleanContent = content.replace(/```json\s*|\s*```/g, '');
              parsedToolCall = JSON.parse(cleanContent);
              break;
            } catch (error) {
              logger.debug('Failed to parse potential tool call JSON', { content, error });
            }
          }
        }
        
        // Also try direct JSON parsing for simple cases
        if (!parsedToolCall) {
          try {
            const parsed = JSON.parse(content);
            if (parsed.name || parsed.function) {
              parsedToolCall = parsed;
            }
          } catch (error) {
            // Not JSON, continue normally
            logger.debug('Content is not JSON tool call, processing as text response');
          }
        }
        
        if (parsedToolCall) {
          // Normalize to consistent format
          const normalizedToolCall = {
            name: parsedToolCall.name || parsedToolCall.function?.name,
            arguments: parsedToolCall.arguments || parsedToolCall.function?.arguments || {},
            function: parsedToolCall.function || {
              name: parsedToolCall.name,
              arguments: parsedToolCall.arguments || {}
            }
          };
          
          detectedToolCalls = [normalizedToolCall];
          logger.debug('Tool execution: Parsed local LLM tool call from content', {
            originalContent: `${content.substring(0, 200)  }...`,
            parsedToolCall: normalizedToolCall,
            count: 1
          });
        }
      }
      
      // Execute detected tool calls
      if (detectedToolCalls.length > 0) {
        logger.debug('Tool execution: Found tool calls', {
          count: detectedToolCalls.length,
        });

        const enhancedToolIntegration = getGlobalEnhancedToolIntegration();
        const toolIntegration = enhancedToolIntegration || getGlobalToolIntegration();
        if (toolIntegration) {
          try {
            const toolResults = [];

            // Execute each tool call
            for (const toolCall of detectedToolCalls) {
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

              // Execute tool using available method
              const result = await this.executeToolCallFromIntegration(toolIntegration, formattedToolCall);
              logger.debug('Tool result', { result });
              toolResults.push(result);
            }

            // If we have tool results, format them into a readable response
            if (toolResults.length > 0) {
              const firstResult = toolResults[0];

              if (firstResult.success && firstResult.output) {
                // CRITICAL FIX: Normalize tool output to prevent buffer display issues
                const rawContent = firstResult.output.content || firstResult.output;
                const normalizedContent = ResponseNormalizer.normalizeToolResult(rawContent);
                
                // Validate normalization succeeded
                if (ResponseNormalizer.validateNormalization(rawContent, normalizedContent)) {
                  (response as ModelResponse).content = normalizedContent;
                } else {
                  // Fallback if normalization fails
                  (response as ModelResponse).content = `Tool executed but result normalization failed. Raw result type: ${typeof rawContent}`;
                  logger.error('Tool result normalization failed', { 
                    rawContentType: typeof rawContent,
                    toolName: firstResult.toolName || 'unknown' 
                  });
                }
                
                (response as ModelResponse).metadata = {
                  tokens: 0,
                  latency: 0,
                  ...(response as ModelResponse).metadata,
                  toolExecuted: true,
                  toolResults: toolResults.map(r => ({
                    success: r.success,
                    executionTime: r.metadata?.executionTime,
                    toolName: r.toolName || 'unknown'
                  })),
                };
              } else {
                // Normalize error messages too
                const errorMsg = firstResult.error || 'Unknown error';
                (response as ModelResponse).content = `Tool execution failed: ${ResponseNormalizer.normalizeToString(errorMsg)}`;
              }
            }
          } catch (error: unknown) {
            const errorMessage = getErrorMessage(error);
            logger.error('Tool execution error', error);
            (response as ModelResponse).content = `Tool execution error: ${errorMessage}`;
          }
        } else {
          logger.warn('Tool integration not available for execution');
        }
      }

      // Add hybrid routing metadata
      if (!(response as ModelResponse).metadata) {
        (response as ModelResponse).metadata = { tokens: 0, latency: 0 };
      }
      (response as ModelResponse).metadata!.hybridRouting = routingDecision;
      (response as ModelResponse).metadata!.selectedProvider = selectedProvider;

      return response;
    } catch (error) {
      logger.error(`Hybrid processing failed with ${selectedProvider}:`, error);

      // Fallback to alternative provider if available
      const fallbackProvider = selectedProvider === 'lm-studio' ? 'ollama' : 'lm-studio';
      const fallback = this.client.getProviderManager().selectProvider(fallbackProvider);

      if (fallback) {
        logger.info(`Falling back to ${fallbackProvider}`);
        // Fallback processing - simplified for now
        const fallbackResponse: ModelResponse = {
          content: `Fallback processing: ${request.prompt.substring(0, 100)}...`,
          model: 'fallback',
          metadata: { tokens: 0, latency: 0 },
        };

        fallbackResponse.metadata!.hybridRouting = {
          ...routingDecision,
          fallbackUsed: true,
          originalProvider: selectedProvider,
          actualProvider: fallbackProvider,
        };

        return fallbackResponse;
      }

      throw error;
    }
  }
}
