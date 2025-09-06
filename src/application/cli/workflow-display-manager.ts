/**
 * Workflow Display Manager - Modularized Progress Tracking
 *
 * Extracted from UnifiedCLICoordinator to handle workflow visualization:
 * - Agentic workflow display management and progress tracking
 * - Step tracking and status updates
 * - Session-based workflow management
 * - Integration with streaming workflow systems
 * - Real-time progress feedback for CLI operations
 *
 * This module provides transparent progress visualization for complex operations.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { logger } from '../../infrastructure/logging/unified-logger.js';
import { agenticWorkflowDisplay } from '../workflow/agentic-workflow-display.js';
import { streamingWorkflowIntegration } from '../workflow/streaming-workflow-integration.js';

export interface WorkflowStep {
  id: string;
  sessionId: string;
  phase: 'planning' | 'executing' | 'testing' | 'iterating';
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  data?: unknown;
  error?: string;
}

export interface WorkflowSession {
  id: string;
  input: string;
  complexity: 'simple' | 'medium' | 'complex';
  startTime: number;
  endTime?: number;
  steps: WorkflowStep[];
  status: 'running' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
}

export interface WorkflowDisplayOptions {
  enableRealTimeUpdates?: boolean;
  enableStreamingDisplay?: boolean;
  showProgressBars?: boolean;
  verboseLogging?: boolean;
}

/**
 * Manages workflow display and progress tracking for CLI operations
 */
export class WorkflowDisplayManager extends EventEmitter {
  private readonly activeSessions: Map<string, WorkflowSession> = new Map();
  private readonly options: Required<WorkflowDisplayOptions>;

  public constructor(options: Readonly<WorkflowDisplayOptions> = {}) {
    super();

    this.options = {
      enableRealTimeUpdates: options.enableRealTimeUpdates ?? true,
      enableStreamingDisplay: options.enableStreamingDisplay ?? true,
      showProgressBars: options.showProgressBars ?? true,
      verboseLogging: options.verboseLogging ?? false,
    };
  }

  /**
   * Start a new workflow session
   */
  public startSession(
    input: string,
    complexity: 'simple' | 'medium' | 'complex' = 'medium'
  ): string {
    const sessionId = agenticWorkflowDisplay.startSession(input, complexity);

    const session: WorkflowSession = {
      id: sessionId,
      input,
      complexity,
      startTime: performance.now(),
      steps: [],
      status: 'running',
    };

    this.activeSessions.set(sessionId, session);

    if (this.options.verboseLogging) {
      logger.info(`🚀 Started workflow session ${sessionId} with complexity: ${complexity}`);
    }

    this.emit('session:started', session);
    return sessionId;
  }

