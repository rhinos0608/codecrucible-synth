import { logger } from '../logging/logger.js';
import type { Threat } from './threat-detector.js';

export class IncidentResponse {
  public respond(threats: readonly Threat[]): void {
    for (const threat of threats) {
      logger.error(`⚠️ Responding to threat: ${threat.description}`);
    }
  }

  public emergencyLockdown(): void {
    logger.error('🚨 Emergency lockdown activated');
  }
}
