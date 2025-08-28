/**
 * Intelligent Model Detector - Iteration 7: Enhanced Model Management & Auto-Configuration
 * Automatically detects available models and configures optimal dual-agent setup
 */

import { logger } from '../logger.js';

export interface ModelInfo {
  name: string;
  platform: 'ollama' | 'lmstudio';
  size: string;
  sizeBytes?: number;
  capabilities: ModelCapability[];
  performance: PerformanceProfile;
  availability: 'available' | 'downloading' | 'unavailable';
  lastUsed?: Date;
}

export interface ModelCapability {
  type: 'code_generation' | 'code_review' | 'analysis' | 'conversation' | 'reasoning';
  score: number; // 0-1
  specialization?: string[];
}

export interface PerformanceProfile {
  speed: 'fast' | 'medium' | 'slow';
  quality: 'basic' | 'good' | 'excellent';
  memoryUsage: 'low' | 'medium' | 'high';
  contextWindow: number;
  estimatedTokensPerSecond?: number;
}

export interface OptimalConfiguration {
  writer: {
    model: string;
    platform: 'ollama' | 'lmstudio';
    reasoning: string;
  };
  auditor: {
    model: string;
    platform: 'ollama' | 'lmstudio';
    reasoning: string;
  };
  fallback?: {
    model: string;
    platform: 'ollama' | 'lmstudio';
    reasoning: string;
  };
  confidence: number; // 0-1
}

export class IntelligentModelDetector {
  private logger: Logger;
  private detectedModels: ModelInfo[] = [];
  private lastScan: Date | null = null;
  private platformHealth = {
    ollama: false,
    lmstudio: false,
  };

  constructor() {
    this.logger = new Logger('ModelDetector');
  }

  /**
   * Scan all platforms and detect available models
   */
  async scanAvailableModels(forceRefresh = false): Promise<ModelInfo[]> {
    if (!forceRefresh && this.lastScan && Date.now() - this.lastScan.getTime() < 30000) {
      return this.detectedModels;
    }

    this.logger.info('Scanning for available models...');
    this.detectedModels = [];

    // Scan Ollama
    const ollamaModels = await this.scanOllamaModels();
    this.detectedModels.push(...ollamaModels);

    // Scan LM Studio
    const lmStudioModels = await this.scanLMStudioModels();
    this.detectedModels.push(...lmStudioModels);

    this.lastScan = new Date();
    this.logger.info(`Found ${this.detectedModels.length} total models`);

    return this.detectedModels;
  }

  /**
   * Scan Ollama for available models
   */
  private async scanOllamaModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    try {
      const response = await fetch('http://localhost:11434/api/tags');

      if (!response.ok) {
        this.logger.warn('Ollama not available');
        this.platformHealth.ollama = false;
        return [];
      }

      this.platformHealth.ollama = true;
      const data = await response.json();

      for (const model of data.models || []) {
        const modelInfo = this.analyzeOllamaModel(model);
        models.push(modelInfo);
      }

      this.logger.info(`Found ${models.length} Ollama models`);
    } catch (error) {
      this.logger.warn('Failed to scan Ollama models:', error);
      this.platformHealth.ollama = false;
    }

