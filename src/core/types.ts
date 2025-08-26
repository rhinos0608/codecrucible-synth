// Backward compatibility bridge for core types
// This file re-exports from the new domain/types structure

// Re-export all types from domain layer
export * from '../domain/types/index.js';

// Legacy warning
console.warn('Warning: Importing from src/core/types.ts is deprecated. Use src/domain/types/index.js instead.');