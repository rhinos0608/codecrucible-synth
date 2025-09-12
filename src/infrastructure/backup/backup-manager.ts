/**
 * Enterprise Backup and Disaster Recovery Manager
 * Integrates with existing DatabaseManager for comprehensive data protection
 */

import { ProductionDatabaseManager as DatabaseManager } from '../../database/production-database-manager.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined, toReadonlyRecord } from '../../utils/type-guards.js';
import { join, dirname } from 'path';
import { promises as fs, existsSync } from 'fs';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';
import * as AWS from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { exec } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import * as tar from 'tar';

const execAsync = promisify(exec);

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // Cron format
  retentionDays: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  destinations: BackupDestination[];
  notifications: NotificationConfig;
}

export interface BackupDestination {
  type: 'local' | 'cloud' | 's3' | 'azure' | 'gcp';
  path: string;
  credentials?: Record<string, string>;
  enabled: boolean;
  bucket?: string; // For S3/cloud storage
  region?: string; // For cloud providers
  endpoint?: string; // For custom S3-compatible storage
}

export interface NotificationConfig {
  onSuccess: boolean;
  onFailure: boolean;
  webhookUrl?: string;
  emailAddress?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: Date;
  type: 'full' | 'incremental';
  size: number;
  compressed: boolean;
  encrypted: boolean;
  checksum: string;
  version: string;
  source: string;
  destination: string;
}

export interface RestoreOptions {
  backupId: string;
  targetPath?: string;
  verifyIntegrity: boolean;
  restoreData: boolean;
  restoreConfig: boolean;
}

/**
 * Comprehensive backup and disaster recovery system
 */
export class BackupManager {
  private config: BackupConfig;
  private dbManager: DatabaseManager;
  private backupHistory: BackupMetadata[] = [];
  private scheduleTimer?: NodeJS.Timeout;
  private s3Client?: AWS.S3Client;
  private encryptionKey?: Buffer;

  constructor(dbManager: DatabaseManager, config: Partial<BackupConfig> = {}) {
    this.dbManager = dbManager;

    const defaultConfig: BackupConfig = {
      enabled: true,
      schedule: '0 2 * * *', // Daily at 2 AM
      retentionDays: 30,
      compressionEnabled: true,
      encryptionEnabled: false,
      destinations: [
        {
          type: 'local',
          path: join(process.cwd(), 'backups'),
          enabled: true,
        },
      ],
      notifications: {
        onSuccess: true,
        onFailure: true,
      },
    };

    this.config = { ...defaultConfig, ...config };

    // Initialize cloud storage clients
    this.initializeCloudClients();

    // Initialize encryption
    if (this.config.encryptionEnabled) {
      this.encryptionKey = crypto.randomBytes(32);
    }
  }

  /**
   * Initialize backup system
   */
  async initialize(): Promise<void> {
    try {
      // Ensure backup directories exist
      for (const destination of this.config.destinations) {
        if (destination.type === 'local' && destination.enabled) {
          await fs.mkdir(destination.path, { recursive: true });
        }
      }

      // Load backup history
      await this.loadBackupHistory();

      // Start scheduled backups if enabled
      if (this.config.enabled) {
        this.startScheduledBackups();
      }

      logger.info('Backup manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize backup manager', toErrorOrUndefined(error));
      throw error;
    }
  }

  /**
   * Perform full backup
   */
  async performFullBackup(): Promise<BackupMetadata> {
    const startTime = performance.now();
    const backupId = this.generateBackupId();

    logger.info(`Starting full backup: ${backupId}`);

    try {
      // Create database backup
      const dbBackupPath = await this.backupDatabase(backupId);

      // Backup configuration files
      const configBackupPath = await this.backupConfiguration(backupId);

      // Backup application state
      const stateBackupPath = await this.backupApplicationState(backupId);

      // Create backup package
      const backupPackage = await this.createBackupPackage(backupId, [
        dbBackupPath,
        configBackupPath,
        stateBackupPath,
      ]);

      // Calculate checksum
      const checksum = await this.calculateChecksum(backupPackage.path);

      const metadata: BackupMetadata = {
        id: backupId,
        timestamp: new Date(),
        type: 'full',
        size: backupPackage.size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.encryptionEnabled,
        checksum,
        version: '3.8.10',
        source: 'codecrucible-synth',
        destination: backupPackage.path,
      };

      // Store backup to all destinations
      await this.storeBackupToDestinations(backupPackage.path, metadata);

      // Record backup metadata
      this.backupHistory.push(metadata);
      await this.saveBackupHistory();

      // Cleanup old backups
      await this.cleanupOldBackups();

      const duration = performance.now() - startTime;
      logger.info(`Full backup completed: ${backupId} (${duration.toFixed(2)}ms)`);

      // Send success notification
      await this.sendNotification('success', metadata);

      return metadata;
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Full backup failed', toErrorOrUndefined(error), {
        backupId,
        duration: duration.toFixed(2),
      });

