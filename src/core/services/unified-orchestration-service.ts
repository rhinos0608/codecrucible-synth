/**
 * Legacy Unified Orchestration Service - Backward Compatibility Wrapper
 * 
 * This is a temporary wrapper around the new application layer service
 * to maintain backward compatibility during the architectural migration.
 * 
 * @deprecated Use UnifiedOrchestrationService from application/services instead
 */

export { 
  UnifiedOrchestrationService, 
  createUnifiedOrchestrationService,
  type OrchestrationRequest,
  type OrchestrationResponse
} from '../../application/services/unified-orchestration-service.js';

// Re-export tool types from domain layer with expected names
export type {
  ITool as UnifiedTool,
  ToolDefinition as ToolMetadata,
  ToolPermission as ToolCapability,
  ToolParameter as ToolRequirement,
  ToolExecutionContext as ToolContext,
  ToolParameterSchema as ToolConstraints,
  ToolExecutionContext as SecurityContext,
  ToolExecutionResult as ToolResult,
  ToolExecutionRequest as ToolExecutionDelta
} from '../../domain/interfaces/tool-system.js';

// Missing exports needed by index.ts
export interface AgentCapability {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  priority: number;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

export interface AgentPreferences {
  voiceArchetype: string;
  collaborationStyle: string;
  riskTolerance: number;
  qualityThreshold: number;
}

export interface TaskResult {
  success: boolean;
  data?: any;
  error?: string;
  executionTime: number;
  resourcesUsed: string[];
}

export interface ExecutionRequest {
  id: string;
  type: string;
  payload: any;
  context: any;
  timestamp: Date;
}

export interface ExecutionResponse {
  requestId: string;
  success: boolean;
  result?: any;
  error?: string;
  executionTime: number;
}

export interface ExecutionPlan {
  id: string;
  steps: ExecutionStep[];
  totalEstimatedTime: number;
  riskAssessment: RiskAssessment;
}

export interface ExecutionStep {
  id: string;
  name: string;
  type: string;
  dependencies: string[];
  estimatedTime: number;
}

export interface RiskAssessment {
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  mitigations: string[];
  score: number;
}

// Fix CollaborationData export
export type CollaborationData = CollaborationType;

// Additional workflow types expected by the index
export type ToolCategory = 'file' | 'git' | 'analysis' | 'generation' | 'research' | 'system';

export interface WorkflowTask {
  id: string;
  type: WorkflowTaskType;
  name: string;
  priority: TaskPriority;
  status: TaskStatus;
  dependencies: string[];
  estimatedDuration?: number;
}

export type WorkflowTaskType = 'analysis' | 'generation' | 'validation' | 'execution' | 'orchestration';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowPattern {
  id: string;
  name: string;
  type: WorkflowPatternType;
  stages: WorkflowStage[];
  collaboration: CollaborationType;
}

export enum WorkflowPatternType {
  Sequential = 'sequential',
  Parallel = 'parallel',
  ConditionalBranch = 'conditional',
  Loop = 'loop',
  Pipeline = 'pipeline'
}

export interface WorkflowStage {
  id: string;
  name: string;
  tasks: string[]; // Task IDs
  conditions?: string[];
}

export type CollaborationType = 'single' | 'multi-voice' | 'hierarchical' | 'consensus';

// Create a lazy-loaded singleton instance for backward compatibility
import { createUnifiedOrchestrationService, UnifiedOrchestrationService } from '../../application/services/unified-orchestration-service.js';
import { getUnifiedConfigurationManager } from '../../domain/services/unified-configuration-manager.js';

let _unifiedOrchestrationServiceInstance: UnifiedOrchestrationService | null = null;

export async function getUnifiedOrchestrationService(): Promise<UnifiedOrchestrationService> {
  if (!_unifiedOrchestrationServiceInstance) {
    const configManager = await getUnifiedConfigurationManager();
    // Create default event bus and user interaction for backward compatibility
    const { EventEmitter } = await import('events');
    const eventBus = new EventEmitter() as any; // Mock IEventBus
    const userInteraction = {
      requestConsent: async () => 'allow',
      showWarning: async () => {},
      showError: async () => {},
      requestInput: async () => ''
    } as any; // Mock IUserInteraction
    
    _unifiedOrchestrationServiceInstance = createUnifiedOrchestrationService(
      configManager, 
      eventBus, 
      userInteraction
    );
  }
  return _unifiedOrchestrationServiceInstance;
}

// Legacy synchronous export - returns Promise for compatibility
export const unifiedOrchestrationService = getUnifiedOrchestrationService();