/**
 * Voice System Integration Layer (2025 Pattern)
 * Agent 3: Voice System Optimization Specialist
 * 
 * Integration Features:
 * - Seamless integration with existing VoiceArchetypeSystem
 * - Backward compatibility with current interfaces
 * - Hot-swappable optimization components
 * - Performance monitoring and analytics integration
 * - Living Spiral methodology integration
 * - Configuration-driven optimization enablement
 */

import { VoiceArchetypeSystemInterface } from '../refactor/voice-archetype-system-interface.js';
import { VoiceArchetypeSystem } from './voice-archetype-system.js';
import { OptimizedVoiceSystem2025 } from './optimized-voice-system-2025.js';
import { AdvancedVoiceCoordinator2025 } from './advanced-voice-coordinator-2025.js';
import { VoicePerformanceAnalytics2025, VoiceMetrics } from './voice-performance-analytics-2025.js';
import { DynamicVoiceSelector2025 } from './dynamic-voice-selector-2025.js';
import { VoiceModeOptimizer2025 } from './voice-mode-optimizer-2025.js';
import { HierarchicalVoiceMemory2025 } from './hierarchical-voice-memory-2025.js';
import { logger } from '../core/logger.js';

export interface VoiceSystemConfig {
  // Core system selection
  useOptimizedSystem: boolean;
  fallbackToLegacy: boolean;
  
  // Optimization features
  enableDynamicSelection: boolean;
  enableModeOptimization: boolean;
  enableHierarchicalMemory: boolean;
  enableAdvancedCoordination: boolean;
  enablePerformanceAnalytics: boolean;
  
  // Performance settings
  maxConcurrentVoices: number;
  cacheSize: number;
  metricsRetentionDays: number;
  
  // Quality thresholds
  qualityThreshold: number;
  performanceThreshold: number;
  costThreshold: number;
  
  // Integration settings
  enableLivingSpiralIntegration: boolean;
  enableHotSwapping: boolean;
  enableAutoOptimization: boolean;
}

export interface VoiceSystemMetrics {
  systemType: 'legacy' | 'optimized';
  startupTime: number;
  totalRequests: number;
  averageResponseTime: number;
  costSavings: number;
  qualityImprovement: number;
  optimizationsActive: string[];
  recommendationsGenerated: number;
}

/**
 * Unified Voice System Integration Layer
 * Provides seamless switching between legacy and optimized systems
 */
export class VoiceSystemIntegration2025 implements VoiceArchetypeSystemInterface {
  private config: VoiceSystemConfig;
  private legacySystem: VoiceArchetypeSystem;
  private optimizedSystem: OptimizedVoiceSystem2025 | null = null;
  private coordinator: AdvancedVoiceCoordinator2025 | null = null;
  private analytics: VoicePerformanceAnalytics2025 | null = null;
  private dynamicSelector: DynamicVoiceSelector2025 | null = null;
  private modeOptimizer: VoiceModeOptimizer2025 | null = null;
  private voiceMemory: HierarchicalVoiceMemory2025 | null = null;
  
  private currentSystem: 'legacy' | 'optimized';
  private systemMetrics: VoiceSystemMetrics;
  private startupTime: number;

  constructor(modelClient?: any, config?: Partial<VoiceSystemConfig>) {
    const initStart = Date.now();
    
    // Default configuration with optimizations enabled
    this.config = {
      useOptimizedSystem: true,
      fallbackToLegacy: true,
      enableDynamicSelection: true,
      enableModeOptimization: true,
      enableHierarchicalMemory: true,
      enableAdvancedCoordination: true,
      enablePerformanceAnalytics: true,
      maxConcurrentVoices: 3,
      cacheSize: 100,
      metricsRetentionDays: 30,
      qualityThreshold: 0.7,
      performanceThreshold: 5000,
      costThreshold: 0.10,
      enableLivingSpiralIntegration: true,
      enableHotSwapping: true,
      enableAutoOptimization: true,
      ...config
    };

    // Initialize legacy system (always available as fallback)
    this.legacySystem = new VoiceArchetypeSystem(modelClient);
    this.currentSystem = 'legacy';

    // Initialize optimized system if enabled
    if (this.config.useOptimizedSystem) {
      this.initializeOptimizedSystem(modelClient);
    }

    // Initialize optimization components
    this.initializeOptimizationComponents();

    this.startupTime = Date.now() - initStart;
    
    // Initialize system metrics
    this.systemMetrics = {
      systemType: this.currentSystem,
      startupTime: this.startupTime,
      totalRequests: 0,
      averageResponseTime: 0,
      costSavings: 0,
      qualityImprovement: 0,
      optimizationsActive: this.getActiveOptimizations(),
      recommendationsGenerated: 0
    };

    logger.info('🎭 Voice System Integration initialized', {
      systemType: this.currentSystem,
      startupTime: `${this.startupTime}ms`,
      optimizationsEnabled: this.systemMetrics.optimizationsActive.length,
      fallbackAvailable: this.config.fallbackToLegacy
    });
  }

