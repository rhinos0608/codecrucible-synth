/**
 * Dynamic Model Router - Automatically detects and routes to best available models
 * Supports role-based routing: Auditor (LM Studio) vs Writer (Ollama)
 */

import axios from 'axios';
import { logger } from './logger.js';
import { EventEmitter } from 'events';

export interface ModelCapabilities {
  provider: 'ollama' | 'lm-studio';
  model: string;
  size: string;
  contextWindow: number;
  capabilities: string[];
  strengths: string[];
  isCodeFocused: boolean;
  responseSpeed: 'fast' | 'medium' | 'slow';
  qualityLevel: 'high' | 'medium' | 'low';
}

export interface RoleConfiguration {
  role: 'auditor' | 'writer' | 'auto';
  preferredProvider: 'ollama' | 'lm-studio' | 'auto';
  taskType: string;
  requiresCodeAnalysis: boolean;
  requiresGeneration: boolean;
}

export class DynamicModelRouter extends EventEmitter {
  private availableModels: ModelCapabilities[] = [];
  private currentRole: 'auditor' | 'writer' | 'auto' = 'auto';
  private lastScan: number = 0;
  private readonly SCAN_CACHE_TTL = 30000; // 30 seconds
  
  constructor() {
    super();
    this.setMaxListeners(20);
  }

  /**
   * Dynamically detect all available models across providers
   */
  async detectAvailableModels(): Promise<ModelCapabilities[]> {
    if (Date.now() - this.lastScan < this.SCAN_CACHE_TTL && this.availableModels.length > 0) {
      return this.availableModels;
    }

    const models: ModelCapabilities[] = [];

    // Scan Ollama models
    try {
      const ollamaModels = await this.scanOllamaModels();
      models.push(...ollamaModels);
      logger.info(`Found ${ollamaModels.length} Ollama models`);
    } catch (error) {
      logger.warn('Failed to scan Ollama models:', error.message);
    }

    // Scan LM Studio models
    try {
      const lmStudioModels = await this.scanLMStudioModels();
      models.push(...lmStudioModels);
      logger.info(`Found ${lmStudioModels.length} LM Studio models`);
    } catch (error) {
      logger.warn('Failed to scan LM Studio models:', error.message);
    }

    this.availableModels = models;
    this.lastScan = Date.now();
    
    logger.info(`Found ${models.length} total models`);
    return models;
  }

  /**
   * Scan Ollama for available models
   */
  private async scanOllamaModels(): Promise<ModelCapabilities[]> {
    const response = await axios.get('http://localhost:11434/api/tags', { timeout: 5000 });
    const models: ModelCapabilities[] = [];

    for (const model of response.data.models || []) {
      const capabilities = this.analyzeModelCapabilities(model.name, 'ollama');
      models.push({
        provider: 'ollama',
        model: model.name,
        size: model.size || 'unknown',
        contextWindow: this.estimateContextWindow(model.name),
        capabilities: capabilities.capabilities,
        strengths: capabilities.strengths,
        isCodeFocused: capabilities.isCodeFocused,
        responseSpeed: capabilities.responseSpeed,
        qualityLevel: capabilities.qualityLevel,
      });
    }

    return models;
  }

  /**
   * Scan LM Studio for available models
   */
  private async scanLMStudioModels(): Promise<ModelCapabilities[]> {
    try {
      const response = await axios.get('http://localhost:1234/v1/models', { timeout: 5000 });
      const models: ModelCapabilities[] = [];

      for (const model of response.data.data || []) {
        const capabilities = this.analyzeModelCapabilities(model.id, 'lm-studio');
        models.push({
          provider: 'lm-studio',
          model: model.id,
          size: 'unknown',
          contextWindow: this.estimateContextWindow(model.id),
          capabilities: capabilities.capabilities,
          strengths: capabilities.strengths,
          isCodeFocused: capabilities.isCodeFocused,
          responseSpeed: capabilities.responseSpeed,
          qualityLevel: capabilities.qualityLevel,
        });
      }

      return models;
    } catch (error) {
      logger.debug('LM Studio API not available:', error.message);
      return [];
    }
  }

  /**
   * Analyze model capabilities based on name patterns
   */
  private analyzeModelCapabilities(modelName: string, provider: string): {
    capabilities: string[];
    strengths: string[];
    isCodeFocused: boolean;
    responseSpeed: 'fast' | 'medium' | 'slow';
    qualityLevel: 'high' | 'medium' | 'low';
  } {
    const name = modelName.toLowerCase();
    const capabilities: string[] = [];
    const strengths: string[] = [];
    let isCodeFocused = false;
    let responseSpeed: 'fast' | 'medium' | 'slow' = 'medium';
    let qualityLevel: 'high' | 'medium' | 'low' = 'medium';

    // Code-focused models
    if (name.includes('coder') || name.includes('code') || name.includes('programming')) {
      isCodeFocused = true;
      capabilities.push('code-generation', 'code-analysis', 'debugging');
      strengths.push('Programming', 'Code Review', 'Technical Analysis');
    }

    // Model size indicators
    if (name.includes('3b') || name.includes('7b')) {
      responseSpeed = 'fast';
      qualityLevel = 'medium';
    } else if (name.includes('13b') || name.includes('14b')) {
      responseSpeed = 'medium';
      qualityLevel = 'high';
    } else if (name.includes('20b') || name.includes('27b') || name.includes('30b') || name.includes('32b')) {
      responseSpeed = 'slow';
      qualityLevel = 'high';
    }

    // Specialized capabilities
    if (name.includes('instruct') || name.includes('chat')) {
      capabilities.push('conversation', 'instruction-following');
      strengths.push('Interactive Communication');
    }

    if (name.includes('qwen') || name.includes('gemma') || name.includes('llama')) {
      capabilities.push('general-reasoning', 'text-generation');
      strengths.push('General Intelligence');
    }

    // Provider-specific optimizations
    if (provider === 'lm-studio') {
      strengths.push('Fast Inference', 'Windows Optimized');
      if (responseSpeed === 'medium') responseSpeed = 'fast';
    }

    if (provider === 'ollama') {
      strengths.push('Quality Reasoning', 'Model Management');
    }

    return { capabilities, strengths, isCodeFocused, responseSpeed, qualityLevel };
  }