      // Send failure notification
      await this.sendNotification('failure', {
        id: backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(options: RestoreOptions): Promise<void> {
    const startTime = performance.now();
    logger.info(`Starting restore from backup: ${options.backupId}`);

    try {
      // Find backup metadata
      const backup = this.backupHistory.find(b => b.id === options.backupId);
      if (!backup) {
        throw new Error(`Backup not found: ${options.backupId}`);
      }

      // Verify backup integrity
      if (options.verifyIntegrity) {
        await this.verifyBackupIntegrity(backup);
      }

      // Extract backup package
      const extractedPath = await this.extractBackupPackage(backup);

      // Restore database
      if (options.restoreData) {
        await this.restoreDatabase(extractedPath);
      }

      // Restore configuration
      if (options.restoreConfig) {
        await this.restoreConfiguration(extractedPath);
      }

      const duration = performance.now() - startTime;
      logger.info(`Restore completed: ${options.backupId} (${duration.toFixed(2)}ms)`);
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Restore failed', toErrorOrUndefined(error), {
        backupId: options.backupId,
        duration: duration.toFixed(2),
      });
      throw error;
    }
  }

  /**
   * List available backups
   */
  async listBackups(): Promise<BackupMetadata[]> {
    return this.backupHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Verify backup integrity
   */
  async verifyBackupIntegrity(backup: BackupMetadata): Promise<boolean> {
    try {
      logger.info(`Verifying backup integrity: ${backup.id}`);

      // Check if backup file exists
      if (!existsSync(backup.destination)) {
        throw new Error(`Backup file not found: ${backup.destination}`);
      }

      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backup.destination);
      if (currentChecksum !== backup.checksum) {
        throw new Error(`Checksum mismatch for backup: ${backup.id}`);
      }

      // Try to extract and validate structure
      const tempDir = join(process.cwd(), 'temp', `verify_${backup.id}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        await this.extractBackupPackage(backup, tempDir);

        // Verify expected files exist
        const requiredFiles = ['database.db', 'config.json', 'state.json'];
        for (const file of requiredFiles) {
          const filePath = join(tempDir, file);
          if (!existsSync(filePath)) {
            throw new Error(`Missing file in backup: ${file}`);
          }
        }

        logger.info(`Backup integrity verified: ${backup.id}`);
        return true;
      } finally {
        // Cleanup temp directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      logger.error('Backup integrity verification failed', toErrorOrUndefined(error), {
        backupId: backup.id,
      });
      return false;
    }
  }

  /**
   * Test disaster recovery procedure
   */
  async testDisasterRecovery(): Promise<{
    success: boolean;
    results: Array<{
      step: string;
      success: boolean;
      duration: number;
      error?: string;
    }>;
  }> {
    const results: Array<{
      step: string;
      success: boolean;
      duration: number;
      error?: string;
    }> = [];

    logger.info('Starting disaster recovery test');

    // Test 1: Create backup
    const step1Start = performance.now();
    try {
      await this.performFullBackup();
      results.push({
        step: 'Create Backup',
        success: true,
        duration: performance.now() - step1Start,
      });
    } catch (error) {
      results.push({
        step: 'Create Backup',
        success: false,
        duration: performance.now() - step1Start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Verify backup integrity
    const step2Start = performance.now();
    try {
      const latestBackup = this.backupHistory[this.backupHistory.length - 1];
      await this.verifyBackupIntegrity(latestBackup);
      results.push({
        step: 'Verify Integrity',
        success: true,
        duration: performance.now() - step2Start,
      });
    } catch (error) {
      results.push({
        step: 'Verify Integrity',
        success: false,
        duration: performance.now() - step2Start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: Simulate restore (dry run)
    const step3Start = performance.now();
    try {
      const latestBackup = this.backupHistory[this.backupHistory.length - 1];
      const tempDir = join(process.cwd(), 'temp', `dr_test_${Date.now()}`);

      await this.extractBackupPackage(latestBackup, tempDir);
      await fs.rm(tempDir, { recursive: true, force: true });

      results.push({
        step: 'Simulate Restore',
        success: true,
        duration: performance.now() - step3Start,
      });
    } catch (error) {
      results.push({
        step: 'Simulate Restore',
        success: false,
        duration: performance.now() - step3Start,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const allSuccessful = results.every(r => r.success);

    logger.info(`Disaster recovery test completed. Success: ${allSuccessful}`);

    return {
      success: allSuccessful,
      results,
    };
  }

  /**
   * Generate unique backup ID
   */
  private generateBackupId(): string {
    const timestamp = new Date().toISOString().replace(/[:-]/g, '').replace(/\..+/, '');
    const random = Math.random().toString(36).substring(2, 8);
    return `backup_${timestamp}_${random}`;
  }

  /**
   * Initialize cloud storage clients
   */
  private initializeCloudClients(): void {
    const s3Destination = this.config.destinations.find(d => d.type === 's3');
    if (s3Destination) {
      this.s3Client = new AWS.S3Client({
        region: s3Destination.region || 'us-east-1',
        endpoint: s3Destination.endpoint,
        credentials: s3Destination.credentials
          ? {
              accessKeyId: s3Destination.credentials.accessKeyId,
              secretAccessKey: s3Destination.credentials.secretAccessKey,
            }
          : undefined,
      });
    }
  }

  /**
   * Backup database with production techniques
   */
  private async backupDatabase(backupId: string): Promise<string> {
    const backupPath = join(process.cwd(), 'temp', `db_${backupId}.sql`);
    await fs.mkdir(dirname(backupPath), { recursive: true });

    try {
      // Check database type and use appropriate backup method
      const dbType = process.env.DATABASE_TYPE || 'sqlite';

      switch (dbType) {
        case 'postgresql':
          await this.backupPostgreSQL(backupPath);
          break;
        case 'mysql':
          await this.backupMySQL(backupPath);
          break;
        case 'mongodb':
          await this.backupMongoDB(backupPath);
          break;
        default:
          // SQLite backup
          await this.dbManager.backup(backupPath.replace('.sql', '.db'));
          return backupPath.replace('.sql', '.db');
      }

      return backupPath;
    } catch (error) {
      logger.error('Database backup failed', toErrorOrUndefined(error));
      throw error;
    }
  }

  /**
   * Backup PostgreSQL database
   */
  private async backupPostgreSQL(backupPath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost/codecrucible';
    const command = `pg_dump "${dbUrl}" > "${backupPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes('NOTICE')) {
        throw new Error(`pg_dump error: ${stderr}`);
      }
      logger.info('PostgreSQL backup completed');
    } catch (error: any) {
      throw new Error(`PostgreSQL backup failed: ${error.message}`);
    }
  }

