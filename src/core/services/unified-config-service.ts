/**
 * Unified Config Service - Replaced with Domain Implementation
 * 
 * @deprecated Use UnifiedConfigurationManager from domain/services instead
 * This provides backward compatibility during architectural migration.
 * 
 * The previous implementation referenced non-existent SecurityUtils and
 * violated architectural layering. The domain-level configuration manager
 * provides the same functionality with proper dependency management.
 */

// Re-export the properly layered domain implementation
export * from '../../domain/services/unified-configuration-manager.js';

// For backward compatibility, also provide type aliases
export type {
  UnifiedConfiguration as UnifiedConfig
} from '../../domain/services/unified-configuration-manager.js';

// Export the class as a value, not just a type
export {
  UnifiedConfigurationManager as UnifiedConfigService
} from '../../domain/services/unified-configuration-manager.js';