  /**
   * Add a step to a workflow session
   */
  public addStep(
    sessionId: string,
    phase: 'planning' | 'executing' | 'testing' | 'iterating',
    title: string,
    description: string
  ): string {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to add step to non-existent session: ${sessionId}`);
      return '';
    }

    const stepId = agenticWorkflowDisplay.addStep(sessionId, phase, title, description);

    const step: WorkflowStep = {
      id: stepId,
      sessionId,
      phase,
      title,
      description,
      status: 'running',
      progress: 0,
      startTime: performance.now(),
    };

    session.steps.push(step);

    if (this.options.verboseLogging) {
      logger.info(`📋 Added step "${title}" to session ${sessionId}`);
    }

    this.emit('step:added', { sessionId, step });
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
    const session = this.activeSessions.get(sessionId) as Readonly<WorkflowSession> | undefined;
    if (!session) {
      logger.warn(`Attempted to update progress for non-existent session: ${sessionId}`);
      return;
    }

    const step = (session.steps as ReadonlyArray<WorkflowStep>).find(s => s.id === stepId);
    if (!step) {
      logger.warn(`Attempted to update progress for non-existent step: ${stepId}`);
      return;
    }

    step.progress = Math.max(0, Math.min(100, progress));

    // Update the agentic workflow display
    agenticWorkflowDisplay.updateStepProgress(sessionId, stepId, progress, message);

    if (this.options.enableRealTimeUpdates) {
      this.emit('step:progress', { sessionId, stepId, progress, message });
    }

    if (this.options.verboseLogging && message) {
      logger.info(`⏳ Step "${step.title}" progress: ${progress}% - ${message}`);
    }
  }

  /**
   * Complete a workflow step
   */
  public completeStep(sessionId: string, stepId: string, data?: Record<string, unknown>): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to complete step for non-existent session: ${sessionId}`);
      return;
    }

    const step = session.steps.find((s: Readonly<WorkflowStep>) => s.id === stepId);
    if (!step) {
      logger.warn(`Attempted to complete non-existent step: ${stepId}`);
      return;
    }

    step.status = 'completed';
    step.progress = 100;
    step.endTime = performance.now();
    step.data = data;

    // Update the agentic workflow display
    agenticWorkflowDisplay.completeStep(sessionId, stepId, data);

    const duration = step.endTime - step.startTime;
    if (this.options.verboseLogging) {
      logger.info(`✅ Completed step "${step.title}" in ${duration.toFixed(2)}ms`);
    }

    this.emit('step:completed', { sessionId, step });
  }

  /**
   * Fail a workflow step
   */
  public failStep(sessionId: string, stepId: string, error: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to fail step for non-existent session: ${sessionId}`);
      return;
    }

    const step = session.steps.find((s: Readonly<WorkflowStep>) => s.id === stepId);
    if (!step) {
      logger.warn(`Attempted to fail non-existent step: ${stepId}`);
      return;
    }

    step.status = 'failed';
    step.endTime = performance.now();
    step.error = error;

    // Update the agentic workflow display
    agenticWorkflowDisplay.failStep(sessionId, stepId, error);

    logger.error(`❌ Step "${step.title}" failed: ${error}`);

    this.emit('step:failed', { sessionId, step, error });
  }

  /**
   * Complete a workflow session
   */
  public completeSession(
    sessionId: string,
    result: Readonly<{
      success: boolean;
      qualityScore?: number;
      operationType?: string;
      tokensUsed?: number;
      confidenceScore?: number;
      error?: string;
    }>
  ): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      logger.warn(`Attempted to complete non-existent session: ${sessionId}`);
      return;
    }

    session.status = result.success ? 'completed' : 'failed';
    session.endTime = performance.now();
    session.result = result.success ? result : undefined;
    session.error = result.error;

    // Update the agentic workflow display
    agenticWorkflowDisplay.completeSession(sessionId, result);

    const duration = session.endTime - session.startTime;
    const successSymbol = result.success ? '✅' : '❌';

    logger.info(
      `${successSymbol} Workflow session ${sessionId} ${session.status} in ${duration.toFixed(2)}ms. ` +
        `Steps: ${session.steps.length}, Quality: ${((result.qualityScore ?? 0) * 100).toFixed(0)}%`
    );

    this.emit('session:completed', { session, result });
  }

  /**
   * Execute with streaming display for real-time progress
   */
  public async executeWithStreaming<T>(
    sessionId: string,
    stepId: string,
    operation: () => Promise<T>,
    operationType: string
  ): Promise<T> {
    if (!this.options.enableStreamingDisplay) {
      // Fall back to regular execution
      return operation();
    }

    try {
      logger.info(`🌊 Starting streaming for ${operationType} (session: ${sessionId})`);

      // Start streaming display integration
      this.emit('streaming:started', { sessionId, stepId, operationType });

      // Execute the operation - streaming tokens will be handled by model client
      const result = await operation();

      logger.info(`✅ Streaming completed for ${operationType}`);
      this.emit('streaming:completed', { sessionId, stepId, operationType });

      return result;
    } catch (error) {
      // Ensure streaming is stopped on error
      streamingWorkflowIntegration.stopStreaming(stepId);
      logger.error(`❌ Streaming failed for ${operationType}:`, error);
      this.emit('streaming:failed', { sessionId, stepId, operationType, error });
      throw error;
    }
  }

  /**
   * Determine if an operation should use streaming display
   */
  public shouldUseStreaming(operationType: string): boolean {
    if (!this.options.enableStreamingDisplay) {
      return false;
    }

    // Operations that typically involve AI model generation benefit from streaming
    const streamingOperations = [
      'code generation',
      'prompt processing',
      'content analysis',
      'file analysis',
      'directory analysis',
      'ai response',
    ];

    return streamingOperations.includes(operationType.toLowerCase());
  }

  /**
   * Get active workflow sessions
   */
  public getActiveSessions(): WorkflowSession[] {
    return Array.from(this.activeSessions.values()).filter(
      (s: Readonly<WorkflowSession>) => s.status === 'running'
    );
  }

  /**
   * Get session by ID
   */
  public getSession(sessionId: string): WorkflowSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Get workflow statistics
   */
  public getWorkflowStats(): {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    failedSessions: number;
    averageDuration: number;
    averageStepsPerSession: number;
  } {
    const sessions = Array.from(this.activeSessions.values());
    const completed = sessions.filter((s: Readonly<WorkflowSession>) => s.status === 'completed');
    const failed = sessions.filter((s: Readonly<WorkflowSession>) => s.status === 'failed');
    const active = sessions.filter((s: Readonly<WorkflowSession>) => s.status === 'running');

    const averageDuration =
      completed.length > 0
        ? completed.reduce(
            (sum: number, s: Readonly<WorkflowSession>) => sum + ((s.endTime ?? 0) - s.startTime),
            0
          ) / completed.length
        : 0;

    const averageStepsPerSession =
      sessions.length > 0
        ? sessions.reduce((sum: number, s: Readonly<WorkflowSession>) => sum + s.steps.length, 0) /
          sessions.length
        : 0;

    return {
      totalSessions: sessions.length,
      activeSessions: active.length,
      completedSessions: completed.length,
      failedSessions: failed.length,
      averageDuration,
      averageStepsPerSession,
    };
  }

  /**
   * Clean up completed sessions to prevent memory leaks
   */
  public cleanupCompletedSessions(olderThanMs: number = 300000): void {
    const now = performance.now();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.status !== 'running' && session.endTime) {
        if (now - session.endTime > olderThanMs) {
          sessionsToRemove.push(sessionId);
        }
      }
    }

    sessionsToRemove.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
    });

    if (sessionsToRemove.length > 0) {
      logger.info(`🧹 Cleaned up ${sessionsToRemove.length} completed workflow sessions`);
    }
  }

  /**
   * Shutdown and cleanup all resources
   */
  public shutdown(): void {
    logger.info('Shutting down WorkflowDisplayManager');

    // Complete any running sessions
    const runningSessions = Array.from(this.activeSessions.values()).filter(
      (s: Readonly<WorkflowSession>) => s.status === 'running'
    );

    for (const session of runningSessions) {
      this.completeSession(session.id, {
        success: false,
        error: 'System shutdown',
      });
    }

    // Clear all sessions
    this.activeSessions.clear();

    // Remove all listeners
    this.removeAllListeners();
  }
}

// Create a default instance for convenience
export const workflowDisplayManager = new WorkflowDisplayManager();

export default WorkflowDisplayManager;
