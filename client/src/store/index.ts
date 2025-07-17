// Central store index - Export all store slices and types
// Following AI_INSTRUCTIONS.md patterns with comprehensive type safety

export { useAppStore } from './app-store';
export { useVoiceStore } from './slices/voice-slice';
export { useProjectStore } from './slices/project-slice';
export { useTeamStore } from './slices/team-slice';
export { useUIStore } from './slices/ui-slice';
export { useAuthStore } from './slices/auth-slice';
export { useConsciousnessStore } from './slices/consciousness-slice';

// Export all state types
export type {
  AppState,
  VoiceState,
  ProjectState,
  TeamState,
  UIState,
  AuthState,
  ConsciousnessState
} from './types';

// Export store utilities
export { createPersistentSlice } from './utils/persistence';
export { createAsyncSlice } from './utils/async-slice';
export { storeLogger } from './utils/logger';

// Store documentation for future maintainers
export const STORE_DOCUMENTATION = {
  architecture: 'Modular Zustand store with TypeScript interfaces',
  persistence: 'Selective localStorage persistence for user preferences',
  patterns: 'Immutable updates with Immer integration',
  testing: 'Each slice includes test utilities and mock data',
  debugging: 'Redux DevTools integration for state inspection'
} as const;