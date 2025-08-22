/**
 * Enterprise Secrets Management System
 * Implements encrypted configuration storage with key rotation and access control
 */

import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../logger.js';

export interface SecretConfig {
  name: string;
  value: string;
  description?: string;
  tags?: string[];
  expiresAt?: Date;
  createdAt: Date;
  lastAccessed?: Date;
  accessCount: number;
}

export interface EncryptedSecret {
  name: string;
  encryptedData: string;
  encryptedValue: string;
  iv: string;
  salt: string;
  authTag: string;
  algorithm: string;
  keyDerivation: string;
  metadata: {
    description?: string;
    tags?: string[];
    expiresAt?: string;
    createdAt: string;
    lastAccessed?: string;
    accessCount: number;
  };
}

export interface KeyRotationConfig {
  enabled: boolean;
  intervalDays: number;
  retainOldKeys: number;
  autoRotate: boolean;
}

export interface SecretsManagerConfig {
  storePath: string;
  masterKeyPath: string;
  keyRotation: KeyRotationConfig;
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    saltLength: number;
    iterations: number;
  };
  access: {
    auditLog: boolean;
    maxAccessAttempts: number;
    requireAuthentication: boolean;
  };
}

export class SecretsManager {
  private config: SecretsManagerConfig;
  private masterKey: Buffer | null = null;
  private secrets = new Map<string, SecretConfig>();
  private accessLog: Array<{ secret: string; timestamp: Date; user?: string; success: boolean }> =
    [];
  private keyRotationTimer?: NodeJS.Timeout;

