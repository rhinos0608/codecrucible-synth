/**
 * Context Preservation System
 * 
 * Addresses Issues #5 & #12: Context Passing Inconsistencies
 * 
 * This system ensures that context information is correctly preserved
 * and consistently passed between the 4 major systems without loss
 * of critical information or state corruption.
 */

import { EventEmitter } from 'events';
import { logger } from '../logger.js';
import {
  UnifiedRequestContext,
  SystemResult,
  ContextPreservation,
  ContextChange,
  ContextIntegrity,
  UnifiedStateSnapshot,
  ValidationResult,
} from './unified-data-models.js';

/**
 * Context Preservation Manager
 * Central system for managing context flow across system boundaries
 */
export class ContextPreservationSystem extends EventEmitter {
  private static instance: ContextPreservationSystem | null = null;
  
  // Context tracking
  private contextHistory: Map<string, ContextPreservation[]> = new Map();
  private activeContexts: Map<string, UnifiedRequestContext> = new Map();
  private contextSnapshots: Map<string, ContextSnapshot> = new Map();
  
  // Context validation
  private contextValidators: Map<string, ContextValidator> = new Map();
  private integrityCheckers: Map<string, IntegrityChecker> = new Map();
  
  // Context transformation
  private contextAdapters: Map<string, ContextAdapter> = new Map();
  private preservationRules: Map<string, PreservationRule[]> = new Map();
  
  // Performance tracking
  private preservationMetrics: PreservationMetrics;
  
  private constructor() {
    super();
    
    this.preservationMetrics = {
      totalContexts: 0,
      successfulPreservations: 0,
      contextLosses: 0,
      averagePreservationQuality: 0,
      integrationQualityScores: new Map(),
      systemPreservationRates: new Map(),
    };
    
    this.initializeDefaultValidators();
    this.initializeDefaultAdapters();
    this.initializeDefaultRules();
  }
  
  static getInstance(): ContextPreservationSystem {
    if (!ContextPreservationSystem.instance) {
      ContextPreservationSystem.instance = new ContextPreservationSystem();
    }
    return ContextPreservationSystem.instance;
  }
  
  /**
   * Create initial context for a new request
   */
  async createInitialContext(
    requestId: string,
    sessionId: string,
    initialData: any,
    options?: ContextCreationOptions
  ): Promise<UnifiedRequestContext> {
    const context: UnifiedRequestContext = {
      requestId,
      sessionId,
      userId: options?.userId,
      timestamp: Date.now(),
      
      // Initialize Living Spiral context
      phase: options?.phase,
      iteration: options?.iteration || 1,
      spiralHistory: [],
      
      // System tracking
      systemPath: [],
      previousResults: [],
      currentSystemState: {},
      
      // Performance targets
      performanceTargets: {
        maxLatency: options?.maxLatency || 30000,
        minAccuracy: options?.minAccuracy || 0.7,
        maxCost: options?.maxCost || 1.0,
        qualityThreshold: options?.qualityThreshold || 0.8,
      },
      
      // Routing preferences
      routingPreferences: {
        prioritizeSpeed: options?.prioritizeSpeed || false,
        prioritizeQuality: options?.prioritizeQuality || true,
        maxVoices: options?.maxVoices || 3,
        preferredProviders: options?.preferredProviders || [],
        enableHybridRouting: options?.enableHybridRouting || true,
      },
      
      // MCP requirements
      mcpRequirements: {
        capabilities: options?.mcpCapabilities || [],
        minReliability: options?.minReliability || 80,
        maxLatency: options?.mcpMaxLatency || 5000,
        securityLevel: options?.securityLevel || 'standard',
      },
      
      // Error recovery
      errorRecovery: {
        fallbackEnabled: options?.fallbackEnabled !== false,
        retryAttempts: options?.retryAttempts || 3,
        escalateToHuman: options?.escalateToHuman || false,
        allowPartialResults: options?.allowPartialResults || true,
      },
      
      // State management
      stateVersion: this.generateStateVersion(),
      stateLocks: [],
      stateSnapshot: initialData,
    };
    
    // Store context
    this.activeContexts.set(requestId, context);
    
    // Create initial snapshot
    await this.createContextSnapshot(context, 'initial');
    
    // Initialize preservation tracking
    this.contextHistory.set(requestId, []);
    
    logger.info('Initial context created', {
      requestId,
      sessionId,
      phase: context.phase,
      stateVersion: context.stateVersion,
    });
    
    this.emit('context-created', context);
    return context;
  }
  
