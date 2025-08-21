import crypto from 'crypto';
import { logger } from './logger.js';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  tagLength: number;
  iterations: number;
}

export class SecurityUtils {
  private static encryptionKey: Buffer | null = null;
  private static readonly config: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16,
    tagLength: 16,
    iterations: 100000,
  };

  static initializeEncryption(masterKey?: string): void {
    try {
      if (masterKey) {
        // Derive encryption key from master key using PBKDF2
        const salt = crypto.randomBytes(16);
        this.encryptionKey = crypto.pbkdf2Sync(
          masterKey,
          salt,
          this.config.iterations,
          this.config.keyLength,
          'sha256'
        );
      } else {
        // Generate random encryption key for temporary use
        this.encryptionKey = crypto.randomBytes(this.config.keyLength);
      }

      logger.info('Encryption system initialized');
    } catch (error) {
      logger.error('Failed to initialize encryption', error as Error);
      throw new Error('Encryption initialization failed');
    }
  }

  static isEncrypted(data: string): boolean {
    try {
      return data.startsWith('encrypted:') && data.includes(':') && data.split(':').length >= 4;
    } catch {
      return false;
    }
  }

  static encrypt(data: string): string {
    try {
      if (!this.encryptionKey) {
        this.initializeEncryption();
      }

      if (!this.encryptionKey) {
        throw new Error('Encryption key not available');
      }

      // Generate random IV for each encryption
      const iv = crypto.randomBytes(this.config.ivLength);

      // Create cipher with AES-256-GCM
      const cipher = crypto.createCipheriv(this.config.algorithm, this.encryptionKey, iv);

      // Encrypt the data
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');

      // Get authentication tag for integrity verification
      const authTag = (cipher as any).getAuthTag();

      // Return format: encrypted:iv:authTag:encryptedData
      return `encrypted:${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
    } catch (error) {
      logger.error('Encryption failed', error as Error);
      throw new Error('Data encryption failed');
    }
  }

  static decrypt(data: string): string {
    try {
      if (!this.isEncrypted(data)) {
        return data;
      }

      if (!this.encryptionKey) {
        throw new Error('Encryption key not available for decryption');
      }

      // Parse encrypted data format: encrypted:iv:authTag:encryptedData
      const parts = data.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }

      const [prefix, ivBase64, authTagBase64, encryptedData] = parts;

      if (prefix !== 'encrypted') {
        throw new Error('Invalid encryption prefix');
      }

      // Convert from base64
      const iv = Buffer.from(ivBase64, 'base64');
      const authTag = Buffer.from(authTagBase64, 'base64');

      // Validate buffer lengths
      if (iv.length !== this.config.ivLength) {
        throw new Error('Invalid IV length');
      }
      if (authTag.length !== this.config.tagLength) {
        throw new Error('Invalid authentication tag length');
      }

      // Create decipher with AES-256-GCM
      const decipher = crypto.createDecipheriv(this.config.algorithm, this.encryptionKey, iv);
      (decipher as any).setAuthTag(authTag);

      // Decrypt the data with authentication verification
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', error as Error);
      throw new Error('Data decryption failed');
    }
  }

  /**
   * Validate data integrity using HMAC
   */
  static validateIntegrity(data: string, expectedHash: string): boolean {
    try {
      if (!this.encryptionKey) {
        return false;
      }

      const hmac = crypto.createHmac('sha256', this.encryptionKey);
      hmac.update(data);
      const calculatedHash = hmac.digest('hex');

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(expectedHash, 'hex'),
        Buffer.from(calculatedHash, 'hex')
      );
    } catch {
      return false;
    }
  }

  /**
   * Generate integrity hash for data
   */
  static generateIntegrityHash(data: string): string {
    try {
      if (!this.encryptionKey) {
        this.initializeEncryption();
      }

      const hmac = crypto.createHmac('sha256', this.encryptionKey!);
      hmac.update(data);
      return hmac.digest('hex');
    } catch (error) {
      logger.error('Failed to generate integrity hash', error as Error);
      throw new Error('Integrity hash generation failed');
    }
  }

  /**
   * Securely clear encryption key from memory
   */
  static clearEncryptionKey(): void {
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
      logger.info('Encryption key cleared from memory');
    }
  }

  /**
   * Generate cryptographically secure random string
   */
  static generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password using bcrypt-like security
   */
  static async hashPassword(password: string, salt?: string): Promise<string> {
    try {
      const actualSalt = salt || crypto.randomBytes(16).toString('hex');
      const hash = crypto.pbkdf2Sync(password, actualSalt, this.config.iterations, 64, 'sha256');
      return `${actualSalt}:${hash.toString('hex')}`;
    } catch (error) {
      logger.error('Password hashing failed', error as Error);
      throw new Error('Password hashing failed');
    }
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const [salt, expectedHash] = hash.split(':');
      if (!salt || !expectedHash) {
        return false;
      }

      const actualHash = crypto.pbkdf2Sync(password, salt, this.config.iterations, 64, 'sha256');
      return crypto.timingSafeEqual(Buffer.from(expectedHash, 'hex'), actualHash);
    } catch {
      return false;
    }
  }
}
