/**
 * Agentic Workflow Display - Transparent AI Process Visualization
 *
 * Shows users the AI's thinking process in real-time:
 * - Plan: What the AI will do
 * - Execute: Current actions being performed
 * - Test: Validation and verification steps
 * - Iterate: Learning and refinement
 *
 * Based on modern AI transparency principles and user experience research.
 */

import { EventEmitter } from 'events';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export type WorkflowPhase = 'planning' | 'executing' | 'testing' | 'iterating' | 'completed';

export interface WorkflowStep {
  id: string;
  phase: WorkflowPhase;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number; // 0-100
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  metadata?: Record<string, unknown>;
  substeps?: WorkflowStep[];
}

export interface WorkflowSession {
  id: string;
  title: string;
  description: string;
  startTime: Date;
  endTime?: Date;
  totalDuration?: number;
  currentPhase: WorkflowPhase;
  currentStep?: WorkflowStep;
  steps: WorkflowStep[];
  metadata: {
    userQuery: string;
    complexity: 'simple' | 'medium' | 'complex';
    voicesUsed?: string[];
    modelUsed?: string;
    tokensUsed?: number;
    confidenceScore?: number;
  };
  status: 'active' | 'completed' | 'failed' | 'cancelled';
}

export interface ProgressUpdate {
  sessionId: string;
  stepId: string;
  phase: WorkflowPhase;
  progress: number;
  message: string;
  timestamp: Date;
}

/**
 * Agentic Workflow Display System
 */
export class AgenticWorkflowDisplay extends EventEmitter {
  private readonly activeSessions: Map<string, WorkflowSession> = new Map();
  private readonly sessionHistory: WorkflowSession[] = [];
  private displayEnabled: boolean = true;

  public constructor(
    options: Readonly<{
      displayEnabled?: boolean;
      maxHistorySize?: number;
    }> = {}
  ) {
    super();
    this.displayEnabled = options.displayEnabled ?? true;
  }

  /**
   * Start a new agentic workflow session
   */
  public startSession(
    userQuery: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const session: WorkflowSession = {
      id: sessionId,
      title: this.generateSessionTitle(userQuery),
      description: userQuery,
      startTime: new Date(),
      currentPhase: 'planning',
      steps: [],
      metadata: {
        userQuery,
        complexity,
        confidenceScore: 0.5,
      },
      status: 'active',
    };

    this.activeSessions.set(sessionId, session);

    if (this.displayEnabled) {
      this.displaySessionStart(session);
    }

    this.emit('sessionStarted', session);
    logger.info(`🎯 Started agentic workflow session: ${sessionId}`);

    return sessionId;
  }

  /**
   * Add a workflow step to the current session
   */
  public addStep(
    sessionId: string,
    phase: WorkflowPhase,
    title: string,
    description: string
  ): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const step: WorkflowStep = {
      id: stepId,
      phase,
      title,
      description,
      status: 'pending',
      progress: 0,
      startTime: new Date(),
    };

    session.steps.push(step);
    session.currentPhase = phase;
    session.currentStep = step;

    if (this.displayEnabled) {
      this.displayStep(session, step);
    }

