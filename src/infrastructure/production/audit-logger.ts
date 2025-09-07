import { logger } from '../logging/logger.js';

export interface AuditEvent {
  type: string;
  message: string;
  context?: Record<string, unknown>;
}

export class AuditLogger {
  private readonly events: AuditEvent[] = [];

  public log(event: AuditEvent): void {
    this.events.push(event);
    logger.info(`📝 [AUDIT] ${event.type}: ${event.message}`, event.context);
  }

  public getEvents(): AuditEvent[] {
    return [...this.events];
  }
}
