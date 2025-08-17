import { SandboxManager } from './sandbox/sandbox-manager.js';
import { ApprovalManager, ApprovalMode } from './approval/approval-manager.js';
import { ProjectMemorySystem } from './memory/project-memory.js';
import { ConversationStore } from './memory/conversation-store.js';
import { HybridModelClient } from './hybrid-model-client.js';
import { PerformanceValidator } from './performance/performance-validator.js';
import { ModelBridgeManager } from './model-bridge/model-bridge-manager.js';
import { GitMCPServer } from '../mcp-servers/git-mcp-server.js';
import { logger } from './logger.js';
import { SynthesisResult } from './response-types.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface IntegrationConfig {
  security: {
    mode: ApprovalMode;
    enableSandbox: boolean;
    disableApproval: boolean;
  };
  hybrid: {
    enabled: boolean;
    autoLoadConfig: boolean;
    enableFallback: boolean;
    enableLearning: boolean;
  };
  memory: {
    enabled: boolean;
    projectContext: boolean;
    conversationPersistence: boolean;
  };
  performance: {
    enableValidation: boolean;
    enableBenchmarking: boolean;
    enableOptimization: boolean;
  };
  mcp: {
    enabledServers: string[];
    autoRegister: boolean;
  };
}

export interface EnhancedSynthesisOptions {
  taskType?: string;
  complexity?: 'simple' | 'medium' | 'complex';
  securityMode?: ApprovalMode;
  enableSandbox?: boolean;
  streaming?: boolean;
  forceLLM?: 'lmstudio' | 'ollama';
  saveToMemory?: boolean;
}

export interface EnhancedSynthesisResult extends SynthesisResult {
  llmUsed?: 'lmstudio' | 'ollama' | 'escalated';
  routing?: {
    decision: string;
    confidence: number;
    reasoning: string;
  };
  security?: {
    approved: boolean;
    mode: ApprovalMode;
    restrictions?: string[];
  };
  performance?: {
    latency: number;
    fromCache: boolean;
    optimization: string;
  };
  memory?: {
    contextUsed: boolean;
    similarInteractions: number;
    stored: boolean;
  };
}

/**
 * Integration Manager for all enhanced CodeCrucible systems
 * Coordinates security, hybrid LLM, memory, and performance systems
 */
export class IntegrationManager {
  private config: IntegrationConfig;
  private sandboxManager?: SandboxManager;
  private approvalManager?: ApprovalManager;
  private projectMemory?: ProjectMemorySystem;
  private conversationStore?: ConversationStore;
  private hybridClient?: HybridModelClient;
  private performanceValidator?: PerformanceValidator;
  private modelBridge?: ModelBridgeManager;
  private mcpServers = new Map<string, any>();
  private workspaceRoot: string;
  private sessionId: string;

  constructor(workspaceRoot: string, config: Partial<IntegrationConfig> = {}) {
    this.workspaceRoot = workspaceRoot;
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.config = {
      security: {
        mode: config.security?.mode || ApprovalMode.WORKSPACE_WRITE,
        enableSandbox: config.security?.enableSandbox ?? true,
        disableApproval: config.security?.disableApproval ?? false
      },
      hybrid: {
        enabled: config.hybrid?.enabled ?? true,
        autoLoadConfig: config.hybrid?.autoLoadConfig ?? true,
        enableFallback: config.hybrid?.enableFallback ?? true,
        enableLearning: config.hybrid?.enableLearning ?? true
      },
      memory: {
        enabled: config.memory?.enabled ?? true,
        projectContext: config.memory?.projectContext ?? true,
        conversationPersistence: config.memory?.conversationPersistence ?? true
      },
      performance: {
        enableValidation: config.performance?.enableValidation ?? false,
        enableBenchmarking: config.performance?.enableBenchmarking ?? false,
        enableOptimization: config.performance?.enableOptimization ?? true
      },
      mcp: {
        enabledServers: config.mcp?.enabledServers || ['git', 'filesystem'],
        autoRegister: config.mcp?.autoRegister ?? true
      }
    };

    logger.info('Integration manager initialized', {
      workspaceRoot,
      sessionId: this.sessionId,
      config: this.config
    });
  }

