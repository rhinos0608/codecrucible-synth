/**
 * Unified Security Validator Domain Service
 *
 * Domain layer now only exports interfaces and types.
 * Concrete implementation has been moved to infrastructure layer.
 *
 * This maintains backward compatibility for imports while enforcing
 * clean architecture principles.
 */

// Re-export the security validator interface and types from domain interfaces
export * from '../interfaces/security-validator.js';

/**
 * @deprecated Use IUnifiedSecurityValidator interface and inject implementation
 * This re-export is maintained for backward compatibility only.
 * Infrastructure implementations should be injected via dependency injection.
 */
export type { IUnifiedSecurityValidator as UnifiedSecurityValidator } from '../interfaces/security-validator.js';
