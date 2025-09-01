/**
 * Approval Modes Manager - OpenAI Codex Pattern Implementation
 * Inspired by OpenAI Codex's Auto/Read Only/Full Access permission system
 *
 * Provides granular control over AI agent permissions and user approval requirements
 */

import { logger } from '../logging/logger.js';
import { EventEmitter } from 'events';

export type ApprovalMode =
  | 'auto'
  | 'read-only'
  | 'full-access'
  | 'interactive'
  | 'enterprise-audit'
  | 'voice-collaborative';

export interface ApprovalRequest {
  id: string;
  operation: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiredPermissions: Permission[];
  context: {
    workingDirectory: string;
    targetPaths?: string[];
    networkAccess?: boolean;
    systemCommands?: string[];
    voiceArchetype?: string;
    livingSpiralPhase?: 'collapse' | 'council' | 'synthesis' | 'rebirth' | 'reflection';
    enterpriseCompliance?: boolean;
    auditRequired?: boolean;
  };
}

export interface Permission {
  type: 'read' | 'write' | 'execute' | 'network' | 'system';
  scope: 'working-directory' | 'parent-directory' | 'system-wide' | 'network';
  description: string;
}

export interface ApprovalResponse {
  approved: boolean;
  reason?: string;
  modifications?: Partial<ApprovalRequest>;
  rememberChoice?: boolean;
}

export class ApprovalModesManager extends EventEmitter {
  private currentMode: ApprovalMode = 'auto';
  private userRules: Map<string, ApprovalResponse> = new Map();
  private sessionApprovals: Map<string, ApprovalResponse> = new Map();

  constructor() {
    super();
    logger.info('ApprovalModesManager initialized');
  }

  /**
   * Set the current approval mode
   */
  setMode(mode: ApprovalMode): void {
    const previousMode = this.currentMode;
    this.currentMode = mode;

    logger.info(`Approval mode changed from ${previousMode} to ${mode}`);
    this.emit('modeChanged', { previous: previousMode, current: mode });
  }

  /**
   * Get the current approval mode
   */
  getCurrentMode(): ApprovalMode {
    return this.currentMode;
  }

  /**
   * Request approval for an operation based on current mode
   */
  async requestApproval(request: ApprovalRequest): Promise<ApprovalResponse> {
    // Check for cached user rules first
    const cacheKey = this.generateCacheKey(request);
    if (this.userRules.has(cacheKey)) {
      const cached = this.userRules.get(cacheKey)!;
      logger.debug(`Using cached approval for ${request.operation}: ${cached.approved}`);
      return cached;
    }

    // Check for session approvals
    if (this.sessionApprovals.has(request.id)) {
      return this.sessionApprovals.get(request.id)!;
    }

    // Apply approval logic based on current mode
    const response = await this.evaluateRequest(request);

    // Cache the response if user wants to remember
    if (response.rememberChoice) {
      this.userRules.set(cacheKey, response);
    } else {
      this.sessionApprovals.set(request.id, response);
    }

    this.emit('approvalRequested', { request, response });
    return response;
  }

  /**
   * Evaluate approval request based on current mode and permissions
   */
  private async evaluateRequest(request: ApprovalRequest): Promise<ApprovalResponse> {
    switch (this.currentMode) {
      case 'auto':
        return this.evaluateAutoMode(request);

      case 'read-only':
        return this.evaluateReadOnlyMode(request);

      case 'full-access':
        return this.evaluateFullAccessMode(request);

      case 'interactive':
        return this.evaluateInteractiveMode(request);

      case 'enterprise-audit':
        return this.evaluateEnterpriseAuditMode(request);

      case 'voice-collaborative':
        return this.evaluateVoiceCollaborativeMode(request);

      default:
        return {
          approved: false,
          reason: `Unknown approval mode: ${this.currentMode}`,
        };
    }
  }

