import { logger } from './logger.js';
import axios from 'axios';

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'lmstudio' | 'ollama';
  size?: string;
  capabilities: string[];
  performance: {
    speed: number; // 1-10 scale
    quality: number; // 1-10 scale
    contextWindow: number;
  };
  status: 'available' | 'loading' | 'error';
  lastSeen: number;
}

export interface ProviderStatus {
  available: boolean;
  healthy: boolean;
  responseTime: number;
  modelsCount: number;
  lastCheck: number;
}

export interface ModelSelectionContext {
  taskType: string;
  complexity: 'simple' | 'medium' | 'complex';
  preferredProvider?: 'lmstudio' | 'ollama' | 'auto';
  requiresStreaming?: boolean;
  maxTokens?: number;
  timeoutConstraint?: number;
}

export interface ModelSelectionResult {
  selectedModel: ModelInfo;
  provider: 'lmstudio' | 'ollama';
  reasoning: string;
  fallbackModels: ModelInfo[];
  confidence: number;
}

/**
 * Autonomous Model Selector - Intelligently selects the best available model
 * based on provider availability, model capabilities, and task requirements
 */
export class AutonomousModelSelector {
  private availableModels = new Map<string, ModelInfo>();
  private providerStatus = new Map<'lmstudio' | 'ollama', ProviderStatus>();
  private modelPerformanceHistory = new Map<string, { avgTime: number; successRate: number }>();
  private lastDiscovery = 0;
  private discoveryInterval = 30000; // 30 seconds

  constructor() {
    this.initializeProviderStatus();
    this.startPeriodicDiscovery();
    logger.info('Autonomous Model Selector initialized');
  }

  /**
   * Autonomously select the best model for a given task
   */
  async selectBestModel(context: ModelSelectionContext): Promise<ModelSelectionResult> {
    // Ensure we have recent model discovery
    await this.ensureRecentDiscovery();

    // Get available providers and models
    const availableProviders = this.getAvailableProviders();
    const availableModels = this.getAvailableModels();

    if (availableModels.length === 0) {
      throw new Error('No models available on any provider. Please start LM Studio or Ollama.');
    }

    // Apply selection algorithm
    const selection = this.applySelectionAlgorithm(context, availableModels, availableProviders);

    logger.info(`Autonomous model selection: ${selection.selectedModel.id} (${selection.provider})`, {
      reasoning: selection.reasoning,
      confidence: selection.confidence,
      taskType: context.taskType,
      complexity: context.complexity
    });

    return selection;
  }

  /**
   * Discover available models from all providers
   */
  async discoverAvailableModels(): Promise<void> {
    logger.debug('Starting autonomous model discovery...');
    
    const discoveryPromises = [
      this.discoverLMStudioModels(),
      this.discoverOllamaModels()
    ];

    await Promise.allSettled(discoveryPromises);
    
    this.lastDiscovery = Date.now();
    
    const totalModels = this.availableModels.size;
    const lmStudioModels = Array.from(this.availableModels.values()).filter(m => m.provider === 'lmstudio').length;
    const ollamaModels = Array.from(this.availableModels.values()).filter(m => m.provider === 'ollama').length;
    
    logger.info(`Model discovery complete: ${totalModels} total (LM Studio: ${lmStudioModels}, Ollama: ${ollamaModels})`);
  }

  /**
   * Get current provider availability status
   */
  getProviderStatus(): Record<string, ProviderStatus> {
    const status: Record<string, ProviderStatus> = {};
    for (const [provider, providerStatus] of this.providerStatus.entries()) {
      status[provider] = { ...providerStatus };
    }
    return status;
  }

  /**
   * Get all available models
   */
  getAllAvailableModels(): ModelInfo[] {
    return Array.from(this.availableModels.values())
      .filter(model => model.status === 'available')
      .sort((a, b) => b.performance.speed - a.performance.speed);
  }

