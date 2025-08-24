/**
 * Database Migration Manager - Enterprise Grade Versioning System
 * Extends existing database-manager.ts with migration capabilities
 */

import { ProductionDatabaseManager as DatabaseManager } from './production-database-manager.js';
import { logger } from '../core/logger.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export interface Migration {
  version: string;
  name: string;
  description: string;
  up: string;
  down: string;
  checksum: string;
  appliedAt?: Date;
}

export interface MigrationResult {
  success: boolean;
  version: string;
  error?: string;
  duration: number;
}

/**
 * Migration Manager for CodeCrucible Database
 * Works WITH existing DatabaseManager, not against it
 */
export class MigrationManager {
  private dbManager: DatabaseManager;
  private migrationsPath: string;

  constructor(dbManager: DatabaseManager, migrationsPath?: string) {
    this.dbManager = dbManager;
    this.migrationsPath = migrationsPath || join(process.cwd(), 'migrations');
  }

  /**
   * Initialize migration tracking table
   */
  async initialize(): Promise<void> {
    if (!this.dbManager.isInitialized()) {
      throw new Error('Database manager must be initialized first');
    }

    const db = this.dbManager.getRawDb();
    if (!db) throw new Error('Database connection not available');

    // Create migrations tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        checksum TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER
      )
    `);

    logger.info('Migration tracking initialized');
  }

  /**
   * Get all pending migrations
   */
  async getPendingMigrations(): Promise<Migration[]> {
    const allMigrations = await this.loadMigrations();
    const appliedMigrations = await this.getAppliedMigrations();
    const appliedVersions = new Set(appliedMigrations.map(m => m.version));

    return allMigrations.filter(m => !appliedVersions.has(m.version));
  }

  /**
   * Get applied migrations from database
   */
  async getAppliedMigrations(): Promise<Migration[]> {
    const db = this.dbManager.getRawDb();
    if (!db) throw new Error('Database connection not available');

    const stmt = db.prepare(`
      SELECT version, name, description, checksum, applied_at, execution_time_ms
      FROM schema_migrations 
      ORDER BY version ASC
    `);

    const rows = stmt.all() as any[];
    return rows.map(row => ({
      version: row.version,
      name: row.name,
      description: row.description,
      checksum: row.checksum,
      appliedAt: new Date(row.applied_at),
      up: '', // Not stored in DB
      down: '', // Not stored in DB
    }));
  }

  /**
   * Load migration files from disk
   */
  private async loadMigrations(): Promise<Migration[]> {
    try {
      const files = readdirSync(this.migrationsPath)
        .filter(f => f.endsWith('.sql'))
        .sort();

      const migrations: Migration[] = [];

      for (const file of files) {
        const filePath = join(this.migrationsPath, file);
        const content = readFileSync(filePath, 'utf-8');

        // Parse migration file format:
        // -- Migration: version
        // -- Name: name
        // -- Description: description
        // -- Up
        // SQL statements...
        // -- Down
        // SQL statements...

        const lines = content.split('\n');
        let version = '';
        let name = '';
        let description = '';
        let up = '';
        let down = '';
        let section = '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed.startsWith('-- Migration:')) {
            version = trimmed.replace('-- Migration:', '').trim();
          } else if (trimmed.startsWith('-- Name:')) {
            name = trimmed.replace('-- Name:', '').trim();
          } else if (trimmed.startsWith('-- Description:')) {
            description = trimmed.replace('-- Description:', '').trim();
          } else if (trimmed === '-- Up') {
            section = 'up';
          } else if (trimmed === '-- Down') {
            section = 'down';
          } else if (section === 'up' && !trimmed.startsWith('--')) {
            up += line + '\n';
          } else if (section === 'down' && !trimmed.startsWith('--')) {
            down += line + '\n';
          }
        }

        if (version && name) {
          migrations.push({
            version,
            name,
            description,
            up: up.trim(),
            down: down.trim(),
            checksum: this.calculateChecksum(up),
          });
        }
      }

      return migrations;
    } catch (error) {
      logger.error('Failed to load migrations:', error);
      return [];
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<MigrationResult[]> {
    const pending = await this.getPendingMigrations();
    const results: MigrationResult[] = [];

    logger.info(`Running ${pending.length} pending migrations`);

    for (const migration of pending) {
      const result = await this.runMigration(migration);
      results.push(result);

      if (!result.success) {
        logger.error(`Migration failed: ${migration.version} - ${result.error}`);
        break; // Stop on first failure
      }
    }

    return results;
  }

  /**
   * Run a single migration
   */
  private async runMigration(migration: Migration): Promise<MigrationResult> {
    const startTime = Date.now();
    const db = this.dbManager.getRawDb();
    if (!db) throw new Error('Database connection not available');

    try {
      logger.info(`Applying migration: ${migration.version} - ${migration.name}`);

      // Start transaction
      db.exec('BEGIN TRANSACTION');

      try {
        // Execute migration SQL
        db.exec(migration.up);

        // Record migration in tracking table
        const stmt = db.prepare(`
          INSERT INTO schema_migrations 
          (version, name, description, checksum, execution_time_ms)
          VALUES (?, ?, ?, ?, ?)
        `);

        const duration = Date.now() - startTime;
        stmt.run(
          migration.version,
          migration.name,
          migration.description,
          migration.checksum,
          duration
        );

        // Commit transaction
        db.exec('COMMIT');

        logger.info(`Migration completed: ${migration.version} (${duration}ms)`);

        return {
          success: true,
          version: migration.version,
          duration,
        };
      } catch (error) {
        // Rollback on error
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Migration failed: ${migration.version}`, error);

      return {
        success: false,
        version: migration.version,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Rollback last migration
   */
  async rollback(): Promise<MigrationResult> {
    const applied = await this.getAppliedMigrations();
    if (applied.length === 0) {
      throw new Error('No migrations to rollback');
    }

    const lastMigration = applied[applied.length - 1];
    const allMigrations = await this.loadMigrations();
    const migrationDef = allMigrations.find(m => m.version === lastMigration.version);

    if (!migrationDef) {
      throw new Error(`Migration definition not found for version: ${lastMigration.version}`);
    }

    const startTime = Date.now();
    const db = this.dbManager.getRawDb();
    if (!db) throw new Error('Database connection not available');

    try {
      logger.info(`Rolling back migration: ${lastMigration.version} - ${lastMigration.name}`);

      // Start transaction
      db.exec('BEGIN TRANSACTION');

      try {
        // Execute rollback SQL
        if (migrationDef.down) {
          db.exec(migrationDef.down);
        }

        // Remove migration record
        const stmt = db.prepare('DELETE FROM schema_migrations WHERE version = ?');
        stmt.run(lastMigration.version);

        // Commit transaction
        db.exec('COMMIT');

        const duration = Date.now() - startTime;
        logger.info(`Migration rolled back: ${lastMigration.version} (${duration}ms)`);

        return {
          success: true,
          version: lastMigration.version,
          duration,
        };
      } catch (error) {
        // Rollback on error
        db.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error(`Rollback failed: ${lastMigration.version}`, error);

      return {
        success: false,
        version: lastMigration.version,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Get migration status
   */
  async getStatus(): Promise<{
    currentVersion: string | null;
    pendingCount: number;
    appliedCount: number;
    appliedMigrations: Migration[];
    pendingMigrations: Migration[];
  }> {
    const applied = await this.getAppliedMigrations();
    const pending = await this.getPendingMigrations();

    return {
      currentVersion: applied.length > 0 ? applied[applied.length - 1].version : null,
      pendingCount: pending.length,
      appliedCount: applied.length,
      appliedMigrations: applied,
      pendingMigrations: pending,
    };
  }

  /**
   * Validate all applied migrations
   */
  async validateMigrations(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const applied = await this.getAppliedMigrations();
    const allMigrations = await this.loadMigrations();
    const issues: string[] = [];

    for (const appliedMigration of applied) {
      const migrationDef = allMigrations.find(m => m.version === appliedMigration.version);

      if (!migrationDef) {
        issues.push(`Missing migration file for applied version: ${appliedMigration.version}`);
        continue;
      }

      // Validate checksum
      const currentChecksum = this.calculateChecksum(migrationDef.up);
      if (currentChecksum !== appliedMigration.checksum) {
        issues.push(`Checksum mismatch for migration: ${appliedMigration.version}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Create a new migration file template
   */
  async createMigration(name: string, description?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, '');
    const version = `${timestamp}_${name.toLowerCase().replace(/\s+/g, '_')}`;
    const filename = `${version}.sql`;
    const filepath = join(this.migrationsPath, filename);

    const template = `-- Migration: ${version}
-- Name: ${name}
-- Description: ${description || 'Add description here'}

-- Up
-- Add your migration SQL here


-- Down  
-- Add your rollback SQL here

`;

    try {
      const fs = await import('fs/promises');
      await fs.mkdir(this.migrationsPath, { recursive: true });
      await fs.writeFile(filepath, template);

      logger.info(`Created migration: ${filename}`);
      return filepath;
    } catch (error) {
      logger.error('Failed to create migration:', error);
      throw error;
    }
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Get database schema version
   */
  async getSchemaVersion(): Promise<string | null> {
    const applied = await this.getAppliedMigrations();
    return applied.length > 0 ? applied[applied.length - 1].version : null;
  }
}
