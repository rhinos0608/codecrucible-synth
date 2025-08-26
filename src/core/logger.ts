// Backward compatibility bridge for logger
// This file re-exports from the new infrastructure/logging structure

export * from '../infrastructure/logging/logger.js';

// Legacy warning
console.warn('Warning: Importing from src/core/logger.ts is deprecated. Use src/infrastructure/logging/logger.js instead.');