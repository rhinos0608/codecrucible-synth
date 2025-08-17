import { EventEmitter } from 'events';
import { logger } from './logger.js';
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export interface EditOperation {
  id: string;
  type: 'create' | 'modify' | 'delete';
  targetPath: string;
  originalContent?: string;
  newContent?: string;
  metadata: {
    timestamp: number;
    agent: string;
    reason: string;
    confidence: number;
  };
}

export interface EditBatch {
  id: string;
  operations: EditOperation[];
  summary: string;
  totalFiles: number;
  linesAdded: number;
  linesRemoved: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'applied';
}

export class EditConfirmationSystem extends EventEmitter {
  private pendingBatches: Map<string, EditBatch> = new Map();
  public options: any = {}; // CLI compatibility

  // Static instance for global access
  private static instance: EditConfirmationSystem | null = null;

  public static getInstance(): EditConfirmationSystem {
    if (!EditConfirmationSystem.instance) {
      EditConfirmationSystem.instance = new EditConfirmationSystem();
    }
    return EditConfirmationSystem.instance;
  }

  public async proposeEdits(operations: EditOperation[], summary: string, agent: string): Promise<string> {
    const batchId = this.generateBatchId();
    const batch = this.createEditBatch(batchId, operations, summary);
    
    this.pendingBatches.set(batchId, batch);
    logger.info(`📝 Edit batch ${batchId} proposed: ${summary}`);

    return await this.requestConfirmation(batchId);
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createEditBatch(id: string, operations: EditOperation[], summary: string): EditBatch {
    const stats = this.calculateStats(operations);
    return {
      id,
      operations,
      summary,
      totalFiles: stats.totalFiles,
      linesAdded: stats.linesAdded,
      linesRemoved: stats.linesRemoved,
      riskLevel: this.assessRisk(operations, stats),
      status: 'pending'
    };
  }

  private calculateStats(operations: EditOperation[]) {
    let totalFiles = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const op of operations) {
      totalFiles++;
      if (op.newContent && op.originalContent) {
        const newLines = op.newContent.split('\n').length;
        const oldLines = op.originalContent.split('\n').length;
        linesAdded += Math.max(0, newLines - oldLines);
        linesRemoved += Math.max(0, oldLines - newLines);
      } else if (op.newContent) {
        linesAdded += op.newContent.split('\n').length;
      }
    }

    return { totalFiles, linesAdded, linesRemoved };
  }

  private assessRisk(operations: EditOperation[], stats: any): 'low' | 'medium' | 'high' | 'critical' {
    const criticalFiles = ['package.json', 'tsconfig.json'];
    const hasCriticalFiles = operations.some(op => 
      criticalFiles.some(file => op.targetPath.includes(file))
    );

    if (hasCriticalFiles) return 'critical';
    if (stats.totalFiles > 10 || stats.linesRemoved > 100) return 'high';
    if (stats.totalFiles > 5 || stats.linesAdded > 50) return 'medium';
    return 'low';
  }

  private async requestConfirmation(batchId: string): Promise<string> {
    const batch = this.pendingBatches.get(batchId);
    if (!batch) throw new Error(`Batch ${batchId} not found`);

    console.log(chalk.cyan('\n🤖 CodeCrucible wants to make changes:\n'));
    console.log(`Summary: ${batch.summary}`);
    console.log(`Files: ${batch.totalFiles}, Lines: +${batch.linesAdded}/-${batch.linesRemoved}`);
    console.log(`Risk: ${batch.riskLevel.toUpperCase()}\n`);

    const { confirm } = await inquirer.prompt([{
      type: 'confirm',
      name: 'confirm',
      message: 'Apply these changes?',
      default: false
    }]);

    if (confirm) {
      return await this.applyEdits(batchId);
    } else {
      batch.status = 'rejected';
      this.pendingBatches.delete(batchId);
      return 'Changes rejected by user.';
    }
  }

  public async applyEdits(batchIds: string | string[]): Promise<any> {
    const ids = Array.isArray(batchIds) ? batchIds : [batchIds];
    let totalFiles = 0;
    let filesModified = 0;
    let filesCreated = 0;
    let filesDeleted = 0;
    let linesAdded = 0;
    let linesRemoved = 0;

    for (const batchId of ids) {
      const batch = this.pendingBatches.get(batchId);
      if (!batch) continue;

      try {
        for (const operation of batch.operations) {
          await this.applyOperation(operation);
          totalFiles++;
          
          if (operation.type === 'create') filesCreated++;
          else if (operation.type === 'modify') filesModified++;
          else if (operation.type === 'delete') filesDeleted++;
        }

        linesAdded += batch.linesAdded;
        linesRemoved += batch.linesRemoved;
        
        batch.status = 'applied';
        this.pendingBatches.delete(batchId);
      } catch (error) {
        logger.error(`Failed to apply batch ${batchId}:`, error);
        throw error;
      }
    }

    return {
      totalFiles,
      filesModified,
      filesCreated,
      filesDeleted,
      linesAdded,
      linesRemoved,
      linesChanged: linesAdded + linesRemoved
    };
  }

  private async applyOperation(operation: EditOperation): Promise<void> {
    const { type, targetPath, newContent } = operation;

    switch (type) {
      case 'create':
      case 'modify':
        if (!newContent) throw new Error('No content for create/modify operation');
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, newContent, 'utf8');
        break;
      case 'delete':
        await fs.unlink(targetPath);
        break;
    }
  }

  // CLI compatibility methods
  public getPendingEditsCount(): number {
    return this.pendingBatches.size;
  }
  
  public clearPendingEdits(): void {
    this.pendingBatches.clear();
  }
  
  public async confirmAllEdits(): Promise<{ approved: string[], rejected: string[] }> {
    const batches = Array.from(this.pendingBatches.values());
    const approved: string[] = [];
    const rejected: string[] = [];
    
    for (const batch of batches) {
      if (batch.status === 'pending') {
        batch.status = 'approved';
        approved.push(batch.id);
      } else if (batch.status === 'rejected') {
        rejected.push(batch.id);
      }
    }
    
    return { approved, rejected };
  }
  
  public generateEditSummary(): any {
    return { pendingCount: this.pendingBatches.size };
  }
  
  public displayEditSummary(summary: any): void {
    console.log(`Pending edits: ${summary.pendingCount}`);
  }
  
  public async confirmEdit(id: string): Promise<any> {
    const batch = this.pendingBatches.get(id);
    if (batch) {
      batch.status = 'approved';
      const result = await this.applyEdits(id);
      return typeof result === 'string' ? result : `✅ Applied edits successfully`;
    }
    return 'Edit not found';
  }
}

// Global instance accessor
export const globalEditConfirmation = EditConfirmationSystem.getInstance();

// Initialize function for compatibility  
export function initializeEditConfirmation(workingDir?: string, options?: any) {
  const instance = EditConfirmationSystem.getInstance();
  if (options) {
    instance.options = { ...instance.options, ...options };
  }
  return instance;
}