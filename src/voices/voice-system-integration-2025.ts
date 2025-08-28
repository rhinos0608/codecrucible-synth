/**
 * Voice System Integration 2025
 * Modern wrapper for voice archetype system integration
 */

import { VoiceArchetypeSystem } from './voice-archetype-system.js';
import { logger } from '../core/logger.js';

export interface VoiceSystemConfig {
  useOptimizedSystem?: boolean;
  fallbackToLegacy?: boolean;
  maxConcurrentVoices?: number;
  enablePerformanceMonitoring?: boolean;
  voiceSelectionStrategy?: 'random' | 'round-robin' | 'adaptive';
}

export class VoiceSystemIntegration2025 {
  private voiceArchetypeSystem: VoiceArchetypeSystem;
  private config: VoiceSystemConfig;
  private initialized: boolean = false;

  constructor(modelClient: any = null, config: VoiceSystemConfig = {}) {
    this.config = {
      useOptimizedSystem: true,
      fallbackToLegacy: true,
      maxConcurrentVoices: 3,
      enablePerformanceMonitoring: false,
      voiceSelectionStrategy: 'adaptive',
      ...config
    };

    // Initialize with the actual voice archetype system
    this.voiceArchetypeSystem = new VoiceArchetypeSystem(modelClient, {
      logger: console // Simple logger for now
    });
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Voice System Integration 2025');
      
      // Initialize the underlying voice system if it has an initialize method
      if (this.voiceArchetypeSystem.initialize) {
        await this.voiceArchetypeSystem.initialize();
      }

      this.initialized = true;
      logger.info('Voice System Integration 2025 initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Voice System Integration 2025:', error);
      throw error;
    }
  }

  async synthesizeVoices(request: string, context: any = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Use the underlying voice system for synthesis
      if (this.voiceArchetypeSystem.synthesizeMultipleVoices) {
        return await this.voiceArchetypeSystem.synthesizeMultipleVoices(request, context);
      }

      // Fallback to basic voice processing
      return await this.basicVoiceSynthesis(request, context);
    } catch (error) {
      logger.error('Voice synthesis failed:', error);
      
      if (this.config.fallbackToLegacy) {
        logger.info('Falling back to legacy voice processing');
        return await this.basicVoiceSynthesis(request, context);
      }
      
      throw error;
    }
  }

  async selectVoices(criteria: any = {}): Promise<string[]> {
    const availableVoices = this.getAvailableVoices();
    const maxVoices = Math.min(
      this.config.maxConcurrentVoices || 3,
      availableVoices.length
    );

    switch (this.config.voiceSelectionStrategy) {
      case 'random':
        return this.selectRandomVoices(availableVoices, maxVoices);
      case 'round-robin':
        return this.selectRoundRobinVoices(availableVoices, maxVoices);
      case 'adaptive':
      default:
        return this.selectAdaptiveVoices(availableVoices, maxVoices, criteria);
    }
  }

  getAvailableVoices(): string[] {
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
      'guardian'
    ];
  }

  getSystemStatus(): any {
    return {
      initialized: this.initialized,
      config: this.config,
      availableVoices: this.getAvailableVoices().length,
      performance: this.getPerformanceMetrics()
    };
  }

  // Private methods
  private async basicVoiceSynthesis(request: string, context: any): Promise<any> {
    const selectedVoices = await this.selectVoices(context);
    
    return {
      request,
      voices: selectedVoices,
      synthesis: `Basic voice synthesis completed with ${selectedVoices.length} voices`,
      timestamp: Date.now(),
      fallback: true
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

  private selectAdaptiveVoices(voices: string[], count: number, criteria: any): string[] {
    // Adaptive selection based on criteria
    const priorities = this.calculateVoicePriorities(voices, criteria);
    return priorities
      .sort((a, b) => b.priority - a.priority)
      .slice(0, count)
      .map(v => v.voice);
  }

  private calculateVoicePriorities(voices: string[], criteria: any): Array<{voice: string, priority: number}> {
    return voices.map(voice => ({
      voice,
      priority: this.calculateVoicePriority(voice, criteria)
    }));
  }

  private calculateVoicePriority(voice: string, criteria: any): number {
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

  private getPerformanceMetrics(): any {
    if (!this.config.enablePerformanceMonitoring) {
      return { enabled: false };
    }

    return {
      enabled: true,
      synthesisCount: 0, // Would track actual usage
      averageResponseTime: 0,
      errorRate: 0,
      lastActivity: Date.now()
    };
  }
}