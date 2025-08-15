import { createHash, randomBytes, pbkdf2Sync, scryptSync, createCipheriv, createDecipheriv } from 'crypto';
import { logger } from './logger.js';
/**
 * Security utilities for encryption and secure storage
 */
export class SecurityUtils {
    static ENCRYPTION_ALGORITHM = 'aes-256-cbc';
    static encryptionKey = null;
    /**
     * Initialize encryption key from machine-specific data
     */
    static async initializeEncryption() {
        try {
            // Generate machine-specific key based on hardware info
            const machineId = await this.getMachineIdentifier();
            const salt = 'codecrucible-synth-2024';
            // Create deterministic key from machine info
            this.encryptionKey = createHash('sha256')
                .update(machineId + salt)
                .digest('hex');
            logger.info('Encryption initialized successfully');
        }
        catch (error) {
            logger.error('Failed to initialize encryption:', error);
            throw new Error('Encryption initialization failed');
        }
    }
    /**
     * Encrypt sensitive data
     */
    static encrypt(data) {
        if (!this.encryptionKey) {
            throw new Error('Encryption not initialized');
        }
        try {
            const iv = randomBytes(16);
            const key = scryptSync(this.encryptionKey, 'salt', 32);
            const cipher = createCipheriv('aes-256-cbc', key, iv);
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            // Return IV + encrypted data
            return iv.toString('hex') + ':' + encrypted;
        }
        catch (error) {
            logger.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    /**
     * Decrypt sensitive data
     */
    static decrypt(encryptedData) {
        if (!this.encryptionKey) {
            throw new Error('Encryption not initialized');
        }
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 2) {
                throw new Error('Invalid encrypted data format');
            }
            const iv = Buffer.from(parts[0], 'hex');
            const encrypted = parts[1];
            const key = scryptSync(this.encryptionKey, 'salt', 32);
            const decipher = createDecipheriv('aes-256-cbc', key, iv);
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (error) {
            logger.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data');
        }
    }
    /**
     * Check if a value appears to be encrypted
     */
    static isEncrypted(value) {
        return typeof value === 'string' && value.split(':').length === 2 && value.length > 32;
    }
    /**
     * Sanitize sensitive data for logging
     */
    static sanitizeForLogging(data) {
        if (typeof data === 'string') {
            // Mask potential API keys, tokens, passwords
            return data.replace(/([a-f0-9]{32,}|[A-Za-z0-9+/]{40,})/g, '[REDACTED]');
        }
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('key') || lowerKey.includes('password') ||
                    lowerKey.includes('token') || lowerKey.includes('secret')) {
                    sanitized[key] = '[REDACTED]';
                }
                else {
                    sanitized[key] = this.sanitizeForLogging(value);
                }
            }
            return sanitized;
        }
        return data;
    }
    /**
     * Generate machine-specific identifier
     */
    static async getMachineIdentifier() {
        try {
            // Use a combination of OS-specific information
            const os = await import('os');
            const fs = await import('fs');
            let identifier = '';
            // Add hostname
            identifier += os.hostname();
            // Add platform info
            identifier += os.platform() + os.arch();
            // Add network interfaces (MAC addresses)
            const interfaces = os.networkInterfaces();
            for (const [name, iface] of Object.entries(interfaces)) {
                if (iface) {
                    for (const addr of iface) {
                        if (addr.mac && addr.mac !== '00:00:00:00:00:00') {
                            identifier += addr.mac;
                            break; // Use first valid MAC
                        }
                    }
                }
            }
            // Fallback to user info if available
            try {
                identifier += os.userInfo().username;
            }
            catch {
                // Ignore if user info is not available
            }
            if (identifier.length < 10) {
                // Final fallback - use timestamp + random for this session
                identifier = Date.now().toString() + Math.random().toString(36);
                logger.warn('Using fallback machine identifier');
            }
            return createHash('sha1').update(identifier).digest('hex');
        }
        catch (error) {
            logger.error('Failed to generate machine identifier:', error);
            // Ultimate fallback
            return createHash('sha1').update(Date.now().toString() + Math.random().toString()).digest('hex');
        }
    }
    /**
     * Validate input to prevent injection attacks
     */
    static validateInput(input, type = 'string') {
        switch (type) {
            case 'string':
                return typeof input === 'string' && input.length < 1000 && !input.includes('\0');
            case 'number':
                return typeof input === 'number' && isFinite(input);
            case 'boolean':
                return typeof input === 'boolean';
            case 'object':
                return typeof input === 'object' && input !== null && !Array.isArray(input);
            default:
                return false;
        }
    }
    /**
     * Generate secure random token
     */
    static generateSecureToken(length = 32) {
        return randomBytes(length).toString('hex');
    }
    /**
     * Hash password with salt
     */
    static hashPassword(password, salt) {
        const actualSalt = salt || randomBytes(16).toString('hex');
        const hash = pbkdf2Sync(password, actualSalt, 100000, 32, 'sha256').toString('hex');
        return { hash, salt: actualSalt };
    }
    /**
     * Verify password against hash
     */
    static verifyPassword(password, hash, salt) {
        const computed = this.hashPassword(password, salt);
        return computed.hash === hash;
    }
}
//# sourceMappingURL=security-utils.js.map