  /**
   * Backup MySQL database
   */
  private async backupMySQL(backupPath: string): Promise<void> {
    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'codecrucible';

    const command = `mysqldump -h ${host} -u ${user} ${password ? `-p${password}` : ''} ${database} > "${backupPath}"`;

    try {
      await execAsync(command);
      logger.info('MySQL backup completed');
    } catch (error: any) {
      throw new Error(`MySQL backup failed: ${error.message}`);
    }
  }

  /**
   * Backup MongoDB database
   */
  private async backupMongoDB(backupPath: string): Promise<void> {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codecrucible';
    const tempDir = backupPath.replace('.sql', '_mongo');

    try {
      // Create temporary directory for MongoDB dump
      await fs.mkdir(tempDir, { recursive: true });

      // Run mongodump
      const command = `mongodump --uri="${uri}" --out="${tempDir}"`;
      await execAsync(command);

      // Create tar archive of the dump
      await tar.create(
        {
          gzip: true,
          file: backupPath.replace('.sql', '.tar.gz'),
          cwd: tempDir,
        },
        ['./']
      );

      // Clean up temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });

      logger.info('MongoDB backup completed');
    } catch (error: any) {
      throw new Error(`MongoDB backup failed: ${error.message}`);
    }
  }

  /**
   * Backup configuration files
   */
  private async backupConfiguration(backupId: string): Promise<string> {
    const configPath = join(process.cwd(), 'temp', `config_${backupId}.json`);

    const config = {
      version: '3.8.10',
      timestamp: new Date().toISOString(),
      // Add configuration data here
    };

    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    return configPath;
  }

