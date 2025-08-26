// Backward compatibility bridge for CLI
// This file re-exports from the new application/interfaces structure

export * from '../application/interfaces/cli';

// Legacy warning
console.warn('Warning: Importing from src/core/cli.ts is deprecated. Use src/application/interfaces/cli.js instead.');