/**
 * Voice Memory Manager
 * 
 * Optimizes memory usage in voice synthesis operations by implementing:
 * - Session-based memory limits
 * - Context window management
 * - Automatic cleanup of expired voice outputs
 * - Memory usage monitoring and alerts
 */

import { EventEmitter } from 'events';
import type { ILogger } from '../domain/interfaces/logger.js';
import type { SynthesisResult, VoiceOutput } from './perspective-synthesizer.js';

export interface VoiceMemoryConfig {
  maxSessionMemoryMB: number;
  maxContextWindowSize: number;
  cleanupIntervalMs: number;
  sessionTimeoutMs: number;
  maxConcurrentSessions: number;
  enableMemoryAlerts: boolean;
  memoryAlertThresholdMB: number;
}

export interface VoiceSession {
  sessionId: string;
  createdAt: Date;
  lastAccessed: Date;
  memoryUsageBytes: number;
  contextWindow: VoiceOutput[];
  synthesisHistory: SynthesisResult[];
  voiceOutputs: Map<string, VoiceOutput[]>;
}

export interface MemoryStats {
  totalMemoryUsageMB: number;
  activeSessions: number;
  averageSessionSizeMB: number;
  largestSessionMB: number;
  cleanupEvents: number;
  memoryAlerts: number;
  lastCleanup: Date;
}

export class VoiceMemoryManager extends EventEmitter {
  private sessions: Map<string, VoiceSession> = new Map();
  private config: VoiceMemoryConfig;
  private cleanupInterval?: NodeJS.Timeout;
  private stats: MemoryStats;
  private logger: ILogger;

  constructor(logger: ILogger, config?: Partial<VoiceMemoryConfig>) {
    super();
    this.logger = logger;
    this.config = {
      maxSessionMemoryMB: 512, // 512MB per session
      maxContextWindowSize: 1000, // Max number of voice outputs in context
      cleanupIntervalMs: 300000, // 5 minutes
      sessionTimeoutMs: 1800000, // 30 minutes
      maxConcurrentSessions: 10,
      enableMemoryAlerts: true,
      memoryAlertThresholdMB: 256,
      ...config,
    };

    this.stats = {
      totalMemoryUsageMB: 0,
      activeSessions: 0,
      averageSessionSizeMB: 0,
      largestSessionMB: 0,
      cleanupEvents: 0,
      memoryAlerts: 0,
      lastCleanup: new Date(),
    };

    this.startCleanupTimer();
  }

  /**
   * Create or get existing voice session
   */
  public getSession(sessionId: string): VoiceSession {
    let session = this.sessions.get(sessionId);
    
    if (!session) {
      // Check if we're at max concurrent sessions
      if (this.sessions.size >= this.config.maxConcurrentSessions) {
        this.cleanupOldestSession();
      }

      session = {
        sessionId,
        createdAt: new Date(),
        lastAccessed: new Date(),
        memoryUsageBytes: 0,
        contextWindow: [],
        synthesisHistory: [],
        voiceOutputs: new Map(),
      };
      
      this.sessions.set(sessionId, session);
      this.logger.info(`Created new voice session: ${sessionId}`);
    } else {
      session.lastAccessed = new Date();
    }

    return session;
  }

  /**
   * Add voice output to session with memory management
   */
  public addVoiceOutput(sessionId: string, voiceId: string, output: VoiceOutput): void {
    const session = this.getSession(sessionId);
    
    // Calculate memory usage of the new output
    const outputSize = this.calculateOutputSize(output);
    
    // Check session memory limit
    if (session.memoryUsageBytes + outputSize > this.config.maxSessionMemoryMB * 1024 * 1024) {
      this.compressSession(session);
    }

    // Add to voice outputs
    if (!session.voiceOutputs.has(voiceId)) {
      session.voiceOutputs.set(voiceId, []);
    }
    const voiceOutputs = session.voiceOutputs.get(voiceId);
    if (voiceOutputs) {
      voiceOutputs.push(output);
    }

    // Add to context window with size limit
    session.contextWindow.push(output);
    if (session.contextWindow.length > this.config.maxContextWindowSize) {
      const removed = session.contextWindow.shift();
      if (removed) {
        session.memoryUsageBytes -= this.calculateOutputSize(removed);
      }
    }

    // Update memory usage
    session.memoryUsageBytes += outputSize;
    this.updateStats();

    // Check for memory alerts
    if (this.config.enableMemoryAlerts && 
        session.memoryUsageBytes > this.config.memoryAlertThresholdMB * 1024 * 1024) {
      this.emitMemoryAlert(session);
    }
  }

  /**
   * Add synthesis result to session history
   */
  public addSynthesisResult(sessionId: string, result: SynthesisResult): void {
    const session = this.getSession(sessionId);
    
    // Keep only last 10 synthesis results to limit memory
    session.synthesisHistory.push(result);
    if (session.synthesisHistory.length > 10) {
      session.synthesisHistory.shift();
    }

    session.memoryUsageBytes += this.calculateSynthesisSize(result);
    this.updateStats();
  }

  /**
   * Get context window for session
   */
  public getContextWindow(sessionId: string): VoiceOutput[] {
    const session = this.sessions.get(sessionId);
    return session ? [...session.contextWindow] : [];
  }

