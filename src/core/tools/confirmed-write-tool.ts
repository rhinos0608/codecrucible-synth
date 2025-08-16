/**
 * Confirmed Write Tool - Integrates with edit confirmation system
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { globalEditConfirmation } from '../edit-confirmation-system.js';
import { logger } from '../logger.js';

const ConfirmedWriteSchema = z.object({
  path: z.string().describe('The path to the file to write'),
  content: z.string().describe('The content to write to the file'),
  reason: z.string().optional().describe('Reason for the change (for user confirmation)'),
  requireConfirmation: z.boolean().optional().default(true).describe('Whether to require user confirmation'),
  backup: z.boolean().optional().default(true).describe('Whether to create a backup of existing file')
});

export class ConfirmedWriteTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'confirmedWrite',
      description: 'Write content to a file with user confirmation and before/after preview',
      category: 'File System',
      parameters: ConfirmedWriteSchema,
      examples: [
        '{"path": "src/component.ts", "content": "export const Component = () => {};", "reason": "Create new React component"}',
        '{"path": "package.json", "content": "{...}", "reason": "Update dependencies", "requireConfirmation": true}'
      ]
    });
  }

  async execute(args: z.infer<typeof ConfirmedWriteSchema>): Promise<any> {
    try {
      // Validate input
      if (!args.path || !args.content) {
        return { 
          error: 'Both path and content are required',
          success: false 
        };
      }

      if (!globalEditConfirmation) {
        return { 
          error: 'Edit confirmation system not initialized',
          success: false 
        };
      }

      const fullPath = join(this.agentContext.workingDirectory, args.path);
      const reason = args.reason || `Write content to ${args.path}`;

      // Check if file exists to determine change type
      let changeType: 'create' | 'modify' = 'create';
      try {
        await fs.access(fullPath);
        changeType = 'modify';
      } catch {
        // File doesn't exist, it's a creation
      }

      // Create backup if requested and file exists
      if (args.backup && changeType === 'modify') {
        await this.createBackup(fullPath);
      }

      // Propose the edit
      const proposal = await globalEditConfirmation.proposeEdit(
        args.path,
        args.content,
        reason,
        'confirmedWrite',
        changeType
      );

      // If confirmation not required, auto-approve
      if (!args.requireConfirmation) {
        const { approved } = await globalEditConfirmation.confirmAllEdits();
        if (approved.includes(proposal.id)) {
          const summary = await globalEditConfirmation.applyEdits([proposal.id]);
          return {
            success: true,
            changeType,
            filePath: args.path,
            proposalId: proposal.id,
            summary,
            message: `Successfully ${changeType}d file ${args.path}`
          };
        }
      }

      return {
        success: true,
        pendingConfirmation: true,
        changeType,
        filePath: args.path,
        proposalId: proposal.id,
        message: `Edit proposed for ${args.path}. Use 'confirmEdits' tool to apply changes.`,
        confirmationRequired: args.requireConfirmation
      };

    } catch (error) {
      logger.error('ConfirmedWriteTool execution failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      };
    }
  }

  /**
   * Create backup of existing file
   */
  private async createBackup(filePath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.backup.${timestamp}`;
    
    try {
      await fs.copyFile(filePath, backupPath);
      logger.info(`Created backup: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.warn(`Failed to create backup for ${filePath}:`, error);
      throw error;
    }
  }
}

/**
 * Tool for confirming and applying pending edits
 */
const ConfirmEditsSchema = z.object({
  mode: z.enum(['batch', 'individual']).optional().default('batch').describe('Confirmation mode'),
  editIds: z.array(z.string()).optional().describe('Specific edit IDs to confirm (optional)')
});

export class ConfirmEditsTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'confirmEdits',
      description: 'Confirm and apply pending file edits with user approval',
      category: 'File System',
      parameters: ConfirmEditsSchema,
      examples: [
        '{"mode": "batch"}',
        '{"mode": "individual"}',
        '{"editIds": ["edit_123", "edit_456"]}'
      ]
    });
  }

  async execute(args: z.infer<typeof ConfirmEditsSchema>): Promise<any> {
    try {
      if (!globalEditConfirmation) {
        return { 
          error: 'Edit confirmation system not initialized',
          success: false 
        };
      }

      const pendingCount = globalEditConfirmation.getPendingEditsCount();
      if (pendingCount === 0) {
        return {
          success: true,
          message: 'No pending edits to confirm',
          pendingEdits: 0
        };
      }

      let result;
      if (args.editIds && args.editIds.length > 0) {
        // Confirm specific edits
        const approved: string[] = [];
        const rejected: string[] = [];
        
        for (const editId of args.editIds) {
          const isApproved = await globalEditConfirmation.confirmEdit(editId);
          if (isApproved) {
            approved.push(editId);
          } else {
            rejected.push(editId);
          }
        }
        
        result = { approved, rejected };
      } else {
        // Confirm all edits
        result = await globalEditConfirmation.confirmAllEdits();
      }

      // Apply approved edits
      const summary = await globalEditConfirmation.applyEdits(result.approved);

      return {
        success: true,
        approved: result.approved.length,
        rejected: result.rejected.length,
        summary,
        message: `Applied ${result.approved.length} edits, rejected ${result.rejected.length}`
      };

    } catch (error) {
      logger.error('ConfirmEditsTool execution failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      };
    }
  }
}

/**
 * Tool for viewing pending edits
 */
const ViewPendingEditsSchema = z.object({
  showDetails: z.boolean().optional().default(false).describe('Show detailed diff preview')
});

export class ViewPendingEditsTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'viewPendingEdits',
      description: 'View summary of pending file edits awaiting confirmation',
      category: 'File System',
      parameters: ViewPendingEditsSchema,
      examples: [
        '{"showDetails": false}',
        '{"showDetails": true}'
      ]
    });
  }

  async execute(args: z.infer<typeof ViewPendingEditsSchema>): Promise<any> {
    try {
      if (!globalEditConfirmation) {
        return { 
          error: 'Edit confirmation system not initialized',
          success: false 
        };
      }

      const pendingCount = globalEditConfirmation.getPendingEditsCount();
      if (pendingCount === 0) {
        return {
          success: true,
          message: 'No pending edits',
          pendingEdits: 0
        };
      }

      // This will trigger the display of the edit summary
      const summary = globalEditConfirmation['generateEditSummary']();
      
      if (args.showDetails) {
        globalEditConfirmation['displayEditSummary'](summary);
      }

      return {
        success: true,
        pendingEdits: pendingCount,
        summary: {
          totalFiles: summary.totalFiles,
          filesCreated: summary.filesCreated,
          filesModified: summary.filesModified,
          filesDeleted: summary.filesDeleted,
          linesAdded: summary.linesAdded,
          linesRemoved: summary.linesRemoved,
          files: summary.proposals.map(p => ({
            path: p.filePath,
            type: p.changeType,
            reason: p.reason,
            tool: p.tool
          }))
        },
        message: `${pendingCount} edits pending confirmation`
      };

    } catch (error) {
      logger.error('ViewPendingEditsTool execution failed:', error);
      return {
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        success: false
      };
    }
  }
}