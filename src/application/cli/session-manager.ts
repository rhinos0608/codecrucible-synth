/**
 * CLI Session Manager - Modularized Session Management
 * 
 * Enhanced from basic session tracking to handle comprehensive CLI session lifecycle:
 * - Creating and managing CLI sessions with full context
 * - Session metrics tracking and performance monitoring
 * - Session cleanup and resource management
 * - Integration with event bus and workflow context
 * 
 * Maintains backward compatibility with existing simple interface while adding
 * advanced functionality extracted from UnifiedCLICoordinator.
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { randomUUID } from 'node:crypto';
import { WorkflowContext } from '../../domain/interfaces/workflow-orchestrator.js';
import { IEventBus } from '../../domain/interfaces/event-bus.js';
import { logger } from '../../infrastructure/logging/unified-logger.js';

// Enhanced session interface with backward compatibility
export interface CLISession {
  id: string;
  startTime: number;
  history: string[];
  // Enhanced properties for advanced functionality
  workingDirectory?: string;
  context?: WorkflowContext;
  metrics?: CLISessionMetrics;
}

export interface CLISessionMetrics {
  commandsExecuted: number;
  contextEnhancements: number;
  errorsRecovered: number;
  totalProcessingTime: number;
}

export interface SessionManagerOptions {
  historyLimit?: number;
  sessionTimeout?: number;
  maxConcurrentSessions?: number;
}

/**
 * Enhanced SessionManager with comprehensive session lifecycle management
 * Maintains backward compatibility with existing simple interface
 */
export class SessionManager extends EventEmitter {
  private sessions = new Map<string, CLISession>();
  private eventBus?: IEventBus;
  private options: Required<SessionManagerOptions>;

  constructor(options: SessionManagerOptions = {}) {
    super();

    this.options = {
      historyLimit: options.historyLimit || 50,
      sessionTimeout: options.sessionTimeout || 300000, // 5 minutes
      maxConcurrentSessions: options.maxConcurrentSessions || 10,
    };
  }

  /**
   * Initialize the session manager with dependencies (optional)
   */
  initialize(eventBus: IEventBus): void {
    this.eventBus = eventBus;
    this.emit('initialized');
  }

