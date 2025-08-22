import { logger } from '../logger.js';
import { SandboxMode } from '../sandbox/sandbox-manager.js';
import * as readline from 'readline';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type OperationType =
  | 'file-read'
  | 'file-write'
  | 'file-delete'
  | 'command-exec'
  | 'network-access'
  | 'git-operation'
  | 'package-install'
  | 'code-generation'
  | 'fine-tuning';

export enum ApprovalMode {
  READ_ONLY = 'read-only',
  WORKSPACE_READ = 'workspace-read',
  WORKSPACE_WRITE = 'workspace-write',
  FULL_ACCESS = 'full-access',
}
export type ApprovalStatus = 'approved' | 'denied' | 'pending';

export interface Operation {
  type: OperationType;
  target: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface OperationContext {
  sandboxMode: SandboxMode;
  workspaceRoot: string;
  userIntent: string;
  sessionId: string;
}

export interface ApprovalResult {
  status: ApprovalStatus;
  granted: boolean;
  reason: string;
  suggestions?: string[];
  autoApproved?: boolean;
  reviewerId?: string;
  mode?: ApprovalMode;
  restrictions?: string[];
}

export interface RiskAssessment {
  level: RiskLevel;
  score: number; // 0-100
  factors: RiskFactor[];
  recommendations: string[];
}

export interface RiskFactor {
  category: 'security' | 'data' | 'system' | 'network' | 'user';
  severity: number; // 0-10
  description: string;
  mitigation?: string;
}

export interface ApprovalPolicy {
  sandboxMode: SandboxMode;
  autoApproveThreshold: number; // Risk score threshold for auto-approval
  requireConfirmationThreshold: number; // Risk score threshold for user confirmation
  rules: ApprovalRule[];
}

export interface ApprovalRule {
  id: string;
  operationType: OperationType;
  condition: string; // JavaScript expression
  action: 'auto-approve' | 'require-confirmation' | 'deny';
  reason: string;
  priority: number;
}

/**
 * Three-tier approval system for CodeCrucible operations
 * Implements security policies based on Codex CLI patterns
 */
export class ApprovalManager {
  private policies: Map<SandboxMode, ApprovalPolicy>;
  private approvalHistory: Map<string, ApprovalResult[]>;
  private userInterface: readline.Interface;

  constructor() {
    this.policies = new Map();
    this.approvalHistory = new Map();
    this.userInterface = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.initializePolicies();

    logger.info('Approval manager initialized with three-tier policy system');
  }