  /**
   * Initialize all systems based on configuration
   */
  async initialize(): Promise<void> {
    const startTime = Date.now();
    logger.info('Initializing enhanced CodeCrucible systems...');

    try {
      // Initialize security systems
      if (!this.config.security.disableApproval) {
        this.approvalManager = new ApprovalManager();
        this.approvalManager.setMode(this.config.security.mode);
        logger.debug('Approval manager initialized');
      }

      if (this.config.security.enableSandbox) {
        this.sandboxManager = new SandboxManager();
        logger.debug('Sandbox manager initialized');
      }

      // Initialize memory systems
      if (this.config.memory.enabled) {
        if (this.config.memory.projectContext) {
          this.projectMemory = new ProjectMemorySystem(this.workspaceRoot);
          logger.debug('Project memory system initialized');
        }

        if (this.config.memory.conversationPersistence) {
          this.conversationStore = new ConversationStore(this.workspaceRoot);
          await this.conversationStore.initialize();
          await this.conversationStore.startSession(this.workspaceRoot, 'CodeCrucible-Integration');
          logger.debug('Conversation store initialized');
        }
      }

      // Initialize hybrid LLM system
      if (this.config.hybrid.enabled) {
        this.hybridClient = new HybridModelClient({
          autoLoadConfig: this.config.hybrid.autoLoadConfig,
          enableFallback: this.config.hybrid.enableFallback,
          enableLearning: this.config.hybrid.enableLearning
        });
        logger.debug('Hybrid model client initialized');
      }

      // Initialize model bridge
      this.modelBridge = new ModelBridgeManager(this.workspaceRoot);
      await this.modelBridge.initialize();
      logger.debug('Model bridge manager initialized');

      // Initialize performance systems
      if (this.config.performance.enableValidation || this.config.performance.enableBenchmarking) {
        this.performanceValidator = new PerformanceValidator();
        logger.debug('Performance validator initialized');
      }

      // Initialize MCP servers
      if (this.config.mcp.autoRegister) {
        await this.initializeMCPServers();
      }

      const duration = Date.now() - startTime;
      logger.info(`Enhanced CodeCrucible systems initialized in ${duration}ms`);

    } catch (error) {
      logger.error('Failed to initialize enhanced systems:', error);
      throw error;
    }
  }

