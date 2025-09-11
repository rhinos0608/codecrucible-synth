/**
 * Voice Repository Interface
 * Domain layer contract for voice persistence
 *
 * Living Spiral Council Applied:
 * - Pure domain interface with no implementation details
 * - Repository pattern for decoupled data access
 * - Business-focused method signatures
 */

import { Voice } from '../entities/voice.js';

/**
 * Voice Repository Interface
 * Defines the contract for voice persistence without implementation details
 */
export interface IVoiceRepository {
  /**
   * Find a voice by its unique identifier
   */
  findById: (id: string) => Promise<Voice | null>;

  /**
   * Find all voices
   */
  findAll: () => Promise<Voice[]>;

  /**
   * Find voices by their expertise areas
   */
  findByExpertise: (expertise: readonly string[]) => Promise<Voice[]>;

  /**
   * Find enabled voices only
   */
  findEnabledVoices: () => Promise<Voice[]>;

  /**
   * Find voices suitable for a specific task type
   */
  findSuitableVoices: (taskType: 'creative' | 'analytical' | 'balanced') => Promise<Voice[]>;

  /**
   * Save a voice (create or update)
   */
  save: (voice: Readonly<Voice>) => Promise<void>;

  /**
   * Save multiple voices in a transaction
   */
  saveAll: (voices: readonly Readonly<Voice>[]) => Promise<void>;

  /**
   * Delete a voice by ID
   */
  deleteById: (id: string) => Promise<void>;

  /**
   * Check if a voice exists
   */
  exists: (id: string) => Promise<boolean>;

  /**
   * Get count of total voices
   */
  count: () => Promise<number>;

  /**
   * Get count of enabled voices
   */
  countEnabled: () => Promise<number>;
}

/**
 * Voice Query Interface
 * For complex voice queries with filtering and sorting
 */
export interface VoiceQuery {
  expertise?: string[];
  temperatureRange?: {
    min: number;
    max: number;
  };
  style?: string[];
  enabled?: boolean;
  sortBy?: 'name' | 'temperature' | 'expertise';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Extended Voice Repository Interface
 * For advanced querying capabilities
 */
export interface IAdvancedVoiceRepository extends IVoiceRepository {
  /**
   * Find voices using complex query criteria
   */
  findByQuery: (query: Readonly<VoiceQuery>) => Promise<Voice[]>;

  /**
   * Find the most suitable voice for a given context
   */
  findBestMatch: (
    context: Readonly<{
      taskType: 'creative' | 'analytical' | 'balanced';
      requiredExpertise?: readonly string[];
      excludedVoices?: readonly string[];
      preferredStyle?: string;
    }>
  ) => Promise<Voice | null>;

  /**
   * Get voice usage statistics
   */
  getUsageStatistics: () => Promise<VoiceUsageStats[]>;

  /**
   * Bulk enable/disable voices
   */
  bulkUpdateEnabled: (voiceIds: readonly string[], enabled: boolean) => Promise<void>;
}

/**
 * Voice Usage Statistics
 */
export interface VoiceUsageStats {
  voiceId: string;
  voiceName: string;
  usageCount: number;
  successRate: number;
  averageRating: number;
  lastUsed: Date;
}

/**
 * Voice Repository Events
 * Domain events that can be published by repository implementations
 */
export interface VoiceRepositoryEvents {
  voiceCreated: { voice: Voice };
  voiceUpdated: { voice: Voice; previousVersion?: Voice };
  voiceDeleted: { voiceId: string };
  voiceEnabled: { voiceId: string };
  voiceDisabled: { voiceId: string };
}