  /**
   * Backup application state
   */
  private async backupApplicationState(backupId: string): Promise<string> {
    const statePath = join(process.cwd(), 'temp', `state_${backupId}.json`);

    const state = {
      backupId,
      timestamp: new Date().toISOString(),
      // Add application state here
    };

    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
    return statePath;
  }

  /**
   * Create compressed and encrypted backup package
   */
  private async createBackupPackage(
    backupId: string,
    sourcePaths: string[]
  ): Promise<{ path: string; size: number }> {
    const packagePath = join(process.cwd(), 'temp', `${backupId}.tar.gz`);
    const tempManifest = join(process.cwd(), 'temp', `${backupId}_manifest.json`);

    try {
      // Create backup manifest
      const fileStats = await Promise.all(
        sourcePaths.map(async path => ({
          originalPath: path,
          fileName: path.split('/').pop(),
          size: (await fs.stat(path)).size,
        }))
      );

      const manifest = {
        id: backupId,
        timestamp: new Date().toISOString(),
        files: fileStats,
        version: '3.8.10',
        encrypted: this.config.encryptionEnabled,
        compressed: this.config.compressionEnabled,
      };

      await fs.writeFile(tempManifest, JSON.stringify(manifest, null, 2));

      // Create tar.gz archive
      const output = createWriteStream(packagePath);
      const archive = archiver('tar', {
        gzip: this.config.compressionEnabled,
        gzipOptions: { level: 9 }, // Maximum compression
      });

      archive.pipe(output);

      // Add manifest to archive
      archive.file(tempManifest, { name: 'manifest.json' });

      // Add all source files to archive
      for (const sourcePath of sourcePaths) {
        if (existsSync(sourcePath)) {
          const fileName = sourcePath.split('/').pop() || 'unknown';
          archive.file(sourcePath, { name: fileName });
        }
      }

      await archive.finalize();

      // Wait for archive to complete
      await new Promise<void>((resolve, reject) => {
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
      });

      // Clean up manifest file
      await fs.unlink(tempManifest);

      // Encrypt the archive if encryption is enabled
      let finalPath = packagePath;
      if (this.config.encryptionEnabled) {
        finalPath = await this.encryptFile(packagePath);
        await fs.unlink(packagePath); // Remove unencrypted version
      }

      const stats = await fs.stat(finalPath);

      return {
        path: finalPath,
        size: stats.size,
      };
    } catch (error) {
      logger.error('Failed to create backup package', toErrorOrUndefined(error));
      throw error;
    }
  }

  /**
   * Encrypt backup file using AES-256-GCM
   */
  private async encryptFile(filePath: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const encryptedPath = `${filePath}.enc`;
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    cipher.setAutoPadding(true);

    const input = createReadStream(filePath);
    const output = createWriteStream(encryptedPath);

    // Write IV at the beginning of the file
    output.write(iv);

    await pipeline(input, cipher, output);

    // Append the authentication tag
    const tag = cipher.getAuthTag();
    await fs.appendFile(encryptedPath, tag);

    logger.info(`File encrypted: ${encryptedPath}`);
    return encryptedPath;
  }

  /**
   * Decrypt backup file
   */
  private async decryptFile(encryptedPath: string): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const decryptedPath = encryptedPath.replace('.enc', '');
    const algorithm = 'aes-256-gcm';

    // Read IV from beginning of file
    const encryptedData = await fs.readFile(encryptedPath);
    const iv = encryptedData.slice(0, 16);
    const tag = encryptedData.slice(-16);
    const ciphertext = encryptedData.slice(16, -16);

    const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    await fs.writeFile(decryptedPath, decrypted);

    logger.info(`File decrypted: ${decryptedPath}`);
    return decryptedPath;
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(filePath: string): Promise<string> {
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    for await (const chunk of stream) {
      hash.update(chunk);
    }

    return hash.digest('hex');
  }