  /**
   * Enhanced synthesis with all integrated systems
   */
  async enhancedSynthesis(
    prompt: string, 
    options: EnhancedSynthesisOptions = {}
  ): Promise<EnhancedSynthesisResult> {
    const startTime = Date.now();
    
    logger.info('Starting enhanced synthesis', {
      prompt: prompt.substring(0, 100),
      options,
      sessionId: this.sessionId
    });

    try {
      // Load project context if enabled
      let projectContext: any = {};
      let contextRecommendations: any = {};
      
      if (this.config.memory.projectContext && this.projectMemory) {
        projectContext = await this.projectMemory.loadProjectContext();
        contextRecommendations = await this.projectMemory.getContextRecommendations(prompt);
        
        logger.debug('Project context loaded', {
          guidance: projectContext.guidance?.length || 0,
          patterns: projectContext.patterns?.length || 0,
          history: projectContext.history?.length || 0
        });
      }

      // Find similar past interactions
      let similarInteractions: any[] = [];
      if (this.config.memory.conversationPersistence && this.conversationStore) {
        similarInteractions = await this.conversationStore.searchInteractions({
          text: prompt,
          limit: 3,
          minConfidence: 0.6
        });
        
        logger.debug(`Found ${similarInteractions.interactions?.length || 0} similar interactions`);
      }

      // Build enhanced prompt with context
      const enhancedPrompt = this.buildEnhancedPrompt(
        prompt, 
        projectContext, 
        contextRecommendations, 
        similarInteractions.interactions || []
      );

      // Security approval if enabled
      let securityResult: any = { approved: true, mode: this.config.security.mode };
      
      if (this.approvalManager && !this.config.security.disableApproval) {
        const operation = {
          type: 'code-generation',
          target: 'synthesis request',
          description: `Generate code for: ${prompt.substring(0, 100)}...`,
          metadata: { taskType: options.taskType, complexity: options.complexity }
        };

        const context = {
          sandboxMode: options.securityMode || this.config.security.mode,
          workspaceRoot: this.workspaceRoot,
          userIntent: prompt,
          sessionId: this.sessionId
        };

        const approval = await this.approvalManager.requestApproval(operation, context);
        securityResult = {
          approved: approval.granted,
          mode: approval.mode || this.config.security.mode,
          restrictions: approval.restrictions
        };

        if (!approval.granted) {
          throw new Error(`Operation not approved: ${approval.reason}`);
        }
      }

      // Generate with hybrid client or fallback
      let synthesisResult: any;
      let routingInfo: any;

      if (this.hybridClient && this.config.hybrid.enabled) {
        const hybridResult = await this.hybridClient.generateCode(enhancedPrompt, [], {
          taskType: options.taskType,
          complexity: options.complexity,
          forceLLM: options.forceLLM,
          streaming: options.streaming
        });

        synthesisResult = {
          synthesis: hybridResult.code,
          reasoning: { steps: [hybridResult.explanation] },
          confidence: hybridResult.confidence,
          latency: hybridResult.latency,
          voicesUsed: [hybridResult.llmUsed || 'hybrid'],
          modelUsed: hybridResult.llmUsed
        };

        routingInfo = {
          decision: hybridResult.llmUsed,
          confidence: hybridResult.confidence,
          reasoning: hybridResult.reasoning || 'Hybrid routing decision'
        };

      } else {
        // Fallback to basic synthesis
        synthesisResult = {
          synthesis: `// Enhanced synthesis not available\n// Prompt: ${prompt}\n// Please check hybrid LLM configuration`,
          reasoning: { steps: ['Hybrid system unavailable, using fallback'] },
          confidence: 0.3,
          latency: Date.now() - startTime,
          voicesUsed: ['fallback'],
          modelUsed: 'fallback'
        };

        routingInfo = {
          decision: 'fallback',
          confidence: 0.3,
          reasoning: 'Hybrid client not available'
        };
      }

      // Store interaction in memory if enabled
      let memoryInfo: any = { stored: false };
      
      if (this.config.memory.conversationPersistence && this.conversationStore && options.saveToMemory !== false) {
        try {
          await this.conversationStore.storeInteraction(
            prompt,
            synthesisResult,
            projectContext,
            this.sessionId
          );
          
          memoryInfo = {
            contextUsed: Object.keys(projectContext).length > 0,
            similarInteractions: similarInteractions.interactions?.length || 0,
            stored: true
          };
        } catch (error) {
          logger.warn('Failed to store interaction in memory:', error);
        }
      }

      // Update project memory with new interaction
      if (this.config.memory.projectContext && this.projectMemory) {
        try {
          await this.projectMemory.storeInteraction(
            prompt,
            synthesisResult,
            projectContext
          );
        } catch (error) {
          logger.warn('Failed to update project memory:', error);
        }
      }

      const totalLatency = Date.now() - startTime;

      const result: EnhancedSynthesisResult = {
        ...synthesisResult,
        llmUsed: routingInfo.decision,
        routing: routingInfo,
        security: securityResult,
        performance: {
          latency: totalLatency,
          fromCache: false,
          optimization: this.config.hybrid.enabled ? 'hybrid-routing' : 'single-llm'
        },
        memory: memoryInfo
      };

      logger.info('Enhanced synthesis completed', {
        latency: totalLatency,
        confidence: result.confidence,
        llmUsed: result.llmUsed,
        approved: securityResult.approved,
        stored: memoryInfo.stored
      });

      return result;

    } catch (error) {
      const errorLatency = Date.now() - startTime;
      logger.error('Enhanced synthesis failed:', error);

      return {
        synthesis: `// Error in enhanced synthesis: ${error instanceof Error ? error.message : 'Unknown error'}`,
        reasoning: { steps: ['Enhanced synthesis failed'] },
        confidence: 0,
        latency: errorLatency,
        voicesUsed: ['error'],
        modelUsed: 'error',
        security: { approved: false, mode: this.config.security.mode },
        performance: { latency: errorLatency, fromCache: false, optimization: 'error' },
        memory: { stored: false }
      };
    }
  }

  /**
   * Run performance validation
   */
  async validatePerformance(): Promise<any> {
    if (!this.performanceValidator) {
      throw new Error('Performance validator not initialized');
    }

    logger.info('Running performance validation...');
    return await this.performanceValidator.validateDocumentationClaims();
  }

