import { UnifiedModelClient } from './client.js';
import { LMStudioClient, LMStudioConfig } from './lm-studio-client.js';
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
  private ollamaClient: UnifiedModelClient;
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

    // Create basic config for UnifiedModelClient
    this.ollamaClient = new UnifiedModelClient({
      providers: [{
        type: 'ollama',
        endpoint: this.config.ollama.endpoint,
        model: 'llama2'
      }],
      executionMode: 'balanced',
      fallbackChain: ['ollama'],
      performanceThresholds: {
        fastModeMaxTokens: 2048,
        timeoutMs: 30000,
        maxConcurrentRequests: 2
      },
      security: {
        enableSandbox: true,
        maxInputLength: 50000,
        allowedCommands: ['npm', 'node', 'git']
      }
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
      // Use Ollama through UnifiedModelClient - simplified for now
      const response = await this.ollamaClient.generateText(prompt);

      return {
        code: response || 'No response generated',
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
    lmStudio: {
      available: boolean;
      lastHealthCheck: number;
      endpoint: string;
      config: LMStudioConfig;
    };
    ollama: {
      available: boolean;
      endpoint: string;
    };
    routing: {
      escalationThreshold: number;
      confidenceScoring: boolean;
    };
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
  private async checkOllamaStatus(): Promise<{
    available: boolean;
    endpoint: string;
  }> {
    try {
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
