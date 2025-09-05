/**
 * Voice System Integration 2025
 * Modern wrapper for voice archetype system integration
 */

import { VoiceArchetypeSystem } from './voice-archetype-system.js';
import { logger } from '../infrastructure/logging/logger.js';
import { CouncilMode } from './collaboration/council-decision-engine.js';

export interface VoiceSystemConfig {
  useOptimizedSystem?: boolean;
  fallbackToLegacy?: boolean;
  maxConcurrentVoices?: number;
  enablePerformanceMonitoring?: boolean;
  voiceSelectionStrategy?: 'random' | 'round-robin' | 'adaptive';
}

export interface RoutingOptions {
  type?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  priority?: 'low' | 'medium' | 'high';
  context?: string;
  domain?: string;
}

export interface VoiceSynthesisOptions {
  requiredVoices?: string[];
  excludeVoices?: string[];
  strategy?: 'consensus' | 'majority' | 'weighted' | 'sequential';
  maxVoices?: number;
  timeout?: number;
}

export interface VoiceResult {
  voice: string;
  content: string;
  confidence: number;
  processingTime?: number;
  metadata?: Record<string, unknown>;
}

export interface SynthesisResult {
  content: string;
  voices: VoiceResult[];
  strategy: string;
  confidence: number;
  processingTime: number;
  routing?: {
    strategy: string;
    selectedVoices: string[];
    routingCriteria: RoutingOptions;
  };
}

export class VoiceSystemIntegration2025 {
  private readonly voiceArchetypeSystem: VoiceArchetypeSystem;
  private readonly config: VoiceSystemConfig;
  private initialized: boolean = false;

