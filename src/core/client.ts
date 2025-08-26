// Backward compatibility bridge for client
// This file re-exports from the new application/services structure

export * from '../application/services/client.js';

// Legacy warning
console.warn('Warning: Importing from src/core/client.ts is deprecated. Use src/application/services/client.js instead.');