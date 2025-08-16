/**
 * Edit Confirmation System
 * Provides user confirmation for code changes with before/after previews
 */

import { promises as fs } from 'fs';
import { join, relative } from 'path';
import chalk from 'chalk';
import { logger } from './logger.js';

export interface EditProposal {
  id: string;
  filePath: string;
  originalContent: string;
  proposedContent: string;
  changeType: 'create' | 'modify' | 'delete';
  reason: string;
  tool: string;
  timestamp: number;
}

export interface EditSummary {
  totalFiles: number;
  filesCreated: number;
  filesModified: number;
  filesDeleted: number;
  linesAdded: number;
  linesRemoved: number;
  linesChanged: number;
  proposals: EditProposal[];
}

export interface EditConfirmationOptions {
  requireConfirmation: boolean;
  showDiff: boolean;
  autoApproveSmallChanges: boolean;
  smallChangeThreshold: number; // lines
  interactive: boolean;
  batchMode: boolean;
}

export class EditConfirmationSystem {
  private pendingEdits: Map<string, EditProposal> = new Map();
  private options: EditConfirmationOptions;
  private workingDirectory: string;

  constructor(workingDirectory: string, options: Partial<EditConfirmationOptions> = {}) {
    this.workingDirectory = workingDirectory;
    this.options = {
      requireConfirmation: true,
      showDiff: true,
      autoApproveSmallChanges: false,
      smallChangeThreshold: 10,
      interactive: true,
      batchMode: false,
      ...options
    };
  }

