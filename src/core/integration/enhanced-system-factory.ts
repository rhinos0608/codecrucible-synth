/**
 * Enhanced System Factory
 * Creates and configures fully integrated system with all enhancements
 */

import { UnifiedModelClient } from '../../refactor/unified-model-client.js';
import { SystemIntegrationCoordinator } from './system-integration-coordinator.js';
import { EnterpriseSecurityFramework } from '../security/enterprise-security-framework.js';
import { ReconstructedCodeQualityAnalyzer as CodeQualityAnalyzer } from '../quality/reconstructed-code-quality-analyzer.js';
import { VoiceArchetypeSystem } from '../../voices/voice-archetype-system.js';
import { SequentialDualAgentSystem } from '../collaboration/sequential-dual-agent-system.js';
import { logger } from '../logger.js';

export interface EnhancedSystemConfig {
  security: {
    enabled: boolean;
    riskThreshold: number;
    auditEnabled: boolean;
  };
  quality: {
    enabled: boolean;
    enforceGates: boolean;
    autoFix: boolean;
    thresholds: {
      complexity: number;
      maintainability: number;
      overall: number;
    };
  };
  voice: {
    enabled: boolean;
    maxVoices: number;
    collaborationMode: 'sequential' | 'parallel';
  };
  spiral: {
    enabled: boolean;
    maxIterations: number;
    convergenceThreshold: number;
  };
}

export interface EnhancedSystemInstance {
  coordinator: SystemIntegrationCoordinator;
  modelClient: UnifiedModelClient;
  securityFramework?: EnterpriseSecurityFramework;
  qualityAnalyzer?: CodeQualityAnalyzer;
  voiceSystem?: VoiceArchetypeSystem;
  sequentialAgentSystem?: SequentialDualAgentSystem;
  
  // Integrated methods
  processRequest: (request: any) => Promise<any>;
  getSystemHealth: () => Promise<any>;
  shutdown: () => Promise<void>;
}

/**
 * Factory to create fully integrated enhanced system
 */
export class EnhancedSystemFactory {
  private static instance: EnhancedSystemInstance | null = null;

  /**
   * Create or get singleton instance of enhanced system
   */
  static async createEnhancedSystem(
    modelClient: UnifiedModelClient,
    config?: Partial<EnhancedSystemConfig>
  ): Promise<EnhancedSystemInstance> {
    if (this.instance) {
      return this.instance;
    }

    logger.info('🚀 Creating enhanced system with full integration');

    const defaultConfig: EnhancedSystemConfig = {
      security: {
        enabled: true,
        riskThreshold: 75,
        auditEnabled: true
      },
      quality: {
        enabled: true,
        enforceGates: true,
        autoFix: false,
        thresholds: {
          complexity: 20,
          maintainability: 70,
          overall: 80
        }
      },
      voice: {
        enabled: true,
        maxVoices: 3,
        collaborationMode: 'sequential'
      },
      spiral: {
        enabled: true,
        maxIterations: 5,
        convergenceThreshold: 0.85
      }
    };

    const finalConfig = { ...defaultConfig, ...config };

    try {
      // Create system integration coordinator
      const coordinator = SystemIntegrationCoordinator.getInstance();
      
      // Initialize all integrated systems
      await coordinator.initializeIntegratedSystems();

      // Create additional systems for direct access
      const securityFramework = finalConfig.security.enabled ? new EnterpriseSecurityFramework() : undefined;
      const qualityAnalyzer = finalConfig.quality.enabled ? new CodeQualityAnalyzer({
        quality: {
          maintainability: {
            excellent: 80,
            acceptable: 60,
            problematic: 40,
            critical: 20
          },
          weights: {
            complexity: 0.25,
            maintainability: 0.20,
            linting: 0.15,
            formatting: 0.10,
            typeScript: 0.15,
            documentation: 0.10,
            security: 0.05,
          }
        },
        performance: {},
        tools: {},
        analysis: {}
      }) : undefined;

      const voiceSystem = finalConfig.voice.enabled ? new VoiceArchetypeSystem(modelClient) : undefined;
      const sequentialAgentSystem = finalConfig.voice.collaborationMode === 'sequential' 
        ? new SequentialDualAgentSystem() 
        : undefined;

      this.instance = {
        coordinator,
        modelClient,
        securityFramework,
        qualityAnalyzer,
        voiceSystem,
        sequentialAgentSystem,

        // Integrated processing method
        processRequest: async (request: any) => {
          return await coordinator.processIntegratedRequest({
            id: request.id || `req-${Date.now()}`,
            type: request.type || 'generation',
            content: request.content || request.prompt,
            context: {
              phase: request.phase,
              iteration: request.iteration,
              previousResults: request.previousResults,
              routingStrategy: request.routingStrategy,
              voiceSelectionCriteria: request.voiceSelectionCriteria,
              mcpCapabilityRequirements: request.mcpCapabilityRequirements,
              performanceTargets: request.performanceTargets,
              errorRecoveryOptions: request.errorRecoveryOptions
            },
            priority: request.priority || 'medium',
            constraints: request.constraints
          });
        },

        // System health monitoring
        getSystemHealth: async () => {
          return await coordinator.getSystemHealth();
        },

        // Graceful shutdown
        shutdown: async () => {
          logger.info('🛑 Shutting down enhanced system');
          // The coordinator handles coordinated shutdown
          this.instance = null;
        }
      };

      logger.info('✅ Enhanced system created successfully with full integration');
      return this.instance;

    } catch (error) {
      logger.error('❌ Failed to create enhanced system:', error);
      throw new Error(`Enhanced system creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get existing instance (returns null if not created)
   */
  static getInstance(): EnhancedSystemInstance | null {
    return this.instance;
  }

  /**
   * Force reset instance (for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }
}

/**
 * Convenience function to get or create enhanced system
 */
export async function getEnhancedSystem(
  modelClient?: UnifiedModelClient,
  config?: Partial<EnhancedSystemConfig>
): Promise<EnhancedSystemInstance> {
  const existing = EnhancedSystemFactory.getInstance();
  if (existing) {
    return existing;
  }

  if (!modelClient) {
    throw new Error('ModelClient is required for first initialization of enhanced system');
  }

  return await EnhancedSystemFactory.createEnhancedSystem(modelClient, config);
}

/**
 * Create enhanced request from simple prompt
 */
export function createEnhancedRequest(
  prompt: string,
  options?: {
    type?: 'analysis' | 'generation' | 'execution' | 'orchestration';
    phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
    iteration?: number;
    priority?: 'low' | 'medium' | 'high' | 'critical';
  }
) {
  return {
    id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    content: prompt,
    type: options?.type || 'generation',
    phase: options?.phase,
    iteration: options?.iteration || 1,
    priority: options?.priority || 'medium',
    context: {
      timestamp: new Date().toISOString(),
      enhanced: true
    }
  };
}

// Types are already exported via the interface declarations above