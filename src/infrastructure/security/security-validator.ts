/**
 * Security Validator - Infrastructure Security Module
 * Re-exports unified security validator for architectural compatibility
 */

export * from '../../domain/services/unified-security-validator.js';

// Named export alias for backward compatibility
export { 
  UnifiedSecurityValidator as SecurityValidator 
} from '../../domain/services/unified-security-validator.js';