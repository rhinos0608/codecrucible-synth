/**
 * Core Streaming Manager - Replaced with Infrastructure Implementation
 * 
 * @deprecated Use StreamingManager from infrastructure/streaming instead
 * This provides backward compatibility during architectural migration.
 */

// Re-export the more advanced infrastructure implementation
export * from '../../infrastructure/streaming/streaming-manager.js';

// For backward compatibility, also export with the old interface name
export type { StreamingManagerInterface } from '../../infrastructure/streaming/streaming-manager.js';