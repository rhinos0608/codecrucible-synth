/**
 * Integration Monitor
 *
 * Tracks basic health metrics for the MCP-Voice bridge. Higher level systems
 * can subscribe to events for real-time monitoring or periodic health checks.
 */

import { EventEmitter } from 'events';
import { createLogger } from '../logger.js';

export interface IntegrationHealth {
  lastSuccess: number | null;
  lastFailure: number | null;
  errorCount: number;
}

export class IntegrationMonitor extends EventEmitter {
  private readonly logger = createLogger('IntegrationMonitor');
  private health: IntegrationHealth = {
    lastSuccess: null,
    lastFailure: null,
    errorCount: 0,
  };

  /** Record a successful bridge interaction. */
  recordSuccess(): void {
    this.health.lastSuccess = Date.now();
    this.emit('success');
  }

  /** Record a failed bridge interaction. */
  recordFailure(error: Error): void {
    this.health.lastFailure = Date.now();
    this.health.errorCount += 1;
    this.logger.error('MCP-Voice bridge error', { error: error.message });
    this.emit('failure', error);
  }

  /** Retrieve current health metrics. */
  getHealth(): IntegrationHealth {
    return { ...this.health };
  }
}

export const integrationMonitor = new IntegrationMonitor();