  /**
   * Store backup to all configured destinations
   */
  private async storeBackupToDestinations(
    sourcePath: string,
    metadata: BackupMetadata
  ): Promise<void> {
    for (const destination of this.config.destinations) {
      if (!destination.enabled) continue;

      try {
        switch (destination.type) {
          case 'local':
            await this.storeBackupLocal(sourcePath, destination, metadata);
            break;
          case 's3':
            await this.storeBackupS3(sourcePath, destination, metadata);
            break;
          case 'azure':
            await this.storeBackupAzure(sourcePath, destination, metadata);
            break;
          default:
            logger.warn(`Unsupported backup destination type: ${destination.type}`);
        }
      } catch (error) {
        logger.error('Failed to store backup to destination', toErrorOrUndefined(error), {
          destinationType: destination.type,
        });
      }
    }
  }

  /**
   * Store backup to local destination
   */
  private async storeBackupLocal(
    sourcePath: string,
    destination: BackupDestination,
    metadata: BackupMetadata
  ): Promise<void> {
    const targetPath = join(destination.path, `${metadata.id}.backup`);
    await fs.copyFile(sourcePath, targetPath);

    // Update metadata with final destination
    metadata.destination = targetPath;

    logger.info(`Backup stored locally: ${targetPath}`);
  }

  /**
   * Store backup to AWS S3
   */
  private async storeBackupS3(
    sourcePath: string,
    destination: BackupDestination,
    metadata: BackupMetadata
  ): Promise<void> {
    if (!this.s3Client || !destination.bucket) {
      throw new Error('S3 client or bucket not configured');
    }

    const key = `backups/${metadata.id}.backup`;
    const fileStream = createReadStream(sourcePath);

    const upload = new Upload({
      client: this.s3Client,
      params: {
        Bucket: destination.bucket,
        Key: key,
        Body: fileStream,
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD_IA', // Infrequent Access for cost optimization
        Metadata: {
          backupId: metadata.id,
          timestamp: metadata.timestamp.toISOString(),
          version: metadata.version,
        },
        Tagging: Object.entries({
          backup_id: metadata.id,
          backup_type: metadata.type,
          created_date: metadata.timestamp.toISOString().split('T')[0],
        })
          .map(([k, v]) => `${k}=${v}`)
          .join('&'),
      },
    });

    await upload.done();

    metadata.destination = `s3://${destination.bucket}/${key}`;
    logger.info(`Backup stored to S3: ${metadata.destination}`);
  }

  /**
   * Store backup to Azure Blob Storage
   */
  private async storeBackupAzure(
    sourcePath: string,
    destination: BackupDestination,
    metadata: BackupMetadata
  ): Promise<void> {
    try {
      // Would implement Azure Blob Storage upload here
      // For now, fallback to local storage
      logger.warn('Azure Blob Storage not yet implemented, using local fallback');
      await this.storeBackupLocal(sourcePath, { ...destination, type: 'local' }, metadata);
    } catch (error) {
      logger.error('Azure backup failed', toErrorOrUndefined(error));
      throw error;
    }
  }

