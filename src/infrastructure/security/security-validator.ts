/**
 * Security Validator - Infrastructure Security Module
 * Re-exports unified security validator for architectural compatibility
 */

// Export domain interfaces (allowed - infrastructure can depend on domain interfaces)
export * from '../../domain/interfaces/security-validator.js';

// Export infrastructure implementation 
export { UnifiedSecurityValidator } from './unified-security-validator.js';

// Named export alias for backward compatibility
export { UnifiedSecurityValidator as SecurityValidator } from './unified-security-validator.js';