  /**
   * Request approval for an operation
   */
  async requestApproval(operation: Operation, context: OperationContext): Promise<ApprovalResult> {
    const startTime = Date.now();
    const sessionHistory = this.approvalHistory.get(context.sessionId) || [];

    logger.info(`Approval request: ${operation.type} on ${operation.target}`, {
      sandboxMode: context.sandboxMode,
      userIntent: context.userIntent,
    });

    try {
      // Assess risk level
      const riskAssessment = await this.assessRisk(operation, context);

      // Get applicable policy
      const policy = this.policies.get(context.sandboxMode);
      if (!policy) {
        throw new Error(`No policy found for sandbox mode: ${context.sandboxMode}`);
      }

      // Apply approval rules
      const result = await this.applyApprovalRules(operation, context, riskAssessment, policy);

      // Store in history
      sessionHistory.push(result);
      this.approvalHistory.set(context.sessionId, sessionHistory);

      const duration = Date.now() - startTime;

      logger.info(`Approval ${result.status}: ${operation.type} (${duration}ms)`, {
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        autoApproved: result.autoApproved,
      });

      return result;
    } catch (error) {
      logger.error(`Approval request failed for ${operation.type}:`, error);

      return {
        status: 'denied',
        granted: false,
        reason: `Approval system error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestions: ['Check approval system configuration', 'Try again with simpler operation'],
      };
    }
  }

  /**
   * Assess risk level for an operation
   */
  private async assessRisk(
    operation: Operation,
    context: OperationContext
  ): Promise<RiskAssessment> {
    const factors: RiskFactor[] = [];
    let score = 0;

    // Operation type risk factors
    const operationRisks = this.getOperationTypeRisk(operation.type);
    factors.push(...operationRisks);
    score += operationRisks.reduce((sum, factor) => sum + factor.severity, 0);

    // Target path risk factors
    const pathRisks = this.getPathRisk(operation.target, context);
    factors.push(...pathRisks);
    score += pathRisks.reduce((sum, factor) => sum + factor.severity, 0);

    // Sandbox mode risk factors
    const sandboxRisks = this.getSandboxModeRisk(context.sandboxMode);
    factors.push(...sandboxRisks);
    score += sandboxRisks.reduce((sum, factor) => sum + factor.severity, 0);

    // Command content risk factors (for command-exec operations)
    if (operation.type === 'command-exec') {
      const commandRisks = this.getCommandRisk(operation.target);
      factors.push(...commandRisks);
      score += commandRisks.reduce((sum, factor) => sum + factor.severity, 0);
    }

    // Determine risk level based on score
    let level: RiskLevel;
    if (score >= 25) level = 'critical';
    else if (score >= 15) level = 'high';
    else if (score >= 8) level = 'medium';
    else level = 'low';

    // Generate recommendations
    const recommendations = this.generateRecommendations(factors, level);

    return {
      level,
      score,
      factors,
      recommendations,
    };
  }

  /**
   * Apply approval rules based on policy
   */
  private async applyApprovalRules(
    operation: Operation,
    context: OperationContext,
    riskAssessment: RiskAssessment,
    policy: ApprovalPolicy
  ): Promise<ApprovalResult> {
    // Check explicit rules first
    const applicableRules = policy.rules
      .filter(rule => rule.operationType === operation.type)
      .sort((a, b) => b.priority - a.priority); // Higher priority first

    for (const rule of applicableRules) {
      try {
        const conditionMet = this.evaluateCondition(rule.condition, {
          operation,
          context,
          riskAssessment,
        });

        if (conditionMet) {
          switch (rule.action) {
            case 'auto-approve':
              return {
                status: 'approved',
                granted: true,
                reason: rule.reason,
                autoApproved: true,
              };

            case 'deny':
              return {
                status: 'denied',
                granted: false,
                reason: rule.reason,
                suggestions: riskAssessment.recommendations,
              };

            case 'require-confirmation':
              return await this.requestUserConfirmation(operation, context, riskAssessment);
          }
        }
      } catch (error) {
        logger.warn(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }

    // Fall back to threshold-based decisions
    if (riskAssessment.score <= policy.autoApproveThreshold) {
      return this.autoApprove(operation, riskAssessment);
    } else if (riskAssessment.score <= policy.requireConfirmationThreshold) {
      return await this.requestUserConfirmation(operation, context, riskAssessment);
    } else {
      return this.denyOperation(operation, riskAssessment);
    }
  }

  /**
   * Auto-approve low-risk operations
   */
  private autoApprove(operation: Operation, riskAssessment: RiskAssessment): ApprovalResult {
    return {
      status: 'approved',
      granted: true,
      reason: `Auto-approved: ${riskAssessment.level} risk (score: ${riskAssessment.score})`,
      autoApproved: true,
    };
  }

  /**
   * Request user confirmation for medium-risk operations
   */
  private async requestUserConfirmation(
    operation: Operation,
    context: OperationContext,
    riskAssessment: RiskAssessment
  ): Promise<ApprovalResult> {
    console.log('\n' + '='.repeat(60));
    console.log('🔐 OPERATION APPROVAL REQUIRED');
    console.log('='.repeat(60));
    console.log(`Operation: ${operation.type}`);
    console.log(`Target: ${operation.target}`);
    console.log(`Description: ${operation.description}`);
    console.log(
      `Risk Level: ${riskAssessment.level.toUpperCase()} (score: ${riskAssessment.score})`
    );
    console.log(`Sandbox Mode: ${context.sandboxMode}`);

    if (riskAssessment.factors.length > 0) {
      console.log('\nRisk Factors:');
      riskAssessment.factors.forEach(factor => {
        console.log(`  • ${factor.description} (${factor.category}, severity: ${factor.severity})`);
      });
    }

    if (riskAssessment.recommendations.length > 0) {
      console.log('\nRecommendations:');
      riskAssessment.recommendations.forEach(rec => {
        console.log(`  • ${rec}`);
      });
    }

    console.log('\nOptions:');
    console.log('  [y] Approve and execute');
    console.log('  [n] Deny operation');
    console.log('  [s] Show more details');
    console.log('  [q] Quit/cancel');
    console.log('='.repeat(60));

    return new Promise(resolve => {
      const askForInput = () => {
        this.userInterface.question('Your choice (y/n/s/q): ', answer => {
          const choice = answer.toLowerCase().trim();

          switch (choice) {
            case 'y':
            case 'yes':
              resolve({
                status: 'approved',
                granted: true,
                reason: 'User approved after confirmation',
                reviewerId: 'user',
              });
              break;

            case 'n':
            case 'no':
              resolve({
                status: 'denied',
                granted: false,
                reason: 'User denied after review',
                suggestions: riskAssessment.recommendations,
                reviewerId: 'user',
              });
              break;

            case 's':
            case 'show':
              this.showDetailedInformation(operation, context, riskAssessment);
              askForInput(); // Ask again after showing details
              break;

            case 'q':
            case 'quit':
              resolve({
                status: 'denied',
                granted: false,
                reason: 'User cancelled operation',
                reviewerId: 'user',
              });
              break;

            default:
              console.log('Invalid choice. Please enter y, n, s, or q.');
              askForInput();
          }
        });
      };

      askForInput();
    });
  }

  /**
   * Deny high-risk operations
   */
  private denyOperation(operation: Operation, riskAssessment: RiskAssessment): ApprovalResult {
    return {
      status: 'denied',
      granted: false,
      reason: `Operation denied: ${riskAssessment.level} risk (score: ${riskAssessment.score})`,
      suggestions: riskAssessment.recommendations,
    };
  }

  /**
   * Show detailed information about the operation
   */
  private showDetailedInformation(
    operation: Operation,
    context: OperationContext,
    riskAssessment: RiskAssessment
  ): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DETAILED OPERATION ANALYSIS');
    console.log('='.repeat(60));

    console.log('Operation Details:');
    console.log(`  Type: ${operation.type}`);
    console.log(`  Target: ${operation.target}`);
    console.log(`  Description: ${operation.description}`);

    if (operation.metadata) {
      console.log('  Metadata:');
      Object.entries(operation.metadata).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    }

    console.log('\nContext:');
    console.log(`  Sandbox Mode: ${context.sandboxMode}`);
    console.log(`  Workspace: ${context.workspaceRoot}`);
    console.log(`  User Intent: ${context.userIntent}`);
    console.log(`  Session ID: ${context.sessionId}`);

    console.log('\nRisk Assessment:');
    console.log(`  Overall Level: ${riskAssessment.level.toUpperCase()}`);
    console.log(`  Risk Score: ${riskAssessment.score}/100`);

    console.log('\nRisk Factors:');
    riskAssessment.factors.forEach((factor, index) => {
      console.log(`  ${index + 1}. ${factor.description}`);
      console.log(`     Category: ${factor.category}`);
      console.log(`     Severity: ${factor.severity}/10`);
      if (factor.mitigation) {
        console.log(`     Mitigation: ${factor.mitigation}`);
      }
    });

    console.log('\nRecommendations:');
    riskAssessment.recommendations.forEach((rec, index) => {
      console.log(`  ${index + 1}. ${rec}`);
    });

    console.log('='.repeat(60));
  }

  /**
   * Get operation type risk factors
   */
  private getOperationTypeRisk(operationType: OperationType): RiskFactor[] {
    const riskMap: Record<OperationType, RiskFactor[]> = {
      'file-read': [
        {
          category: 'data',
          severity: 2,
          description: 'Reading file contents may expose sensitive information',
        },
      ],
      'file-write': [
        {
          category: 'data',
          severity: 5,
          description: 'Writing files can modify or corrupt existing data',
        },
      ],
      'file-delete': [
        {
          category: 'data',
          severity: 8,
          description: 'Deleting files is irreversible and may cause data loss',
        },
      ],
      'command-exec': [
        {
          category: 'system',
          severity: 7,
          description: 'Command execution can modify system state or access sensitive resources',
        },
      ],
      'network-access': [
        {
          category: 'network',
          severity: 6,
          description: 'Network access may leak data or download malicious content',
        },
      ],
      'git-operation': [
        {
          category: 'data',
          severity: 4,
          description: 'Git operations can modify version control history',
        },
      ],
      'package-install': [
        {
          category: 'security',
          severity: 7,
          description:
            'Package installation can introduce security vulnerabilities or malicious code',
        },
      ],
      'code-generation': [
        {
          category: 'data',
          severity: 3,
          description: 'Code generation may create files or modify existing code',
        },
      ],
      'fine-tuning': [
        {
          category: 'system',
          severity: 6,
          description: 'Fine-tuning models requires significant system resources and file access',
        },
      ],
    };

    return riskMap[operationType] || [];
  }

  /**
   * Get path-based risk factors
   */
  private getPathRisk(target: string, context: OperationContext): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // System paths
    const systemPaths = ['/etc', '/bin', '/usr/bin', '/System', 'C:\\Windows', 'C:\\Program Files'];
    if (systemPaths.some(sysPath => target.includes(sysPath))) {
      factors.push({
        category: 'system',
        severity: 9,
        description: 'Operation targets system directory',
        mitigation: 'Consider using workspace-relative paths',
      });
    }

    // Outside workspace
    if (!target.startsWith(context.workspaceRoot)) {
      factors.push({
        category: 'security',
        severity: 6,
        description: 'Operation targets path outside workspace',
        mitigation: 'Use paths within the project workspace',
      });
    }

    // Hidden/config files
    if (target.includes('/.') || target.includes('\\.')) {
      factors.push({
        category: 'data',
        severity: 4,
        description: 'Operation targets hidden or configuration files',
        mitigation: 'Review if access to hidden files is necessary',
      });
    }

    return factors;
  }

  /**
   * Get sandbox mode risk factors
   */
  private getSandboxModeRisk(sandboxMode: SandboxMode): RiskFactor[] {
    switch (sandboxMode) {
      case 'read-only':
        return [
          {
            category: 'security',
            severity: 1,
            description: 'Read-only mode provides maximum security',
          },
        ];

      case 'workspace-write':
        return [
          {
            category: 'security',
            severity: 3,
            description: 'Workspace-write mode allows modifications within project',
          },
        ];

      case 'full-access':
        return [
          {
            category: 'security',
            severity: 6,
            description: 'Full-access mode provides minimal restrictions',
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Get command-specific risk factors
   */
  private getCommandRisk(command: string): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Dangerous commands
    const dangerousCommands = ['rm', 'del', 'format', 'sudo', 'chmod', 'chown'];
    const cmdParts = command.toLowerCase().split(' ');

    for (const dangerous of dangerousCommands) {
      if (cmdParts.includes(dangerous)) {
        factors.push({
          category: 'system',
          severity: 9,
          description: `Command contains dangerous operation: ${dangerous}`,
          mitigation: 'Use safer alternatives or review command carefully',
        });
      }
    }

    // Network commands
    const networkCommands = ['curl', 'wget', 'nc', 'netcat'];
    for (const netCmd of networkCommands) {
      if (cmdParts.includes(netCmd)) {
        factors.push({
          category: 'network',
          severity: 6,
          description: `Command includes network operation: ${netCmd}`,
          mitigation: 'Review network endpoints and data transfer',
        });
      }
    }

    // Script execution
    const scriptExecutors = ['python', 'node', 'powershell', 'bash', 'sh'];
    for (const executor of scriptExecutors) {
      if (cmdParts.includes(executor)) {
        factors.push({
          category: 'system',
          severity: 5,
          description: `Command executes scripts with: ${executor}`,
          mitigation: 'Review script content for security implications',
        });
      }
    }

    return factors;
  }

  /**
   * Generate recommendations based on risk factors
   */
  private generateRecommendations(factors: RiskFactor[], riskLevel: RiskLevel): string[] {
    const recommendations: string[] = [];

    // Risk level specific recommendations
    switch (riskLevel) {
      case 'critical':
        recommendations.push('Consider alternative approaches with lower risk');
        recommendations.push('Review operation necessity before proceeding');
        break;
      case 'high':
        recommendations.push('Proceed with caution and review potential impacts');
        recommendations.push('Consider implementing additional safeguards');
        break;
      case 'medium':
        recommendations.push('Review operation details and ensure appropriateness');
        break;
      case 'low':
        recommendations.push('Operation appears safe to proceed');
        break;
    }

    // Factor-specific recommendations
    factors.forEach(factor => {
      if (factor.mitigation) {
        recommendations.push(factor.mitigation);
      }
    });

    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateCondition(condition: string, data: any): boolean {
    try {
      // Simple expression evaluation (could be enhanced with a proper parser)
      const func = new Function('data', `with(data) { return ${condition}; }`);
      return func(data);
    } catch (error) {
      logger.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  /**
   * Initialize approval policies for different sandbox modes
   */
  private initializePolicies(): void {
    // Read-only mode policy
    this.policies.set('read-only', {
      sandboxMode: 'read-only',
      autoApproveThreshold: 10,
      requireConfirmationThreshold: 20,
      rules: [
        {
          id: 'readonly-file-read',
          operationType: 'file-read',
          condition: 'true',
          action: 'auto-approve',
          reason: 'File reading is safe in read-only mode',
          priority: 10,
        },
        {
          id: 'readonly-file-write',
          operationType: 'file-write',
          condition: 'true',
          action: 'deny',
          reason: 'File writing not allowed in read-only mode',
          priority: 10,
        },
      ],
    });

    // Workspace-write mode policy
    this.policies.set('workspace-write', {
      sandboxMode: 'workspace-write',
      autoApproveThreshold: 15,
      requireConfirmationThreshold: 25,
      rules: [
        {
          id: 'workspace-file-read',
          operationType: 'file-read',
          condition: 'true',
          action: 'auto-approve',
          reason: 'File reading is generally safe',
          priority: 10,
        },
        {
          id: 'workspace-file-write-safe',
          operationType: 'file-write',
          condition: 'operation.target.startsWith(context.workspaceRoot)',
          action: 'auto-approve',
          reason: 'Writing within workspace is allowed',
          priority: 10,
        },
        {
          id: 'workspace-dangerous-command',
          operationType: 'command-exec',
          condition: 'riskAssessment.score > 20',
          action: 'require-confirmation',
          reason: 'High-risk command requires confirmation',
          priority: 5,
        },
      ],
    });

    // Full-access mode policy
    this.policies.set('full-access', {
      sandboxMode: 'full-access',
      autoApproveThreshold: 20,
      requireConfirmationThreshold: 35,
      rules: [
        {
          id: 'full-access-critical',
          operationType: 'command-exec',
          condition: 'riskAssessment.level === "critical"',
          action: 'require-confirmation',
          reason: 'Critical operations require confirmation even in full-access mode',
          priority: 10,
        },
      ],
    });
  }

  /**
   * Set the approval mode
   */
  setMode(mode: ApprovalMode): void {
    // Implementation for setting approval mode
    logger.info(`Approval mode set to: ${mode}`);
  }

  /**
   * Get approval history for a session
   */
  getApprovalHistory(sessionId: string): ApprovalResult[] {
    return this.approvalHistory.get(sessionId) || [];
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.userInterface.close();
    this.approvalHistory.clear();
    logger.info('Approval manager disposed');
  }
}