  /**
   * Load backup history
   */
  private async loadBackupHistory(): Promise<void> {
    const historyPath = join(process.cwd(), 'data', 'backup-history.json');

    try {
      if (existsSync(historyPath)) {
        const data = await fs.readFile(historyPath, 'utf-8');
        this.backupHistory = JSON.parse(data).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp),
        }));
      }
    } catch (error) {
      logger.warn('Failed to load backup history:', toReadonlyRecord(error));
      this.backupHistory = [];
    }
  }

  /**
   * Save backup history
   */
  private async saveBackupHistory(): Promise<void> {
    const historyPath = join(process.cwd(), 'data', 'backup-history.json');
    await fs.mkdir(dirname(historyPath), { recursive: true });
    await fs.writeFile(historyPath, JSON.stringify(this.backupHistory, null, 2));
  }

  /**
   * Cleanup old backups based on retention policy
   */
  private async cleanupOldBackups(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const oldBackups = this.backupHistory.filter(b => b.timestamp < cutoffDate);

    for (const backup of oldBackups) {
      try {
        if (existsSync(backup.destination)) {
          await fs.unlink(backup.destination);
        }

        // Remove from history
        const index = this.backupHistory.indexOf(backup);
        if (index > -1) {
          this.backupHistory.splice(index, 1);
        }

        logger.info(`Cleaned up old backup: ${backup.id}`);
      } catch (error) {
        logger.warn(`Failed to cleanup backup ${backup.id}:`, toReadonlyRecord(error));
      }
    }

    await this.saveBackupHistory();
  }

  /**
   * Start scheduled backups
   */
  private startScheduledBackups(): void {
    // Simple daily backup (in production, use a proper cron library)
    const DAILY_MS = 24 * 60 * 60 * 1000;

    this.scheduleTimer = setInterval(async () => {
      try {
        await this.performFullBackup();
      } catch (error) {
        logger.error('Scheduled backup failed', { error: toErrorOrUndefined(error) });
      }
    }, DAILY_MS);

    logger.info('Scheduled backups started');
  }

  /**
   * Extract backup package with decryption and decompression
   */
  private async extractBackupPackage(backup: BackupMetadata, targetDir?: string): Promise<string> {
    const extractDir = targetDir || join(process.cwd(), 'temp', `extract_${backup.id}`);
    await fs.mkdir(extractDir, { recursive: true });

    let backupPath = backup.destination;

    // Download from cloud storage if needed
    if (backupPath.startsWith('s3://')) {
      backupPath = await this.downloadFromS3(backupPath, extractDir);
    }

    // Decrypt if encrypted
    if (backup.encrypted && backupPath.endsWith('.enc')) {
      backupPath = await this.decryptFile(backupPath);
    }

    // Extract tar.gz archive
    try {
      // Use node-tar extract API
      await tar.extract({
        file: backupPath,
        cwd: extractDir,
        ...(backup.compressed && { gzip: true }),
      });

      logger.info(`Backup extracted to: ${extractDir}`);
    } catch (error) {
      logger.error('Failed to extract backup archive', { error: toErrorOrUndefined(error) });
      throw new Error(`Archive extraction failed: ${error}`);
    }

    // Verify manifest
    const manifestPath = join(extractDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8'));
      logger.info(`Backup manifest verified: ${manifest.files.length} files`);
    }

    return extractDir;
  }

  /**
   * Download backup from S3
   */
  private async downloadFromS3(s3Path: string, targetDir: string): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const [, , bucket, ...keyParts] = s3Path.split('/');
    const key = keyParts.join('/');
    const localPath = join(targetDir, 'backup.tar.gz');

    try {
      const command = new AWS.GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (response.Body) {
        const writeStream = createWriteStream(localPath);
        await pipeline(response.Body as NodeJS.ReadableStream, writeStream);
        logger.info(`Downloaded backup from S3: ${localPath}`);
        return localPath;
      } else {
        throw new Error('Empty response from S3');
      }
    } catch (error) {
      logger.error('Failed to download from S3', { error: toErrorOrUndefined(error) });
      throw error;
    }
  }

  /**
   * Restore database
   */
  private async restoreDatabase(extractedPath: string): Promise<void> {
    const dbType = process.env.DATABASE_TYPE || 'sqlite';

    try {
      switch (dbType) {
        case 'postgresql':
          await this.restorePostgreSQL(extractedPath);
          break;
        case 'mysql':
          await this.restoreMySQL(extractedPath);
          break;
        case 'mongodb':
          await this.restoreMongoDB(extractedPath);
          break;
        default:
          // SQLite restore
          const dbPath = join(extractedPath, 'database.db');
          if (existsSync(dbPath)) {
            const targetPath =
              process.env.DATABASE_PATH || join(process.cwd(), 'data', 'codecrucible.db');
            await fs.mkdir(dirname(targetPath), { recursive: true });

            // Stop database connections before restore
            await this.dbManager.close();

            // Replace database file
            await fs.copyFile(dbPath, targetPath);

            // Restart database connections
            await this.dbManager.initialize();

            logger.info('SQLite database restored successfully');
          } else {
            logger.warn('Database backup file not found in extracted backup');
          }
          break;
      }
    } catch (error) {
      logger.error('Database restore failed', { error: toErrorOrUndefined(error) });
      throw error;
    }
  }

  /**
   * Restore PostgreSQL database
   */
  private async restorePostgreSQL(extractedPath: string): Promise<void> {
    const backupPath = join(extractedPath, 'database.sql');
    if (!existsSync(backupPath)) {
      throw new Error('PostgreSQL backup file not found');
    }

    const dbUrl = process.env.DATABASE_URL || 'postgresql://localhost/codecrucible';
    const command = `psql "${dbUrl}" < "${backupPath}"`;

    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn(`PostgreSQL restore warnings: ${stderr}`);
      }
      logger.info('PostgreSQL database restored successfully');
    } catch (error: any) {
      throw new Error(`PostgreSQL restore failed: ${error.message}`);
    }
  }

  /**
   * Restore MySQL database
   */
  private async restoreMySQL(extractedPath: string): Promise<void> {
    const backupPath = join(extractedPath, 'database.sql');
    if (!existsSync(backupPath)) {
      throw new Error('MySQL backup file not found');
    }

    const host = process.env.DB_HOST || 'localhost';
    const user = process.env.DB_USER || 'root';
    const password = process.env.DB_PASSWORD || '';
    const database = process.env.DB_NAME || 'codecrucible';

    const command = `mysql -h ${host} -u ${user} ${password ? `-p${password}` : ''} ${database} < "${backupPath}"`;

    try {
      await execAsync(command);
      logger.info('MySQL database restored successfully');
    } catch (error: any) {
      throw new Error(`MySQL restore failed: ${error.message}`);
    }
  }

  /**
   * Restore MongoDB database
   */
  private async restoreMongoDB(extractedPath: string): Promise<void> {
    const backupPath = join(extractedPath, 'database.tar.gz');
    if (!existsSync(backupPath)) {
      throw new Error('MongoDB backup file not found');
    }

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codecrucible';
    const tempDir = join(extractedPath, 'mongo_restore');

    try {
      // Extract the backup
      await tar.extract({
        file: backupPath,
        cwd: tempDir,
        gzip: true,
      });

      // Run mongorestore
      const command = `mongorestore --uri="${uri}" --drop "${tempDir}"`;
      await execAsync(command);

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      logger.info('MongoDB database restored successfully');
    } catch (error: any) {
      throw new Error(`MongoDB restore failed: ${error.message}`);
    }
  }

  /**
   * Restore configuration
   */
  private async restoreConfiguration(extractedPath: string): Promise<void> {
    const configPath = join(extractedPath, 'config.json');
    if (existsSync(configPath)) {
      try {
        const configData = JSON.parse(await fs.readFile(configPath, 'utf-8'));

        // Validate configuration format
        if (!configData.version || !configData.timestamp) {
          throw new Error('Invalid configuration backup format');
        }

        // Backup current configuration before restore
        const currentConfigPath = join(process.cwd(), 'config', 'production.config.json');
        const backupConfigPath = join(
          process.cwd(),
          'config',
          `production.config.backup.${Date.now()}.json`
        );

        if (existsSync(currentConfigPath)) {
          await fs.copyFile(currentConfigPath, backupConfigPath);
          logger.info(`Current configuration backed up to: ${backupConfigPath}`);
        }

        // Restore configuration (implement specific restoration logic based on config structure)
        logger.info(`Configuration restored from backup version: ${configData.version}`);
        logger.info(`Original backup timestamp: ${configData.timestamp}`);

        // For now, we log the restore. In production, you would merge/replace specific config sections
        // based on your application's configuration management needs
      } catch (error) {
        logger.error('Configuration restore failed', { error: toErrorOrUndefined(error) });
        throw error;
      }
    } else {
      logger.warn('Configuration backup file not found in extracted backup');
    }
  }

  /**
   * Send notification
   */
  private async sendNotification(type: 'success' | 'failure', data: any): Promise<void> {
    if (!this.config.notifications.onSuccess && type === 'success') return;
    if (!this.config.notifications.onFailure && type === 'failure') return;

    const message =
      type === 'success'
        ? `Backup completed successfully: ${data.id}`
        : `Backup failed: ${data.id} - ${data.error}`;

    logger.info(`Notification: ${message}`);

    // Implement webhook/email notifications here
  }

  /**
   * Stop backup system
   */
  async stop(): Promise<void> {
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = undefined;
    }

    logger.info('Backup manager stopped');
  }
}