  /**
   * Initialize optimized system with error handling and fallback
   */
  private initializeOptimizedSystem(modelClient?: any): void {
    try {
      this.optimizedSystem = new OptimizedVoiceSystem2025(modelClient, {
        enableLazyLoading: this.config.enableDynamicSelection,
        enableDynamicSelection: this.config.enableDynamicSelection,
        enableModeOptimization: this.config.enableModeOptimization,
        enableMemoryHierarchy: this.config.enableHierarchicalMemory,
        enablePerformanceMonitoring: this.config.enablePerformanceAnalytics,
        maxConcurrentVoices: this.config.maxConcurrentVoices,
        cacheSize: this.config.cacheSize
      });
      
      this.currentSystem = 'optimized';
      logger.info('✅ Optimized voice system initialized successfully');
      
    } catch (error) {
      logger.error('❌ Failed to initialize optimized system, falling back to legacy', {
        error: error.message
      });
      
      if (!this.config.fallbackToLegacy) {
        throw error;
      }
      
      this.currentSystem = 'legacy';
      this.optimizedSystem = null;
    }
  }

  /**
   * Initialize optimization components
   */
  private initializeOptimizationComponents(): void {
    try {
      if (this.config.enableAdvancedCoordination) {
        this.coordinator = new AdvancedVoiceCoordinator2025();
      }

      if (this.config.enablePerformanceAnalytics) {
        this.analytics = new VoicePerformanceAnalytics2025({
          metricsRetentionDays: this.config.metricsRetentionDays,
          enableRealTimeAlerts: true,
          alertThresholds: {
            responseTimeMs: this.config.performanceThreshold,
            qualityScore: this.config.qualityThreshold,
            successRate: 0.8,
            costPerRequest: this.config.costThreshold
          }
        });
      }

      if (this.config.enableDynamicSelection) {
        this.dynamicSelector = new DynamicVoiceSelector2025();
      }

      if (this.config.enableModeOptimization) {
        this.modeOptimizer = new VoiceModeOptimizer2025();
      }

      if (this.config.enableHierarchicalMemory) {
        this.voiceMemory = new HierarchicalVoiceMemory2025();
      }

      logger.info('🔧 Optimization components initialized', {
        coordinator: !!this.coordinator,
        analytics: !!this.analytics,
        dynamicSelector: !!this.dynamicSelector,
        modeOptimizer: !!this.modeOptimizer,
        voiceMemory: !!this.voiceMemory
      });

    } catch (error) {
      logger.error('⚠️ Some optimization components failed to initialize', {
        error: error.message
      });
    }
  }

  /**
   * Get active voice (with lazy initialization for optimized system)
   */
  async getVoice(name: string): Promise<any> {
    const activeSystem = this.getActiveSystem();
    
    // Use optimized system's async getVoice if available
    if (this.currentSystem === 'optimized' && this.optimizedSystem) {
      return await this.optimizedSystem.getVoice(name);
    }
    
    // Fallback to legacy system (synchronous)
    return activeSystem.getVoice(name);
  }