  /**
   * Preserve context when transitioning between systems
   */
  async preserveContextForSystem(
    context: UnifiedRequestContext,
    sourceSystem: string,
    targetSystem: string,
    systemResult?: SystemResult
  ): Promise<ContextPreservationResult> {
    const preservationId = this.generatePreservationId();
    const startTime = Date.now();
    
    try {
      logger.debug('Preserving context for system transition', {
        requestId: context.requestId,
        sourceSystem,
        targetSystem,
        preservationId,
      });
      
      // Create context snapshot before transformation
      const preSnapshot = await this.createContextSnapshot(context, 'pre-system');
      
      // Get appropriate adapter for system transition
      const adapterKey = `${sourceSystem}->${targetSystem}`;
      const adapter = this.contextAdapters.get(adapterKey);
      
      let adaptedContext: UnifiedRequestContext;
      
      if (adapter) {
        // Apply context adaptation
        adaptedContext = await adapter.adaptContext(context, systemResult);
      } else {
        // Default preservation without adaptation
        adaptedContext = await this.defaultContextPreservation(
          context,
          sourceSystem,
          targetSystem,
          systemResult
        );
      }
      
      // Update system path
      adaptedContext.systemPath = [...context.systemPath, sourceSystem];
      
      // Add previous result if provided
      if (systemResult) {
        adaptedContext.previousResults = [...context.previousResults || [], systemResult];
      }
      
      // Validate adapted context
      const validation = await this.validateContext(adaptedContext, targetSystem);
      if (!validation.valid) {
        throw new Error(`Context validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Create post-adaptation snapshot
      const postSnapshot = await this.createContextSnapshot(adaptedContext, 'post-system');
      
      // Calculate preservation quality
      const preservationQuality = this.calculatePreservationQuality(
        preSnapshot,
        postSnapshot,
        context,
        adaptedContext
      );
      
      // Track context changes
      const contextChanges = this.detectContextChanges(
        context,
        adaptedContext,
        sourceSystem,
        targetSystem
      );
      
      // Create preservation record
      const preservation: ContextPreservation = {
        preservationId,
        originalContext: context,
        contextChanges,
        preservationQuality,
        lostInformation: this.identifyLostInformation(context, adaptedContext),
        addedInformation: this.identifyAddedInformation(context, adaptedContext),
        contextIntegrity: await this.checkContextIntegrity(adaptedContext),
      };
      
      // Store preservation record
      const contextHistory = this.contextHistory.get(context.requestId) || [];
      contextHistory.push(preservation);
      this.contextHistory.set(context.requestId, contextHistory);
      
      // Update active context
      this.activeContexts.set(context.requestId, adaptedContext);
      
      // Update metrics
      this.updatePreservationMetrics(preservation, sourceSystem, targetSystem);
      
      const executionTime = Date.now() - startTime;
      
      const result: ContextPreservationResult = {
        success: true,
        preservedContext: adaptedContext,
        preservationRecord: preservation,
        executionTime,
        qualityScore: preservationQuality,
      };
      
      logger.info('Context preserved successfully', {
        requestId: context.requestId,
        preservationId,
        qualityScore: preservationQuality,
        executionTime,
        changesCount: contextChanges.length,
      });
      
      this.emit('context-preserved', result);
      return result;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Context preservation failed', {
        requestId: context.requestId,
        sourceSystem,
        targetSystem,
        error: errorMessage,
      });
      
      // Record failure
      this.preservationMetrics.contextLosses++;
      
      const result: ContextPreservationResult = {
        success: false,
        error: errorMessage,
        executionTime,
        qualityScore: 0,
      };
      
      this.emit('context-preservation-failed', result, error);
      return result;
    }
  }
  
  /**
   * Validate context for a specific system
   */
  async validateContext(
    context: UnifiedRequestContext,
    targetSystem: string
  ): Promise<ValidationResult> {
    const validator = this.contextValidators.get(targetSystem);
    
    if (!validator) {
      // Use default validation
      return this.defaultContextValidation(context, targetSystem);
    }
    
    return await validator.validate(context);
  }
  
  /**
   * Check context integrity across all systems
   */
  async checkContextIntegrity(context: UnifiedRequestContext): Promise<ContextIntegrity> {
    const integrityChecks = await Promise.all([
      this.checkContextCompleteness(context),
      this.checkContextConsistency(context),
      this.checkContextCoherence(context),
      this.checkContextTraceability(context),
      this.checkContextReliability(context),
    ]);
    
    return {
      completeness: integrityChecks[0],
      consistency: integrityChecks[1],
      coherence: integrityChecks[2],
      traceability: integrityChecks[3],
      reliability: integrityChecks[4],
    };
  }
  
  /**
   * Restore context to a previous state
   */
  async restoreContext(
    requestId: string,
    snapshotId: string
  ): Promise<UnifiedRequestContext | null> {
    const snapshot = this.contextSnapshots.get(snapshotId);
    if (!snapshot) {
      logger.error('Context snapshot not found', { requestId, snapshotId });
      return null;
    }
    
    const restoredContext = snapshot.context;
    this.activeContexts.set(requestId, restoredContext);
    
    logger.info('Context restored from snapshot', {
      requestId,
      snapshotId,
      snapshotType: snapshot.type,
    });
    
    this.emit('context-restored', { requestId, snapshotId, context: restoredContext });
    return restoredContext;
  }
  
  /**
   * Get current context for a request
   */
  getCurrentContext(requestId: string): UnifiedRequestContext | null {
    return this.activeContexts.get(requestId) || null;
  }
  
  /**
   * Get preservation history for a request
   */
  getPreservationHistory(requestId: string): ContextPreservation[] {
    return this.contextHistory.get(requestId) || [];
  }
  
  /**
   * Get preservation metrics
   */
  getPreservationMetrics(): PreservationMetrics {
    return { ...this.preservationMetrics };
  }
  
  /**
   * Clean up completed contexts
   */
  async cleanupContext(requestId: string): Promise<void> {
    this.activeContexts.delete(requestId);
    
    // Keep history for a limited time
    setTimeout(() => {
      this.contextHistory.delete(requestId);
    }, 300000); // 5 minutes
    
    logger.debug('Context cleaned up', { requestId });
    this.emit('context-cleaned', { requestId });
  }
  
  // ========================================
  // PRIVATE IMPLEMENTATION METHODS
  // ========================================
  
  private async createContextSnapshot(
    context: UnifiedRequestContext,
    type: 'initial' | 'pre-system' | 'post-system' | 'checkpoint'
  ): Promise<ContextSnapshot> {
    const snapshotId = this.generateSnapshotId();
    
    const snapshot: ContextSnapshot = {
      snapshotId,
      type,
      timestamp: Date.now(),
      context: JSON.parse(JSON.stringify(context)), // Deep clone
      checksums: {
        context: this.calculateChecksum(context),
        systemState: this.calculateChecksum(context.currentSystemState),
        stateSnapshot: this.calculateChecksum(context.stateSnapshot),
      },
    };
    
    this.contextSnapshots.set(snapshotId, snapshot);
    return snapshot;
  }
  
  private async defaultContextPreservation(
    context: UnifiedRequestContext,
    sourceSystem: string,
    targetSystem: string,
    systemResult?: SystemResult
  ): Promise<UnifiedRequestContext> {
    // Create a deep copy of the context
    const preservedContext = JSON.parse(JSON.stringify(context));
    
    // Update timestamps
    preservedContext.timestamp = Date.now();
    
    // Update state version
    preservedContext.stateVersion = this.generateStateVersion();
    
    // Apply system-specific adaptations based on target system
    switch (targetSystem) {
      case 'intelligent-routing':
        preservedContext.routingPreferences = {
          ...preservedContext.routingPreferences,
          // Ensure routing preferences are properly set
        };
        break;
        
      case 'voice-optimization':
        // Ensure voice-specific context is available
        if (!preservedContext.phase) {
          preservedContext.phase = 'council'; // Default to council phase for voice
        }
        break;
        
      case 'mcp-enhancement':
        // Ensure MCP requirements are specified
        preservedContext.mcpRequirements = {
          ...preservedContext.mcpRequirements,
          // Apply any MCP-specific defaults
        };
        break;
        
      case 'unified-orchestration':
        // Final orchestration - ensure all previous results are available
        break;
    }
    
    return preservedContext;
  }
  
  private async defaultContextValidation(
    context: UnifiedRequestContext,
    targetSystem: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Basic validation checks
    if (!context.requestId) {
      errors.push('Request ID is required');
    }
    
    if (!context.sessionId) {
      errors.push('Session ID is required');
    }
    
    if (!context.stateVersion) {
      errors.push('State version is required');
    }
    
    // System-specific validation
    switch (targetSystem) {
      case 'intelligent-routing':
        if (!context.performanceTargets) {
          errors.push('Performance targets required for routing system');
        }
        break;
        
      case 'voice-optimization':
        if (!context.phase) {
          warnings.push('Living Spiral phase not specified for voice system');
        }
        break;
        
      case 'mcp-enhancement':
        if (!context.mcpRequirements.capabilities.length) {
          warnings.push('No MCP capabilities specified');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors: errors.map(msg => ({
        field: 'context',
        message: msg,
        severity: 'error' as const,
        code: 'VALIDATION_FAILED',
      })),
      warnings,
      confidence: errors.length === 0 ? (warnings.length === 0 ? 1.0 : 0.8) : 0.0,
    };
  }
  
  private calculatePreservationQuality(
    preSnapshot: ContextSnapshot,
    postSnapshot: ContextSnapshot,
    originalContext: UnifiedRequestContext,
    adaptedContext: UnifiedRequestContext
  ): number {
    let qualityScore = 1.0;
    
    // Check for lost information
    const lostInfo = this.identifyLostInformation(originalContext, adaptedContext);
    qualityScore -= lostInfo.length * 0.1;
    
    // Check for data consistency
    if (originalContext.requestId !== adaptedContext.requestId) {
      qualityScore -= 0.5; // Major consistency violation
    }
    
    if (originalContext.sessionId !== adaptedContext.sessionId) {
      qualityScore -= 0.5; // Major consistency violation
    }
    
    // Check for context completeness
    const requiredFields = [
      'performanceTargets',
      'routingPreferences',
      'mcpRequirements',
      'errorRecovery',
    ];
    
    for (const field of requiredFields) {
      if (!adaptedContext[field as keyof UnifiedRequestContext]) {
        qualityScore -= 0.1;
      }
    }
    
    return Math.max(0, Math.min(1, qualityScore));
  }
  
  private detectContextChanges(
    originalContext: UnifiedRequestContext,
    adaptedContext: UnifiedRequestContext,
    sourceSystem: string,
    targetSystem: string
  ): ContextChange[] {
    const changes: ContextChange[] = [];
    
    // Compare key fields
    const fieldsToCheck = [
      'phase',
      'iteration',
      'performanceTargets',
      'routingPreferences',
      'mcpRequirements',
      'errorRecovery',
      'currentSystemState',
      'stateSnapshot',
    ];
    
    for (const field of fieldsToCheck) {
      const originalValue = originalContext[field as keyof UnifiedRequestContext];
      const adaptedValue = adaptedContext[field as keyof UnifiedRequestContext];
      
      if (JSON.stringify(originalValue) !== JSON.stringify(adaptedValue)) {
        changes.push({
          changeId: this.generateChangeId(),
          system: targetSystem,
          changeType: originalValue ? 'modification' : 'addition',
          contextPath: field,
          oldValue: originalValue,
          newValue: adaptedValue,
          reason: `System transition: ${sourceSystem} -> ${targetSystem}`,
          timestamp: Date.now(),
          reversible: true,
        });
      }
    }
    
    return changes;
  }
  
  private identifyLostInformation(
    originalContext: UnifiedRequestContext,
    adaptedContext: UnifiedRequestContext
  ): string[] {
    const lost: string[] = [];
    
    // Check for missing fields
    const originalKeys = new Set(Object.keys(originalContext));
    const adaptedKeys = new Set(Object.keys(adaptedContext));
    
    for (const key of originalKeys) {
      if (!adaptedKeys.has(key)) {
        lost.push(`Missing field: ${key}`);
      }
    }
    
    // Check for empty arrays/objects that were previously populated
    if (originalContext.previousResults?.length && !adaptedContext.previousResults?.length) {
      lost.push('Previous results were cleared');
    }
    
    if (Object.keys(originalContext.currentSystemState).length && 
        !Object.keys(adaptedContext.currentSystemState).length) {
      lost.push('System state was cleared');
    }
    
    return lost;
  }
  
  private identifyAddedInformation(
    originalContext: UnifiedRequestContext,
    adaptedContext: UnifiedRequestContext
  ): string[] {
    const added: string[] = [];
    
    // Check for new fields
    const originalKeys = new Set(Object.keys(originalContext));
    const adaptedKeys = new Set(Object.keys(adaptedContext));
    
    for (const key of adaptedKeys) {
      if (!originalKeys.has(key)) {
        added.push(`Added field: ${key}`);
      }
    }
    
    // Check for extended arrays
    if (adaptedContext.previousResults?.length > (originalContext.previousResults?.length || 0)) {
      added.push('Additional previous results');
    }
    
    if (adaptedContext.systemPath.length > originalContext.systemPath.length) {
      added.push('Extended system path');
    }
    
    return added;
  }
  
  private async checkContextCompleteness(context: UnifiedRequestContext): Promise<number> {
    const requiredFields = [
      'requestId',
      'sessionId',
      'timestamp',
      'systemPath',
      'performanceTargets',
      'routingPreferences',
      'mcpRequirements',
      'errorRecovery',
      'stateVersion',
    ];
    
    let score = 0;
    for (const field of requiredFields) {
      if (context[field as keyof UnifiedRequestContext]) {
        score += 1 / requiredFields.length;
      }
    }
    
    return score;
  }
  
  private async checkContextConsistency(context: UnifiedRequestContext): Promise<number> {
    let consistencyScore = 1.0;
    
    // Check timestamp consistency
    if (context.timestamp > Date.now()) {
      consistencyScore -= 0.2; // Future timestamp
    }
    
    // Check system path consistency
    const uniqueSystems = new Set(context.systemPath);
    if (uniqueSystems.size < context.systemPath.length) {
      consistencyScore -= 0.1; // Duplicate systems in path
    }
    
    // Check performance target consistency
    if (context.performanceTargets.maxLatency < 0) {
      consistencyScore -= 0.2; // Invalid latency
    }
    
    return Math.max(0, consistencyScore);
  }
  
  private async checkContextCoherence(context: UnifiedRequestContext): Promise<number> {
    let coherenceScore = 1.0;
    
    // Check that preferences align with targets
    if (context.routingPreferences.prioritizeSpeed && 
        context.performanceTargets.qualityThreshold > 0.9) {
      coherenceScore -= 0.1; // Speed vs quality conflict
    }
    
    // Check MCP requirements alignment
    if (context.mcpRequirements.maxLatency > context.performanceTargets.maxLatency) {
      coherenceScore -= 0.1; // Inconsistent latency requirements
    }
    
    return Math.max(0, coherenceScore);
  }
  
  private async checkContextTraceability(context: UnifiedRequestContext): Promise<number> {
    let traceabilityScore = 1.0;
    
    // Check system path traceability
    if (context.systemPath.length === 0) {
      traceabilityScore -= 0.3; // No system path
    }
    
    // Check result traceability
    if (context.previousResults && context.previousResults.length > 0) {
      for (const result of context.previousResults) {
        if (!result.requestId || result.requestId !== context.requestId) {
          traceabilityScore -= 0.1; // Untraced result
        }
      }
    }
    
    return Math.max(0, traceabilityScore);
  }
  
  private async checkContextReliability(context: UnifiedRequestContext): Promise<number> {
    let reliabilityScore = 1.0;
    
    // Check for null/undefined critical values
    const criticalFields = ['requestId', 'sessionId', 'stateVersion'];
    for (const field of criticalFields) {
      if (!context[field as keyof UnifiedRequestContext]) {
        reliabilityScore -= 0.2;
      }
    }
    
    return Math.max(0, reliabilityScore);
  }
  
  private updatePreservationMetrics(
    preservation: ContextPreservation,
    sourceSystem: string,
    targetSystem: string
  ): void {
    this.preservationMetrics.totalContexts++;
    
    if (preservation.preservationQuality > 0.7) {
      this.preservationMetrics.successfulPreservations++;
    }
    
    // Update running average
    const alpha = 0.1;
    this.preservationMetrics.averagePreservationQuality =
      (1 - alpha) * this.preservationMetrics.averagePreservationQuality +
      alpha * preservation.preservationQuality;
    
    // Track system-specific rates
    const systemKey = `${sourceSystem}->${targetSystem}`;
    const currentRate = this.preservationMetrics.systemPreservationRates.get(systemKey) || 0;
    this.preservationMetrics.systemPreservationRates.set(
      systemKey,
      (currentRate + preservation.preservationQuality) / 2
    );
  }
  
  private initializeDefaultValidators(): void {
    // Initialize validators for each system
    const systems = ['intelligent-routing', 'voice-optimization', 'mcp-enhancement', 'unified-orchestration'];
    
    for (const system of systems) {
      this.contextValidators.set(system, new DefaultContextValidator(system));
    }
  }
  
  private initializeDefaultAdapters(): void {
    // Initialize context adapters for system transitions
    const transitions = [
      'intelligent-routing->voice-optimization',
      'voice-optimization->mcp-enhancement',
      'mcp-enhancement->unified-orchestration',
    ];
    
    for (const transition of transitions) {
      this.contextAdapters.set(transition, new DefaultContextAdapter(transition));
    }
  }
  
  private initializeDefaultRules(): void {
    // Initialize preservation rules
    this.preservationRules.set('global', [
      {
        ruleId: 'preserve-request-id',
        description: 'Always preserve request ID',
        priority: 'critical',
        field: 'requestId',
        action: 'preserve',
        conditions: [],
      },
      {
        ruleId: 'preserve-session-id',
        description: 'Always preserve session ID',
        priority: 'critical',
        field: 'sessionId',
        action: 'preserve',
        conditions: [],
      },
    ]);
  }
  
  private generatePreservationId(): string {
    return `preservation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateSnapshotId(): string {
    return `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateChangeId(): string {
    return `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateStateVersion(): string {
    return `v${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }
  
  private calculateChecksum(data: any): string {
    // Simple checksum calculation
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }
}

// ========================================
// SUPPORTING CLASSES
// ========================================

class DefaultContextValidator implements ContextValidator {
  constructor(private systemId: string) {}
  
  async validate(context: UnifiedRequestContext): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: string[] = [];
    
    // System-specific validation logic would go here
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      confidence: errors.length === 0 ? 1.0 : 0.0,
    };
  }
}

class DefaultContextAdapter implements ContextAdapter {
  constructor(private transition: string) {}
  
  async adaptContext(
    context: UnifiedRequestContext,
    systemResult?: SystemResult
  ): Promise<UnifiedRequestContext> {
    // Default adaptation logic
    return JSON.parse(JSON.stringify(context));
  }
}

// ========================================
// INTERFACES
// ========================================

interface ContextCreationOptions {
  userId?: string;
  phase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
  iteration?: number;
  maxLatency?: number;
  minAccuracy?: number;
  maxCost?: number;
  qualityThreshold?: number;
  prioritizeSpeed?: boolean;
  prioritizeQuality?: boolean;
  maxVoices?: number;
  preferredProviders?: string[];
  enableHybridRouting?: boolean;
  mcpCapabilities?: string[];
  minReliability?: number;
  mcpMaxLatency?: number;
  securityLevel?: 'basic' | 'standard' | 'high' | 'enterprise';
  fallbackEnabled?: boolean;
  retryAttempts?: number;
  escalateToHuman?: boolean;
  allowPartialResults?: boolean;
}

interface ContextPreservationResult {
  success: boolean;
  preservedContext?: UnifiedRequestContext;
  preservationRecord?: ContextPreservation;
  executionTime: number;
  qualityScore: number;
  error?: string;
}

interface ContextSnapshot {
  snapshotId: string;
  type: 'initial' | 'pre-system' | 'post-system' | 'checkpoint';
  timestamp: number;
  context: UnifiedRequestContext;
  checksums: {
    context: string;
    systemState: string;
    stateSnapshot: string;
  };
}

interface ContextValidator {
  validate(context: UnifiedRequestContext): Promise<ValidationResult>;
}

interface ContextAdapter {
  adaptContext(
    context: UnifiedRequestContext,
    systemResult?: SystemResult
  ): Promise<UnifiedRequestContext>;
}

interface IntegrityChecker {
  checkIntegrity(context: UnifiedRequestContext): Promise<number>;
}

interface PreservationRule {
  ruleId: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  field: string;
  action: 'preserve' | 'transform' | 'validate' | 'ignore';
  conditions: string[];
}

interface PreservationMetrics {
  totalContexts: number;
  successfulPreservations: number;
  contextLosses: number;
  averagePreservationQuality: number;
  integrationQualityScores: Map<string, number>;
  systemPreservationRates: Map<string, number>;
}

// Export singleton instance
export const contextPreservationSystem = ContextPreservationSystem.getInstance();