  /**
   * Initialize provider status tracking
   */
  private initializeProviderStatus(): void {
    this.providerStatus.set('lmstudio', {
      available: false,
      healthy: false,
      responseTime: 0,
      modelsCount: 0,
      lastCheck: 0
    });

    this.providerStatus.set('ollama', {
      available: false,
      healthy: false,
      responseTime: 0,
      modelsCount: 0,
      lastCheck: 0
    });
  }

  /**
   * Start periodic model discovery
   */
  private startPeriodicDiscovery(): void {
    // Initial discovery
    setTimeout(() => this.discoverAvailableModels(), 1000);
    
    // Periodic discovery
    setInterval(() => {
      this.discoverAvailableModels().catch(error => {
        logger.debug('Periodic model discovery failed:', error);
      });
    }, this.discoveryInterval);
  }

  /**
   * Ensure we have recent model discovery
   */
  private async ensureRecentDiscovery(): Promise<void> {
    const timeSinceLastDiscovery = Date.now() - this.lastDiscovery;
    if (timeSinceLastDiscovery > this.discoveryInterval) {
      await this.discoverAvailableModels();
    }
  }

  /**
   * Discover LM Studio models
   */
  private async discoverLMStudioModels(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get('http://localhost:1234/v1/models', { timeout: 5000 });
      const responseTime = Date.now() - startTime;
      
      if (response.data?.data) {
        // Update provider status
        this.providerStatus.set('lmstudio', {
          available: true,
          healthy: true,
          responseTime,
          modelsCount: response.data.data.length,
          lastCheck: Date.now()
        });

        // Process discovered models
        for (const model of response.data.data) {
          const modelInfo = this.createModelInfo(model.id, 'lmstudio', model);
          this.availableModels.set(`lmstudio:${model.id}`, modelInfo);
        }

        logger.debug(`LM Studio: ${response.data.data.length} models discovered`);
      }

    } catch (error) {
      // Update provider status as unavailable
      this.providerStatus.set('lmstudio', {
        available: false,
        healthy: false,
        responseTime: Date.now() - startTime,
        modelsCount: 0,
        lastCheck: Date.now()
      });

      // Remove LM Studio models from available models
      for (const [key, model] of this.availableModels.entries()) {
        if (model.provider === 'lmstudio') {
          this.availableModels.delete(key);
        }
      }

      logger.debug('LM Studio not available:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Discover Ollama models
   */
  private async discoverOllamaModels(): Promise<void> {
    const startTime = Date.now();
    
    try {
      const response = await axios.get('http://localhost:11434/api/tags', { timeout: 10000 });
      const responseTime = Date.now() - startTime;
      
      if (response.data?.models) {
        // Update provider status
        this.providerStatus.set('ollama', {
          available: true,
          healthy: true,
          responseTime,
          modelsCount: response.data.models.length,
          lastCheck: Date.now()
        });

        // Process discovered models
        for (const model of response.data.models) {
          const modelInfo = this.createModelInfo(model.name, 'ollama', model);
          this.availableModels.set(`ollama:${model.name}`, modelInfo);
        }

        logger.debug(`Ollama: ${response.data.models.length} models discovered`);
      }

    } catch (error) {
      // Update provider status as unavailable
      this.providerStatus.set('ollama', {
        available: false,
        healthy: false,
        responseTime: Date.now() - startTime,
        modelsCount: 0,
        lastCheck: Date.now()
      });

      // Remove Ollama models from available models
      for (const [key, model] of this.availableModels.entries()) {
        if (model.provider === 'ollama') {
          this.availableModels.delete(key);
        }
      }

      logger.debug('Ollama not available:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Create ModelInfo from discovered model data
   */
  private createModelInfo(id: string, provider: 'lmstudio' | 'ollama', modelData: any): ModelInfo {
    // Analyze model capabilities based on name and metadata
    const capabilities = this.analyzeModelCapabilities(id, modelData);
    const performance = this.estimateModelPerformance(id, provider, modelData);

    return {
      id,
      name: id,
      provider,
      size: modelData.size || this.estimateModelSize(id),
      capabilities,
      performance,
      status: 'available',
      lastSeen: Date.now()
    };
  }

  /**
   * Analyze model capabilities from name and metadata
   */
  private analyzeModelCapabilities(modelId: string, modelData: any): string[] {
    const capabilities: string[] = [];
    const lowerName = modelId.toLowerCase();

    // Code-focused models
    if (lowerName.includes('code') || lowerName.includes('deepseek') || lowerName.includes('codellama')) {
      capabilities.push('code-generation', 'code-analysis', 'debugging');
    }

    // Reasoning models
    if (lowerName.includes('reasoning') || lowerName.includes('r1') || lowerName.includes('think')) {
      capabilities.push('complex-reasoning', 'planning', 'analysis');
    }

    // Fast models
    if (lowerName.includes('gemma') || lowerName.includes('fast') || lowerName.includes('lite')) {
      capabilities.push('fast-generation', 'templates', 'quick-responses');
    }

    // Large context models
    if (lowerName.includes('30b') || lowerName.includes('34b') || lowerName.includes('large')) {
      capabilities.push('large-context', 'multi-file', 'architecture');
    }

    // General capabilities
    capabilities.push('general-purpose', 'text-generation');

    return capabilities;
  }

  /**
   * Estimate model performance characteristics
   */
  private estimateModelPerformance(modelId: string, provider: 'lmstudio' | 'ollama', modelData: any): ModelInfo['performance'] {
    const lowerName = modelId.toLowerCase();
    
    // Base performance by provider
    let speed = provider === 'lmstudio' ? 8 : 6; // LM Studio generally faster
    let quality = 7;
    let contextWindow = 4096;

    // Adjust based on model characteristics
    if (lowerName.includes('30b') || lowerName.includes('34b')) {
      quality += 2;
      speed -= 2;
      contextWindow = 8192;
    } else if (lowerName.includes('8b') || lowerName.includes('7b')) {
      speed += 1;
      quality -= 1;
    } else if (lowerName.includes('gemma')) {
      speed += 2;
      contextWindow = 8192;
    }

    // Specific model adjustments
    if (lowerName.includes('deepseek-r1')) {
      quality += 1;
      speed += 1; // Good balance
    }

    // Clamp values
    speed = Math.max(1, Math.min(10, speed));
    quality = Math.max(1, Math.min(10, quality));

    return { speed, quality, contextWindow };
  }

  /**
   * Estimate model size from name
   */
  private estimateModelSize(modelId: string): string {
    const lowerName = modelId.toLowerCase();
    
    if (lowerName.includes('30b')) return '~30GB';
    if (lowerName.includes('34b')) return '~34GB';
    if (lowerName.includes('20b')) return '~20GB';
    if (lowerName.includes('12b')) return '~12GB';
    if (lowerName.includes('8b')) return '~8GB';
    if (lowerName.includes('7b')) return '~7GB';
    if (lowerName.includes('gemma')) return '~5GB';
    
    return 'Unknown';
  }

  /**
   * Get available providers
   */
  private getAvailableProviders(): ('lmstudio' | 'ollama')[] {
    const providers: ('lmstudio' | 'ollama')[] = [];
    
    for (const [provider, status] of this.providerStatus.entries()) {
      if (status.available && status.healthy) {
        providers.push(provider);
      }
    }
    
    return providers;
  }

  /**
   * Get available models
   */
  private getAvailableModels(): ModelInfo[] {
    return Array.from(this.availableModels.values())
      .filter(model => model.status === 'available');
  }

  /**
   * Apply intelligent model selection algorithm
   */
  private applySelectionAlgorithm(
    context: ModelSelectionContext,
    availableModels: ModelInfo[],
    availableProviders: ('lmstudio' | 'ollama')[]
  ): ModelSelectionResult {
    
    if (availableModels.length === 0) {
      throw new Error('No models available for selection');
    }

    // Filter models by provider preference
    let candidateModels = availableModels;
    if (context.preferredProvider && context.preferredProvider !== 'auto') {
      const preferredModels = availableModels.filter(m => m.provider === context.preferredProvider);
      if (preferredModels.length > 0) {
        candidateModels = preferredModels;
      }
    }

    // Score models based on task requirements
    const scoredModels = candidateModels.map(model => ({
      model,
      score: this.calculateModelScore(model, context)
    }));

    // Sort by score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);

    const selectedModel = scoredModels[0].model;
    const fallbackModels = scoredModels.slice(1, 4).map(sm => sm.model);

    // Generate reasoning
    const reasoning = this.generateSelectionReasoning(selectedModel, context, availableProviders);
    
    // Calculate confidence
    const confidence = this.calculateSelectionConfidence(selectedModel, scoredModels, context);

    return {
      selectedModel,
      provider: selectedModel.provider,
      reasoning,
      fallbackModels,
      confidence
    };
  }

  /**
   * Calculate model score for selection
   */
  private calculateModelScore(model: ModelInfo, context: ModelSelectionContext): number {
    let score = 0;

    // Base performance score
    score += model.performance.speed * 2; // Speed is important
    score += model.performance.quality * 1.5; // Quality matters

    // Task type matching
    const taskTypeBonus = this.getTaskTypeBonus(model, context.taskType);
    score += taskTypeBonus;

    // Complexity matching
    const complexityBonus = this.getComplexityBonus(model, context.complexity);
    score += complexityBonus;

    // Provider preference bonus
    if (context.preferredProvider === model.provider) {
      score += 5;
    }

    // Provider availability and health
    const providerStatus = this.providerStatus.get(model.provider);
    if (providerStatus) {
      if (providerStatus.healthy) score += 3;
      if (providerStatus.responseTime < 1000) score += 2; // Fast provider
    }

    // Historical performance
    const historyKey = `${model.provider}:${model.id}`;
    const history = this.modelPerformanceHistory.get(historyKey);
    if (history) {
      score += history.successRate * 5; // Success rate is crucial
      if (history.avgTime < 5000) score += 3; // Fast historical performance
    }

    // Timeout constraint compliance
    if (context.timeoutConstraint) {
      const estimatedTime = this.estimateResponseTime(model, context);
      if (estimatedTime < context.timeoutConstraint * 0.7) {
        score += 4; // Well within timeout
      } else if (estimatedTime < context.timeoutConstraint) {
        score += 1; // Within timeout
      } else {
        score -= 5; // Might exceed timeout
      }
    }

    return score;
  }

  /**
   * Get task type bonus for model
   */
  private getTaskTypeBonus(model: ModelInfo, taskType: string): number {
    const relevantCapabilities = model.capabilities.filter(cap => {
      switch (taskType) {
        case 'template':
        case 'format':
        case 'quick-fixes':
          return cap.includes('fast') || cap.includes('template');
        
        case 'code-generation':
        case 'boilerplate':
          return cap.includes('code');
        
        case 'analysis':
        case 'debugging':
        case 'security-review':
          return cap.includes('analysis') || cap.includes('reasoning') || cap.includes('debug');
        
        case 'planning':
        case 'architecture':
          return cap.includes('reasoning') || cap.includes('planning') || cap.includes('large-context');
        
        case 'voice-generation':
        case 'audio-response':
          return cap.includes('fast') || cap.includes('general');
        
        default:
          return cap.includes('general');
      }
    });

    return relevantCapabilities.length * 2;
  }

  /**
   * Get complexity bonus for model
   */
  private getComplexityBonus(model: ModelInfo, complexity: 'simple' | 'medium' | 'complex'): number {
    switch (complexity) {
      case 'simple':
        // Prefer fast models for simple tasks
        return model.performance.speed >= 7 ? 3 : 0;
      
      case 'medium':
        // Balanced approach
        return (model.performance.speed + model.performance.quality) >= 12 ? 2 : 0;
      
      case 'complex':
        // Prefer quality for complex tasks
        return model.performance.quality >= 8 ? 4 : 0;
      
      default:
        return 0;
    }
  }

  /**
   * Estimate response time for model and context
   */
  private estimateResponseTime(model: ModelInfo, context: ModelSelectionContext): number {
    // Base time by complexity
    let baseTime = context.complexity === 'simple' ? 2000 :
                   context.complexity === 'medium' ? 8000 : 15000;

    // Adjust by model speed
    const speedFactor = (11 - model.performance.speed) / 10; // Invert speed (higher speed = lower factor)
    baseTime *= speedFactor;

    // Provider adjustment
    if (model.provider === 'lmstudio') {
      baseTime *= 0.7; // LM Studio generally faster
    }

    // Historical performance adjustment
    const historyKey = `${model.provider}:${model.id}`;
    const history = this.modelPerformanceHistory.get(historyKey);
    if (history && history.avgTime > 0) {
      baseTime = (baseTime + history.avgTime) / 2; // Blend with historical data
    }

    return Math.round(baseTime);
  }

  /**
   * Generate human-readable selection reasoning
   */
  private generateSelectionReasoning(
    model: ModelInfo,
    context: ModelSelectionContext,
    availableProviders: ('lmstudio' | 'ollama')[]
  ): string {
    const reasons: string[] = [];

    // Provider availability
    if (availableProviders.length === 1) {
      reasons.push(`Only ${model.provider.toUpperCase()} available`);
    } else {
      reasons.push(`Selected ${model.provider.toUpperCase()} for optimal performance`);
    }

    // Model characteristics
    if (model.performance.speed >= 8) {
      reasons.push('high-speed model');
    }
    if (model.performance.quality >= 8) {
      reasons.push('high-quality model');
    }

    // Task suitability
    const suitableCapabilities = model.capabilities.filter(cap => 
      cap.includes(context.taskType) || 
      (context.complexity === 'simple' && cap.includes('fast')) ||
      (context.complexity === 'complex' && cap.includes('reasoning'))
    );
    
    if (suitableCapabilities.length > 0) {
      reasons.push(`optimized for ${context.taskType}`);
    }

    // Fallback reasoning
    if (reasons.length === 0) {
      reasons.push('best available model');
    }

    return reasons.join(', ');
  }

  /**
   * Calculate selection confidence
   */
  private calculateSelectionConfidence(
    selectedModel: ModelInfo,
    scoredModels: Array<{ model: ModelInfo; score: number }>,
    context: ModelSelectionContext
  ): number {
    let confidence = 0.5; // Base confidence

    // Confidence based on score gap
    if (scoredModels.length > 1) {
      const topScore = scoredModels[0].score;
      const secondScore = scoredModels[1].score;
      const scoreGap = topScore - secondScore;
      confidence += Math.min(scoreGap / 20, 0.3); // Max 0.3 bonus for score gap
    } else {
      confidence += 0.2; // Only one model available
    }

    // Provider availability confidence
    const providerStatus = this.providerStatus.get(selectedModel.provider);
    if (providerStatus && providerStatus.healthy && providerStatus.responseTime < 1000) {
      confidence += 0.2;
    }

    // Historical performance confidence
    const historyKey = `${selectedModel.provider}:${selectedModel.id}`;
    const history = this.modelPerformanceHistory.get(historyKey);
    if (history && history.successRate > 0.8) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Record performance data for future selection
   */
  recordModelPerformance(
    provider: 'lmstudio' | 'ollama',
    modelId: string,
    responseTime: number,
    success: boolean
  ): void {
    const historyKey = `${provider}:${modelId}`;
    const existing = this.modelPerformanceHistory.get(historyKey) || { avgTime: 0, successRate: 0 };
    
    // Update average time (simple moving average)
    existing.avgTime = existing.avgTime === 0 ? responseTime : (existing.avgTime + responseTime) / 2;
    
    // Update success rate (simple moving average)
    existing.successRate = existing.successRate === 0 ? (success ? 1 : 0) : 
                          (existing.successRate * 0.9) + (success ? 0.1 : 0);
    
    this.modelPerformanceHistory.set(historyKey, existing);
    
    logger.debug(`Recorded performance: ${historyKey} - ${responseTime}ms, success: ${success}`);
  }
}

// Global instance
export const autonomousModelSelector = new AutonomousModelSelector();