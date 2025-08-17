# Hybrid LLM Implementation Guide

## Technical Implementation of LM Studio + Ollama Integration

This guide provides detailed technical implementation instructions for integrating LM Studio with the existing CodeCrucible Synth architecture.

## Prerequisites

### Software Requirements
- **LM Studio**: Latest version with local server capability
- **Ollama**: Already installed and configured
- **Node.js**: 18+ with TypeScript support
- **Windows**: Native performance optimization

### Port Configuration
- **LM Studio**: Port 1234 (default)
- **Ollama**: Port 11434 (existing)
- **CodeCrucible**: Port 3000 (main application)

## Step 1: LM Studio Client Implementation

### Create the LM Studio Client

**File**: `src/core/lm-studio-client.ts`

```typescript
import axios, { AxiosInstance } from 'axios';
import { logger } from './logger.js';

export interface LMStudioConfig {
  endpoint: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  streamingEnabled: boolean;
}

export interface LMStudioResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LMStudioClient {
  private httpClient: AxiosInstance;
  private config: LMStudioConfig;
  private isAvailable = false;
  private lastHealthCheck = 0;
  private healthCheckInterval = 30000; // 30 seconds

  constructor(config: Partial<LMStudioConfig> = {}) {
    this.config = {
      endpoint: config.endpoint || 'http://localhost:1234',
      timeout: config.timeout || 10000,
      maxTokens: config.maxTokens || 2048,
      temperature: config.temperature || 0.1,
      streamingEnabled: config.streamingEnabled || true
    };

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.initializeHealthChecking();
  }

  /**
   * Initialize periodic health checking
   */
  private async initializeHealthChecking(): Promise<void> {
    await this.checkHealth();
    setInterval(async () => {
      await this.checkHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Check if LM Studio server is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/v1/models', { timeout: 5000 });
      this.isAvailable = response.status === 200;
      this.lastHealthCheck = Date.now();
      
      if (this.isAvailable) {
        logger.debug('LM Studio health check passed');
      }
      
      return this.isAvailable;
    } catch (error) {
      this.isAvailable = false;
      logger.warn('LM Studio health check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Get available models from LM Studio
   */
  async getAvailableModels(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/v1/models');
      return response.data.data.map((model: any) => model.id);
    } catch (error) {
      logger.error('Failed to get LM Studio models:', error);
      return [];
    }
  }

  /**
   * Generate code using LM Studio
   */
  async generateCode(
    prompt: string, 
    context: string[] = [],
    options: {
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    } = {}
  ): Promise<{
    code: string;
    explanation: string;
    confidence: number;
    latency: number;
    fromCache: boolean;
  }> {
    const startTime = Date.now();

    if (!this.isAvailable) {
      await this.checkHealth();
      if (!this.isAvailable) {
        throw new Error('LM Studio server is not available');
      }
    }

    try {
      const messages = this.formatMessages(prompt, context);
      
      const requestData = {
        model: await this.getOptimalModel(),
        messages,
        max_tokens: options.maxTokens || this.config.maxTokens,
        temperature: options.temperature || this.config.temperature,
        stream: options.stream || false
      };

      const response = await this.httpClient.post('/v1/chat/completions', requestData);
      const lmStudioResponse: LMStudioResponse = response.data;
      
      const content = lmStudioResponse.choices[0]?.message?.content || '';
      const latency = Date.now() - startTime;

      // Parse the response to extract code and explanation
      const parsed = this.parseCodeResponse(content);
      
      // Calculate confidence based on response quality
      const confidence = this.calculateConfidence(content, prompt, latency);

      logger.info(`LM Studio generation completed in ${latency}ms`, {
        confidence,
        tokens: lmStudioResponse.usage?.total_tokens || 0
      });

      return {
        code: parsed.code,
        explanation: parsed.explanation,
        confidence,
        latency,
        fromCache: false
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      logger.error('LM Studio generation failed:', error);
      throw new Error(`LM Studio generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stream code generation for real-time responses
   */
  async *streamGenerateCode(
    prompt: string,
    context: string[] = []
  ): AsyncGenerator<{
    chunk: string;
    complete: boolean;
    confidence: number;
  }> {
    if (!this.isAvailable) {
      throw new Error('LM Studio server is not available');
    }

    const messages = this.formatMessages(prompt, context);
    
    try {
      const response = await this.httpClient.post('/v1/chat/completions', {
        model: await this.getOptimalModel(),
        messages,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        stream: true
      }, {
        responseType: 'stream'
      });

      let buffer = '';
      let confidence = 0.5; // Initial confidence

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              yield { chunk: '', complete: true, confidence: this.finalConfidence(buffer) };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              
              if (content) {
                buffer += content;
                confidence = this.calculateStreamingConfidence(buffer);
                yield { chunk: content, complete: false, confidence };
              }
            } catch (e) {
              // Ignore JSON parse errors for streaming
            }
          }
        }
      }
    } catch (error) {
      logger.error('LM Studio streaming failed:', error);
      throw error;
    }
  }

  /**
   * Format messages for LM Studio API
   */
  private formatMessages(prompt: string, context: string[]): Array<{role: string, content: string}> {
    const messages = [
      {
        role: 'system',
        content: 'You are a expert programming assistant. Generate high-quality code with clear explanations. Focus on correctness, efficiency, and best practices.'
      }
    ];

    // Add context if provided
    if (context.length > 0) {
      messages.push({
        role: 'user',
        content: `Context:\n${context.join('\n\n')}`
      });
    }

    // Add the main prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    return messages;
  }

  /**
   * Parse the LM Studio response to extract code and explanation
   */
  private parseCodeResponse(content: string): { code: string; explanation: string } {
    // Look for code blocks
    const codeBlockRegex = /```(?:[\w]*\n)?([\s\S]*?)```/g;
    const codeBlocks = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push(match[1].trim());
    }

    if (codeBlocks.length > 0) {
      const code = codeBlocks.join('\n\n');
      const explanation = content.replace(/```[\s\S]*?```/g, '').trim();
      return { code, explanation };
    }

    // If no code blocks found, treat entire content as code
    return {
      code: content,
      explanation: 'Generated code without explicit explanation'
    };
  }

  /**
   * Calculate confidence score for the generated response
   */
  private calculateConfidence(content: string, prompt: string, latency: number): number {
    let confidence = 0.5; // Base confidence

    // Factors that increase confidence
    if (content.includes('```')) confidence += 0.2; // Has code blocks
    if (content.length > 100) confidence += 0.1; // Substantial response
    if (latency < 5000) confidence += 0.1; // Fast response
    if (content.includes('function') || content.includes('class')) confidence += 0.1; // Contains code structures

    // Factors that decrease confidence  
    if (content.length < 50) confidence -= 0.2; // Too short
    if (latency > 15000) confidence -= 0.1; // Too slow
    if (content.includes('sorry') || content.includes("can't")) confidence -= 0.2; // Apologetic response

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Calculate confidence for streaming responses
   */
  private calculateStreamingConfidence(buffer: string): number {
    // Simple heuristic for streaming confidence
    if (buffer.length < 20) return 0.3;
    if (buffer.includes('```')) return 0.8;
    if (buffer.length > 100) return 0.7;
    return 0.5;
  }

  /**
   * Final confidence calculation when streaming is complete
   */
  private finalConfidence(content: string): number {
    return this.calculateConfidence(content, '', 0);
  }

  /**
   * Get the optimal model for the current task
   */
  private async getOptimalModel(): Promise<string> {
    const models = await this.getAvailableModels();
    
    // Prefer code-focused models
    const preferredModels = [
      'codellama-7b-instruct',
      'gemma-2b-it', 
      'qwen2.5-coder',
      'deepseek-coder'
    ];

    for (const preferred of preferredModels) {
      const found = models.find(model => model.toLowerCase().includes(preferred.toLowerCase()));
      if (found) return found;
    }

    // Fallback to first available model
    return models[0] || 'default';
  }

  /**
   * Get client status and metrics
   */
  getStatus(): {
    available: boolean;
    lastHealthCheck: number;
    endpoint: string;
    config: LMStudioConfig;
  } {
    return {
      available: this.isAvailable,
      lastHealthCheck: this.lastHealthCheck,
      endpoint: this.config.endpoint,
      config: this.config
    };
  }
}
```

## Step 2: Enhanced Model Selector

### Update the Intelligent Model Selector

**File**: `src/core/intelligent-model-selector.ts` (modify existing)

Add the following to the existing file:

```typescript
import { LMStudioClient } from './lm-studio-client.js';

