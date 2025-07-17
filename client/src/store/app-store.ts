// Main Zustand store combining all slices
// Following AI_INSTRUCTIONS.md patterns with consciousness-driven state management

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createVoiceSlice } from './slices/voice-slice';
import { createProjectSlice } from './slices/project-slice';
import { createUISlice } from './slices/ui-slice';
import { createAuthSlice } from './slices/auth-slice';
import { createTeamSlice } from './slices/team-slice';
import { createConsciousnessSlice } from './slices/consciousness-slice';
import { storeLogger } from './utils/logger';
import { validateStorageHealth } from './utils/persistence';
import type { AppState } from './types';

// Create the main store combining all slices
export const useAppStore = create<AppState>()(
  devtools(
    (set, get, api) => ({
      voice: createVoiceSlice(set, get, api),
      project: createProjectSlice(set, get, api),
      ui: createUISlice(set, get, api),
      auth: createAuthSlice(set, get, api),
      team: createTeamSlice(set, get, api),
      consciousness: createConsciousnessSlice(set, get, api)
    }),
    {
      name: 'codecrucible-store',
      enabled: import.meta.env.DEV
    }
  )
);

// Store initialization with health checks
export const initializeStore = async (): Promise<void> => {
  try {
    // Validate storage health
    const isStorageHealthy = validateStorageHealth();
    if (!isStorageHealthy) {
      storeLogger.error('Storage health check failed', new Error('LocalStorage not available'));
    }
    
    // Initialize theme on startup
    const uiState = useAppStore.getState().ui;
    uiState.actions.setTheme(uiState.theme);
    
    storeLogger.info('Store initialized successfully', {
      storageHealthy: isStorageHealthy,
      isDev: import.meta.env.DEV
    });
  } catch (error) {
    storeLogger.error('Store initialization failed', error as Error);
    throw error;
  }
};

// Store health monitoring
export const validateStoreIntegrity = (): boolean => {
  try {
    const state = useAppStore.getState();
    
    const checks = [
      typeof state.voice === 'object' && state.voice !== null,
      typeof state.project === 'object' && state.project !== null,
      typeof state.ui === 'object' && state.ui !== null,
      typeof state.auth === 'object' && state.auth !== null,
      typeof state.team === 'object' && state.team !== null,
      typeof state.consciousness === 'object' && state.consciousness !== null,
      typeof state.voice.actions === 'object',
      typeof state.project.actions === 'object',
      typeof state.ui.actions === 'object',
      typeof state.auth.actions === 'object',
      typeof state.team.actions === 'object',
      typeof state.consciousness.actions === 'object'
    ];
    
    const isValid = checks.every(check => check);
    
    storeLogger.info('Store integrity check', {
      isValid,
      failedChecks: checks.filter(check => !check).length
    });
    
    return isValid;
  } catch (error) {
    storeLogger.error('Store integrity validation failed', error as Error);
    return false;
  }
};

// Reset store for testing
export const resetStore = (): void => {
  useAppStore.setState({
    voice: createVoiceSlice(useAppStore.setState, useAppStore.getState, {} as any),
    project: createProjectSlice(useAppStore.setState, useAppStore.getState, {} as any),
    ui: createUISlice(useAppStore.setState, useAppStore.getState, {} as any),
    auth: createAuthSlice(useAppStore.setState, useAppStore.getState, {} as any),
    team: createTeamSlice(useAppStore.setState, useAppStore.getState, {} as any),
    consciousness: createConsciousnessSlice(useAppStore.setState, useAppStore.getState, {} as any)
  });
  
  storeLogger.info('Store reset completed');
};

// Mock store state for testing
export const mockStoreState = (overrides: Partial<AppState>): void => {
  const currentState = useAppStore.getState();
  useAppStore.setState({
    ...currentState,
    ...overrides
  });
  
  storeLogger.info('Store state mocked', {
    overrideKeys: Object.keys(overrides)
  });
};