  /**
   * Estimate context window based on model name
   */
  private estimateContextWindow(modelName: string): number {
    const name = modelName.toLowerCase();
    
    if (name.includes('32k')) return 32768;
    if (name.includes('16k')) return 16384;
    if (name.includes('8k')) return 8192;
    if (name.includes('4k')) return 4096;
    
    // Default estimates based on model type
    if (name.includes('qwen2.5')) return 32768;
    if (name.includes('gemma')) return 8192;
    if (name.includes('llama3')) return 8192;
    
    return 4096; // Conservative default
  }

  /**
   * Select optimal model based on role and task requirements
   */
  async selectModelForRole(config: RoleConfiguration): Promise<ModelCapabilities | null> {
    await this.detectAvailableModels();

    let filteredModels = this.availableModels;

    // Role-based filtering
    if (config.role === 'auditor') {
      // Auditor prefers LM Studio for fast analysis
      filteredModels = filteredModels.filter(m => 
        m.provider === 'lm-studio' || 
        (m.provider === 'ollama' && m.isCodeFocused)
      );
    } else if (config.role === 'writer') {
      // Writer prefers Ollama for quality generation
      filteredModels = filteredModels.filter(m => 
        m.provider === 'ollama' || 
        (m.provider === 'lm-studio' && m.qualityLevel === 'high')
      );
    }

    // Prefer code-focused models for technical tasks
    if (config.requiresCodeAnalysis) {
      const codeFocusedModels = filteredModels.filter(m => m.isCodeFocused);
      if (codeFocusedModels.length > 0) {
        filteredModels = codeFocusedModels;
      }
    }

    if (filteredModels.length === 0) {
      logger.warn(`No suitable models found for role: ${config.role}`);
      return null;
    }

    // Score and rank models
    const scoredModels = filteredModels.map(model => ({
      model,
      score: this.scoreModelForRole(model, config)
    }));

    // Sort by score (highest first)
    scoredModels.sort((a, b) => b.score - a.score);

    const selected = scoredModels[0].model;
    logger.info(`Selected model for ${config.role}: ${selected.model} (${selected.provider})`);
    
    return selected;
  }

  /**
   * Score model suitability for a specific role
   */
  private scoreModelForRole(model: ModelCapabilities, config: RoleConfiguration): number {
    let score = 0;

    // Base score for provider preference
    if (config.role === 'auditor' && model.provider === 'lm-studio') score += 30;
    if (config.role === 'writer' && model.provider === 'ollama') score += 30;

    // Code focus bonus
    if (config.requiresCodeAnalysis && model.isCodeFocused) score += 25;

    // Quality vs Speed trade-offs
    if (config.role === 'auditor') {
      // Auditor prefers speed
      if (model.responseSpeed === 'fast') score += 20;
      if (model.responseSpeed === 'medium') score += 10;
    } else if (config.role === 'writer') {
      // Writer prefers quality
      if (model.qualityLevel === 'high') score += 20;
      if (model.qualityLevel === 'medium') score += 10;
    }

    // Context window bonus
    if (model.contextWindow >= 32768) score += 15;
    else if (model.contextWindow >= 16384) score += 10;
    else if (model.contextWindow >= 8192) score += 5;

    // Capability matching
    const relevantCapabilities = ['code-analysis', 'code-generation', 'general-reasoning'];
    const matchedCapabilities = model.capabilities.filter(cap => 
      relevantCapabilities.includes(cap)
    ).length;
    score += matchedCapabilities * 5;

    return score;
  }

  /**
   * Switch current role
   */
  setRole(role: 'auditor' | 'writer' | 'auto'): void {
    const previousRole = this.currentRole;
    this.currentRole = role;
    
    logger.info(`Role switched: ${previousRole} -> ${role}`);
    this.emit('role-changed', { previous: previousRole, current: role });
  }

  /**
   * Get current role
   */
  getCurrentRole(): 'auditor' | 'writer' | 'auto' {
    return this.currentRole;
  }

  /**
   * Get models grouped by provider
   */
  async getModelsByProvider(): Promise<{
    ollama: ModelCapabilities[];
    lmStudio: ModelCapabilities[];
  }> {
    await this.detectAvailableModels();
    
    return {
      ollama: this.availableModels.filter(m => m.provider === 'ollama'),
      lmStudio: this.availableModels.filter(m => m.provider === 'lm-studio')
    };
  }

  /**
   * Get best model for current role
   */
  async getBestModelForCurrentRole(taskType: string = 'general'): Promise<ModelCapabilities | null> {
    const config: RoleConfiguration = {
      role: this.currentRole,
      preferredProvider: 'auto',
      taskType,
      requiresCodeAnalysis: taskType.includes('audit') || taskType.includes('analyze'),
      requiresGeneration: taskType.includes('write') || taskType.includes('generate')
    };

    return this.selectModelForRole(config);
  }
}