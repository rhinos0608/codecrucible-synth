/**
 * Central constants for voice system to ensure consistency and prevent typos
 */

// Voice IDs - canonical identifiers for all voice archetypes
export const VOICE_IDS = {
  EXPLORER: 'explorer',
  MAINTAINER: 'maintainer',
  ANALYZER: 'analyzer',
  DEVELOPER: 'developer',
  IMPLEMENTOR: 'implementor',
  SECURITY: 'security',
  ARCHITECT: 'architect',
  DESIGNER: 'designer',
  OPTIMIZER: 'optimizer',
  GUARDIAN: 'guardian',
} as const;

// Voice names - human-readable display names
export const VOICE_NAMES = {
  [VOICE_IDS.EXPLORER]: 'Explorer',
  [VOICE_IDS.MAINTAINER]: 'Maintainer',
  [VOICE_IDS.ANALYZER]: 'Analyzer',
  [VOICE_IDS.DEVELOPER]: 'Developer',
  [VOICE_IDS.IMPLEMENTOR]: 'Implementor',
  [VOICE_IDS.SECURITY]: 'Security',
  [VOICE_IDS.ARCHITECT]: 'Architect',
  [VOICE_IDS.DESIGNER]: 'Designer',
  [VOICE_IDS.OPTIMIZER]: 'Optimizer',
  [VOICE_IDS.GUARDIAN]: 'Guardian',
} as const;

// Voice styles - behavioral characteristics
export const VOICE_STYLES = {
  [VOICE_IDS.EXPLORER]: 'experimental',
  [VOICE_IDS.MAINTAINER]: 'conservative',
  [VOICE_IDS.ANALYZER]: 'analytical',
  [VOICE_IDS.DEVELOPER]: 'pragmatic',
  [VOICE_IDS.IMPLEMENTOR]: 'action-oriented',
  [VOICE_IDS.SECURITY]: 'defensive',
  [VOICE_IDS.ARCHITECT]: 'strategic',
  [VOICE_IDS.DESIGNER]: 'user-centered',
  [VOICE_IDS.OPTIMIZER]: 'performance-focused',
  [VOICE_IDS.GUARDIAN]: 'protective',
} as const;

// Voice temperature settings - creativity levels
export const VOICE_TEMPERATURES = {
  [VOICE_IDS.EXPLORER]: 0.7,
  [VOICE_IDS.MAINTAINER]: 0.5,
  [VOICE_IDS.ANALYZER]: 0.4,
  [VOICE_IDS.DEVELOPER]: 0.5,
  [VOICE_IDS.IMPLEMENTOR]: 0.4,
  [VOICE_IDS.SECURITY]: 0.3,
  [VOICE_IDS.ARCHITECT]: 0.3,
  [VOICE_IDS.DESIGNER]: 0.6,
  [VOICE_IDS.OPTIMIZER]: 0.3,
  [VOICE_IDS.GUARDIAN]: 0.2,
} as const;

// Common voice groupings for different task types
export const VOICE_GROUPS = {
  // Default voices for general tasks
  DEFAULT: [VOICE_IDS.DEVELOPER, VOICE_IDS.ANALYZER, VOICE_IDS.ARCHITECT],

  // Analysis and investigation tasks
  ANALYSIS: [VOICE_IDS.ANALYZER, VOICE_IDS.ARCHITECT],

  // Implementation and development tasks
  IMPLEMENTATION: [VOICE_IDS.DEVELOPER, VOICE_IDS.IMPLEMENTOR],

  // Security-focused tasks
  SECURITY: [VOICE_IDS.SECURITY],

  // High complexity architectural tasks
  ARCHITECTURE: [VOICE_IDS.ARCHITECT, VOICE_IDS.ANALYZER],

  // Creative and innovative tasks
  INNOVATION: [VOICE_IDS.EXPLORER, VOICE_IDS.DESIGNER],

  // Quality and maintenance tasks
  QUALITY: [VOICE_IDS.GUARDIAN, VOICE_IDS.MAINTAINER],

  // Performance optimization tasks
  OPTIMIZATION: [VOICE_IDS.OPTIMIZER, VOICE_IDS.ANALYZER],

  // All available voices
  ALL: [
    VOICE_IDS.EXPLORER,
    VOICE_IDS.MAINTAINER,
    VOICE_IDS.ANALYZER,
    VOICE_IDS.DEVELOPER,
    VOICE_IDS.IMPLEMENTOR,
    VOICE_IDS.SECURITY,
    VOICE_IDS.ARCHITECT,
    VOICE_IDS.DESIGNER,
    VOICE_IDS.OPTIMIZER,
    VOICE_IDS.GUARDIAN,
  ],
} as const;

// Type definitions for type safety
export type VoiceId = (typeof VOICE_IDS)[keyof typeof VOICE_IDS];
export type VoiceName = (typeof VOICE_NAMES)[VoiceId];
export type VoiceStyle = (typeof VOICE_STYLES)[VoiceId];
export type VoiceGroup = keyof typeof VOICE_GROUPS;

// Validation helper
export function isValidVoiceId(id: string): id is VoiceId {
  return Object.values(VOICE_IDS).includes(id as VoiceId);
}

// Group helper
export function getVoiceGroup(groupName: VoiceGroup): readonly VoiceId[] {
  return VOICE_GROUPS[groupName];
}
