/**
 * Git Manager Agent - Handles git operations and version control
 * Integrates with the existing UnifiedAgent system
 */

import { UnifiedAgent } from '../agent.js';
import { ExecutionRequest, ExecutionResponse } from '../types.js';
import { UnifiedModelClient } from '../client.js';
import { PerformanceMonitor } from '../../utils/performance.js';
import { logger } from '../logger.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitManagerAgent extends UnifiedAgent {
  constructor(modelClient: UnifiedModelClient, performanceMonitor: PerformanceMonitor) {
    super(modelClient, performanceMonitor);
  }

  async processRequest(input: string): Promise<ExecutionResponse> {
    logger.info('🔧 Git Manager Agent processing request');

    // Check if this is a direct git operation
    if (this.isGitOperation(input)) {
      return await this.handleGitOperation(input);
    }

    // For git-related analysis/advice, use UnifiedAgent
    const request: ExecutionRequest = {
      id: `git-manager-${Date.now()}`,
      input: `Git/Version Control Task: ${input}`,
      type: 'git-analysis',
      mode: 'fast', // Git operations should be fast
    };

    const response = await this.execute(request);

    if (response.success && response.result) {
      const enhancedResult = await this.enhanceWithGitContext(
        input,
        response.result as Record<string, unknown>
      );
      return {
        ...response,
        result: enhancedResult,
      };
    }

    return response;
  }

  private isGitOperation(input: string): boolean {
    const gitKeywords = [
      'git status',
      'git log',
      'git branch',
      'git diff',
      'git show',
      'check git status',
      'show git log',
      'list branches',
      'show changes',
    ];
    return gitKeywords.some(keyword => input.toLowerCase().includes(keyword));
  }

  private async handleGitOperation(input: string): Promise<ExecutionResponse> {
    try {
      let command = '';

      if (input.toLowerCase().includes('status')) {
        command = 'git status --porcelain -b';
      } else if (input.toLowerCase().includes('log')) {
        command = 'git log --oneline -10';
      } else if (input.toLowerCase().includes('branch')) {
        command = 'git branch -a';
      } else if (input.toLowerCase().includes('diff')) {
        command = 'git diff --stat';
      } else {
        command = 'git status'; // Default
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: process.cwd(),
        timeout: 10000,
      });

      const output = stdout || stderr;

      return {
        success: true,
        result: {
          content: this.formatGitOutput(command, output),
          operation: command,
          rawOutput: output,
        },
        workflowId: `git-op-${Date.now()}`,
        executionTime: 0,
      };
    } catch (error) {
      return {
        success: false,
        result: {},
        error: `Git operation failed: ${error instanceof Error ? error.message : String(error)}`,
        workflowId: `git-op-${Date.now()}`,
        executionTime: 0,
      };
    }
  }

  private formatGitOutput(command: string, output: string): string {
    if (!output.trim()) {
      return `✅ ${command} completed - no output (repository is clean)`;
    }

    let formatted = `🔧 Git Command: ${command}\n\n`;

    if (command.includes('status')) {
      formatted += this.formatStatusOutput(output);
    } else if (command.includes('log')) {
      formatted += this.formatLogOutput(output);
    } else if (command.includes('branch')) {
      formatted += this.formatBranchOutput(output);
    } else {
      formatted += output;
    }

    return formatted;
  }

  private formatStatusOutput(output: string): string {
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return '✅ Working directory is clean';
    }

    let formatted = 'Repository Status:\n';
    for (const line of lines) {
      if (line.startsWith('##')) {
        formatted += `📍 Branch: ${line.substring(2).trim()}\n`;
      } else if (line.startsWith('M ')) {
        formatted += `📝 Modified: ${line.substring(2).trim()}\n`;
      } else if (line.startsWith('A ')) {
        formatted += `➕ Added: ${line.substring(2).trim()}\n`;
      } else if (line.startsWith('D ')) {
        formatted += `❌ Deleted: ${line.substring(2).trim()}\n`;
      } else if (line.startsWith('??')) {
        formatted += `❓ Untracked: ${line.substring(2).trim()}\n`;
      } else {
        formatted += `   ${line}\n`;
      }
    }
    return formatted;
  }

  private formatLogOutput(output: string): string {
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return 'No commit history found';
    }

    let formatted = 'Recent Commits:\n';
    for (const line of lines) {
      const parts = line.split(' ');
      const hash = parts[0];
      const message = parts.slice(1).join(' ');
      formatted += `📝 ${hash}: ${message}\n`;
    }
    return formatted;
  }

  private formatBranchOutput(output: string): string {
    const lines = output.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      return 'No branches found';
    }

    let formatted = 'Branches:\n';
    for (const line of lines) {
      if (line.includes('*')) {
        formatted += `👉 ${line.trim()} (current)\n`;
      } else {
        formatted += `   ${line.trim()}\n`;
      }
    }
    return formatted;
  }

  private async enhanceWithGitContext(
    input: string,
    result: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return {
      ...result,
      gitContext: {
        workingDirectory: process.cwd(),
        capabilities: [
          'Git status checking',
          'Commit history review',
          'Branch management',
          'Change analysis',
        ],
        safeOperations: true, // Only read operations, no destructive changes
      },
      metadata: {
        ...((result.metadata as Record<string, unknown>) || {}),
        agentType: 'git-manager',
        safeMode: true,
      },
    };
  }
}