  /**
   * Generate single voice response with performance tracking
   */
  async generateSingleVoiceResponse(voiceId: string, prompt: string, client?: any): Promise<any> {
    const startTime = Date.now();
    const activeSystem = this.getActiveSystem();
    
    try {
      // Use mode optimization if available
      let selectedVoice = voiceId;
      if (this.modeOptimizer) {
        const modeDecision = await this.modeOptimizer.optimizeVoiceMode(prompt, {
          timeConstraint: 'thorough',
          qualityRequirement: 'high'
        });
        
        if (modeDecision.selectedMode === 'single') {
          // Use the optimizer's voice selection if it recommends single mode
          const selection = await this.dynamicSelector?.selectOptimalVoices({
            prompt,
            taskType: 'generation',
            complexity: 'moderate',
            userPreference: 'auto'
          } as any);
          
          if (selection && selection.selectedVoices.length > 0) {
            selectedVoice = selection.selectedVoices[0];
          }
        }
      }

      // Generate response using active system
      let response;
      if (this.currentSystem === 'optimized' && this.optimizedSystem) {
        response = await this.optimizedSystem.generateSingleVoiceResponse(selectedVoice, prompt, client);
      } else {
        response = await activeSystem.generateSingleVoiceResponse(selectedVoice, prompt, client);
      }

      // Record performance metrics
      if (this.analytics) {
        const metrics: VoiceMetrics = {
          voiceId: selectedVoice,
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          tokenUsage: response.tokens_used || 0,
          qualityScore: response.confidence || 0.8,
          confidenceLevel: response.confidence || 0.8,
          taskComplexity: this.determineTaskComplexity(prompt),
          success: !!response.content,
          costEstimate: this.estimateCost(response.tokens_used || 0)
        };
        
        this.analytics.recordMetrics(metrics);
        this.updateSystemMetrics(metrics);
      }

      return response;

    } catch (error) {
      logger.error('Voice response generation failed', {
        voiceId,
        system: this.currentSystem,
        error: error.message
      });

      // Auto-fallback to legacy system if optimized system fails
      if (this.currentSystem === 'optimized' && this.config.fallbackToLegacy) {
        logger.info('🔄 Auto-fallback to legacy system');
        this.currentSystem = 'legacy';
        return await this.generateSingleVoiceResponse(voiceId, prompt, client);
      }

      throw error;
    }
  }

  /**
   * Generate multi-voice solutions with advanced coordination
   */
  async generateMultiVoiceSolutions(voices: string[], prompt: string, context?: any): Promise<any[]> {
    const startTime = Date.now();
    const activeSystem = this.getActiveSystem();

    try {
      // Use advanced coordination if available
      if (this.coordinator && this.config.enableAdvancedCoordination) {
        const coordinationContext = {
          taskType: context?.taskType || 'implementation',
          complexity: this.determineTaskComplexity(prompt),
          timeConstraint: context?.timeConstraint || 'normal',
          qualityRequirement: context?.qualityRequirement || 'high',
          domainRequirements: context?.domainRequirements || [],
          conflictTolerance: context?.conflictTolerance || 'medium'
        };

        const coordination = await this.coordinator.coordinateVoices(voices, coordinationContext);
        logger.info('🎯 Advanced coordination applied', {
          originalVoices: voices.length,
          optimizedVoices: coordination.assignments.length,
          expectedQuality: coordination.expectedQuality,
          conflictProbability: coordination.conflictProbability
        });
        
        // Use coordinated voice assignments
        voices = coordination.assignments.map(a => a.voiceId);
      }

      // Generate responses using active system
      let responses;
      if (this.currentSystem === 'optimized' && this.optimizedSystem) {
        responses = await this.optimizedSystem.generateMultiVoiceSolutions(voices, prompt, context);
      } else {
        responses = await activeSystem.generateMultiVoiceSolutions(voices, prompt, context);
      }

      // Apply conflict resolution if needed and coordinator is available
      if (this.coordinator && responses.length > 1) {
        const conflictResolution = await this.coordinator.resolveVoiceConflicts(
          responses,
          {
            taskType: context?.taskType || 'implementation',
            complexity: this.determineTaskComplexity(prompt),
            timeConstraint: context?.timeConstraint || 'normal',
            qualityRequirement: context?.qualityRequirement || 'high',
            domainRequirements: context?.domainRequirements || [],
            conflictTolerance: context?.conflictTolerance || 'medium'
          }
        );

        logger.info('🔀 Conflict resolution applied', {
          conflicts: conflictResolution.conflicts.length,
          strategy: conflictResolution.resolutionStrategy,
          confidence: conflictResolution.confidence
        });
      }

      // Record metrics for each voice
      if (this.analytics) {
        const totalTime = Date.now() - startTime;
        for (const response of responses) {
          const metrics: VoiceMetrics = {
            voiceId: response.voiceId,
            timestamp: new Date(),
            responseTime: totalTime / voices.length, // Distribute time across voices
            tokenUsage: response.tokens_used || 0,
            qualityScore: response.confidence || 0.8,
            confidenceLevel: response.confidence || 0.8,
            taskComplexity: this.determineTaskComplexity(prompt),
            success: !!response.content,
            costEstimate: this.estimateCost(response.tokens_used || 0)
          };
          
          this.analytics.recordMetrics(metrics);
          this.updateSystemMetrics(metrics);
        }
      }

      return responses;

    } catch (error) {
      logger.error('Multi-voice generation failed', {
        voices: voices.join(', '),
        system: this.currentSystem,
        error: error.message
      });

      // Auto-fallback logic
      if (this.currentSystem === 'optimized' && this.config.fallbackToLegacy) {
        logger.info('🔄 Auto-fallback to legacy system for multi-voice');
        this.currentSystem = 'legacy';
        return await this.generateMultiVoiceSolutions(voices, prompt, context);
      }

      throw error;
    }
  }

