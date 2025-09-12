import { createLogger } from '../logging/logger-adapter.js';
import type { ILogger } from '../../domain/interfaces/logger.js';
import { BackupManager, type BackupConfig } from '../backup/backup-manager.js';
import { ProductionDatabaseManager, type ProductionDatabaseConfig } from '../../database/production-database-manager.js';
import { SecurityAuditLogger, AuditEventType, AuditOutcome, AuditSeverity } from '../security/security-audit-logger.js';
import { getGlobalObservability } from '../observability/observability-coordinator.js';

/**
 * Production BackupCoordinator
 *
 * Thin orchestrator around BackupManager that:
 * - Bootstraps a ProductionDatabaseManager
 * - Performs a full backup and enforces retention
 * - Emits audit and metrics events
 */
export class BackupCoordinator {
  private readonly logger: ILogger = createLogger('BackupCoordinator');
  private readonly auditor = SecurityAuditLogger.getInstance();
  private backupManager?: BackupManager;

  public constructor(
    options: {
      dbConfig?: Partial<ProductionDatabaseConfig>;
      backupConfig?: Partial<BackupConfig>;
      manager?: BackupManager; // for testing/DI
    } = {}
  ) {
    if (options.manager) {
      this.backupManager = options.manager;
      return;
    }

    // Default DB config from environment (safe fallbacks for local/dev)
    const typeEnv = (process.env.DB_TYPE || '').toLowerCase();
    const resolvedType: ProductionDatabaseConfig['type'] =
      typeEnv === 'postgresql' || typeEnv === 'mysql' || typeEnv === 'sqlite' ? typeEnv : 'sqlite';

    const dbConfig: ProductionDatabaseConfig = {
      type: resolvedType,
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      database: process.env.DB_NAME || 'codecrucible',
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL ? process.env.DB_SSL === 'true' : undefined,
      pool: undefined,
      migrations: undefined,
      readReplicas: undefined,
      redis: undefined,
      ...options.dbConfig,
    };

    const backupConfig: Partial<BackupConfig> = {
      enabled: true,
      retentionDays: process.env.BACKUP_RETENTION_DAYS
        ? Number(process.env.BACKUP_RETENTION_DAYS)
        : undefined,
      schedule: process.env.BACKUP_SCHEDULE || undefined, // cron string
      encryptionEnabled: process.env.BACKUP_ENCRYPTION
        ? process.env.BACKUP_ENCRYPTION === 'true'
        : undefined,
      destinations: options.backupConfig?.destinations, // allow caller override
      ...options.backupConfig,
    };

    const dbManager = new ProductionDatabaseManager(dbConfig);
    this.backupManager = new BackupManager(dbManager, backupConfig);
  }

  /**
   * Initialize underlying backup system (idempotent)
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.backupManager) return;
    // BackupManager.initialize is idempotent, safe to call multiple times
    try {
      await this.backupManager.initialize();
    } catch (err) {
      // initialize() may throw if already initialized; ignore non-fatal
      const message = err instanceof Error ? err.message : String(err);
      this.logger.debug('BackupManager initialize call ended', { message });
    }
  }

  /**
   * Perform a full backup with audit + metrics
   */
  async backup(): Promise<void> {
    if (!this.backupManager) return;
    await this.ensureInitialized();

    this.auditor.logAuditEvent({
      eventType: AuditEventType.SYSTEM_EVENT,
      severity: AuditSeverity.LOW,
      outcome: AuditOutcome.SUCCESS,
      details: { action: 'backup:start' },
    });

    const started = Date.now();
    try {
      const meta = await this.backupManager.performFullBackup();
      const durationMs = Date.now() - started;

      // Emit metrics if observability is present
      const obs = getGlobalObservability();
      if (obs) {
        obs.incrementCounter('backup.completed.total', { type: meta.type });
        obs.recordTimer('backup.duration.ms', durationMs, { type: meta.type });
        obs.recordMetric('backup.size.bytes', meta.size, { type: meta.type }, 'bytes');
      }

      this.auditor.logAuditEvent({
        eventType: AuditEventType.SYSTEM_EVENT,
        severity: AuditSeverity.LOW,
        outcome: AuditOutcome.SUCCESS,
        details: {
          action: 'backup:success',
          id: meta.id,
          size: meta.size,
          compressed: meta.compressed,
          encrypted: meta.encrypted,
          durationMs,
        },
      });
    } catch (error) {
      const durationMs = Date.now() - started;

      const obs = getGlobalObservability();
      if (obs) {
        obs.incrementCounter('backup.failed.total');
        obs.recordTimer('backup.duration.ms', durationMs, { status: 'failed' });
      }

      this.auditor.logAuditEvent({
        eventType: AuditEventType.ERROR_EVENT,
        severity: AuditSeverity.HIGH,
        outcome: AuditOutcome.FAILURE,
        details: { action: 'backup:failure', durationMs },
        errorMessage: (error as Error)?.message,
      });

      this.logger.error('Backup failed', error);
      throw error;
    }
  }
}