  /**
   * Auto mode: Codex can read files, make edits, and run commands in working directory automatically
   * Requires approval for operations outside working directory or network access
   */
  private evaluateAutoMode(request: ApprovalRequest): ApprovalResponse {
    // Always allow read operations
    if (request.requiredPermissions.every(p => p.type === 'read')) {
      return { approved: true, reason: 'Read-only operation approved in auto mode' };
    }

    // Allow write operations within working directory
    const hasWorkingDirWriteOnly = request.requiredPermissions.every(
      p => p.type === 'write' && p.scope === 'working-directory'
    );

    if (hasWorkingDirWriteOnly) {
      return { approved: true, reason: 'Working directory write operation approved in auto mode' };
    }

    // Allow low-risk execute operations in working directory
    const hasLowRiskExecute =
      request.requiredPermissions.some(p => p.type === 'execute') &&
      request.riskLevel === 'low' &&
      request.requiredPermissions.every(p => p.scope === 'working-directory');

    if (hasLowRiskExecute) {
      return { approved: true, reason: 'Low-risk execution approved in auto mode' };
    }

    // Require approval for network access or system-wide operations
    const hasNetworkOrSystem = request.requiredPermissions.some(
      p => p.type === 'network' || p.scope === 'system-wide'
    );

    if (hasNetworkOrSystem) {
      return {
        approved: false,
        reason: 'Network access or system-wide operations require explicit approval in auto mode',
      };
    }

    // Default: require approval for anything else
    return {
      approved: false,
      reason: 'Operation requires explicit approval in auto mode',
    };
  }

  /**
   * Read-only mode: Only read operations allowed
   */
  private evaluateReadOnlyMode(request: ApprovalRequest): ApprovalResponse {
    if (request.requiredPermissions.every(p => p.type === 'read')) {
      return { approved: true, reason: 'Read operation approved in read-only mode' };
    }

    return {
      approved: false,
      reason: 'Only read operations allowed in read-only mode',
    };
  }

  /**
   * Full access mode: All operations approved automatically
   */
  private evaluateFullAccessMode(request: ApprovalRequest): ApprovalResponse {
    // Still require approval for critical risk operations
    if (request.riskLevel === 'critical') {
      return {
        approved: false,
        reason: 'Critical risk operations require explicit approval even in full-access mode',
      };
    }

    return { approved: true, reason: 'Operation approved in full-access mode' };
  }

  /**
   * Interactive mode: Always prompt user for approval
   */
  private evaluateInteractiveMode(request: ApprovalRequest): ApprovalResponse {
    // In a real implementation, this would prompt the user via CLI
    // For now, we'll return a "requires user input" response
    return {
      approved: false,
      reason: 'Interactive approval required - user input needed',
    };
  }

  /**
   * Enterprise Audit mode: Strict compliance with full audit trail
   * All operations logged, high-risk operations require approval
   */
  private evaluateEnterpriseAuditMode(request: ApprovalRequest): ApprovalResponse {
    // Log all operations for audit trail
    logger.info(
      `AUDIT: Operation ${request.operation} by ${request.context.voiceArchetype || 'system'}`,
      {
        operation: request.operation,
        riskLevel: request.riskLevel,
        permissions: request.requiredPermissions,
        context: request.context,
      }
    );

    // Always require approval for critical operations
    if (request.riskLevel === 'critical') {
      return {
        approved: false,
        reason: 'Critical operations require explicit approval in enterprise audit mode',
      };
    }

    // Require approval for operations without enterprise compliance flag
    if (request.context.enterpriseCompliance !== true) {
      return {
        approved: false,
        reason: 'Operations must be marked as enterprise compliant in audit mode',
      };
    }

    // Allow read operations and low-risk working directory operations
    if (
      request.requiredPermissions.every(p => p.type === 'read') ||
      (request.riskLevel === 'low' &&
        request.requiredPermissions.every(p => p.scope === 'working-directory'))
    ) {
      return {
        approved: true,
        reason: 'Operation approved in enterprise audit mode with full logging',
      };
    }

    // Require approval for medium/high risk operations
    return {
      approved: false,
      reason: 'Medium/high risk operations require explicit approval in enterprise audit mode',
    };
  }

  /**
   * Voice Collaborative mode: Optimized for multi-voice AI collaboration
   * Different approval rules based on voice archetype and Living Spiral phase
   */
  private evaluateVoiceCollaborativeMode(request: ApprovalRequest): ApprovalResponse {
    const voiceType = request.context.voiceArchetype;
    const spiralPhase = request.context.livingSpiralPhase;

    // Security voice gets enhanced permissions for security operations
    if (voiceType === 'Security' && request.operation.includes('security')) {
      if (request.riskLevel !== 'critical') {
        return {
          approved: true,
          reason: 'Security voice approved for security operations',
        };
      }
    }

    // Architect voice gets enhanced permissions during synthesis phase
    if (
      voiceType === 'Architect' &&
      spiralPhase === 'synthesis' &&
      request.requiredPermissions.every(
        p => p.type === 'read' || (p.type === 'write' && p.scope === 'working-directory')
      )
    ) {
      return {
        approved: true,
        reason: 'Architect voice approved for synthesis phase operations',
      };
    }

    // Guardian voice requires approval for all write operations
    if (
      voiceType === 'Guardian' &&
      request.requiredPermissions.some(p => p.type === 'write' || p.type === 'execute')
    ) {
      return {
        approved: false,
        reason: 'Guardian voice requires explicit approval for modification operations',
      };
    }

    // Council phase operations get collaborative approval
    if (spiralPhase === 'council') {
      // Allow read operations for gathering perspectives
      if (request.requiredPermissions.every(p => p.type === 'read')) {
        return {
          approved: true,
          reason: 'Council phase read operations approved for collaboration',
        };
      }
    }

    // Default to auto mode evaluation for unspecified cases
    return this.evaluateAutoMode(request);
  }