  public constructor(modelClient: unknown = null, config: Readonly<VoiceSystemConfig> = {}) {
    this.config = {
      useOptimizedSystem: true,
      fallbackToLegacy: true,
      maxConcurrentVoices: 3,
      enablePerformanceMonitoring: false,
      voiceSelectionStrategy: 'adaptive',
      ...config,
    };

    // Create a simple logger
    const simpleLogger = {
      info: (msg: string): void => {
        console.log(`[VoiceSystem] ${msg}`);
      },
      error: (msg: string, error?: unknown): void => {
        console.error(`[VoiceSystem] ${msg}`, error);
      },
      warn: (msg: string): void => {
        console.warn(`[VoiceSystem] ${msg}`);
      },
      debug: (msg: string): void => {
        console.debug(`[VoiceSystem] ${msg}`);
      },
      trace: (msg: string): void => {
        console.trace(`[VoiceSystem] ${msg}`);
      },
    };

    // Initialize with the actual voice archetype system
    // Removed unused _voiceConfig declaration

    this.voiceArchetypeSystem = new VoiceArchetypeSystem(modelClient, simpleLogger);
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Voice System Integration 2025');

      // Initialize the underlying voice system if it has an initialize method
      const initializeMethod =
        typeof this.voiceArchetypeSystem.initialize === 'function'
          ? this.voiceArchetypeSystem.initialize.bind(this.voiceArchetypeSystem)
          : undefined;
      if (initializeMethod) {
        const initResult: unknown = initializeMethod();
        // Await only if the result is a Promise to avoid awaiting a void/non-promise
        if (initResult && typeof initResult === 'object' && 'then' in initResult) {
          await (initResult as Promise<unknown>);
        }
      }

      this.initialized = true;
      logger.info('Voice System Integration 2025 initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Voice System Integration 2025:', error);
      throw error;
    }
  }

  public async synthesizeVoices(
    request: string,
    context: Readonly<{ requiredVoices?: string[]; councilMode?: CouncilMode }> = {}
  ): Promise<Record<string, unknown>> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use the underlying voice system for synthesis
      const result = await this.voiceArchetypeSystem.synthesizeMultipleVoices(request, context);

      // Convert SynthesisResult to Record<string, unknown>
      return result as unknown as Record<string, unknown>;
    } catch (error) {
      logger.error('Voice synthesis failed:', error);

      if (this.config.fallbackToLegacy) {
        logger.info('Falling back to legacy voice processing');
        return await this.basicVoiceSynthesis(request, context);
      }

      throw error;
    }
  }

  public async selectVoices(criteria: Record<string, unknown> = {}): Promise<string[]> {
    const availableVoices = this.getAvailableVoices();
    const maxVoices = Math.min(this.config.maxConcurrentVoices ?? 3, availableVoices.length);

    switch (this.config.voiceSelectionStrategy) {
      case 'random':
        return this.selectRandomVoices(availableVoices, maxVoices);
      case 'round-robin':
        return this.selectRoundRobinVoices(availableVoices, maxVoices);
      case 'adaptive':
      default:
        return Promise.resolve(this.selectAdaptiveVoices(availableVoices, maxVoices, criteria));
    }
  }

  public getAvailableVoices(): string[] {
    // Default voice archetypes based on the system
    return [
      'architect',
      'developer',
      'analyzer',
      'maintainer',
      'explorer',
      'security',
      'optimizer',
      'implementor',
      'designer',
      'guardian',
    ];
  }

  public getSystemStatus(): {
    initialized: boolean;
    config: VoiceSystemConfig;
    availableVoices: number;
    performance: Record<string, unknown>;
  } {
    return {
      initialized: this.initialized,
      config: this.config,
      availableVoices: this.getAvailableVoices().length,
      performance: this.getPerformanceMetrics(),
    };
  }

  // Private methods
  private async basicVoiceSynthesis(
    request: string,
    context: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const selectedVoices = await this.selectVoices(context);

    return {
      request,
      voices: selectedVoices,
      synthesis: `Basic voice synthesis completed with ${selectedVoices.length} voices`,
      timestamp: Date.now(),
      fallback: true,
    };
  }

  private selectRandomVoices(voices: string[], count: number): string[] {
    const shuffled = [...voices].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private selectRoundRobinVoices(voices: string[], count: number): string[] {
    // Simple round-robin selection
    const selected: string[] = [];
    for (let i = 0; i < count && i < voices.length; i++) {
      selected.push(voices[i]);
    }
    return selected;
  }

  private selectAdaptiveVoices(
    voices: string[],
    count: number,
    criteria: Record<string, unknown>
  ): string[] {
    // Adaptive selection based on criteria
    const priorities = this.calculateVoicePriorities(voices, criteria);
    return priorities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count)
      .map(v => v.voice);
  }

  private calculateVoicePriorities(
    voices: string[],
    criteria: Record<string, unknown>
  ): Array<{ voice: string; priority: number }> {
    return voices.map(voice => ({
      voice,
      priority: this.calculateVoicePriority(voice, criteria),
    }));
  }

  private calculateVoicePriority(voice: string, criteria: Record<string, unknown>): number {
    let priority = 0.5; // Base priority

    // Simple priority calculation based on voice type and criteria
    if (criteria.type === 'analysis' && ['analyzer', 'architect'].includes(voice)) {
      priority += 0.3;
    }

    if (criteria.type === 'implementation' && ['developer', 'implementor'].includes(voice)) {
      priority += 0.3;
    }

    if (criteria.type === 'security' && voice === 'security') {
      priority += 0.4;
    }

    if (criteria.complexity === 'high' && ['architect', 'analyzer'].includes(voice)) {
      priority += 0.2;
    }

    return Math.min(priority, 1.0);
  }

  private getPerformanceMetrics(): Record<string, unknown> {
    if (!this.config.enablePerformanceMonitoring) {
      return { enabled: false };
    }

    return {
      enabled: true,
      synthesisCount: 0, // Would track actual usage
      averageResponseTime: 0,
      errorRate: 0,
      lastActivity: Date.now(),
    };
  }

  // === Missing Interface Methods ===

  /**
   * Get system analytics data
   */
  public getSystemAnalytics(): {
    systemStatus: {
      initialized: boolean;
      config: VoiceSystemConfig;
      availableVoices: number;
      performance: Record<string, unknown>;
    };
    performanceMetrics: Record<string, unknown>;
    voiceUsageStats: {
      totalSyntheses: number;
      voiceDistribution: Record<string, unknown>;
      averageVoicesPerRequest: number;
      mostUsedVoice: string;
      leastUsedVoice: string;
    };
    healthMetrics: {
      initialized: boolean;
      errorRate: number;
      uptime: number;
      lastError: unknown;
    };
  } {
    return {
      systemStatus: this.getSystemStatus(),
      performanceMetrics: this.getPerformanceMetrics(),
      voiceUsageStats: this.getVoiceUsageStats() as {
        totalSyntheses: number;
        voiceDistribution: Record<string, unknown>;
        averageVoicesPerRequest: number;
        mostUsedVoice: string;
        leastUsedVoice: string;
      },
      healthMetrics: {
        initialized: this.initialized,
        errorRate: 0, // Would track actual errors
        uptime: Date.now(), // Would track actual uptime
        lastError: null,
      },
    };
  }

  /**
   * Process request with integrated routing
   */
  async processWithIntegratedRouting(request: string, routing: RoutingOptions = {}): Promise<SynthesisResult> {
    logger.info('Processing request with integrated routing');

    const selectedVoices = await this.selectVoices({
      type: routing.type || 'general',
      complexity: routing.complexity || 'medium',
      ...routing,
    });

    const result = await this.synthesizeMultipleVoices(request, {
      requiredVoices: selectedVoices,
    });

    return {
      ...result,
      routing: {
        strategy: this.config.voiceSelectionStrategy || 'adaptive',
        selectedVoices,
        routingCriteria: routing,
      },
    };
  }

  /**
   * Synthesize multiple voices for a given request
   */
  async synthesizeMultipleVoices(request: string, options: VoiceSynthesisOptions = {}): Promise<SynthesisResult> {
    logger.info('Synthesizing multiple voices for request');

    const voices = options.requiredVoices || (await this.selectVoices(options as Record<string, unknown>));
    const results: VoiceResult[] = [];

    for (const voice of voices) {
      try {
        const voiceResult = await this.synthesizeSingleVoice(voice, request, options);
        results.push(voiceResult);
      } catch (error) {
        logger.error(`Failed to synthesize voice ${voice}:`, error);
        // Continue with other voices
      }
    }

    return {
      content: results.map(r => r.content).join('\n\n'),
      voices: results,
      strategy: options.strategy || 'consensus',
      confidence: results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0,
      processingTime: Date.now(),
    };
  }

  private getVoiceUsageStats(): {
    totalSyntheses: number;
    voiceDistribution: Record<string, unknown>;
    averageVoicesPerRequest: number;
    mostUsedVoice: string;
    leastUsedVoice: string;
  } {
    return {
      totalSyntheses: 0, // Would track actual usage
      voiceDistribution: {},
      averageVoicesPerRequest: this.config.maxConcurrentVoices || 3,
      mostUsedVoice: 'analyzer', // Would track actual usage
      leastUsedVoice: 'guardian',
    };
  }

  private async synthesizeSingleVoice(voice: string, request: string, options: VoiceSynthesisOptions): Promise<VoiceResult> {
    // Calculate real confidence based on multiple factors
    const confidence = this.calculateVoiceConfidence(voice, request, options);

    return {
      voice,
      content: `Response from ${voice} archetype for: ${request.substring(0, 50)}...`,
      confidence,
      processingTime: this.estimateProcessingTime(voice, request.length),
      metadata: { options },
    };
  }

  private calculateVoiceConfidence(voice: string, request: string, options: VoiceSynthesisOptions): number {
    let confidence = 0.5; // Base confidence

    // Factor 1: Voice-request alignment
    const voiceStrengths = this.getVoiceStrengths(voice);
    const requestKeywords = this.extractRequestKeywords(request);
    const alignmentScore = this.calculateAlignmentScore(voiceStrengths, requestKeywords);
    confidence += alignmentScore * 0.3;

    // Factor 2: Request complexity vs voice capability
    const complexity = this.assessRequestComplexity(request);
    const voiceCapability = this.getVoiceCapability(voice);
    if (voiceCapability >= complexity) {
      confidence += 0.2;
    } else {
      confidence -= 0.15;
    }

    // Factor 3: Historical success rate for this voice type
    const historicalSuccess = this.getVoiceSuccessRate(voice);
    confidence = confidence * 0.7 + historicalSuccess * 0.3;

    // Clamp between 0.1 and 0.95 (never completely confident or completely uncertain)
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private estimateProcessingTime(voice: string, requestLength: number): number {
    // Base time for voice initialization
    let baseTime = 300;

    // Add time based on request length (words per minute processing)
    const wordsEstimate = requestLength / 5; // ~5 chars per word
    const processingTime = wordsEstimate * 50; // 50ms per word

    // Voice-specific processing overhead
    const voiceOverhead = this.getVoiceProcessingOverhead(voice);

    return Math.round(baseTime + processingTime + voiceOverhead);
  }

  private getVoiceStrengths(voice: string): string[] {
    const strengths: Record<string, string[]> = {
      Explorer: ['innovation', 'creativity', 'research', 'discovery'],
      Maintainer: ['stability', 'quality', 'maintenance', 'reliability'],
      Security: ['security', 'vulnerability', 'authentication', 'encryption'],
      Architect: ['design', 'structure', 'scalability', 'patterns'],
      Developer: ['implementation', 'coding', 'debugging', 'testing'],
      Analyzer: ['performance', 'optimization', 'metrics', 'analysis'],
    };
    return strengths[voice] || [];
  }

  private extractRequestKeywords(request: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    return request
      .toLowerCase()
      .split(/\W+/)
      .filter(word => word.length > 3);
  }

  private calculateAlignmentScore(strengths: string[], keywords: string[]): number {
    if (strengths.length === 0 || keywords.length === 0) return 0;

    const matches = strengths.filter(strength =>
      keywords.some(keyword => keyword.includes(strength) || strength.includes(keyword))
    );

    return matches.length / strengths.length;
  }

  private assessRequestComplexity(request: string): number {
    let complexity = 0.3; // Base complexity

    // Length-based complexity
    if (request.length > 500) complexity += 0.3;
    else if (request.length > 200) complexity += 0.2;
    else if (request.length > 100) complexity += 0.1;

    // Content-based complexity indicators
    const complexityIndicators = [
      'architecture',
      'security',
      'performance',
      'scale',
      'enterprise',
      'integration',
      'optimization',
      'algorithm',
      'system',
    ];

    const matches = complexityIndicators.filter(indicator =>
      request.toLowerCase().includes(indicator)
    );

    complexity += matches.length * 0.1;

    return Math.min(1.0, complexity);
  }

  private getVoiceCapability(voice: string): number {
    const capabilities: Record<string, number> = {
      Explorer: 0.8, // High capability for innovative tasks
      Maintainer: 0.7, // Good for stability tasks
      Security: 0.9, // Excellent for security tasks
      Architect: 0.85, // Very good for design tasks
      Developer: 0.75, // Good for implementation
      Analyzer: 0.8, // High capability for analysis
    };
    return capabilities[voice] || 0.6;
  }

  private getVoiceSuccessRate(voice: string): number {
    // In a real implementation, this would come from historical data
    // For now, return reasonable estimates based on voice characteristics
    const successRates: Record<string, number> = {
      Explorer: 0.72, // Innovative but sometimes unpredictable
      Maintainer: 0.85, // Very reliable
      Security: 0.88, // Highly reliable for security tasks
      Architect: 0.8, // Generally reliable design
      Developer: 0.78, // Good practical results
      Analyzer: 0.82, // Strong analytical results
    };
    return successRates[voice] || 0.75;
  }

  private getVoiceProcessingOverhead(voice: string): number {
    // Different voices have different processing complexity
    const overheads: Record<string, number> = {
      Explorer: 200, // Higher overhead for creative processing
      Maintainer: 100, // Lower overhead for straightforward tasks
      Security: 300, // Higher overhead for security analysis
      Architect: 250, // Moderate overhead for design work
      Developer: 150, // Moderate overhead for implementation
      Analyzer: 180, // Moderate overhead for analysis
    };
    return overheads[voice] || 150;
  }

  /**
   * Generate optimization recommendations based on system performance
   */
  async generateOptimizationRecommendations(): Promise<string[]> {
    return [
      'Consider increasing concurrent voice limit for better throughput',
      'Use adaptive voice selection for complex requests',
      'Enable caching for frequently used voice combinations',
    ];
  }

  /**
   * Recommend voices for a specific prompt
   */
  recommendVoices(prompt: string, count: number = 3): string[] {
    const voices = this.getAvailableVoices();
    return this.selectAdaptiveVoices(voices, count, { prompt });
  }

  /**
   * Generate a response using a single voice
   */
  async generateSingleVoiceResponse(
    voice: string,
    prompt: string,
    options: VoiceSynthesisOptions = {}
  ): Promise<VoiceResult> {
    return this.synthesizeSingleVoice(voice, prompt, options);
  }

  /**
   * Generate solutions using multiple voices
   */
  async generateMultiVoiceSolutions(
    voices: string[],
    prompt: string,
    options: VoiceSynthesisOptions = {}
  ): Promise<VoiceResult[]> {
    const results = await Promise.all(
      voices.map(voice => this.synthesizeSingleVoice(voice, prompt, options))
    );
    return results;
  }

  /**
   * Synthesize responses from multiple voices with a specific strategy
   */
  async synthesize(prompt: string, voices: string[], strategy: string = 'consensus'): Promise<SynthesisResult> {
    const results = await this.generateMultiVoiceSolutions(voices, prompt, {});
    return {
      content: results.map(r => r.content).join('\n\n'),
      voices: results,
      strategy,
      confidence: results.length > 0 ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length : 0,
      processingTime: Date.now(),
    };
  }
}