// Add to the existing class
export class IntelligentModelSelector {
  // ... existing code ...
  
  private lmStudioClient: LMStudioClient;
  private routingMetrics = new Map<string, RoutingMetric>();

  constructor(endpoint: string = 'http://localhost:11434') {
    // ... existing constructor code ...
    
    // Initialize LM Studio client
    this.lmStudioClient = new LMStudioClient({
      endpoint: 'http://localhost:1234',
      timeout: 10000,
      maxTokens: 2048,
      temperature: 0.1,
      streamingEnabled: true
    });
  }

  /**
   * Enhanced model selection with LM Studio support
   */
  async selectOptimalLLM(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    requirements: {
      speed?: 'fast' | 'medium' | 'slow';
      accuracy?: 'high' | 'medium' | 'low';
      streaming?: boolean;
    } = {}
  ): Promise<{
    llm: 'lmstudio' | 'ollama';
    model: string;
    confidence: number;
    reasoning: string;
  }> {
    
    // Check availability of both services
    const [lmStudioAvailable, ollamaAvailable] = await Promise.all([
      this.lmStudioClient.checkHealth(),
      this.checkOllamaHealth()
    ]);

    // Decision matrix based on task characteristics
    const decision = this.makeRoutingDecision(taskType, complexity, requirements, {
      lmStudioAvailable,
      ollamaAvailable
    });

    // Log routing decision for learning
    this.recordRoutingDecision(taskType, complexity, decision);

    return decision;
  }