  /**
   * Synthesize voice responses with optimization
   */
  async synthesize(
    prompt: string,
    voices: string[],
    mode: 'competitive' | 'collaborative' | 'consensus' = 'collaborative',
    client?: any
  ): Promise<any> {
    const activeSystem = this.getActiveSystem();
    
    // Use optimized synthesis if available
    if (this.currentSystem === 'optimized' && this.optimizedSystem) {
      // The optimized system handles synthesis internally in generateMultiVoiceSolutions
      const responses = await this.generateMultiVoiceSolutions(voices, prompt, { mode });
      return {
        content: responses.length > 0 ? responses[0].content : 'No response generated',
        voicesUsed: voices,
        qualityScore: responses.length > 0 ? responses[0].confidence : 0,
        mode,
        responses
      };
    }
    
    // Fallback to legacy synthesis
    return await activeSystem.synthesize(prompt, voices, mode, client);
  }

  /**
   * Get comprehensive system analytics
   */
  async getSystemAnalytics(): Promise<any> {
    const analytics = {
      systemOverview: this.systemMetrics,
      configuration: this.config,
      performance: {
        costOptimization: undefined as any,
        optimizedSystem: undefined as any,
        coordination: undefined as any
      }
    };

    // Get performance analytics if available
    if (this.analytics) {
      analytics.performance = this.analytics.getPerformanceDashboard();
      
      // Get cost optimization report
      try {
        const costReport = await this.analytics.generateCostOptimizationReport();
        analytics.performance.costOptimization = costReport;
      } catch (error) {
        logger.warn('Failed to generate cost optimization report', { error: error.message });
      }
    }

    // Get optimized system analytics if available
    if (this.optimizedSystem) {
      analytics.performance.optimizedSystem = this.optimizedSystem.getPerformanceAnalytics();
    }

    // Get coordination analytics if available
    if (this.coordinator) {
      analytics.performance.coordination = this.coordinator.getCoordinationAnalytics();
    }

    return analytics;
  }

  /**
   * Hot-swap between systems (if enabled)
   */
  async switchSystem(targetSystem: 'legacy' | 'optimized'): Promise<boolean> {
    if (!this.config.enableHotSwapping) {
      logger.warn('Hot-swapping disabled in configuration');
      return false;
    }

    if (targetSystem === this.currentSystem) {
      logger.info(`Already using ${targetSystem} system`);
      return true;
    }

    if (targetSystem === 'optimized' && !this.optimizedSystem) {
      logger.error('Optimized system not available for switching');
      return false;
    }

    const previousSystem = this.currentSystem;
    this.currentSystem = targetSystem;
    this.systemMetrics.systemType = targetSystem;

    logger.info('🔄 Voice system switched', {
      from: previousSystem,
      to: targetSystem,
      hotSwap: true
    });

    return true;
  }

