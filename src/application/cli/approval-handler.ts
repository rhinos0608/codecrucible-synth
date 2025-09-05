/**
 * Approval Handler - Modularized Operation Approval
 * 
 * Extracted from UnifiedCLI to handle operation approval management:
 * - Operation approval using ApprovalModesManager
 * - Risk assessment and permission checks
 * - Approval mode management and statistics
 * - Interactive approval workflows
 */

import {
  ApprovalMode,
  ApprovalModesManager,
  Permission,
  cleanupApprovalManager,
  getApprovalManager,
} from '../../infrastructure/security/approval-modes-manager.js';
import { IUserInteraction } from '../../domain/interfaces/user-interaction.js';
import { getErrorMessage } from '../../utils/error-utils.js';
import chalk from 'chalk';

export interface ApprovalResult {
  approved: boolean;
  reason?: string;
}

export interface OperationInfo {
  operation: string;
  description: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  hasWriteAccess: boolean;
  workingDirectory?: string;
}

/**
 * Handles operation approval workflows and management
 */
export class ApprovalHandler {
  private readonly userInteraction: IUserInteraction;

  constructor(userInteraction: IUserInteraction) {
    this.userInteraction = userInteraction;
  }

  /**
   * Check operation approval
   */
  public async checkOperationApproval(operationInfo: OperationInfo): Promise<ApprovalResult> {
    const approvalManager = getApprovalManager();

    // Determine required permissions based on operation
    const permissions: Permission[] = [];

    if (operationInfo.hasWriteAccess) {
      permissions.push(ApprovalModesManager.permissions.writeWorkingDir());
    } else {
      permissions.push(ApprovalModesManager.permissions.readWorkingDir());
    }

    // Add execute permission for command operations
    if (operationInfo.operation.includes('execute') || operationInfo.operation.includes('command')) {
      permissions.push(ApprovalModesManager.permissions.executeWorkingDir());
    }

    const request = ApprovalModesManager.createRequest(
      operationInfo.operation,
      operationInfo.description,
      permissions,
      {
        workingDirectory: operationInfo.workingDirectory || process.cwd(),
        enterpriseCompliance: true,
      },
      operationInfo.riskLevel
    );

    return approvalManager.requestApproval(request);
  }

  /**
   * Handle approval mode commands
   */
  public async handleApprovalsCommand(args: readonly string[]): Promise<void> {
    const approvalManager = getApprovalManager();

    if (args.length === 0) {
      // Show current approval mode and statistics
      const stats = approvalManager.getStats();
      await this.userInteraction.display(`
${chalk.cyan('🔒 Approval System Status')}

${chalk.yellow('Current Mode:')} ${chalk.green(stats.currentMode)}
${chalk.yellow('Cached Rules:')} ${stats.cachedRules}
${chalk.yellow('Session Approvals:')} ${stats.sessionApprovals}

${chalk.yellow('Available Modes:')}
  • auto - Automatic approval for safe operations
  • read-only - Only read operations allowed
  • full-access - All operations approved (except critical)
  • interactive - Always prompt for approval
  • enterprise-audit - Strict compliance with audit trail
  • voice-collaborative - Optimized for multi-voice collaboration

${chalk.gray('Usage:')} approvals <mode> | approvals status | approvals clear
      `);
      return;
    }

    const command = args[0].toLowerCase();

    switch (command) {
      case 'status': {
        const stats = approvalManager.getStats();
        await this.userInteraction.display(JSON.stringify(stats, null, 2));
        break;
      }

      case 'clear': {
        approvalManager.clearCache();
        await this.userInteraction.display(chalk.green('✅ Approval cache cleared'));
        break;
      }

      case 'auto':
      case 'read-only':
      case 'full-access':
      case 'interactive':
      case 'enterprise-audit':
      case 'voice-collaborative':
        try {
          approvalManager.setMode(command as ApprovalMode);
          await this.userInteraction.display(chalk.green(`✅ Approval mode set to: ${command}`));
        } catch (error) {
          await this.userInteraction.error(
            `Failed to set approval mode: ${getErrorMessage(error)}`
          );
        }
        break;

      default:
        await this.userInteraction.error(
          `Unknown approval command: ${command}. Use 'approvals' for help.`
        );
    }
  }

  /**
   * Check if operation is likely code generation for risk assessment
   */
  isLikelyCodeGeneration(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase();

    // EXCLUDE: Help/advice/explanation questions
    const helpPatterns = [
      'how do i', 'how to', 'help me', 'explain', 'what is', 'what are',
      'why', 'when', 'where', 'fix', 'debug', 'solve', 'resolve',
      'error', 'issue', 'problem', 'trouble', 'advice', 'suggest',
      'recommend', 'best practice', 'should i', 'can you', 'could you',
    ];

    if (helpPatterns.some(pattern => lowerPrompt.includes(pattern))) {
      return false;
    }

    // INCLUDE: Strong code generation indicators
    const strongGenerationKeywords = [
      'create a', 'generate a', 'write a', 'build a', 'implement a',
      'create class', 'create function', 'create component', 'create module',
      'generate code', 'write code', 'build app', 'implement feature',
    ];

    if (strongGenerationKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return true;
    }

    // Weaker keywords only if they appear with creation context
    const weakKeywords = ['function', 'class', 'component', 'module', 'interface'];
    const creationContext = ['new', 'create', 'make', 'add', 'build'];

    return weakKeywords.some(
      keyword =>
        lowerPrompt.includes(keyword) &&
        creationContext.some(context => lowerPrompt.includes(context))
    );
  }

  /**
   * Cleanup approval manager resources
   */
  cleanup(): void {
    cleanupApprovalManager();
  }
}

export default ApprovalHandler;