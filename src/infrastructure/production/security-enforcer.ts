import type { SecurityConfig } from './hardening-types.js';
import { AccessControlManager } from './access-control-manager.js';
import { VulnerabilityScanner } from './vulnerability-scanner.js';
import { AuditLogger } from './audit-logger.js';
import { ComplianceChecker } from './compliance-checker.js';
import { ThreatDetector, Threat } from './threat-detector.js';
import { IncidentResponse } from './incident-response.js';
import { SecurityMetrics } from './security-metrics.js';

export interface EnforcementContext {
  userId?: string;
  action?: string;
  metadata?: Record<string, unknown>;
}

export class SecurityEnforcer {
  private readonly access = new AccessControlManager();
  private readonly scanner = new VulnerabilityScanner();
  private readonly audit = new AuditLogger();
  private readonly compliance = new ComplianceChecker();
  private readonly detector = new ThreatDetector();
  private readonly incident = new IncidentResponse();
  private readonly metrics = new SecurityMetrics();

  public constructor(private readonly config: SecurityConfig) {}

  public async initialize(): Promise<void> {
    if (this.config.auditLogging.enabled) {
      this.audit.log({ type: 'system', message: 'Security enforcer initialized' });
    }
    await this.scanner.scan();
    await this.compliance.check();
  }

  public async enforce(ctx: EnforcementContext): Promise<void> {
    if (this.config.inputValidation.enabled && ctx.metadata?.input) {
      let size: number;
      const input = ctx.metadata.input;
      if (typeof input === 'string') {
        size = Buffer.byteLength(input, 'utf8');
      } else if (Buffer.isBuffer(input)) {
        size = input.length;
      } else if (typeof input === 'object' && input !== null) {
        try {
          size = Buffer.byteLength(JSON.stringify(input), 'utf8');
        } catch {
          throw new Error('Input could not be serialized for size check');
        }
      } else {
        size = Buffer.byteLength(String(input), 'utf8');
      }
      if (size > this.config.inputValidation.maxInputSize) {
        throw new Error('Input too large');
      }
    }

    this.access.checkAccess(ctx.userId ?? 'anonymous', ctx.action ?? 'unknown');
    const threats: Threat[] = this.detector.detect(ctx.metadata || {});
    if (threats.length) {
      this.metrics.record('threats', threats.length);
      await this.incident.respond(threats);
    }
    if (this.config.auditLogging.enabled) {
      this.audit.log({
        type: 'operation',
        message: ctx.action ?? 'unknown',
        context: ctx as Record<string, unknown>,
      });
    }
  }

  public async handleFailure(operationId: string, error: Error): Promise<void> {
    if (this.config.auditLogging.enabled) {
      this.audit.log({ type: 'error', message: operationId, context: { error: error.message } });
    }
  }

  public async emergencyLockdown(): Promise<void> {
    await this.incident.emergencyLockdown();
  }

  public async shutdown(): Promise<void> {
    // No resources to cleanup yet
  }

  public getMetrics(): SecurityMetrics {
    return this.metrics;
  }
}