  /**
   * Get voice outputs for specific voice in session
   */
  public getVoiceOutputs(sessionId: string, voiceId: string): VoiceOutput[] {
    const session = this.sessions.get(sessionId);
    if (!session || !session.voiceOutputs.has(voiceId)) {
      return [];
    }
    const outputs = session.voiceOutputs.get(voiceId);
    return outputs ? [...outputs] : [];
  }

  /**
   * Clean up session data
   */
  public cleanupSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.logger.info(`Cleaned up voice session: ${sessionId}, freed ${(session.memoryUsageBytes / 1024 / 1024).toFixed(2)}MB`);
      this.updateStats();
    }
  }

  /**
   * Get memory usage statistics
   */
  public getMemoryStats(): MemoryStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Force garbage collection and cleanup
   */
  public forceCleanup(): void {
    const beforeSessions = this.sessions.size;
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastAccess = now - session.lastAccessed.getTime();
      if (timeSinceLastAccess > this.config.sessionTimeoutMs) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.cleanupSession(sessionId);
    }

    this.stats.cleanupEvents++;
    this.stats.lastCleanup = new Date();
    
    const cleanedSessions = beforeSessions - this.sessions.size;
    if (cleanedSessions > 0) {
      this.logger.info(`Memory cleanup: removed ${cleanedSessions} expired sessions`);
      this.emit('cleanup', { sessionsRemoved: cleanedSessions });
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<VoiceMemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Voice memory manager configuration updated');
  }

  /**
   * Dispose of the memory manager
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    // Clean up all sessions
    for (const sessionId of this.sessions.keys()) {
      this.cleanupSession(sessionId);
    }
    
    this.removeAllListeners();
    this.logger.info('Voice memory manager disposed');
  }

  // Private methods

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.forceCleanup();
    }, this.config.cleanupIntervalMs);
  }

  private calculateOutputSize(output: Readonly<VoiceOutput>): number {
    // Rough estimation: JSON string length * 2 (for UTF-16 encoding) + object overhead
    const jsonSize = JSON.stringify(output).length * 2;
    return jsonSize + 100; // Add overhead for object structure
  }

  private calculateSynthesisSize(result: SynthesisResult): number {
    const jsonSize = JSON.stringify(result).length * 2;
    return jsonSize + 100;
  }

  private compressSession(session: VoiceSession): void {
    const originalSize = session.memoryUsageBytes;
    
    // Remove older voice outputs, keeping only the most recent ones
    for (const [_voiceId, outputs] of session.voiceOutputs.entries()) {
      if (outputs.length > 20) {
        const removed = outputs.splice(0, outputs.length - 20);
        for (const output of removed) {
          session.memoryUsageBytes -= this.calculateOutputSize(output);
        }
      }
    }

    // Compress context window if needed
    if (session.contextWindow.length > this.config.maxContextWindowSize / 2) {
      const toRemove = session.contextWindow.length - Math.floor(this.config.maxContextWindowSize / 2);
      const removed = session.contextWindow.splice(0, toRemove);
      for (const output of removed) {
        session.memoryUsageBytes -= this.calculateOutputSize(output);
      }
    }

    // Keep only last 5 synthesis results
    if (session.synthesisHistory.length > 5) {
      session.synthesisHistory.splice(0, session.synthesisHistory.length - 5);
    }

    const savedMemory = originalSize - session.memoryUsageBytes;
    this.logger.info(`Compressed session ${session.sessionId}, saved ${(savedMemory / 1024 / 1024).toFixed(2)}MB`);
  }

  private cleanupOldestSession(): void {
    let oldestSession: VoiceSession | null = null;
    let oldestTime = Date.now();

    for (const session of this.sessions.values()) {
      if (session.lastAccessed.getTime() < oldestTime) {
        oldestTime = session.lastAccessed.getTime();
        oldestSession = session;
      }
    }

    if (oldestSession) {
      this.cleanupSession(oldestSession.sessionId);
    }
  }

  private updateStats(): void {
    let totalMemory = 0;
    let largestSession = 0;

    for (const session of this.sessions.values()) {
      totalMemory += session.memoryUsageBytes;
      if (session.memoryUsageBytes > largestSession) {
        largestSession = session.memoryUsageBytes;
      }
    }

    this.stats.totalMemoryUsageMB = totalMemory / 1024 / 1024;
    this.stats.activeSessions = this.sessions.size;
    this.stats.averageSessionSizeMB = this.sessions.size > 0 ? 
      this.stats.totalMemoryUsageMB / this.sessions.size : 0;
    this.stats.largestSessionMB = largestSession / 1024 / 1024;
  }

  private emitMemoryAlert(session: VoiceSession): void {
    this.stats.memoryAlerts++;
    const memoryMB = session.memoryUsageBytes / 1024 / 1024;
    
    this.logger.warn(`Memory alert: Session ${session.sessionId} using ${memoryMB.toFixed(2)}MB`);
    this.emit('memoryAlert', {
      sessionId: session.sessionId,
      memoryUsageMB: memoryMB,
      threshold: this.config.memoryAlertThresholdMB,
    });
  }
}