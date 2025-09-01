/**
 * Legacy Core Logger - Compatibility Stub
 *
 * This is a minimal stub to maintain backward compatibility
 * during the architectural migration.
 *
 * @deprecated Use createLogger from infrastructure/logging/logger-adapter.js instead
 */

import { createLogger } from '../infrastructure/logging/logger-adapter.js';

// Create a default logger instance for legacy compatibility
export const logger = createLogger('LegacyCore');

// Re-export createLogger for convenience
export { createLogger };