  /**
   * Propose a file edit for user confirmation
   */
  async proposeEdit(
    filePath: string,
    proposedContent: string,
    reason: string,
    tool: string,
    changeType: 'create' | 'modify' | 'delete' = 'modify'
  ): Promise<EditProposal> {
    const fullPath = join(this.workingDirectory, filePath);
    const editId = `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let originalContent = '';
    if (changeType !== 'create') {
      try {
        originalContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        if (changeType === 'modify') {
          changeType = 'create'; // File doesn't exist, so it's a creation
        }
      }
    }

    const proposal: EditProposal = {
      id: editId,
      filePath: relative(this.workingDirectory, fullPath),
      originalContent,
      proposedContent,
      changeType,
      reason,
      tool,
      timestamp: Date.now()
    };

    this.pendingEdits.set(editId, proposal);
    
    logger.info(`📝 Edit proposed for ${proposal.filePath} by ${tool}: ${reason}`);
    
    return proposal;
  }

  /**
   * Get confirmation for a single edit
   */
  async confirmEdit(editId: string): Promise<boolean> {
    const proposal = this.pendingEdits.get(editId);
    if (!proposal) {
      throw new Error(`Edit proposal ${editId} not found`);
    }

    // Auto-approve if disabled
    if (!this.options.requireConfirmation) {
      return true;
    }

    // Auto-approve small changes if enabled
    if (this.options.autoApproveSmallChanges && this.isSmallChange(proposal)) {
      console.log(chalk.green(`✅ Auto-approved small change to ${proposal.filePath}`));
      return true;
    }

    // Show the edit preview
    this.displayEditPreview(proposal);

    // Get user confirmation
    if (this.options.interactive) {
      return await this.getUserConfirmation(proposal);
    }

    return false;
  }

  /**
   * Confirm all pending edits at once
   */
  async confirmAllEdits(): Promise<{ approved: string[], rejected: string[] }> {
    const approved: string[] = [];
    const rejected: string[] = [];

    if (this.pendingEdits.size === 0) {
      console.log(chalk.yellow('📝 No pending edits to confirm'));
      return { approved, rejected };
    }

    // Show summary first
    const summary = this.generateEditSummary();
    this.displayEditSummary(summary);

    if (!this.options.requireConfirmation) {
      for (const editId of this.pendingEdits.keys()) {
        approved.push(editId);
      }
      return { approved, rejected };
    }

    if (this.options.batchMode) {
      const batchApproval = await this.getBatchConfirmation(summary);
      if (batchApproval) {
        for (const editId of this.pendingEdits.keys()) {
          approved.push(editId);
        }
      } else {
        for (const editId of this.pendingEdits.keys()) {
          rejected.push(editId);
        }
      }
    } else {
      // Individual confirmation for each edit
      for (const [editId, proposal] of this.pendingEdits) {
        const isApproved = await this.confirmEdit(editId);
        if (isApproved) {
          approved.push(editId);
        } else {
          rejected.push(editId);
        }
      }
    }

    return { approved, rejected };
  }

  /**
   * Apply approved edits
   */
  async applyEdits(editIds: string[]): Promise<EditSummary> {
    const appliedProposals: EditProposal[] = [];
    
    for (const editId of editIds) {
      const proposal = this.pendingEdits.get(editId);
      if (!proposal) {
        logger.warn(`Edit ${editId} not found, skipping`);
        continue;
      }

      try {
        await this.applyEdit(proposal);
        appliedProposals.push(proposal);
        this.pendingEdits.delete(editId);
        
        console.log(chalk.green(`✅ Applied ${proposal.changeType} to ${proposal.filePath}`));
      } catch (error) {
        logger.error(`Failed to apply edit ${editId}:`, error);
        console.error(chalk.red(`❌ Failed to apply ${proposal.changeType} to ${proposal.filePath}: ${error}`));
      }
    }

    return this.calculateSummary(appliedProposals);
  }

  /**
   * Clear all pending edits
   */
  clearPendingEdits(): void {
    this.pendingEdits.clear();
    console.log(chalk.yellow('🧹 Cleared all pending edits'));
  }

  /**
   * Get pending edits count
   */
  getPendingEditsCount(): number {
    return this.pendingEdits.size;
  }

  /**
   * Generate comprehensive edit summary
   */
  private generateEditSummary(): EditSummary {
    const proposals = Array.from(this.pendingEdits.values());
    return this.calculateSummary(proposals);
  }

  /**
   * Calculate summary statistics for proposals
   */
  private calculateSummary(proposals: EditProposal[]): EditSummary {
    const summary: EditSummary = {
      totalFiles: proposals.length,
      filesCreated: 0,
      filesModified: 0,
      filesDeleted: 0,
      linesAdded: 0,
      linesRemoved: 0,
      linesChanged: 0,
      proposals
    };

    for (const proposal of proposals) {
      switch (proposal.changeType) {
        case 'create':
          summary.filesCreated++;
          summary.linesAdded += proposal.proposedContent.split('\n').length;
          break;
        case 'modify':
          summary.filesModified++;
          const diff = this.calculateLineDiff(proposal.originalContent, proposal.proposedContent);
          summary.linesAdded += diff.added;
          summary.linesRemoved += diff.removed;
          summary.linesChanged += diff.changed;
          break;
        case 'delete':
          summary.filesDeleted++;
          summary.linesRemoved += proposal.originalContent.split('\n').length;
          break;
      }
    }

    return summary;
  }

  /**
   * Display edit summary
   */
  private displayEditSummary(summary: EditSummary): void {
    console.log(chalk.cyan('\n📊 Edit Summary'));
    console.log(chalk.cyan('═══════════════'));
    console.log(`${chalk.white('Total Files:')} ${summary.totalFiles}`);
    
    if (summary.filesCreated > 0) {
      console.log(`${chalk.green('Files Created:')} ${summary.filesCreated}`);
    }
    if (summary.filesModified > 0) {
      console.log(`${chalk.yellow('Files Modified:')} ${summary.filesModified}`);
    }
    if (summary.filesDeleted > 0) {
      console.log(`${chalk.red('Files Deleted:')} ${summary.filesDeleted}`);
    }
    
    if (summary.linesAdded > 0) {
      console.log(`${chalk.green('Lines Added:')} ${summary.linesAdded}`);
    }
    if (summary.linesRemoved > 0) {
      console.log(`${chalk.red('Lines Removed:')} ${summary.linesRemoved}`);
    }
    if (summary.linesChanged > 0) {
      console.log(`${chalk.yellow('Lines Changed:')} ${summary.linesChanged}`);
    }

    console.log('\n📝 Proposed Changes:');
    for (const proposal of summary.proposals) {
      const icon = proposal.changeType === 'create' ? '📄' : 
                   proposal.changeType === 'modify' ? '✏️' : '🗑️';
      const color = proposal.changeType === 'create' ? chalk.green : 
                    proposal.changeType === 'modify' ? chalk.yellow : chalk.red;
      
      console.log(`${icon} ${color(proposal.filePath)} - ${proposal.reason}`);
    }
  }

  /**
   * Display individual edit preview
   */
  private displayEditPreview(proposal: EditProposal): void {
    const icon = proposal.changeType === 'create' ? '📄' : 
                 proposal.changeType === 'modify' ? '✏️' : '🗑️';
    const actionText = proposal.changeType === 'create' ? 'Create' : 
                       proposal.changeType === 'modify' ? 'Modify' : 'Delete';
    
    console.log(chalk.cyan(`\n${icon} ${actionText} File: ${proposal.filePath}`));
    console.log(chalk.gray(`Reason: ${proposal.reason}`));
    console.log(chalk.gray(`Tool: ${proposal.tool}`));
    console.log(chalk.gray('─'.repeat(60)));

    if (this.options.showDiff && proposal.changeType === 'modify') {
      this.displayDiff(proposal.originalContent, proposal.proposedContent);
    } else if (proposal.changeType === 'create') {
      console.log(chalk.green('New file content:'));
      console.log(this.formatContent(proposal.proposedContent, 20));
    } else if (proposal.changeType === 'delete') {
      console.log(chalk.red('File will be deleted'));
    }
  }

  /**
   * Display diff between original and proposed content
   */
  private displayDiff(original: string, proposed: string): void {
    const originalLines = original.split('\n');
    const proposedLines = proposed.split('\n');
    
    const maxLines = Math.max(originalLines.length, proposedLines.length);
    const previewLines = Math.min(maxLines, 20); // Limit preview to 20 lines
    
    console.log(chalk.gray('Changes preview (first 20 lines):'));
    console.log(chalk.red('- Original') + ' | ' + chalk.green('+ Proposed'));
    console.log('─'.repeat(60));
    
    for (let i = 0; i < previewLines; i++) {
      const originalLine = originalLines[i] || '';
      const proposedLine = proposedLines[i] || '';
      
      if (originalLine !== proposedLine) {
        if (originalLine && !proposedLine) {
          console.log(chalk.red(`- ${originalLine}`));
        } else if (!originalLine && proposedLine) {
          console.log(chalk.green(`+ ${proposedLine}`));
        } else {
          console.log(chalk.red(`- ${originalLine}`));
          console.log(chalk.green(`+ ${proposedLine}`));
        }
      } else if (originalLine) {
        console.log(chalk.gray(`  ${originalLine}`));
      }
    }
    
    if (maxLines > previewLines) {
      console.log(chalk.gray(`... and ${maxLines - previewLines} more lines`));
    }
  }

  /**
   * Format content for display with line limits
   */
  private formatContent(content: string, maxLines: number = 20): string {
    const lines = content.split('\n');
    if (lines.length <= maxLines) {
      return content;
    }
    
    return lines.slice(0, maxLines).join('\n') + 
           `\n${chalk.gray(`... and ${lines.length - maxLines} more lines`)}`;
  }

  /**
   * Check if change is considered small
   */
  private isSmallChange(proposal: EditProposal): boolean {
    if (proposal.changeType === 'create' || proposal.changeType === 'delete') {
      return false;
    }
    
    const diff = this.calculateLineDiff(proposal.originalContent, proposal.proposedContent);
    const totalChanges = diff.added + diff.removed + diff.changed;
    
    return totalChanges <= this.options.smallChangeThreshold;
  }

  /**
   * Calculate line differences
   */
  private calculateLineDiff(original: string, proposed: string): { added: number, removed: number, changed: number } {
    const originalLines = original.split('\n');
    const proposedLines = proposed.split('\n');
    
    let added = 0;
    let removed = 0;
    let changed = 0;
    
    const maxLines = Math.max(originalLines.length, proposedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const originalLine = originalLines[i];
      const proposedLine = proposedLines[i];
      
      if (originalLine === undefined && proposedLine !== undefined) {
        added++;
      } else if (originalLine !== undefined && proposedLine === undefined) {
        removed++;
      } else if (originalLine !== proposedLine) {
        changed++;
      }
    }
    
    return { added, removed, changed };
  }

  /**
   * Get user confirmation for individual edit
   */
  private async getUserConfirmation(proposal: EditProposal): Promise<boolean> {
    const inquirer = (await import('inquirer')).default;
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Apply ${proposal.changeType} to ${proposal.filePath}?`,
        default: false
      }
    ]);
    
    return confirm;
  }

  /**
   * Get batch confirmation for all edits
   */
  private async getBatchConfirmation(summary: EditSummary): Promise<boolean> {
    const inquirer = (await import('inquirer')).default;
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Apply all ${summary.totalFiles} proposed changes?`,
        default: false
      }
    ]);
    
    return confirm;
  }

  /**
   * Apply a single edit to the filesystem
   */
  private async applyEdit(proposal: EditProposal): Promise<void> {
    const fullPath = join(this.workingDirectory, proposal.filePath);
    
    switch (proposal.changeType) {
      case 'create':
      case 'modify':
        // Ensure directory exists
        await fs.mkdir(join(fullPath, '..'), { recursive: true });
        await fs.writeFile(fullPath, proposal.proposedContent, 'utf-8');
        break;
      case 'delete':
        await fs.unlink(fullPath);
        break;
    }
  }
}

/**
 * Global edit confirmation system instance
 */
export let globalEditConfirmation: EditConfirmationSystem | null = null;

/**
 * Initialize global edit confirmation system
 */
export function initializeEditConfirmation(
  workingDirectory: string, 
  options: Partial<EditConfirmationOptions> = {}
): EditConfirmationSystem {
  globalEditConfirmation = new EditConfirmationSystem(workingDirectory, options);
  return globalEditConfirmation;
}