    this.emit('stepAdded', { session, step });
    return stepId;
  }

  /**
   * Update step progress
   */
  public updateStepProgress(
    sessionId: string,
    stepId: string,
    progress: number,
    message?: string
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const step = session.steps.find((s: Readonly<WorkflowStep>) => s.id === stepId);
    if (!step) return;

    step.progress = Math.min(100, Math.max(0, progress));
    if (progress >= 100) {
      step.status = 'completed';
      step.endTime = new Date();
      if (step.startTime) {
        step.duration = step.endTime.getTime() - step.startTime.getTime();
      }
    } else {
      step.status = 'in_progress';
    }

    if (this.displayEnabled) {
      this.displayProgress(session, step, message);
    }

    const update: ProgressUpdate = {
      sessionId,
      stepId,
      phase: step.phase,
      progress,
      message: message ?? '',
      timestamp: new Date(),
    };

    this.emit('progressUpdate', update);
  }

  /**
   * Mark step as completed
   */
  public completeStep(sessionId: string, stepId: string, metadata?: Record<string, unknown>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const step = session.steps.find((s: Readonly<WorkflowStep>) => s.id === stepId);
    if (!step) return;

    step.status = 'completed';
    step.progress = 100;
    step.endTime = new Date();
    if (step.startTime) {
      step.duration = step.endTime.getTime() - step.startTime.getTime();
    }
    if (metadata) {
      step.metadata = { ...step.metadata, ...metadata };
    }

    if (this.displayEnabled) {
      this.displayStepCompletion(session, step);
    }

    this.emit('stepCompleted', { session, step });
  }

  /**
   * Mark step as failed
   */
  public failStep(sessionId: string, stepId: string, error: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    const step = session.steps.find((s: Readonly<WorkflowStep>) => s.id === stepId);
    if (!step) return;

    step.status = 'failed';
    step.endTime = new Date();
    step.metadata = { ...step.metadata, error };

    if (this.displayEnabled) {
      this.displayStepFailure(session, step, error);
    }

    this.emit('stepFailed', { session, step, error });
  }

  /**
   * Complete the entire session
   */
  public completeSession(sessionId: string, results?: Record<string, unknown>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.currentPhase = 'completed';
    session.endTime = new Date();
    session.totalDuration = session.endTime.getTime() - session.startTime.getTime();

    if (results) {
      session.metadata = { ...session.metadata, ...results };
    }

    // Move to history
    this.sessionHistory.push(session);
    this.activeSessions.delete(sessionId);

    if (this.displayEnabled) {
      this.displaySessionCompletion(session);
    }

    this.emit('sessionCompleted', session);
    logger.info(
      `✅ Completed agentic workflow session: ${sessionId} in ${session.totalDuration}ms`
    );
  }

  /**
   * Get current session status
   */
  public getSession(sessionId: string): WorkflowSession | undefined {
    return (
      this.activeSessions.get(sessionId) ??
      this.sessionHistory.find((s: Readonly<WorkflowSession>) => s.id === sessionId)
    );
  }

  /**
   * Get all active sessions
   */
  public getActiveSessions(): WorkflowSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Get session history
   */
  public getSessionHistory(): WorkflowSession[] {
    return [...this.sessionHistory];
  }

  // Display methods for different output formats

  /**
   * Display session start
   */
  private displaySessionStart(session: WorkflowSession): void {
    const complexityIcon = {
      simple: '🟢',
      medium: '🟡',
      complex: '🔴',
    }[session.metadata.complexity];

    console.log(`\n🤖 Starting AI Analysis ${complexityIcon}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📋 Task: ${session.title}`);
    console.log(`🎯 Query: "${session.description}"`);
    console.log(`⏰ Started: ${session.startTime.toLocaleTimeString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  /**
   * Display step start
   */
  private displayStep(session: WorkflowSession, step: WorkflowStep): void {
    const phaseIcons = {
      planning: '📋',
      executing: '⚡',
      testing: '🧪',
      iterating: '🔄',
      completed: '✅',
    };

    const icon = phaseIcons[step.phase];
    console.log(`${icon} ${step.phase.toUpperCase()}: ${step.title}`);
    console.log(`   ${step.description}`);
  }

  /**
   * Display progress update
   */
  private displayProgress(session: WorkflowSession, step: WorkflowStep, message?: string): void {
    const progressBar = this.createProgressBar(step.progress);
    const statusIcon =
      step.status === 'in_progress'
        ? '⏳'
        : step.status === 'completed'
          ? '✅'
          : step.status === 'failed'
            ? '❌'
            : '⏸️';

    console.log(
      `   ${statusIcon} ${progressBar} ${step.progress.toFixed(0)}%${message ? ` - ${message}` : ''}`
    );
  }

  /**
   * Display step completion
   */
  private displayStepCompletion(session: WorkflowSession, step: WorkflowStep): void {
    const duration = step.duration ? `(${step.duration}ms)` : '';
    console.log(`   ✅ Completed: ${step.title} ${duration}`);
  }

  /**
   * Display step failure
   */
  private displayStepFailure(session: WorkflowSession, step: WorkflowStep, error: string): void {
    console.log(`   ❌ Failed: ${step.title}`);
    console.log(`   💥 Error: ${error}`);
  }

  /**
   * Display session completion
   */
  private displaySessionCompletion(session: WorkflowSession): void {
    const duration = session.totalDuration
      ? `${(session.totalDuration / 1000).toFixed(1)}s`
      : 'unknown';
    const completedSteps = session.steps.filter(s => s.status === 'completed').length;
    const totalSteps = session.steps.length;

    console.log(`\n✅ Analysis Complete!`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`⏱️ Duration: ${duration}`);
    console.log(`📊 Steps: ${completedSteps}/${totalSteps} completed`);
    console.log(`🎯 Success rate: ${((completedSteps / totalSteps) * 100).toFixed(0)}%`);

    if (session.metadata.tokensUsed) {
      console.log(`🔤 Tokens used: ${session.metadata.tokensUsed.toLocaleString()}`);
    }

    if (session.metadata.confidenceScore) {
      console.log(`📈 Confidence: ${(session.metadata.confidenceScore * 100).toFixed(0)}%`);
    }

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  /**
   * Create progress bar visualization
   */
  private createProgressBar(progress: number, width: number = 20): string {
    const filled = Math.round((progress / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
  }

  /**
   * Generate session title from user query
   */
  private generateSessionTitle(query: string): string {
    const words = query.toLowerCase().split(' ');

    // Extract key action words
    const actionWords = [
      'analyze',
      'create',
      'fix',
      'implement',
      'refactor',
      'optimize',
      'test',
      'review',
    ];
    const targetWords = [
      'component',
      'function',
      'code',
      'file',
      'project',
      'system',
      'architecture',
    ];

    const action = words.find(w => actionWords.includes(w)) || 'process';
    const target = words.find(w => targetWords.includes(w)) || 'request';

    return `${action.charAt(0).toUpperCase() + action.slice(1)} ${target}`;
  }

  /**
   * Enable or disable display output
   */
  setDisplayEnabled(enabled: boolean): void {
    this.displayEnabled = enabled;
  }

  /**
   * Get workflow statistics
   */
  getStatistics(): {
    activeSessions: number;
    completedSessions: number;
    averageDuration: number;
    successRate: number;
    totalStepsCompleted: number;
  } {
    const completed = this.sessionHistory.filter(s => s.status === 'completed');
    const totalDuration = completed.reduce((sum, s) => sum + (s.totalDuration || 0), 0);
    const totalSteps = this.sessionHistory.reduce((sum, s) => sum + s.steps.length, 0);
    const completedSteps = this.sessionHistory.reduce(
      (sum, s) => sum + s.steps.filter(step => step.status === 'completed').length,
      0
    );

    return {
      activeSessions: this.activeSessions.size,
      completedSessions: completed.length,
      averageDuration: completed.length > 0 ? totalDuration / completed.length : 0,
      successRate: totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0,
      totalStepsCompleted: completedSteps,
    };
  }
}

// Export singleton instance
export const agenticWorkflowDisplay = new AgenticWorkflowDisplay();