  /**
   * Get comprehensive system status
   */
  async getSystemStatus(): Promise<{
    security: any;
    hybrid: any;
    memory: any;
    performance: any;
    mcp: any;
    modelBridge: any;
  }> {
    const status = {
      security: {
        approval: this.approvalManager ? 'enabled' : 'disabled',
        sandbox: this.sandboxManager ? 'enabled' : 'disabled',
        mode: this.config.security.mode
      },
      hybrid: {
        enabled: this.config.hybrid.enabled,
        client: this.hybridClient ? await this.hybridClient.getStatus() : null
      },
      memory: {
        project: this.projectMemory ? 'enabled' : 'disabled',
        conversation: this.conversationStore ? 'enabled' : 'disabled'
      },
      performance: {
        validator: this.performanceValidator ? 'enabled' : 'disabled',
        validation: this.config.performance.enableValidation,
        benchmarking: this.config.performance.enableBenchmarking
      },
      mcp: {
        servers: Array.from(this.mcpServers.keys()),
        enabled: this.config.mcp.enabledServers
      },
      modelBridge: this.modelBridge ? await this.modelBridge.getProviderHealth() : null
    };

    return status;
  }

  /**
   * Build enhanced prompt with all available context
   */
  private buildEnhancedPrompt(
    originalPrompt: string,
    projectContext: any,
    recommendations: any,
    similarInteractions: any[]
  ): string {
    const contextParts: string[] = [];

    // Add project guidance if available
    if (projectContext.guidance) {
      contextParts.push(`Project Context:\n${projectContext.guidance}`);
    }

    // Add relevant patterns
    if (recommendations.relevantPatterns?.length > 0) {
      const patterns = recommendations.relevantPatterns
        .slice(0, 3)
        .map((p: any) => `- ${p.name}: ${p.description}`)
        .join('\n');
      contextParts.push(`Relevant Patterns:\n${patterns}`);
    }

    // Add constraints
    if (projectContext.constraints?.length > 0) {
      contextParts.push(`Constraints:\n${projectContext.constraints.join('\n')}`);
    }

    // Add similar interactions
    if (similarInteractions.length > 0) {
      const similar = similarInteractions
        .slice(0, 2)
        .map((interaction: any, i: number) => 
          `${i + 1}. Q: ${interaction.prompt}\n   A: ${interaction.response.substring(0, 200)}...`
        )
        .join('\n');
      contextParts.push(`Previous Similar Interactions:\n${similar}`);
    }

    // Add suggested voices if available
    if (recommendations.suggestedVoices?.length > 0) {
      contextParts.push(`Suggested Approach: ${recommendations.suggestedVoices.join(', ')}`);
    }

    // Combine all context
    if (contextParts.length > 0) {
      return `${contextParts.join('\n\n')}\n\n---\n\nCurrent Request: ${originalPrompt}`;
    }

    return originalPrompt;
  }

  /**
   * Initialize MCP servers based on configuration
   */
  private async initializeMCPServers(): Promise<void> {
    const enabledServers = this.config.mcp.enabledServers;

    if (enabledServers.includes('git') && this.approvalManager) {
      const gitServer = new GitMCPServer(this.approvalManager, this.workspaceRoot);
      this.mcpServers.set('git', gitServer);
      logger.debug('Git MCP server registered');
    }

    // Add other MCP servers as they're implemented
    // if (enabledServers.includes('filesystem')) { ... }
    // if (enabledServers.includes('package-manager')) { ... }

    logger.info(`Initialized ${this.mcpServers.size} MCP servers`);
  }

  /**
   * Update configuration dynamically
   */
  updateConfiguration(newConfig: Partial<IntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.approvalManager && newConfig.security?.mode) {
      this.approvalManager.setMode(newConfig.security.mode);
    }

    logger.info('Configuration updated', { newConfig });
  }

  /**
   * Cleanup all resources
   */
  async dispose(): Promise<void> {
    const cleanupPromises: Promise<void>[] = [];

    if (this.conversationStore) {
      cleanupPromises.push(this.conversationStore.endSession(this.sessionId));
      cleanupPromises.push(this.conversationStore.dispose());
    }

    if (this.projectMemory) {
      cleanupPromises.push(this.projectMemory.dispose());
    }

    if (this.modelBridge) {
      cleanupPromises.push(this.modelBridge.dispose());
    }

    if (this.performanceValidator) {
      cleanupPromises.push(this.performanceValidator.dispose());
    }

    if (this.approvalManager) {
      this.approvalManager.dispose();
    }

    if (this.sandboxManager) {
      cleanupPromises.push(this.sandboxManager.cleanupAll());
    }

    await Promise.all(cleanupPromises);
    
    logger.info('Integration manager disposed');
  }
}