    return models;
  }

  /**
   * Scan LM Studio for available models
   */
  private async scanLMStudioModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    try {
      const response = await fetch('http://localhost:1234/v1/models');

      if (!response.ok) {
        this.logger.warn('LM Studio not available');
        this.platformHealth.lmstudio = false;
        return [];
      }

      this.platformHealth.lmstudio = true;
      const data = await response.json();

      for (const model of data.data || []) {
        const modelInfo = this.analyzeLMStudioModel(model);
        models.push(modelInfo);
      }

      this.logger.info(`Found ${models.length} LM Studio models`);
    } catch (error) {
      this.logger.warn('Failed to scan LM Studio models:', error);
      this.platformHealth.lmstudio = false;
    }

    return models;
  }

  /**
   * Analyze Ollama model and extract capabilities
   */
  private analyzeOllamaModel(model: any): ModelInfo {
    const name = model.name || 'unknown';
    const size = this.formatSize(model.size);

    return {
      name,
      platform: 'ollama',
      size,
      sizeBytes: model.size,
      capabilities: this.inferCapabilities(name, model.size),
      performance: this.inferPerformance(name, model.size),
      availability: 'available',
      lastUsed: model.modified_at ? new Date(model.modified_at) : undefined,
    };
  }

  /**
   * Analyze LM Studio model and extract capabilities
   */
  private analyzeLMStudioModel(model: any): ModelInfo {
    const name = model.id || 'unknown';

    return {
      name,
      platform: 'lmstudio',
      size: 'unknown',
      capabilities: this.inferCapabilities(name),
      performance: this.inferPerformance(name),
      availability: 'available',
    };
  }

  /**
   * Infer model capabilities from name and size
   */
  private inferCapabilities(name: string, sizeBytes?: number): ModelCapability[] {
    const capabilities: ModelCapability[] = [];
    const nameLower = name.toLowerCase();

    // Code generation capability
    if (
      nameLower.includes('code') ||
      nameLower.includes('deepseek') ||
      nameLower.includes('codellama') ||
      nameLower.includes('starcoder')
    ) {
      capabilities.push({
        type: 'code_generation',
        score: 0.9,
        specialization: ['programming', 'debugging', 'refactoring'],
      });
    } else {
      capabilities.push({
        type: 'code_generation',
        score: 0.6,
      });
    }

    // Analysis/Review capability (better for larger models)
    const reviewScore = sizeBytes && sizeBytes > 10 * 1024 * 1024 * 1024 ? 0.9 : 0.7; // >10GB
    capabilities.push({
      type: 'code_review',
      score: reviewScore,
      specialization: ['security', 'quality', 'best_practices'],
    });

    // Reasoning capability
    if (
      nameLower.includes('qwq') ||
      nameLower.includes('reasoning') ||
      nameLower.includes('o1') ||
      nameLower.includes('gpt')
    ) {
      capabilities.push({
        type: 'reasoning',
        score: 0.95,
        specialization: ['logic', 'problem_solving', 'analysis'],
      });
    }

    return capabilities;
  }

  /**
   * Infer performance profile from model characteristics
   */
  private inferPerformance(name: string, sizeBytes?: number): PerformanceProfile {
    const nameLower = name.toLowerCase();

    // Size-based performance estimation
    let speed: PerformanceProfile['speed'] = 'medium';
    let quality: PerformanceProfile['quality'] = 'good';
    let memoryUsage: PerformanceProfile['memoryUsage'] = 'medium';
    let contextWindow = 4096;

    if (sizeBytes) {
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);

      if (sizeGB < 3) {
        speed = 'fast';
        quality = 'basic';
        memoryUsage = 'low';
        contextWindow = 2048;
      } else if (sizeGB < 8) {
        speed = 'fast';
        quality = 'good';
        memoryUsage = 'medium';
        contextWindow = 4096;
      } else if (sizeGB < 15) {
        speed = 'medium';
        quality = 'good';
        memoryUsage = 'medium';
        contextWindow = 8192;
      } else {
        speed = 'slow';
        quality = 'excellent';
        memoryUsage = 'high';
        contextWindow = 16384;
      }
    }

    // Model-specific adjustments
    if (nameLower.includes('gemma:2b') || nameLower.includes('3.2:latest')) {
      speed = 'fast';
      memoryUsage = 'low';
    }

    if (nameLower.includes('qwq:32b') || nameLower.includes('27b')) {
      speed = 'slow';
      quality = 'excellent';
      memoryUsage = 'high';
      contextWindow = 32768;
    }

    return {
      speed,
      quality,
      memoryUsage,
      contextWindow,
      estimatedTokensPerSecond: speed === 'fast' ? 50 : speed === 'medium' ? 20 : 10,
    };
  }

  /**
   * Find optimal dual-agent configuration
   */
  async findOptimalConfiguration(): Promise<OptimalConfiguration> {
    await this.scanAvailableModels();

    const codeGenerationModels = this.detectedModels
      .filter(m => m.availability === 'available')
      .filter(m => this.getCapabilityScore(m, 'code_generation') > 0.5)
      .sort((a, b) => {
        // Prefer fast models for writing
        if (a.performance.speed !== b.performance.speed) {
          const speedOrder = { fast: 3, medium: 2, slow: 1 };
          return speedOrder[b.performance.speed] - speedOrder[a.performance.speed];
        }
        return (
          this.getCapabilityScore(b, 'code_generation') -
          this.getCapabilityScore(a, 'code_generation')
        );
      });

    const reviewModels = this.detectedModels
      .filter(m => m.availability === 'available')
      .filter(m => this.getCapabilityScore(m, 'code_review') > 0.5)
      .sort((a, b) => {
        // Prefer quality models for auditing
        const qualityOrder = { excellent: 3, good: 2, basic: 1 };
        if (a.performance.quality !== b.performance.quality) {
          return qualityOrder[b.performance.quality] - qualityOrder[a.performance.quality];
        }
        return (
          this.getCapabilityScore(b, 'code_review') - this.getCapabilityScore(a, 'code_review')
        );
      });

    // Select best writer (fast generation)
    const writer = codeGenerationModels[0];

    // Select best auditor (high quality, different from writer if possible)
    const auditor = reviewModels.find(m => m.name !== writer?.name) || reviewModels[0];

    // Fallback model
    const fallback = this.detectedModels
      .filter(
        m => m.availability === 'available' && m.name !== writer?.name && m.name !== auditor?.name
      )
      .sort((a, b) => this.getOverallScore(b) - this.getOverallScore(a))[0];

    if (!writer || !auditor) {
      throw new Error('No suitable models found for dual-agent configuration');
    }

    const confidence = this.calculateConfigurationConfidence(writer, auditor, fallback);

    return {
      writer: {
        model: writer.name,
        platform: writer.platform,
        reasoning: `Fast ${writer.performance.speed} model optimized for code generation (${writer.size})`,
      },
      auditor: {
        model: auditor.name,
        platform: auditor.platform,
        reasoning: `${auditor.performance.quality} quality model for thorough code review (${auditor.size})`,
      },
      fallback: fallback
        ? {
            model: fallback.name,
            platform: fallback.platform,
            reasoning: `Backup model for redundancy`,
          }
        : undefined,
      confidence,
    };
  }

  /**
   * Get capability score for a model
   */
  private getCapabilityScore(model: ModelInfo, capability: ModelCapability['type']): number {
    const cap = model.capabilities.find(c => c.type === capability);
    return cap?.score || 0;
  }

  /**
   * Calculate overall model score
   */
  private getOverallScore(model: ModelInfo): number {
    const avgCapability =
      model.capabilities.reduce((sum, cap) => sum + cap.score, 0) / model.capabilities.length;
    const qualityBonus =
      model.performance.quality === 'excellent'
        ? 0.2
        : model.performance.quality === 'good'
          ? 0.1
          : 0;
    return avgCapability + qualityBonus;
  }

  /**
   * Calculate confidence in configuration
   */
  private calculateConfigurationConfidence(
    writer: ModelInfo,
    auditor: ModelInfo,
    fallback?: ModelInfo
  ): number {
    let confidence = 0.5; // Base confidence

    // Platform diversity bonus
    if (writer.platform !== auditor.platform) {
      confidence += 0.2;
    }

    // Quality bonus
    if (writer.performance.speed === 'fast') confidence += 0.1;
    if (auditor.performance.quality === 'excellent') confidence += 0.2;

    // Capability scores
    confidence += this.getCapabilityScore(writer, 'code_generation') * 0.1;
    confidence += this.getCapabilityScore(auditor, 'code_review') * 0.1;

    // Fallback bonus
    if (fallback) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  /**
   * Format size in human readable format
   */
  private formatSize(bytes?: number): string {
    if (!bytes) return 'unknown';

    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 1) {
      const mb = bytes / (1024 * 1024);
      return `${mb.toFixed(0)}MB`;
    }
    return `${gb.toFixed(1)}GB`;
  }

  /**
   * Get platform health status
   */
  getPlatformHealth(): { ollama: boolean; lmstudio: boolean } {
    return { ...this.platformHealth };
  }

  /**
   * Get detected models summary
   */
  getModelsSummary(): any {
    return {
      total: this.detectedModels.length,
      byPlatform: {
        ollama: this.detectedModels.filter(m => m.platform === 'ollama').length,
        lmstudio: this.detectedModels.filter(m => m.platform === 'lmstudio').length,
      },
      bySpeed: {
        fast: this.detectedModels.filter(m => m.performance.speed === 'fast').length,
        medium: this.detectedModels.filter(m => m.performance.speed === 'medium').length,
        slow: this.detectedModels.filter(m => m.performance.speed === 'slow').length,
      },
      lastScan: this.lastScan?.toISOString(),
    };
  }

  /**
   * Force refresh model list
   */
  async refresh(): Promise<ModelInfo[]> {
    return await this.scanAvailableModels(true);
  }
}

export default IntelligentModelDetector;