  /**
   * Generate optimization recommendations
   */
  async generateOptimizationRecommendations(): Promise<string[]> {
    const recommendations = [];

    // System-level recommendations
    if (this.currentSystem === 'legacy' && this.optimizedSystem) {
      recommendations.push('Consider switching to optimized system for better performance');
    }

    // Analytics-based recommendations
    if (this.analytics) {
      const dashboard = this.analytics.getPerformanceDashboard();
      recommendations.push(...dashboard.recommendations);
    }

    // Optimized system recommendations
    if (this.optimizedSystem) {
      const systemAnalytics = this.optimizedSystem.getPerformanceAnalytics();
      recommendations.push(...systemAnalytics.recommendations);
    }

    this.systemMetrics.recommendationsGenerated = recommendations.length;
    return recommendations;
  }

  /**
   * Interface compatibility methods
   */
  getAvailableVoices(): any[] {
    return this.getActiveSystem().getAvailableVoices();
  }

  getDefaultVoices(): string[] {
    return this.getActiveSystem().getDefaultVoices();
  }

  recommendVoices(prompt: string, maxVoices: number = 3): string[] {
    const activeSystem = this.getActiveSystem();
    
    // Use dynamic selector if available for better recommendations
    if (this.dynamicSelector && this.config.enableDynamicSelection) {
      try {
        const categories = this.dynamicSelector.getTaskCategories(prompt);
        const voiceMapping = {
          'implementation': ['developer'],
          'analysis': ['analyzer'],
          'design': ['architect'],
          'quality': ['maintainer'],
          'security': ['security']
        };
        
        const recommended = [];
        for (const category of categories) {
          const voices = voiceMapping[category] || [];
          recommended.push(...voices);
        }
        
        return recommended.slice(0, maxVoices);
      } catch (error) {
        logger.debug('Dynamic voice selection failed, using fallback', { error: error.message });
      }
    }
    
    const result = activeSystem.recommendVoices(prompt, maxVoices);
    return Array.isArray(result) ? result : ['maintainer', 'developer', 'analyst'].slice(0, maxVoices);
  }

  validateVoices(voiceIds: string[]): { valid: string[]; invalid: string[] } {
    const result = this.getActiveSystem().validateVoices(voiceIds);
    
    // Handle case where validateVoices might return a boolean
    if (typeof result === 'boolean') {
      return result ? { valid: voiceIds, invalid: [] } : { valid: [], invalid: voiceIds };
    }
    
    return result;
  }

  /**
   * Helper methods
   */
  private getActiveSystem(): VoiceArchetypeSystemInterface {
    if (this.currentSystem === 'optimized' && this.optimizedSystem) {
      return this.optimizedSystem as any;
    }
    return this.legacySystem;
  }


  private determineTaskComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const complexKeywords = ['architecture', 'system', 'security', 'scalable', 'enterprise'];
    const simpleKeywords = ['function', 'variable', 'calculate', 'print'];
    
    const lowerPrompt = prompt.toLowerCase();
    const hasComplex = complexKeywords.some(kw => lowerPrompt.includes(kw));
    const hasSimple = simpleKeywords.some(kw => lowerPrompt.includes(kw));
    