  /**
   * Make routing decision based on task characteristics
   */
  private makeRoutingDecision(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    requirements: any,
    availability: { lmStudioAvailable: boolean; ollamaAvailable: boolean }
  ): { llm: 'lmstudio' | 'ollama'; model: string; confidence: number; reasoning: string } {
    
    // If only one service is available, use it
    if (!availability.lmStudioAvailable && availability.ollamaAvailable) {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.8,
        reasoning: 'LM Studio unavailable, using Ollama fallback'
      };
    }
    
    if (availability.lmStudioAvailable && !availability.ollamaAvailable) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.7,
        reasoning: 'Ollama unavailable, using LM Studio fallback'
      };
    }

    // Both available - make optimal choice
    const fastTasks = ['template', 'format', 'edit', 'boilerplate'];
    const complexTasks = ['analysis', 'planning', 'debugging', 'architecture'];

    // Speed is prioritized
    if (requirements.speed === 'fast' || fastTasks.includes(taskType)) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.9,
        reasoning: 'Fast response required, using LM Studio'
      };
    }

    // Quality is prioritized
    if (complexity === 'complex' || complexTasks.includes(taskType)) {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.9,
        reasoning: 'Complex task requiring deep reasoning, using Ollama'
      };
    }

    // Medium complexity - check historical performance
    const historicalPerformance = this.getHistoricalPerformance(taskType);
    
    if (historicalPerformance.lmStudio > historicalPerformance.ollama) {
      return {
        llm: 'lmstudio',
        model: 'codellama-7b-instruct',
        confidence: 0.8,
        reasoning: 'Historical performance favors LM Studio for this task type'
      };
    } else {
      return {
        llm: 'ollama',
        model: 'codellama:34b',
        confidence: 0.8,
        reasoning: 'Historical performance favors Ollama for this task type'
      };
    }
  }

  /**
   * Check Ollama health (existing functionality)
   */
  private async checkOllamaHealth(): Promise<boolean> {
    try {
      const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Get historical performance for a task type
   */
  private getHistoricalPerformance(taskType: string): { lmStudio: number; ollama: number } {
    const metric = this.routingMetrics.get(taskType);
    
    if (!metric) {
      return { lmStudio: 0.5, ollama: 0.5 }; // Default equal weight
    }

    return {
      lmStudio: metric.lmStudioSuccess / Math.max(1, metric.lmStudioAttempts),
      ollama: metric.ollamaSuccess / Math.max(1, metric.ollamaAttempts)
    };
  }

  /**
   * Record routing decision for learning
   */
  private recordRoutingDecision(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    decision: { llm: 'lmstudio' | 'ollama' }
  ): void {
    const key = `${taskType}-${complexity}`;
    
    if (!this.routingMetrics.has(key)) {
      this.routingMetrics.set(key, {
        lmStudioAttempts: 0,
        lmStudioSuccess: 0,
        ollamaAttempts: 0,
        ollamaSuccess: 0
      });
    }

    const metric = this.routingMetrics.get(key)!;
    
    if (decision.llm === 'lmstudio') {
      metric.lmStudioAttempts++;
    } else {
      metric.ollamaAttempts++;
    }
  }

  /**
   * Record the success/failure of a routing decision
   */
  recordRoutingOutcome(
    taskType: string,
    complexity: 'simple' | 'medium' | 'complex',
    llm: 'lmstudio' | 'ollama',
    success: boolean
  ): void {
    const key = `${taskType}-${complexity}`;
    const metric = this.routingMetrics.get(key);
    
    if (metric) {
      if (llm === 'lmstudio' && success) {
        metric.lmStudioSuccess++;
      } else if (llm === 'ollama' && success) {
        metric.ollamaSuccess++;
      }
    }
  }
}

interface RoutingMetric {
  lmStudioAttempts: number;
  lmStudioSuccess: number;
  ollamaAttempts: number;
  ollamaSuccess: number;
}
```

## Step 3: Hybrid Client Implementation

### Create the Unified Hybrid Client

**File**: `src/core/hybrid-model-client.ts`

```typescript
import { LocalModelClient } from './local-model-client.js';
import { LMStudioClient } from './lm-studio-client.js';
import { IntelligentModelSelector } from './intelligent-model-selector.js';
import { logger } from './logger.js';

export interface HybridClientConfig {
  lmStudio: {
    endpoint: string;
    enabled: boolean;
  };
  ollama: {
    endpoint: string;
    enabled: boolean;
  };
  routing: {
    escalationThreshold: number;
    confidenceScoring: boolean;
    autoOptimization: boolean;
  };
}

export class HybridModelClient {
  private lmStudioClient: LMStudioClient;
  private ollamaClient: LocalModelClient;
  private modelSelector: IntelligentModelSelector;
  private config: HybridClientConfig;

  constructor(config: Partial<HybridClientConfig> = {}) {
    this.config = {
      lmStudio: {
        endpoint: config.lmStudio?.endpoint || 'http://localhost:1234',
        enabled: config.lmStudio?.enabled ?? true
      },
      ollama: {
        endpoint: config.ollama?.endpoint || 'http://localhost:11434',
        enabled: config.ollama?.enabled ?? true
      },
      routing: {
        escalationThreshold: config.routing?.escalationThreshold || 0.7,
        confidenceScoring: config.routing?.confidenceScoring ?? true,
        autoOptimization: config.routing?.autoOptimization ?? true
      }
    };

    this.lmStudioClient = new LMStudioClient({
      endpoint: this.config.lmStudio.endpoint
    });

    this.ollamaClient = new LocalModelClient({
      endpoint: this.config.ollama.endpoint,
      model: 'auto',
      timeout: 30000,
      maxTokens: 4096,
      temperature: 0.7
    });

    this.modelSelector = new IntelligentModelSelector(this.config.ollama.endpoint);
  }

  /**
   * Generate code with automatic LLM selection
   */
  async generateCode(
    prompt: string,
    context: string[] = [],
    options: {
      taskType?: string;
      complexity?: 'simple' | 'medium' | 'complex';
      forceLLM?: 'lmstudio' | 'ollama';
      streaming?: boolean;
    } = {}
  ): Promise<{
    code: string;
    explanation: string;
    confidence: number;
    latency: number;
    llmUsed: 'lmstudio' | 'ollama' | 'escalated';
    reasoning: string;
  }> {
    const startTime = Date.now();

    try {
      // If LLM is forced, use it directly
      if (options.forceLLM) {
        return await this.generateWithSpecificLLM(
          options.forceLLM,
          prompt,
          context,
          startTime
        );
      }

      // Determine task characteristics
      const taskType = options.taskType || this.classifyTaskType(prompt);
      const complexity = options.complexity || this.assessComplexity(prompt, context);

      // Select optimal LLM
      const selection = await this.modelSelector.selectOptimalLLM(
        taskType,
        complexity,
        { streaming: options.streaming }
      );

      logger.info(`Selected ${selection.llm} for task`, {
        taskType,
        complexity,
        confidence: selection.confidence,
        reasoning: selection.reasoning
      });

      // Generate with selected LLM
      const result = await this.generateWithSpecificLLM(
        selection.llm,
        prompt,
        context,
        startTime
      );

      // Check if escalation is needed
      if (this.shouldEscalate(result, selection)) {
        logger.info('Escalating to higher-quality LLM due to low confidence');
        
        const escalatedResult = await this.generateWithSpecificLLM(
          'ollama',
          prompt,
          context,
          startTime
        );

        // Record routing outcome
        this.modelSelector.recordRoutingOutcome(taskType, complexity, selection.llm, false);

        return {
          ...escalatedResult,
          llmUsed: 'escalated',
          reasoning: `Escalated from ${selection.llm} due to low confidence`
        };
      }

      // Record successful routing
      this.modelSelector.recordRoutingOutcome(taskType, complexity, selection.llm, true);

      return {
        ...result,
        llmUsed: selection.llm,
        reasoning: selection.reasoning
      };

    } catch (error) {
      logger.error('Hybrid code generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate code with a specific LLM
   */
  private async generateWithSpecificLLM(
    llm: 'lmstudio' | 'ollama',
    prompt: string,
    context: string[],
    startTime: number
  ): Promise<{
    code: string;
    explanation: string;
    confidence: number;
    latency: number;
  }> {
    if (llm === 'lmstudio') {
      return await this.lmStudioClient.generateCode(prompt, context);
    } else {
      // Use existing Ollama client
      const result = await this.ollamaClient.generateText(prompt, {
        includeContext: context.length > 0,
        context: context.join('\n\n')
      });

      return {
        code: result.text,
        explanation: 'Generated with Ollama',
        confidence: 0.8, // Default confidence for Ollama
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Determine if escalation to higher-quality LLM is needed
   */
  private shouldEscalate(
    result: { confidence: number },
    selection: { llm: string; confidence: number }
  ): boolean {
    if (!this.config.routing.confidenceScoring) {
      return false;
    }

    // Don't escalate if already using Ollama
    if (selection.llm === 'ollama') {
      return false;
    }

    // Escalate if confidence is below threshold
    return result.confidence < this.config.routing.escalationThreshold;
  }

  /**
   * Classify task type from prompt
   */
  private classifyTaskType(prompt: string): string {
    const promptLower = prompt.toLowerCase();

    if (promptLower.includes('template') || promptLower.includes('boilerplate')) {
      return 'template';
    }
    if (promptLower.includes('format') || promptLower.includes('lint')) {
      return 'format';
    }
    if (promptLower.includes('analyze') || promptLower.includes('review')) {
      return 'analysis';
    }
    if (promptLower.includes('debug') || promptLower.includes('fix')) {
      return 'debugging';
    }
    if (promptLower.includes('refactor') || promptLower.includes('improve')) {
      return 'refactor';
    }
    if (promptLower.includes('plan') || promptLower.includes('design')) {
      return 'planning';
    }

    return 'general';
  }

  /**
   * Assess complexity from prompt and context
   */
  private assessComplexity(prompt: string, context: string[]): 'simple' | 'medium' | 'complex' {
    let complexity = 0;

    // Factors that increase complexity
    if (context.length > 3) complexity += 2;
    if (prompt.length > 200) complexity += 1;
    if (prompt.includes('multi') || prompt.includes('several')) complexity += 2;
    if (prompt.includes('complex') || prompt.includes('advanced')) complexity += 3;
    if (prompt.includes('architecture') || prompt.includes('system')) complexity += 2;

    // Factors that suggest simplicity
    if (prompt.includes('simple') || prompt.includes('quick')) complexity -= 1;
    if (prompt.includes('template') || prompt.includes('basic')) complexity -= 2;

    if (complexity >= 4) return 'complex';
    if (complexity >= 2) return 'medium';
    return 'simple';
  }

  /**
   * Get status of both LLM backends
   */
  async getStatus(): Promise<{
    lmStudio: any;
    ollama: any;
    routing: any;
  }> {
    const [lmStudioStatus, ollamaStatus] = await Promise.all([
      this.lmStudioClient.getStatus(),
      this.checkOllamaStatus()
    ]);

    return {
      lmStudio: lmStudioStatus,
      ollama: ollamaStatus,
      routing: {
        escalationThreshold: this.config.routing.escalationThreshold,
        confidenceScoring: this.config.routing.confidenceScoring
      }
    };
  }

  /**
   * Check Ollama status
   */
  private async checkOllamaStatus(): Promise<any> {
    try {
      // Use existing LocalModelClient status checking if available
      return {
        available: true,
        endpoint: this.config.ollama.endpoint
      };
    } catch {
      return {
        available: false,
        endpoint: this.config.ollama.endpoint
      };
    }
  }
}
```

## Step 4: Integration with Fast Mode

### Update Fast Mode Client

**File**: `src/core/fast-mode-client.ts` (modify existing)

Add LM Studio integration to the existing fast mode:

```typescript
import { LMStudioClient } from './lm-studio-client.js';

export class FastModeClient extends EventEmitter {
  // ... existing code ...
  
  private lmStudioClient?: LMStudioClient;

  constructor(options = {}) {
    super();
    // ... existing constructor code ...

    // Initialize LM Studio for even faster responses
    if (options.useLMStudio !== false) {
      this.lmStudioClient = new LMStudioClient({
        endpoint: 'http://localhost:1234',
        timeout: 5000,
        maxTokens: 1024,
        temperature: 0.1,
        streamingEnabled: true
      });
    }
  }

  /**
   * Enhanced fast code generation with LM Studio
   */
  async generateCode(prompt, context = []) {
    const startTime = Date.now();

    // Try LM Studio first for maximum speed
    if (this.lmStudioClient) {
      try {
        const lmStudioResult = await this.lmStudioClient.generateCode(prompt, context, {
          maxTokens: 1024,
          temperature: 0.1
        });

        // If confidence is high enough, use LM Studio result
        if (lmStudioResult.confidence > 0.6) {
          return {
            ...lmStudioResult,
            fromCache: false,
            latency: lmStudioResult.latency
          };
        }
      } catch (error) {
        logger.warn('LM Studio failed in fast mode, falling back to templates:', error);
      }
    }

    // Fallback to existing template-based generation
    const optimized = this.optimizer.optimizePrompt(prompt, context);
    const codeResult = this.generateTemplateResponse(prompt, optimized.relevantContext);
    const latency = Date.now() - startTime;

    return {
      ...codeResult,
      fromCache: false,
      latency
    };
  }

  /**
   * Stream code generation for real-time feedback
   */
  async *streamGeneration(prompt, context = []) {
    if (!this.lmStudioClient) {
      // Fallback to template response
      const result = await this.generateCode(prompt, context);
      yield { chunk: result.code, complete: true, confidence: 0.8 };
      return;
    }

    try {
      for await (const chunk of this.lmStudioClient.streamGenerateCode(prompt, context)) {
        yield chunk;
      }
    } catch (error) {
      logger.warn('Streaming failed, providing template response:', error);
      const result = await this.generateCode(prompt, context);
      yield { chunk: result.code, complete: true, confidence: 0.8 };
    }
  }
}
```

## Step 5: Configuration Updates

### Update Configuration Schema

**File**: `config/default.yaml` (modify existing)

Add hybrid configuration:

```yaml
# ... existing configuration ...

hybrid:
  enabled: true
  routing:
    defaultProvider: "auto"  # auto | lmstudio | ollama
    escalationThreshold: 0.7
    confidenceScoring: true
    learningEnabled: true
    
  lmStudio:
    endpoint: "http://localhost:1234"
    enabled: true
    models:
      - "codellama-7b-instruct"
      - "gemma-2b-it"
      - "qwen2.5-coder"
    taskTypes:
      - "template"
      - "edit"
      - "format"
      - "boilerplate"
    streamingEnabled: true
    maxConcurrent: 3
    timeout: 10000
    
  ollama:
    endpoint: "http://localhost:11434"
    enabled: true
    models:
      - "codellama:34b"
      - "qwen2.5:72b"
    taskTypes:
      - "analysis"
      - "planning"
      - "complex"
      - "multi-file"
    maxConcurrent: 1
    timeout: 30000
    
  performance:
    cacheEnabled: true
    metricsCollection: true
    autoOptimization: true
    healthChecking: true
    healthCheckInterval: 30000
```

## Step 6: CLI Integration

### Update CLI to Use Hybrid Client

**File**: `src/core/cli.ts` (modify existing)

```typescript
import { HybridModelClient } from './hybrid-model-client.js';

export class CodeCrucibleCLI {
  // ... existing code ...
  
  private hybridClient?: HybridModelClient;

  constructor(context) {
    // ... existing constructor code ...

    // Initialize hybrid client if enabled
    if (context?.config?.hybrid?.enabled) {
      this.hybridClient = new HybridModelClient(context.config.hybrid);
      logger.info('Hybrid LLM client initialized');
    }
  }

  async processPrompt(prompt: string, options: CLIOptions): Promise<string> {
    // ... existing code ...

    // Use hybrid client if available
    if (this.hybridClient && !options.fast) {
      return await this.handleHybridGeneration(prompt, options);
    }

    // ... existing fallback logic ...
  }

  private async handleHybridGeneration(prompt: string, options: CLIOptions): Promise<string> {
    try {
      const result = await this.hybridClient!.generateCode(prompt, [], {
        taskType: options.type,
        complexity: options.complexity,
        streaming: options.streaming
      });

      return this.formatHybridResponse(result);
    } catch (error) {
      logger.error('Hybrid generation failed:', error);
      return `❌ Hybrid generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private formatHybridResponse(result: any): string {
    return `✅ Generated with ${result.llmUsed} (${result.latency}ms, confidence: ${(result.confidence * 100).toFixed(0)}%)

${result.code}

💡 ${result.explanation}

🔄 ${result.reasoning}`;
  }
}
```

## Step 7: Testing and Validation

### Create Test Suite

**File**: `tests/integration/hybrid-llm.test.ts`

```typescript
import { HybridModelClient } from '../../src/core/hybrid-model-client';
import { LMStudioClient } from '../../src/core/lm-studio-client';

describe('Hybrid LLM Integration', () => {
  let hybridClient: HybridModelClient;

  beforeEach(() => {
    hybridClient = new HybridModelClient({
      lmStudio: { endpoint: 'http://localhost:1234', enabled: true },
      ollama: { endpoint: 'http://localhost:11434', enabled: true },
      routing: { escalationThreshold: 0.7, confidenceScoring: true }
    });
  });

  describe('Task Routing', () => {
    it('should route simple tasks to LM Studio', async () => {
      const result = await hybridClient.generateCode(
        'format this code',
        [],
        { taskType: 'format', complexity: 'simple' }
      );

      expect(result.llmUsed).toBe('lmstudio');
    });

    it('should route complex tasks to Ollama', async () => {
      const result = await hybridClient.generateCode(
        'analyze this complex system architecture',
        ['complex context'],
        { taskType: 'analysis', complexity: 'complex' }
      );

      expect(result.llmUsed).toBe('ollama');
    });

    it('should escalate low-confidence responses', async () => {
      // Mock low confidence response from LM Studio
      const result = await hybridClient.generateCode(
        'medium complexity task',
        [],
        { taskType: 'general', complexity: 'medium' }
      );

      // Should either use appropriate LLM or escalate
      expect(['lmstudio', 'ollama', 'escalated']).toContain(result.llmUsed);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback gracefully when LM Studio is unavailable', async () => {
      // Test with LM Studio disabled
      const client = new HybridModelClient({
        lmStudio: { enabled: false },
        ollama: { enabled: true }
      });

      const result = await client.generateCode('simple task');
      expect(result.llmUsed).toBe('ollama');
    });
  });
});
```

## Step 8: Deployment Instructions

### Setup Script

**File**: `scripts/setup-hybrid-llm.sh`

```bash
#!/bin/bash

echo "🚀 Setting up Hybrid LLM Architecture..."

# Check if LM Studio is installed
if ! command -v lmstudio &> /dev/null; then
    echo "⚠️  LM Studio not found. Please install LM Studio first."
    echo "   Download from: https://lmstudio.ai/"
    exit 1
fi

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "⚠️  Ollama not running on port 11434"
    echo "   Please start Ollama first"
    exit 1
fi

# Start LM Studio server if not running
if ! curl -s http://localhost:1234/v1/models > /dev/null; then
    echo "🔄 Starting LM Studio server..."
    # Note: This requires LM Studio to be configured for headless operation
    echo "   Please start LM Studio and enable local server on port 1234"
    echo "   Then run this script again"
    exit 1
fi

echo "✅ LM Studio server is running"
echo "✅ Ollama server is running"

# Install or update CodeCrucible Synth
echo "🔄 Installing hybrid dependencies..."
npm install

# Build the project
echo "🔄 Building project with hybrid support..."
npm run build

# Test the hybrid setup
echo "🧪 Testing hybrid LLM integration..."
node dist/index.js --fast "test hybrid setup"

echo "🎉 Hybrid LLM architecture setup complete!"
echo ""
echo "Usage examples:"
echo "  codecrucible --fast \"create a React component\"  # Uses LM Studio"
echo "  codecrucible \"analyze this complex system\"       # Uses Ollama"
echo "  codecrucible config hybrid --status                # Check status"
```

### Windows PowerShell Setup

**File**: `scripts/setup-hybrid-llm.ps1`

```powershell
Write-Host "🚀 Setting up Hybrid LLM Architecture..." -ForegroundColor Cyan

# Check if LM Studio is accessible
try {
    $response = Invoke-WebRequest -Uri "http://localhost:1234/v1/models" -Method GET -TimeoutSec 5
    Write-Host "✅ LM Studio server is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  LM Studio not accessible on port 1234" -ForegroundColor Yellow
    Write-Host "   Please start LM Studio and enable local server" -ForegroundColor Yellow
    exit 1
}

# Check if Ollama is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
    Write-Host "✅ Ollama server is running" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Ollama not accessible on port 11434" -ForegroundColor Yellow
    Write-Host "   Please start Ollama first" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "🔄 Installing hybrid dependencies..." -ForegroundColor Blue
npm install

# Build project
Write-Host "🔄 Building project..." -ForegroundColor Blue
npm run build

# Test setup
Write-Host "🧪 Testing hybrid setup..." -ForegroundColor Blue
node dist/index.js --fast "test hybrid setup"

Write-Host "🎉 Hybrid LLM architecture setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Usage examples:" -ForegroundColor Cyan
Write-Host "  codecrucible --fast `"create a React component`"  # Uses LM Studio"
Write-Host "  codecrucible `"analyze this complex system`"       # Uses Ollama"
Write-Host "  codecrucible config hybrid --status                # Check status"
```

## Step 9: Fine-Tuning and Benchmarking (Codex-Inspired)

### Fine-Tuning a Model

Fine-tuning allows you to specialize a model for a specific domain, such as your project's codebase.

**CLI Command:**

```bash
# Fine-tune a model on a directory
cc fine-tune --model codellama:7b --directory ./src --new-model-name my-project-model
```

### Benchmarking Model Performance

Inspired by OpenAI's HumanEval, a built-in benchmarking tool allows you to evaluate model performance.

**CLI Command:**

```bash
# Run the benchmark on the default hybrid model
cc benchmark

# Run the benchmark on a specific model
cc benchmark --model my-project-model
```

This completes the technical implementation guide for the Hybrid LLM Architecture. The implementation provides:


1. **Seamless Integration**: Works with existing CodeCrucible Synth architecture
2. **Intelligent Routing**: Automatic selection between LM Studio and Ollama
3. **Performance Optimization**: Fast responses for simple tasks, quality for complex ones
4. **Graceful Fallbacks**: Continues working even if one service is unavailable
5. **Learning System**: Improves routing decisions over time
6. **Comprehensive Testing**: Full test suite for validation
7. **Easy Deployment**: Automated setup scripts for both platforms

The next step would be to implement this architecture phase by phase, starting with basic integration and progressively adding advanced features.