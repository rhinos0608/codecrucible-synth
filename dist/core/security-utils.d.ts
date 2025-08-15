/**
 * Security utilities for encryption and secure storage
 */
export declare class SecurityUtils {
    private static readonly ENCRYPTION_ALGORITHM;
    private static encryptionKey;
    /**
     * Initialize encryption key from machine-specific data
     */
    static initializeEncryption(): Promise<void>;
    /**
     * Encrypt sensitive data
     */
    static encrypt(data: string): string;
    /**
     * Decrypt sensitive data
     */
    static decrypt(encryptedData: string): string;
    /**
     * Check if a value appears to be encrypted
     */
    static isEncrypted(value: string): boolean;
    /**
     * Sanitize sensitive data for logging
     */
    static sanitizeForLogging(data: any): any;
    /**
     * Generate machine-specific identifier
     */
    private static getMachineIdentifier;
    /**
     * Validate input to prevent injection attacks
     */
    static validateInput(input: any, type?: 'string' | 'number' | 'boolean' | 'object'): boolean;
    /**
     * Generate secure random token
     */
    static generateSecureToken(length?: number): string;
    /**
     * Hash password with salt
     */
    static hashPassword(password: string, salt?: string): {
        hash: string;
        salt: string;
    };
    /**
     * Verify password against hash
     */
    static verifyPassword(password: string, hash: string, salt: string): boolean;
}