  /**
   * Generate cache key for approval requests
   */
  private generateCacheKey(request: ApprovalRequest): string {
    const permissionTypes = request.requiredPermissions.map(p => `${p.type}:${p.scope}`).sort();
    return `${request.operation}:${request.riskLevel}:${permissionTypes.join(',')}`;
  }

  /**
   * Clear all cached approvals
   */
  clearCache(): void {
    this.userRules.clear();
    this.sessionApprovals.clear();
    logger.info('Approval cache cleared');
  }

  /**
   * Get approval statistics
   */
  getStats(): {
    currentMode: ApprovalMode;
    cachedRules: number;
    sessionApprovals: number;
  } {
    return {
      currentMode: this.currentMode,
      cachedRules: this.userRules.size,
      sessionApprovals: this.sessionApprovals.size,
    };
  }

  /**
   * Create a standard approval request
   */
  static createRequest(
    operation: string,
    description: string,
    permissions: Permission[],
    context: ApprovalRequest['context'],
    riskLevel: ApprovalRequest['riskLevel'] = 'medium'
  ): ApprovalRequest {
    return {
      id: `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      operation,
      description,
      riskLevel,
      requiredPermissions: permissions,
      context,
    };
  }

  /**
   * Create standard permissions
   */
  static permissions = {
    readWorkingDir: (): Permission => ({
      type: 'read',
      scope: 'working-directory',
      description: 'Read files in current working directory',
    }),

    writeWorkingDir: (): Permission => ({
      type: 'write',
      scope: 'working-directory',
      description: 'Write files in current working directory',
    }),

    executeWorkingDir: (): Permission => ({
      type: 'execute',
      scope: 'working-directory',
      description: 'Execute commands in current working directory',
    }),

    networkAccess: (): Permission => ({
      type: 'network',
      scope: 'network',
      description: 'Access network resources',
    }),

    systemWideRead: (): Permission => ({
      type: 'read',
      scope: 'system-wide',
      description: 'Read files anywhere on system',
    }),

    systemWideWrite: (): Permission => ({
      type: 'write',
      scope: 'system-wide',
      description: 'Write files anywhere on system',
    }),

    systemCommands: (): Permission => ({
      type: 'execute',
      scope: 'system-wide',
      description: 'Execute system-level commands',
    }),

    // Voice-specific permissions
    voiceCollaboration: (): Permission => ({
      type: 'system',
      scope: 'working-directory',
      description: 'Voice archetype collaboration and consensus building',
    }),

    livingSpiralOperation: (): Permission => ({
      type: 'system',
      scope: 'working-directory',
      description: 'Living Spiral methodology phase operations',
    }),

    // Enterprise permissions
    enterpriseAudit: (): Permission => ({
      type: 'system',
      scope: 'system-wide',
      description: 'Enterprise audit and compliance operations',
    }),

    securityAnalysis: (): Permission => ({
      type: 'read',
      scope: 'system-wide',
      description: 'Security analysis and vulnerability assessment',
    }),

    architecturalDesign: (): Permission => ({
      type: 'write',
      scope: 'working-directory',
      description: 'Architectural design and system planning',
    }),
  } as const;

  /**
   * Cleanup method to remove all listeners and clear state
   */
  cleanup(): void {
    this.removeAllListeners();
    this.userRules.clear();
    this.sessionApprovals.clear();
    logger.info('ApprovalModesManager cleaned up');
  }
}

// Singleton instance
let approvalManager: ApprovalModesManager;

export function getApprovalManager(): ApprovalModesManager {
  if (!approvalManager) {
    approvalManager = new ApprovalModesManager();
  }
  return approvalManager;
}

export function cleanupApprovalManager(): void {
  if (approvalManager) {
    approvalManager.cleanup();
    approvalManager = null as any;
  }
}
