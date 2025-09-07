/**
 * Global Evidence Collector - Extracted from Request Execution Manager
 *
 * Centralized system to capture tool results for evidence collection
 * Implements singleton pattern with observer pattern for collectors
 * Follows modular architecture principles with proper separation of concerns
 */

import { logger } from '../logging/unified-logger.js';

// Define a specific type for tool results
export interface ToolResult {
  success?: boolean;
  error?: string;
  output?: unknown;
  [key: string]: unknown;
}

export type EvidenceCollectorCallback = (toolResult: Readonly<ToolResult>) => void;

export interface ToolResultEvidence {
  result: ToolResult;
  timestamp: Date;
  success?: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Global Evidence Collector for capturing and distributing tool execution results
 * Singleton pattern ensures consistent evidence collection across the application
 */
export class GlobalEvidenceCollector {
  private static instance: GlobalEvidenceCollector | null = null;
  private toolResults: ToolResultEvidence[] = [];
  private readonly evidenceCollectors: Set<EvidenceCollectorCallback> = new Set();
  private maxResults: number = 1000; // Prevent memory leaks

  private constructor() {
    // Private constructor enforces singleton pattern
  }

  public static getInstance(): GlobalEvidenceCollector {
    if (GlobalEvidenceCollector.instance === null) {
      GlobalEvidenceCollector.instance = new GlobalEvidenceCollector();
      logger.info('🔥 GlobalEvidenceCollector: Singleton instance created');
    }
    return GlobalEvidenceCollector.instance;
  }

  /**
   * Add a tool result to the evidence collection
   */
  public addToolResult(toolResult: ToolResult): void {
    const evidence: ToolResultEvidence = {
      result: toolResult,
      timestamp: new Date(),
      success: typeof toolResult.success === 'boolean' ? toolResult.success : undefined,
      error: typeof toolResult.error === 'string' ? toolResult.error : undefined,
      metadata: {
        hasOutput: typeof toolResult.output !== 'undefined',
        resultType: typeof toolResult,
        collectorCount: this.evidenceCollectors.size,
      },
    };

    logger.debug('Evidence collector: Adding tool result', {
      collectorCount: this.evidenceCollectors.size,
      hasResult: toolResult !== undefined && toolResult !== null,
    });

    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Tool result captured', {
      hasResult: toolResult !== undefined && toolResult !== null,
      success: typeof toolResult.success === 'boolean' ? toolResult.success : undefined,
      hasOutput: typeof toolResult.output !== 'undefined',
      collectorCount: this.evidenceCollectors.size,
      timestamp: evidence.timestamp,
    });

    // Add to results with size management
    this.toolResults.push(evidence);
    this.maintainMaxResults();

    // Notify all registered evidence collectors
    this.notifyCollectors(evidence);
  }

  /**
   * Register an evidence collector callback
   */
  public registerEvidenceCollector(callback: EvidenceCollectorCallback): void {
    if (typeof callback !== 'function') {
      throw new Error('Evidence collector callback must be a function');
    }

    logger.debug('Evidence collector: Registering evidence collector');
    this.evidenceCollectors.add(callback);

    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Evidence collector registered', {
      totalCollectors: this.evidenceCollectors.size,
    });
  }

  /**
   * Unregister an evidence collector callback
   */
  public unregisterEvidenceCollector(callback: EvidenceCollectorCallback): void {
    const wasDeleted = this.evidenceCollectors.delete(callback);

    if (wasDeleted) {
      logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Evidence collector unregistered', {
        remainingCollectors: this.evidenceCollectors.size,
      });
    }
  }

  /**
     * Get all captured tool results
     */
    public getToolResults(): ToolResultEvidence[] {
      return [...this.toolResults];
    }
  
    /**
     * Get only the raw tool results (for backward compatibility)
     */
    public getRawToolResults(): Readonly<ToolResult>[] {
      return this.toolResults.map((evidence: Readonly<ToolResultEvidence>) => evidence.result);
    }
  
    /**
     * Clear all tool results from memory
     */
    public clearToolResults(): void {
      const clearedCount = this.toolResults.length;
      this.toolResults = [];
  
      logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Tool results cleared', {
        clearedCount,
        remainingCollectors: this.evidenceCollectors.size,
      });
    }

  /**
   * Get collector statistics for monitoring
   */
  public getStatistics(): {
    totalResults: number;
    activeCollectors: number;
    successCount: number;
    errorCount: number;
    oldestResult?: Date;
    newestResult?: Date;
  } {
    const successCount = this.toolResults.filter((r: Readonly<ToolResultEvidence>) => r.success).length;
    const errorCount = this.toolResults.filter((r: Readonly<ToolResultEvidence>) => r.error).length;
    const timestamps = this.toolResults.map((r: Readonly<ToolResultEvidence>) => r.timestamp);

    return {
      totalResults: this.toolResults.length,
      activeCollectors: this.evidenceCollectors.size,
      successCount,
      errorCount,
      oldestResult:
        timestamps.length > 0 ? new Date(Math.min(...timestamps.map((t: Readonly<Date>) => t.getTime()))) : undefined,
      newestResult:
        timestamps.length > 0 ? new Date(Math.max(...timestamps.map((t: Readonly<Date>) => t.getTime()))) : undefined,
    };
  }

  /**
   * Configure maximum results to prevent memory leaks
   */
  public setMaxResults(maxResults: number): void {
    if (maxResults < 1) {
      throw new Error('Max results must be at least 1');
    }

    this.maxResults = maxResults;
    this.maintainMaxResults();

    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Max results updated', {
      maxResults,
      currentResults: this.toolResults.length,
    });
  }

  /**
   * Shutdown and cleanup all resources
   */
  public shutdown(): void {
    const clearedResults = this.toolResults.length;
    const clearedCollectors = this.evidenceCollectors.size;

    this.toolResults = [];
    this.evidenceCollectors.clear();

    logger.info('🔥 GLOBAL EVIDENCE COLLECTOR: Shutdown completed', {
      clearedResults,
      clearedCollectors,
    });
  }

  // Private methods

  /**
   * Notify all registered collectors of new evidence
   */
  private notifyCollectors(evidence: Readonly<ToolResultEvidence>): void {
    this.evidenceCollectors.forEach(collector => {
      try {
        logger.debug('Evidence collector: Calling collector callback');
        collector(evidence.result); // Maintain backward compatibility by passing raw result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Evidence collector callback failed', error instanceof Error ? error : new Error(errorMessage));
        logger.info('Evidence collector callback failed with timestamp', { timestamp: evidence.timestamp });
        logger.warn('Evidence collector callback failed:', { error: errorMessage });
      }
    });
  }

  /**
   * Maintain maximum results limit to prevent memory leaks
   */
  private maintainMaxResults(): void {
    if (this.toolResults.length > this.maxResults) {
      const excess = this.toolResults.length - this.maxResults;
      this.toolResults = this.toolResults.slice(excess);

      logger.debug('Evidence collector: Trimmed excess results', {
        removed: excess,
        remaining: this.toolResults.length,
        maxResults: this.maxResults,
      });
    }
  }
}

// Export convenience function for getting the singleton instance
export const getGlobalEvidenceCollector = (): GlobalEvidenceCollector => {
  return GlobalEvidenceCollector.getInstance();
};