  constructor(config: Partial<SecretsManagerConfig> = {}) {
    this.config = {
      storePath: process.env.SECRETS_STORE_PATH || './secrets',
      masterKeyPath: process.env.MASTER_KEY_PATH || './master.key',
      keyRotation: {
        enabled: true,
        intervalDays: 90,
        retainOldKeys: 3,
        autoRotate: false,
      },
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        saltLength: 32,
        iterations: 100000,
      },
      access: {
        auditLog: true,
        maxAccessAttempts: 5,
        requireAuthentication: true,
      },
      ...config,
    };
  }

  /**
   * Initialize secrets manager
   */
  async initialize(masterPassword?: string): Promise<void> {
    try {
      // Ensure secrets directory exists
      await fs.mkdir(this.config.storePath, { recursive: true });

      // Load or generate master key
      await this.loadOrGenerateMasterKey(masterPassword);

      // Load existing secrets
      await this.loadSecrets();

      // Start key rotation timer if enabled
      if (this.config.keyRotation.enabled && this.config.keyRotation.autoRotate) {
        this.startKeyRotationTimer();
      }

      logger.info('Secrets manager initialized', {
        storePath: this.config.storePath,
        secretsCount: this.secrets.size,
      });
    } catch (error) {
      logger.error('Failed to initialize secrets manager', error as Error);
      throw error;
    }
  }

  /**
   * Store a secret securely
   */
  async storeSecret(
    name: string,
    value: string,
    options: {
      description?: string;
      tags?: string[];
      expiresAt?: Date;
    } = {}
  ): Promise<void> {
    try {
      if (!this.masterKey) {
        throw new Error('Secrets manager not initialized');
      }

      // Validate secret name
      this.validateSecretName(name);

      // Create secret config
      const secret: SecretConfig = {
        name,
        value,
        description: options.description,
        tags: options.tags || [],
        expiresAt: options.expiresAt,
        createdAt: new Date(),
        accessCount: 0,
      };

      // Encrypt and store
      const encrypted = await this.encryptSecretInternal(secret);
      await this.saveEncryptedSecret(encrypted);

      // Update in-memory cache
      this.secrets.set(name, secret);

      logger.info('Secret stored', {
        name,
        hasExpiration: !!options.expiresAt,
        tags: options.tags,
      });
    } catch (error) {
      logger.error('Failed to store secret', error as Error, { name });
      throw error;
    }
  }

  /**
   * Encrypt a secret and return encrypted data (for testing purposes)
   */
  async encryptSecret(name: string, value: string): Promise<EncryptedSecret> {
    try {
      if (!this.masterKey) {
        await this.initialize();
      }

      // Validate secret name
      this.validateSecretName(name);

      // Create secret config
      const secret: SecretConfig = {
        name,
        value,
        createdAt: new Date(),
        accessCount: 0,
      };

      // Store in memory for decryption
      this.secrets.set(name, secret);

      // Encrypt and return the encrypted secret
      return await this.encryptSecretInternal(secret);
    } catch (error) {
      logger.error('Failed to encrypt secret', error as Error, { name });
      throw error;
    }
  }

  /**
   * Decrypt a secret (for testing purposes)
   */
  async decryptSecret(name: string): Promise<string> {
    const secret = await this.getSecret(name);
    if (!secret) {
      throw new Error('Secret not found');
    }
    return secret;
  }

  /**
   * Retrieve a secret
   */
  async getSecret(name: string, userId?: string): Promise<string | null> {
    try {
      if (!this.masterKey) {
        throw new Error('Secrets manager not initialized');
      }

      // Check if secret exists
      const secret = this.secrets.get(name);
      if (!secret) {
        this.logAccess(name, false, userId);
        return null;
      }

      // Check expiration
      if (secret.expiresAt && secret.expiresAt < new Date()) {
        logger.warn('Attempted access to expired secret', { name, expiresAt: secret.expiresAt });
        this.logAccess(name, false, userId, 'expired');
        return null;
      }

      // Update access tracking
      secret.lastAccessed = new Date();
      secret.accessCount++;

      // Log access
      this.logAccess(name, true, userId);

      logger.debug('Secret accessed', {
        name,
        accessCount: secret.accessCount,
        userId,
      });

      return secret.value;
    } catch (error) {
      logger.error('Failed to retrieve secret', error as Error, { name, userId });
      this.logAccess(name, false, userId, 'error');
      throw error;
    }
  }

  /**
   * Update a secret
   */
  async updateSecret(
    name: string,
    newValue: string,
    options: {
      description?: string;
      tags?: string[];
      expiresAt?: Date;
    } = {}
  ): Promise<void> {
    try {
      const existingSecret = this.secrets.get(name);
      if (!existingSecret) {
        throw new Error(`Secret '${name}' not found`);
      }

      // Create updated secret
      const updatedSecret: SecretConfig = {
        ...existingSecret,
        value: newValue,
        description: options.description ?? existingSecret.description,
        tags: options.tags ?? existingSecret.tags,
        expiresAt: options.expiresAt ?? existingSecret.expiresAt,
      };

      // Encrypt and store
      const encrypted = await this.encryptSecretInternal(updatedSecret);
      await this.saveEncryptedSecret(encrypted);

      // Update in-memory cache
      this.secrets.set(name, updatedSecret);

      logger.info('Secret updated', { name });
    } catch (error) {
      logger.error('Failed to update secret', error as Error, { name });
      throw error;
    }
  }

  /**
   * Delete a secret
   */
  async deleteSecret(name: string): Promise<boolean> {
    try {
      if (!this.secrets.has(name)) {
        return false;
      }

      // Remove from filesystem
      const filePath = path.join(this.config.storePath, `${name}.json`);
      await fs.unlink(filePath);

      // Remove from memory
      this.secrets.delete(name);

      logger.info('Secret deleted', { name });
      return true;
    } catch (error) {
      logger.error('Failed to delete secret', error as Error, { name });
      throw error;
    }
  }

  /**
   * List all secret names (not values)
   */
  async listSecrets(tags?: string[]): Promise<
    Array<{
      name: string;
      description?: string;
      tags?: string[];
      expiresAt?: Date;
      createdAt: Date;
      lastAccessed?: Date;
      accessCount: number;
    }>
  > {
    try {
      let secrets = Array.from(this.secrets.values());

      // Filter by tags if specified
      if (tags && tags.length > 0) {
        secrets = secrets.filter(secret => secret.tags?.some(tag => tags.includes(tag)));
      }

      // Return metadata only (no values)
      return secrets.map(secret => ({
        name: secret.name,
        description: secret.description,
        tags: secret.tags,
        expiresAt: secret.expiresAt,
        createdAt: secret.createdAt,
        lastAccessed: secret.lastAccessed,
        accessCount: secret.accessCount,
      }));
    } catch (error) {
      logger.error('Failed to list secrets', error as Error);
      throw error;
    }
  }

  /**
   * Rotate master key
   */
  async rotateMasterKey(newPassword?: string): Promise<void> {
    try {
      logger.info('Starting master key rotation');

      // Backup current secrets
      const secretsBackup = new Map(this.secrets);

      // Generate new master key
      const oldMasterKey = this.masterKey;
      await this.generateMasterKey(newPassword);

      // Re-encrypt all secrets with new key
      for (const [name, secret] of secretsBackup.entries()) {
        const encrypted = await this.encryptSecretInternal(secret);
        await this.saveEncryptedSecret(encrypted);
      }

      // Archive old master key if configured
      if (this.config.keyRotation.retainOldKeys > 0) {
        await this.archiveMasterKey(oldMasterKey!);
      }

      logger.info('Master key rotation completed', {
        secretsReencrypted: secretsBackup.size,
      });
    } catch (error) {
      logger.error('Master key rotation failed', error as Error);
      throw error;
    }
  }

  /**
   * Export secrets (encrypted) for backup
   */
  async exportSecrets(): Promise<string> {
    try {
      const exportData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        secrets: await this.getAllEncryptedSecrets(),
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error('Failed to export secrets', error as Error);
      throw error;
    }
  }

  /**
   * Import secrets from backup
   */
  async importSecrets(exportData: string): Promise<void> {
    try {
      const data = JSON.parse(exportData);

      if (data.version !== '1.0') {
        throw new Error('Unsupported export format version');
      }

      let importCount = 0;
      for (const encrypted of data.secrets) {
        await this.saveEncryptedSecret(encrypted);

        // Decrypt and add to memory cache
        const secret = await this.decryptSecretInternal(encrypted);
        this.secrets.set(secret.name, secret);
        importCount++;
      }

      logger.info('Secrets imported successfully', {
        importCount,
        totalSecrets: this.secrets.size,
      });
    } catch (error) {
      logger.error('Failed to import secrets', error as Error);
      throw error;
    }
  }

  /**
   * Get access audit log
   */
  getAccessLog(hours: number = 24): Array<{
    secret: string;
    timestamp: Date;
    user?: string;
    success: boolean;
    reason?: string;
  }> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.accessLog.filter(entry => entry.timestamp >= cutoff);
  }

  /**
   * Encrypt a secret (internal method)
   */
  private async encryptSecretInternal(secret: SecretConfig): Promise<EncryptedSecret> {
    const salt = crypto.randomBytes(this.config.encryption.saltLength);
    const iv = crypto.randomBytes(this.config.encryption.ivLength);

    // Derive encryption key from master key and salt
    const key = crypto.pbkdf2Sync(
      this.masterKey!,
      salt,
      this.config.encryption.iterations,
      this.config.encryption.keyLength,
      'sha256'
    );

    // Encrypt the secret value using GCM for authenticated encryption
    const cipher = crypto.createCipheriv(this.config.encryption.algorithm, key, iv);
    let encrypted = cipher.update(secret.value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = (cipher as any).getAuthTag();

    return {
      name: secret.name,
      encryptedData: encrypted,
      encryptedValue: encrypted,
      iv: iv.toString('base64'),
      salt: salt.toString('base64'),
      authTag: authTag.toString('base64'),
      algorithm: this.config.encryption.algorithm,
      keyDerivation: 'pbkdf2',
      metadata: {
        description: secret.description,
        tags: secret.tags,
        expiresAt: secret.expiresAt?.toISOString(),
        createdAt: secret.createdAt.toISOString(),
        lastAccessed: secret.lastAccessed?.toISOString(),
        accessCount: secret.accessCount,
      },
    };
  }

  /**
   * Decrypt a secret (internal method)
   */
  private async decryptSecretInternal(encrypted: EncryptedSecret): Promise<SecretConfig> {
    const salt = Buffer.from(encrypted.salt, 'base64');
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');

    // Derive decryption key
    const key = crypto.pbkdf2Sync(
      this.masterKey!,
      salt,
      this.config.encryption.iterations,
      this.config.encryption.keyLength,
      'sha256'
    );

    // Decrypt the value using GCM for authenticated decryption
    const decipher = crypto.createDecipheriv(encrypted.algorithm, key, iv);
    (decipher as any).setAuthTag(authTag);
    let decrypted = decipher.update(encrypted.encryptedValue, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return {
      name: encrypted.name,
      value: decrypted,
      description: encrypted.metadata.description,
      tags: encrypted.metadata.tags || [],
      expiresAt: encrypted.metadata.expiresAt ? new Date(encrypted.metadata.expiresAt) : undefined,
      createdAt: new Date(encrypted.metadata.createdAt),
      lastAccessed: encrypted.metadata.lastAccessed
        ? new Date(encrypted.metadata.lastAccessed)
        : undefined,
      accessCount: encrypted.metadata.accessCount,
    };
  }

  /**
   * Load or generate master key
   */
  private async loadOrGenerateMasterKey(password?: string): Promise<void> {
    try {
      // Try to load existing master key
      const keyExists = await fs
        .access(this.config.masterKeyPath)
        .then(() => true)
        .catch(() => false);

      if (keyExists) {
        await this.loadMasterKey(password);
      } else {
        await this.generateMasterKey(password);
      }
    } catch (error) {
      logger.error('Failed to load or generate master key', error as Error);
      throw error;
    }
  }

  /**
   * Load master key from file
   */
  private async loadMasterKey(password?: string): Promise<void> {
    const keyData = await fs.readFile(this.config.masterKeyPath, 'utf8');

    if (password) {
      // Decrypt master key with password
      const [encryptedKey, salt, iv] = keyData.split(':');
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, Buffer.from(iv, 'hex'));
      let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      this.masterKey = Buffer.from(decrypted, 'hex');
    } else {
      // Use key directly (for development only)
      this.masterKey = Buffer.from(keyData, 'hex');
    }
  }

  /**
   * Generate new master key
   */
  private async generateMasterKey(password?: string): Promise<void> {
    this.masterKey = crypto.randomBytes(32);

    let keyData: string;

    if (password) {
      // Encrypt master key with password
      const salt = crypto.randomBytes(16).toString('hex');
      const iv = crypto.randomBytes(16);
      const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');

      const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
      let encrypted = cipher.update(this.masterKey.toString('hex'), 'utf8', 'hex');
      encrypted += cipher.final('hex');

      keyData = `${encrypted}:${salt}:${iv.toString('hex')}`;
    } else {
      // Store key directly (for development only)
      keyData = this.masterKey.toString('hex');
    }

    await fs.writeFile(this.config.masterKeyPath, keyData, { mode: 0o600 });

    logger.info('New master key generated', {
      keyPath: this.config.masterKeyPath,
      encrypted: !!password,
    });
  }

  /**
   * Load secrets from storage
   */
  private async loadSecrets(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.storePath);
      const secretFiles = files.filter(file => file.endsWith('.json'));

      for (const file of secretFiles) {
        try {
          const filePath = path.join(this.config.storePath, file);
          const encryptedData = await fs.readFile(filePath, 'utf8');
          const encrypted: EncryptedSecret = JSON.parse(encryptedData);

          const secret = await this.decryptSecretInternal(encrypted);
          this.secrets.set(secret.name, secret);
        } catch (error) {
          logger.error('Failed to load secret file', error as Error, { file });
        }
      }

      logger.info('Secrets loaded from storage', {
        count: this.secrets.size,
      });
    } catch (error) {
      logger.error('Failed to load secrets', error as Error);
      throw error;
    }
  }

  /**
   * Save encrypted secret to file
   */
  private async saveEncryptedSecret(encrypted: EncryptedSecret): Promise<void> {
    const filePath = path.join(this.config.storePath, `${encrypted.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(encrypted, null, 2), { mode: 0o600 });
  }

  /**
   * Get all encrypted secrets
   */
  private async getAllEncryptedSecrets(): Promise<EncryptedSecret[]> {
    const encryptedSecrets: EncryptedSecret[] = [];

    for (const secret of this.secrets.values()) {
      const encrypted = await this.encryptSecretInternal(secret);
      encryptedSecrets.push(encrypted);
    }

    return encryptedSecrets;
  }

  /**
   * Validate secret name
   */
  private validateSecretName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Secret name must be a non-empty string');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      throw new Error(
        'Secret name can only contain alphanumeric characters, underscores, and hyphens'
      );
    }

    if (name.length > 100) {
      throw new Error('Secret name cannot exceed 100 characters');
    }
  }

  /**
   * Log secret access
   */
  private logAccess(secret: string, success: boolean, userId?: string, reason?: string): void {
    if (this.config.access.auditLog) {
      this.accessLog.push({
        secret,
        timestamp: new Date(),
        user: userId,
        success,
        ...(reason && { reason }),
      });

      // Trim access log if too large
      if (this.accessLog.length > 10000) {
        this.accessLog.splice(0, 1000);
      }
    }
  }

  /**
   * Archive old master key
   */
  private async archiveMasterKey(oldKey: Buffer): Promise<void> {
    const archivePath = path.join(this.config.storePath, 'archived-keys');
    await fs.mkdir(archivePath, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveFile = path.join(archivePath, `master-key-${timestamp}.bak`);

    await fs.writeFile(archiveFile, oldKey.toString('hex'), { mode: 0o600 });

    logger.info('Old master key archived', { archiveFile });
  }

  /**
   * Start key rotation timer
   */
  private startKeyRotationTimer(): void {
    const intervalMs = this.config.keyRotation.intervalDays * 24 * 60 * 60 * 1000;

    this.keyRotationTimer = setInterval(async () => {
      try {
        logger.info('Starting automatic key rotation');
        await this.rotateMasterKey();
      } catch (error) {
        logger.error('Automatic key rotation failed', error as Error);
      }
    }, intervalMs);
  }

  /**
   * Stop and cleanup
   */
  async stop(): Promise<void> {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
    }

    // Clear sensitive data from memory
    this.masterKey?.fill(0);
    this.masterKey = null;
    this.secrets.clear();

    logger.info('Secrets manager stopped');
  }

  // Test helper methods
  async deleteTestSecret(name: string): Promise<boolean> {
    const exists = this.secrets.has(name);
    if (exists) {
      this.secrets.delete(name);
      // Also try to delete from storage if it exists
      try {
        const secretPath = path.join(this.config.storePath, `${name}.json`);
        await fs.unlink(secretPath);
      } catch {
        // Ignore if file doesn't exist
      }
    }
    return exists;
  }

  async rotateEncryptionKey(): Promise<void> {
    // Generate new master key
    const newMasterKey = crypto.randomBytes(32);
    const oldMasterKey = this.masterKey;

    // Set new master key
    this.masterKey = newMasterKey;

    // Re-encrypt all secrets with new key
    for (const [name, secret] of this.secrets.entries()) {
      const encrypted = await this.encryptSecretInternal(secret);
      await this.saveEncryptedSecret(encrypted);
    }

    // Clear old key from memory
    if (oldMasterKey) {
      oldMasterKey.fill(0);
    }

    logger.info('Encryption key rotated successfully');
  }

  setEncryptionKey(key: Buffer): void {
    if (key.length < 32) {
      throw new Error('Encryption key must be at least 32 bytes');
    }
    this.masterKey = key;
  }

  get secretStorage() {
    // For testing access to internal storage
    return this.secrets;
  }
}