    if (hasComplex) return 'complex';
    if (hasSimple) return 'simple';
    return 'moderate';
  }

  private estimateCost(tokens: number): number {
    // Rough cost estimation based on token usage
    return tokens * 0.00001; // $0.00001 per token (example rate)
  }

  private updateSystemMetrics(metrics: VoiceMetrics): void {
    this.systemMetrics.totalRequests++;
    
    // Update running averages
    const alpha = 0.1; // Learning rate for exponential moving average
    this.systemMetrics.averageResponseTime = 
      (1 - alpha) * this.systemMetrics.averageResponseTime + alpha * metrics.responseTime;
    
    // Update cost savings (comparison with baseline)
    const baselineCost = 0.08; // Baseline cost estimate
    const savings = Math.max(0, baselineCost - metrics.costEstimate);
    this.systemMetrics.costSavings = 
      (1 - alpha) * this.systemMetrics.costSavings + alpha * savings;
    
    // Update quality improvement
    const baselineQuality = 0.7; // Baseline quality
    const improvement = Math.max(0, metrics.qualityScore - baselineQuality);
    this.systemMetrics.qualityImprovement = 
      (1 - alpha) * this.systemMetrics.qualityImprovement + alpha * improvement;
  }

  /**
   * Synthesize multiple voice responses into a unified result
   */
  async synthesizeVoiceResponses(responses: Record<string, unknown>[]): Promise<any> {
    if (!responses || responses.length === 0) {
      return { content: '', confidence: 0, voicesUsed: [] };
    }

    const activeSystem = this.optimizedSystem || this.legacySystem;
    if (activeSystem && 'synthesizeVoiceResponses' in activeSystem && typeof activeSystem.synthesizeVoiceResponses === 'function') {
      return activeSystem.synthesizeVoiceResponses(responses);
    }

    // Fallback synthesis
    const contents = responses.map((r: any) => r.content || '').filter(Boolean);
    const voicesUsed = responses.map((r: any) => r.voiceId || 'unknown');

    return {
      content: contents.join('\n\n---\n\n'),
      confidence: 0.7,
      voicesUsed,
      synthesizedAt: new Date().toISOString()
    };
  }

  /**
   * Get a voice perspective on a given prompt
   */
  async getVoicePerspective(voiceId: string, prompt: string): Promise<any> {
    try {
      const activeSystem = this.optimizedSystem || this.legacySystem;
      
      if (activeSystem && 'getVoicePerspective' in activeSystem && typeof activeSystem.getVoicePerspective === 'function') {
        return activeSystem.getVoicePerspective(voiceId, prompt);
      }

      // Fallback - use generateSingleVoiceResponse if available
      if (activeSystem && 'generateSingleVoiceResponse' in activeSystem && typeof activeSystem.generateSingleVoiceResponse === 'function') {
        const response = await activeSystem.generateSingleVoiceResponse(voiceId, prompt, undefined);
        return {
          voiceId,
          perspective: response.content || response,
          confidence: response.confidence || 0.7,
          generatedAt: new Date().toISOString()
        };
      }

      return {
        error: `Cannot get perspective: no suitable method available`,
        voiceId,
        prompt
      };

    } catch (error) {
      return {
        error: `Failed to get perspective from ${voiceId}: ${(error as Error).message}`,
        voiceId,
        prompt
      };
    }
  }

  /**
   * Integration method for SystemIntegrationCoordinator
   * Process content with integrated routing decision
   */
  async processWithIntegratedRouting(
    content: string, 
    routingDecision: any, 
    context: any
  ): Promise<any> {
    try {
      const startTime = Date.now();
      
      // Extract voice selection from routing decision
      const voiceSelection = routingDecision.voiceSelection;
      const selectedVoices = voiceSelection.selectedVoice 
        ? [voiceSelection.selectedVoice] 
        : (voiceSelection.alternatives || ['maintainer']).slice(0, this.config.maxConcurrentVoices);
      
      // Determine processing mode based on routing strategy
      let processingMode: 'competitive' | 'collaborative' | 'consensus' = 'collaborative';
      if (routingDecision.routingStrategy === 'multi-voice-collaborative') {
        processingMode = 'collaborative';
      } else if (routingDecision.routingStrategy === 'multi-voice-competitive') {
        processingMode = 'competitive';
      } else if (routingDecision.routingStrategy.includes('consensus')) {
        processingMode = 'consensus';
      }
      
      // Build enhanced context from integration context and routing decision
      const enhancedContext = {
        ...context,
        routingDecision,
        mode: processingMode,
        phase: context.phase || 'synthesis',
        priority: context.priority || 'medium',
        qualityTarget: routingDecision.estimatedQuality || 0.7,
        latencyBudget: routingDecision.estimatedLatency || 30000,
        costBudget: routingDecision.estimatedCost || 0.1
      };
      
      let result;
      
      // Use appropriate processing method based on voice count
      if (selectedVoices.length === 1) {
        // Single voice processing
        result = await this.generateSingleVoiceResponse(
          selectedVoices[0], 
          content, 
          enhancedContext?.modelClient
        );
      } else {
        // Multi-voice processing
        result = await this.generateMultiVoiceSolutions(
          selectedVoices, 
          content, 
          enhancedContext
        );
        
        // If we got multiple results, synthesize them
        if (Array.isArray(result) && result.length > 1) {
          result = await this.synthesizeMultipleResults(result, processingMode);
        } else if (Array.isArray(result) && result.length === 1) {
          result = result[0];
        }
      }
      
      // Record integration metrics
      const processingTime = Date.now() - startTime;
      this.recordIntegrationMetrics({
        content,
        routingDecision,
        selectedVoices,
        processingTime,
        processingMode,
        success: !!result
      });
      
      // Return enhanced result with integration metadata
      return {
        content: result?.content || result || content,
        voicesUsed: selectedVoices,
        routingStrategy: routingDecision.routingStrategy,
        processingMode,
        confidence: result?.confidence || voiceSelection.confidence || 0.7,
        processingTime,
        qualityScore: this.calculateQualityScore(result),
        metadata: {
          integrationMethod: 'processWithIntegratedRouting',
          routingId: routingDecision.routingId,
          systemType: this.currentSystem,
          optimizationsUsed: this.getActiveOptimizations(),
          timestamp: Date.now()
        }
      };
      
    } catch (error) {
      logger.error('Failed to process with integrated routing:', error);
      
      // Fallback processing
      return await this.processWithFallback(content, context);
    }
  }
  
  /**
   * Synthesize multiple voice results based on processing mode
   */
  private async synthesizeMultipleResults(results: any[], mode: string): Promise<any> {
    if (!results || results.length === 0) {
      return null;
    }
    
    if (results.length === 1) {
      return results[0];
    }
    
    switch (mode) {
      case 'competitive':
        // Return the highest confidence result
        return results.reduce((best, current) => 
          (current.confidence || 0) > (best.confidence || 0) ? current : best
        );
        
      case 'consensus':
        // Attempt to find common elements and synthesize
        return this.synthesizeConsensus(results);
        
      case 'collaborative':
      default:
        // Synthesize all results collaboratively
        return await this.synthesize(
          results.map(r => r.content).join('\n\n'),
          results.map((r, i) => r.voiceId || `voice-${i}`),
          'collaborative'
        );
    }
  }
  
  /**
   * Process content with fallback method
   */
  private async processWithFallback(content: string, context: any): Promise<any> {
    try {
      // Use the legacy system or basic processing
      const activeSystem = this.getActiveSystem();
      
      if (activeSystem.generateSingleVoiceResponse) {
        return await activeSystem.generateSingleVoiceResponse(
          'maintainer', // Safe fallback voice
          content,
          context?.modelClient
        );
      }
      
      // Ultimate fallback - return content with minimal processing
      return {
        content: `Processed: ${content}`,
        voicesUsed: ['fallback'],
        confidence: 0.5,
        fallback: true,
        processingMode: 'fallback'
      };
      
    } catch (error) {
      logger.error('Fallback processing also failed:', error);
      
      return {
        content: content,
        error: 'Processing failed',
        voicesUsed: [],
        confidence: 0,
        fallback: true
      };
    }
  }
  
  /**
   * Record integration metrics for monitoring
   */
  private recordIntegrationMetrics(metrics: any): void {
    this.systemMetrics.totalRequests++;
    
    if (this.analytics) {
      // Record integration metrics using available method or store them internally
      try {
        if (typeof this.analytics.recordMetrics === 'function') {
          this.analytics.recordMetrics({
            voiceId: metrics.selectedVoices?.[0] || 'unknown',
            timestamp: new Date(),
            responseTime: metrics.processingTime || 0,
            tokenUsage: 0,
            qualityScore: 0.7,
            confidenceLevel: 0.7,
            taskComplexity: 'moderate',
            success: metrics.success || false,
            costEstimate: 0.01
          } as any);
        }
      } catch (error) {
        // Silently handle analytics errors
        logger.debug('Failed to record integration metrics', { error: error.message });
      }
    }
  }
  
  /**
   * Calculate quality score for result
   */
  private calculateQualityScore(result: any): number {
    if (!result) return 0;
    
    if (typeof result.confidence === 'number') {
      return result.confidence;
    }
    
    // Fallback quality assessment
    const contentLength = (result.content || '').length;
    if (contentLength > 500) return 0.8;
    if (contentLength > 100) return 0.6;
    return 0.4;
  }
  
  /**
   * Get active optimizations for metadata
   */
  private getActiveOptimizations(): string[] {
    const optimizations: string[] = [];
    
    if (this.config.enableDynamicSelection && this.dynamicSelector) {
      optimizations.push('dynamic_selection');
    }
    if (this.config.enableModeOptimization && this.modeOptimizer) {
      optimizations.push('mode_optimization');
    }
    if (this.config.enableHierarchicalMemory && this.voiceMemory) {
      optimizations.push('hierarchical_memory');
    }
    if (this.config.enableAdvancedCoordination && this.coordinator) {
      optimizations.push('advanced_coordination');
    }
    
    return optimizations;
  }
  
  /**
   * Synthesize consensus from multiple results
   */
  private synthesizeConsensus(results: any[]): any {
    // Find common themes and synthesize
    const contents = results.map(r => r.content || '').filter(c => c.length > 0);
    const avgConfidence = results.reduce((sum, r) => sum + (r.confidence || 0), 0) / results.length;
    
    return {
      content: contents.join('\n\n--- CONSENSUS SYNTHESIS ---\n'),
      confidence: avgConfidence,
      voicesUsed: results.map((r, i) => r.voiceId || `voice-${i}`),
      synthesisMode: 'consensus',
      originalResults: results
    };
  }

  /**
   * Initialize the voice system integration
   */
  async initialize(): Promise<void> {
    // Initialize optimized system if needed
    if (!this.optimizedSystem && this.config.useOptimizedSystem) {
      this.optimizedSystem = new OptimizedVoiceSystem2025(
        undefined, // modelClient not available in this context
        this.config
      );
    }

    // Initialize analytics if enabled
    if (this.config.enablePerformanceAnalytics && !this.analytics) {
      this.analytics = new VoicePerformanceAnalytics2025();
    }

    // Initialize coordinator if needed
    if (this.config.enableAdvancedCoordination && !this.coordinator) {
      this.coordinator = new AdvancedVoiceCoordinator2025();
    }
  }
}

