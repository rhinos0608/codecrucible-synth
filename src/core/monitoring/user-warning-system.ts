/**
 * User-Friendly Warning System for CLI AI Agents
 * Industry standard: Warn users about resource usage and repetitive actions
 * Never terminate processes - only provide helpful guidance
 */

import { logger } from '../logger.js';
import chalk from 'chalk';

export interface WarningConfig {
  memoryWarningThreshold: number; // 0.85 = 85%
  repetitiveToolThreshold: number; // 5 uses of same tool
  longRunningWarningInterval: number; // 1800000 = 30 minutes
  maxWarningsPerHour: number; // 3 warnings per hour max
}

export interface ToolUsage {
  toolName: string;
  count: number;
  lastUsed: Date;
  firstUsed: Date;
}

export class UserWarningSystem {
  private config: WarningConfig;
  private toolUsageMap: Map<string, ToolUsage> = new Map();
  private lastWarningTimes: Map<string, number> = new Map();
  private sessionStartTime: Date;

  constructor(config?: Partial<WarningConfig>) {
    this.config = {
      memoryWarningThreshold: 0.85, // 85% memory usage
      repetitiveToolThreshold: 10,   // Warn after 10 uses of same tool
      longRunningWarningInterval: 1800000, // 30 minutes
      maxWarningsPerHour: 2,         // Max 2 warnings per hour per type
      ...config
    };
    
    this.sessionStartTime = new Date();
    
    // Set up periodic long-running session warnings
    this.startLongRunningWarnings();
  }

  /**
   * Check memory usage and warn user if high (never terminate)
   */
  checkMemoryUsage(currentUsage: number): void {
    if (currentUsage < this.config.memoryWarningThreshold) return;
    
    if (!this.shouldWarn('memory', 3600000)) return; // Max 1 memory warning per hour
    
    const percentage = (currentUsage * 100).toFixed(1);
    
    console.log(chalk.yellow(`
⚠️  Memory Usage Warning
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current memory usage: ${percentage}%

💡 Suggestions:
   • Your AI agent is using significant memory
   • Consider using a smaller model for faster responses
   • Run "crucible models" to see lighter alternatives
   • The agent will continue running normally

This is just a helpful notice - your session will continue.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`));
    
    logger.info(`User warned about memory usage: ${percentage}%`);
    this.recordWarning('memory');
  }

  /**
   * Track tool usage and warn about repetitive usage
   */
  trackToolUsage(toolName: string): void {
    const now = new Date();
    const existing = this.toolUsageMap.get(toolName);
    
    if (existing) {
      existing.count++;
      existing.lastUsed = now;
    } else {
      this.toolUsageMap.set(toolName, {
        toolName,
        count: 1,
        lastUsed: now,
        firstUsed: now
      });
    }
    
    this.checkRepetitiveUsage(toolName);
  }

  /**
   * Check for repetitive tool usage and warn user
   */
  private checkRepetitiveUsage(toolName: string): void {
    const usage = this.toolUsageMap.get(toolName);
    if (!usage || usage.count < this.config.repetitiveToolThreshold) return;
    
    if (!this.shouldWarn(`repetitive-${toolName}`, 1800000)) return; // Max 1 warning per 30min per tool
    
    const duration = Math.round((usage.lastUsed.getTime() - usage.firstUsed.getTime()) / 1000 / 60);
    
    console.log(chalk.yellow(`
🔄 Repetitive Tool Usage Notice
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tool: ${toolName}
Used: ${usage.count} times in ${duration} minutes

💡 Suggestions:
   • Consider if this task could be automated differently
   • You might be able to batch these operations
   • The agent is working correctly - this is just a notice
   • Your session will continue normally

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`));
    
    logger.info(`User warned about repetitive tool usage: ${toolName} (${usage.count} times)`);
    this.recordWarning(`repetitive-${toolName}`);
  }

  /**
   * Start periodic long-running session warnings
   */
  private startLongRunningWarnings(): void {
    setInterval(() => {
      this.checkLongRunningSession();
    }, this.config.longRunningWarningInterval);
  }

  /**
   * Warn user about long-running sessions (helpful, not alarming)
   */
  private checkLongRunningSession(): void {
    if (!this.shouldWarn('long-running', this.config.longRunningWarningInterval * 2)) return;
    
    const runtime = Math.round((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
    
    console.log(chalk.blue(`
⏰ Long-Running Session Notice
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Session runtime: ${runtime} minutes

✨ Your AI agent is working great!
   • This is normal for complex tasks
   • The agent can run for hours if needed
   • Everything is functioning properly
   • You can exit anytime with Ctrl+C

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`));
    
    logger.info(`Long-running session notice: ${runtime} minutes`);
    this.recordWarning('long-running');
  }

  /**
   * Check if we should show a warning (rate limiting)
   */
  private shouldWarn(warningType: string, cooldownMs: number): boolean {
    const lastWarning = this.lastWarningTimes.get(warningType);
    if (!lastWarning) return true;
    
    return (Date.now() - lastWarning) > cooldownMs;
  }

  /**
   * Record that we showed a warning
   */
  private recordWarning(warningType: string): void {
    this.lastWarningTimes.set(warningType, Date.now());
  }

  /**
   * Get session statistics for user
   */
  getSessionStats(): string {
    const runtime = Math.round((Date.now() - this.sessionStartTime.getTime()) / 1000 / 60);
    const toolsUsed = Array.from(this.toolUsageMap.values());
    const totalToolUsage = toolsUsed.reduce((sum, tool) => sum + tool.count, 0);
    
    return `
📊 Session Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Runtime: ${runtime} minutes
Tools used: ${toolsUsed.length} different tools
Total tool calls: ${totalToolUsage}
Most used tool: ${toolsUsed.length > 0 ? toolsUsed.reduce((max, tool) => tool.count > max.count ? tool : max).toolName : 'none'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
  }
}