  /**
   * Create a new CLI session (backward compatible)
   */
  createSession(): CLISession;
  createSession(workingDirectory: string): Promise<CLISession>;
  createSession(workingDirectory?: string): CLISession | Promise<CLISession> {
    if (workingDirectory) {
      return this.createAdvancedSession(workingDirectory);
    }

    // Simple backward-compatible session creation
    const session: CLISession = {
      id: randomUUID(),
      startTime: Date.now(),
      history: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Create an advanced CLI session with full context and metrics
   */
  private async createAdvancedSession(workingDirectory: string = process.cwd()): Promise<CLISession> {
    // Check session limit
    if (this.sessions.size >= this.options.maxConcurrentSessions) {
      // Clean up oldest sessions if at limit
      await this.cleanupOldestSessions(1);
    }

    const sessionId = randomUUID();
    const context: WorkflowContext = {
      sessionId,
      workingDirectory,
      permissions: ['read', 'write', 'execute'],
      securityLevel: 'medium',
    };

    const session: CLISession = {
      id: sessionId,
      startTime: performance.now(),
      history: [],
      workingDirectory,
      context,
      metrics: {
        commandsExecuted: 0,
        contextEnhancements: 0,
        errorsRecovered: 0,
        totalProcessingTime: 0,
      },
    };

    this.sessions.set(sessionId, session);

    if (this.eventBus) {
      this.eventBus.emit('session:created', { sessionId, workingDirectory });
    }

    this.emit('session:created', session);
    logger.info(`Created CLI session ${sessionId} in ${workingDirectory}`);

    return session;
  }

  /**
   * Get session by ID (backward compatible)
   */
  getSession(id: string): CLISession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CLISession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Update session metrics (enhanced functionality)
   */
  updateSessionMetrics(
    sessionId: string,
    updates: Partial<CLISessionMetrics>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session || !session.metrics) {
      logger.warn(`Attempted to update metrics for session without metrics: ${sessionId}`);
      return;
    }

    if (updates.commandsExecuted !== undefined) {
      session.metrics.commandsExecuted += updates.commandsExecuted;
    }
    if (updates.contextEnhancements !== undefined) {
      session.metrics.contextEnhancements += updates.contextEnhancements;
    }
    if (updates.errorsRecovered !== undefined) {
      session.metrics.errorsRecovered += updates.errorsRecovered;
    }
    if (updates.totalProcessingTime !== undefined) {
      session.metrics.totalProcessingTime += updates.totalProcessingTime;
    }

    this.emit('session:metrics:updated', { sessionId, metrics: session.metrics });
  }

  /**
   * End/close a session (backward compatible, enhanced with cleanup)
   */
  endSession(id: string): void {
    const session = this.sessions.get(id);
    if (!session) {
      logger.warn(`Attempted to close non-existent session: ${id}`);
      return;
    }

    const duration = performance.now() - session.startTime;
    
    if (session.metrics) {
      logger.info(
        `Closing CLI session ${id} after ${duration.toFixed(2)}ms. ` +
        `Commands executed: ${session.metrics.commandsExecuted}, ` +
        `Errors recovered: ${session.metrics.errorsRecovered}`
      );
    }

    this.sessions.delete(id);

    if (this.eventBus) {
      this.eventBus.emit('session:closed', { sessionId: id, duration, metrics: session.metrics });
    }

    this.emit('session:closed', { session, duration });
  }

  /**
   * Record history entry (backward compatible)
   */
  record(id: string, entry: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    
    session.history.push(entry);
    if (session.history.length > this.options.historyLimit) {
      session.history.shift();
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    sessionIds.forEach(id => this.endSession(id));
  }

  /**
   * Clean up oldest sessions to make room for new ones
   */
  private async cleanupOldestSessions(count: number): Promise<void> {
    const sessions = Array.from(this.sessions.values());
    
    // Sort by start time (oldest first)
    sessions.sort((a, b) => a.startTime - b.startTime);
    
    const sessionsToClose = sessions.slice(0, count);
    
    logger.info(`Cleaning up ${sessionsToClose.length} oldest sessions to make room for new sessions`);
    
    for (const session of sessionsToClose) {
      this.endSession(session.id);
    }
  }

  /**
   * Clean up expired sessions based on timeout
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = performance.now();
    const expiredSessions = Array.from(this.sessions.values())
      .filter(session => now - session.startTime > this.options.sessionTimeout);

    if (expiredSessions.length > 0) {
      logger.info(`Cleaning up ${expiredSessions.length} expired sessions`);
      
      for (const session of expiredSessions) {
        this.endSession(session.id);
      }
    }
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalCommandsExecuted: number;
    totalErrorsRecovered: number;
    totalProcessingTime: number;
    averageSessionDuration: number;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = performance.now();

    const totalCommandsExecuted = sessions.reduce(
      (sum, session) => sum + (session.metrics?.commandsExecuted || 0), 
      0
    );
    
    const totalErrorsRecovered = sessions.reduce(
      (sum, session) => sum + (session.metrics?.errorsRecovered || 0), 
      0
    );
    
    const totalProcessingTime = sessions.reduce(
      (sum, session) => sum + (session.metrics?.totalProcessingTime || 0), 
      0
    );
    
    const averageSessionDuration = sessions.length > 0 
      ? sessions.reduce((sum, session) => sum + (now - session.startTime), 0) / sessions.length
      : 0;

    return {
      activeSessions: sessions.length,
      totalCommandsExecuted,
      totalErrorsRecovered,
      totalProcessingTime,
      averageSessionDuration,
    };
  }

  /**
   * Start periodic cleanup of expired sessions
   */
  startPeriodicCleanup(intervalMs: number = 60000): void {
    setInterval(() => {
      this.cleanupExpiredSessions().catch(error => {
        logger.error('Error during periodic session cleanup:', error);
      });
    }, intervalMs);
    
    logger.info(`Started periodic session cleanup with ${intervalMs}ms interval`);
  }

  /**
   * Shutdown and cleanup all resources
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SessionManager');
    
    // Close all active sessions
    await this.closeAllSessions();
    
    // Remove all listeners
    this.removeAllListeners();
  }
}