/**
 * Factory function for creating integrated voice system
 */
export function createIntegratedVoiceSystem(
  modelClient?: any, 
  config?: Partial<VoiceSystemConfig>
): VoiceSystemIntegration2025 {
  return new VoiceSystemIntegration2025(modelClient, config);
}

/**
 * Utility function for automatic system selection based on requirements
 */
export async function selectOptimalVoiceSystem(
  requirements: {
    performance?: 'fast' | 'balanced' | 'quality';
    costConstraint?: 'low' | 'medium' | 'high';
    reliability?: 'basic' | 'high' | 'critical';
  },
  modelClient?: any
): Promise<VoiceSystemIntegration2025> {
  const config: Partial<VoiceSystemConfig> = {};
  
  // Configure based on requirements
  if (requirements.performance === 'fast') {
    config.maxConcurrentVoices = 2;
    config.enableModeOptimization = true;
    config.performanceThreshold = 3000;
  } else if (requirements.performance === 'quality') {
    config.maxConcurrentVoices = 3;
    config.enableAdvancedCoordination = true;
    config.qualityThreshold = 0.8;
  }
  
  if (requirements.costConstraint === 'low') {
    config.enableDynamicSelection = true;
    config.enableModeOptimization = true;
    config.costThreshold = 0.05;
  }
  
  if (requirements.reliability === 'critical') {
    config.fallbackToLegacy = true;
    config.enablePerformanceAnalytics = true;
    config.enableAutoOptimization = true;
  }
  
  return new VoiceSystemIntegration2025(modelClient, config);
}