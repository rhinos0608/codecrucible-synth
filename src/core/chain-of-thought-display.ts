/**
 * Chain-of-Thought Display System
 * Shows agent reasoning process, tool calls, and decision-making to users
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';

export interface ThoughtStep {
  id: string;
  timestamp: number;
  type: 'reasoning' | 'tool_call' | 'file_read' | 'analysis' | 'conclusion' | 'decision' | 'error';
  title: string;
  content: string;
  metadata?: {
    duration?: number;
    toolName?: string;
    fileName?: string;
    fileSize?: number;
    linesRead?: number;
    reasoning?: string;
    confidence?: number;
    nextAction?: string;
  };
  level: 'info' | 'debug' | 'success' | 'warning' | 'error';
}

export interface ChainOfThoughtOptions {
  showTimestamps: boolean;
  showDuration: boolean;
  showMetadata: boolean;
  showReasoningDetails: boolean;
  indentLevel: number;
  colorOutput: boolean;
  realTimeDisplay: boolean;
}

export class ChainOfThoughtDisplay extends EventEmitter {
  private steps: ThoughtStep[] = [];
  private options: ChainOfThoughtOptions;
  private currentIndentLevel: number = 0;
  private startTime: number = Date.now();

  constructor(options: Partial<ChainOfThoughtOptions> = {}) {
    super();

    this.options = {
      showTimestamps: true,
      showDuration: true,
      showMetadata: true,
      showReasoningDetails: true,
      indentLevel: 0,
      colorOutput: true,
      realTimeDisplay: true,
      ...options,
    };
  }

  /**
   * Start a new chain of thought session
   */
  startSession(title: string): void {
    this.steps = [];
    this.currentIndentLevel = 0;
    this.startTime = Date.now();

    console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue(`║ 🤔 ${title.padEnd(56)} ║`));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
  }

  /**
   * Add a reasoning step
   */
  addReasoning(title: string, reasoning: string, confidence?: number, nextAction?: string): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'reasoning',
      title,
      content: reasoning,
      metadata: {
        confidence,
        nextAction,
        reasoning,
      },
      level: 'info',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Add a tool call step
   */
  addToolCall(toolName: string, description: string, parameters?: any): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'tool_call',
      title: `🛠️  Calling ${toolName}`,
      content: description,
      metadata: {
        toolName,
        ...parameters,
      },
      level: 'info',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Add a file reading step
   */
  addFileRead(fileName: string, reason: string, fileSize?: number, linesRead?: number): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'file_read',
      title: `📄 Reading ${fileName}`,
      content: reason,
      metadata: {
        fileName,
        fileSize,
        linesRead,
        reasoning: reason,
      },
      level: 'info',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Add an analysis step
   */
  addAnalysis(title: string, findings: string, confidence: number = 0.8): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'analysis',
      title: `🔍 ${title}`,
      content: findings,
      metadata: {
        confidence,
        reasoning: findings,
      },
      level: confidence > 0.7 ? 'success' : 'warning',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Add a decision step
   */
  addDecision(decision: string, reasoning: string, alternatives?: string[]): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'decision',
      title: `⚡ Decision: ${decision}`,
      content: reasoning,
      metadata: {
        reasoning,
        nextAction: decision,
      },
      level: 'success',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);

      // Show alternatives if provided
      if (alternatives && alternatives.length > 0) {
        console.log(chalk.gray(`    ${this.getIndent()}💭 Alternatives considered:`));
        alternatives.forEach(alt => {
          console.log(chalk.gray(`    ${this.getIndent()}   • ${alt}`));
        });
      }
    }
  }

  /**
   * Add a conclusion step
   */
  addConclusion(title: string, conclusion: string, confidence: number = 0.9): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'conclusion',
      title: `✅ ${title}`,
      content: conclusion,
      metadata: {
        confidence,
        reasoning: conclusion,
      },
      level: 'success',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Add an error step
   */
  addError(error: string, context: string, resolution?: string): void {
    const step: ThoughtStep = {
      id: this.generateStepId(),
      timestamp: Date.now(),
      type: 'error',
      title: `❌ Error`,
      content: `${error}\nContext: ${context}${resolution ? `\nResolution: ${resolution}` : ''}`,
      metadata: {
        reasoning: context,
      },
      level: 'error',
    };

    this.steps.push(step);

    if (this.options.realTimeDisplay) {
      this.displayStep(step);
    }
  }

  /**
   * Increase indentation level for nested operations
   */
  indent(): void {
    this.currentIndentLevel++;
  }

  /**
   * Decrease indentation level
   */
  outdent(): void {
    this.currentIndentLevel = Math.max(0, this.currentIndentLevel - 1);
  }

  /**
   * Display a single step
   */
  private displayStep(step: ThoughtStep): void {
    const indent = this.getIndent();
    const timestamp = this.options.showTimestamps
      ? chalk.gray(`[${this.formatTimestamp(step.timestamp)}] `)
      : '';

    // Choose color based on step type and level
    const color = this.getStepColor(step);

    // Display main step
    console.log(`${indent}${timestamp}${color(step.title)}`);

    // Display content with proper indentation
    if (step.content) {
      const contentLines = step.content.split('\n');
      contentLines.forEach(line => {
        if (line.trim()) {
          console.log(`${indent}  ${chalk.gray(line)}`);
        }
      });
    }

    // Display metadata if enabled
    if (this.options.showMetadata && step.metadata) {
      this.displayMetadata(step, indent);
    }

    // Add spacing
    console.log();
  }

  /**
   * Display step metadata
   */
  private displayMetadata(step: ThoughtStep, indent: string): void {
    const meta = step.metadata!;

    if (meta.duration && this.options.showDuration) {
      console.log(`${indent}  ${chalk.gray(`⏱️  Duration: ${meta.duration}ms`)}`);
    }

    if (meta.confidence) {
      const confidenceColor =
        meta.confidence > 0.8 ? chalk.green : meta.confidence > 0.6 ? chalk.yellow : chalk.red;
      console.log(
        `${indent}  ${chalk.gray('🎯 Confidence:')} ${confidenceColor(`${Math.round(meta.confidence * 100)}%`)}`
      );
    }

    if (meta.nextAction && this.options.showReasoningDetails) {
      console.log(`${indent}  ${chalk.gray('➡️  Next:')} ${chalk.cyan(meta.nextAction)}`);
    }

    if (meta.fileSize) {
      console.log(
        `${indent}  ${chalk.gray(`📊 Size: ${this.formatFileSize(meta.fileSize)}`)}${meta.linesRead ? ` (${meta.linesRead} lines)` : ''}`
      );
    }
  }

  /**
   * Get color for step based on type and level
   */
  private getStepColor(step: ThoughtStep): (text: string) => string {
    if (!this.options.colorOutput) {
      return (text: string) => text;
    }

    switch (step.level) {
      case 'success':
        return chalk.green;
      case 'warning':
        return chalk.yellow;
      case 'error':
        return chalk.red;
      case 'debug':
        return chalk.gray;
      default:
        return chalk.cyan;
    }
  }

  /**
   * Get current indentation string
   */
  private getIndent(): string {
    return '  '.repeat(this.currentIndentLevel + this.options.indentLevel);
  }

  /**
   * Format timestamp
   */
  private formatTimestamp(timestamp: number): string {
    const elapsed = timestamp - this.startTime;
    return `+${elapsed.toString().padStart(4, '0')}ms`;
  }

  /**
   * Format file size
   */
  private formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 10) / 10} ${sizes[i]}`;
  }

  /**
   * Generate unique step ID
   */
  private generateStepId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * End session and display summary
   */
  endSession(summary?: string): void {
    const totalDuration = Date.now() - this.startTime;

    console.log(chalk.blue('┌──────────────────────────────────────────────────────────────┐'));
    console.log(chalk.blue('│ 🎯 Chain of Thought Summary                                 │'));
    console.log(chalk.blue('└──────────────────────────────────────────────────────────────┘'));

    console.log(chalk.gray(`Total steps: ${this.steps.length}`));
    console.log(chalk.gray(`Total duration: ${totalDuration}ms`));

    // Count step types
    const typeCount = this.steps.reduce(
      (acc, step) => {
        acc[step.type] = (acc[step.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    Object.entries(typeCount).forEach(([type, count]) => {
      console.log(chalk.gray(`${this.getTypeEmoji(type)} ${type}: ${count}`));
    });

    if (summary) {
      console.log();
      console.log(chalk.cyan('📝 Summary:'));
      console.log(chalk.gray(summary));
    }

    console.log();
  }

  /**
   * Get emoji for step type
   */
  private getTypeEmoji(type: string): string {
    const emojis: Record<string, string> = {
      reasoning: '🤔',
      tool_call: '🛠️',
      file_read: '📄',
      analysis: '🔍',
      conclusion: '✅',
      decision: '⚡',
      error: '❌',
    };
    return emojis[type] || '📋';
  }

  /**
   * Get all steps (for debugging or analysis)
   */
  getSteps(): ThoughtStep[] {
    return [...this.steps];
  }

  /**
   * Export session as JSON
   */
  exportSession(): string {
    return JSON.stringify(
      {
        startTime: this.startTime,
        endTime: Date.now(),
        steps: this.steps,
        summary: {
          totalSteps: this.steps.length,
          duration: Date.now() - this.startTime,
          stepTypes: this.steps.reduce(
            (acc, step) => {
              acc[step.type] = (acc[step.type] || 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
      },
      null,
      2
    );
  }
}

// Default instance for easy use
export const chainOfThought = new ChainOfThoughtDisplay({
  realTimeDisplay: true,
  showTimestamps: true,
  showDuration: true,
  showMetadata: true,
  colorOutput: true,
});

export default chainOfThought;
