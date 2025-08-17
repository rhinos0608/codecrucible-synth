/**
 * Confirmed Write Tool - Integrates with edit confirmation system
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { UnifiedAgent } from '../agent.js';
import { logger } from '../logger.js';

const ConfirmedWriteSchema = z.object({
  path: z.string().describe('The path to the file to write'),
  content: z.string().describe('The content to write to the file'),
  reason: z.string().optional().describe('Reason for the change (for user confirmation)'),
  requireConfirmation: z.boolean().optional().default(true).describe('Whether to require user confirmation')
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

      const fullPath = join(this.agentContext.workingDirectory, args.path);
      const reason = args.reason || `Write content to ${args.path}`;

      // Check if file exists and read current content
      let originalContent: string | undefined;
      let changeType: 'create' | 'modify' = 'create';
      
      try {
        originalContent = await fs.readFile(fullPath, 'utf8');
        changeType = 'modify';
      } catch {
        // File doesn't exist, it's a creation
        changeType = 'create';
      }

      // Create edit operation
      const editOperation = {
        id: this.generateOperationId(),
        type: changeType,
        targetPath: fullPath,
        originalContent: originalContent,
        newContent: args.content,
        metadata: {
          timestamp: Date.now(),
          agent: 'ConfirmedWriteTool',
          reason: reason,
          confidence: 90
        }
      };

      // Propose the edit
      if (args.requireConfirmation) {
        const result = await (await import("../agent.js")).globalEditConfirmation.proposeEdits(
          [editOperation], 
          `${changeType === 'create' ? 'Create' : 'Modify'} ${args.path}`
        );
        
        return {
          success: true,
          pendingConfirmation: true,
          changeType,
          filePath: args.path,
          message: result
        };
      } else {
        // Direct write without confirmation
        await fs.mkdir(dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, args.content, 'utf8');
        
        return {
          success: true,
          changeType,
          filePath: args.path,
          message: `Successfully ${changeType}d file ${args.path}`
        };
      }

    } catch (error) {
      logger.error('ConfirmedWriteTool execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Alias for backwards compatibility
export class ConfirmEditsTool extends ConfirmedWriteTool {}

// Placeholder for ViewPendingEditsTool
export class ViewPendingEditsTool extends BaseTool {
  constructor(agentContext: { workingDirectory: string }) {
    super({
      name: 'viewPendingEdits',
      description: 'View pending edit operations awaiting confirmation',
      category: 'File System',
      parameters: z.object({})
    });
  }

  async execute(): Promise<any> {
    const { UnifiedAgent } = await import('../agent.js');
    const pendingCount = (await import("../agent.js")).globalEditConfirmation.getPendingEditsCount();
    
    return {
      success: true,
      pendingCount,
      message: `Found ${pendingCount} pending edit operations`
    };
  }
}