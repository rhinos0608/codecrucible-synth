// Main application store combining all slices
// Following AI_INSTRUCTIONS.md patterns with comprehensive error handling

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { createVoiceSlice } from './slices/voice-slice';
import { createProjectSlice } from './slices/project-slice';
import { createTeamSlice } from './slices/team-slice';
import { createUISlice } from './slices/ui-slice';
import { createAuthSlice } from './slices/auth-slice';
import { createConsciousnessSlice } from './slices/consciousness-slice';
import { storeLogger } from './utils/logger';
import type { AppState } from './types';

// Store configuration following CodingPhilosophy.md consciousness principles
const STORE_CONFIG = {
  devtools: process.env.NODE_ENV === 'development',
  persist: true,
  logger: process.env.NODE_ENV === 'development',
  errorBoundary: true
} as const;

// Main application store with combined slices
export const useAppStore = create<AppState>()(
  devtools(
    (set, get, api) => ({
      // Voice selection and AI consciousness
      voice: createVoiceSlice(set, get, api),
      
      // Project and file management
      project: createProjectSlice(set, get, api),
      
      // Team collaboration and Matrix integration
      team: createTeamSlice(set, get, api),
      
      // UI state and modal management
      ui: createUISlice(set, get, api),
      
      // Authentication and subscription
      auth: createAuthSlice(set, get, api),
      
      // Consciousness evolution tracking
      consciousness: createConsciousnessSlice(set, get, api)
    }),
    {
      name: 'codecrucible-store',
      enabled: STORE_CONFIG.devtools
    }
  )
);

// Store initialization with error boundary
export const initializeStore = async (): Promise<void> => {
  try {
    // Initialize authentication state
    const authState = useAppStore.getState().auth;
    if (authState.actions.refreshSession) {
      await authState.actions.refreshSession();
    }
    
    // Load persisted voice preferences
    const voiceState = useAppStore.getState().voice;
    if (voiceState.actions && voiceState.selectedPerspectives.length === 0) {
      // Set default voice selection if none exists
      voiceState.actions.selectPerspectives(['Explorer']);
      voiceState.actions.selectRoles(['Architect']);
    }
    
    // Initialize consciousness tracking
    const consciousnessState = useAppStore.getState().consciousness;
    if (consciousnessState.level === 0) {
      consciousnessState.actions.updateLevel(5.0); // Initial consciousness level
    }
    
    storeLogger.info('Application store initialized successfully', {
      hasAuth: !!authState.user,
      voiceSelection: voiceState.selectedPerspectives.length,
      consciousnessLevel: consciousnessState.level
    });
  } catch (error) {
    storeLogger.error('Store initialization failed', error as Error);
    throw error;
  }
};

// Store state selectors for performance optimization
export const useVoiceSelection = () => useAppStore(state => ({
  perspectives: state.voice.selectedPerspectives,
  roles: state.voice.selectedRoles,
  recommendations: state.voice.recommendations,
  actions: state.voice.actions
}));

export const useProjectManagement = () => useAppStore(state => ({
  projects: Object.values(state.project.projects),
  folders: Object.values(state.project.folders),
  selectedProject: state.project.selectedProject,
  actions: state.project.actions
}));

export const useTeamCollaboration = () => useAppStore(state => ({
  teams: Object.values(state.team.teams),
  activeTeam: state.team.activeTeam,
  activeSessions: state.team.activeSessions,
  matrixMessages: state.team.chatMessages,
  actions: state.team.actions
}));

export const useUIState = () => useAppStore(state => ({
  panels: state.ui.panels,
  modals: state.ui.modals,
  theme: state.ui.theme,
  actions: state.ui.actions
}));

export const useAuthState = () => useAppStore(state => ({
  user: state.auth.user,
  isAuthenticated: state.auth.isAuthenticated,
  subscription: state.auth.subscription,
  actions: state.auth.actions
}));

export const useConsciousnessTracking = () => useAppStore(state => ({
  level: state.consciousness.level,
  evolution: state.consciousness.evolution,
  patterns: state.consciousness.patterns,
  shadowIntegration: state.consciousness.shadowIntegration,
  actions: state.consciousness.actions
}));

// Store debugging utilities
export const getStoreSnapshot = (): AppState => useAppStore.getState();

export const resetStore = (): void => {
  useAppStore.setState({
    voice: createVoiceSlice(() => {}, () => useAppStore.getState(), {} as any),
    project: createProjectSlice(() => {}, () => useAppStore.getState(), {} as any),
    team: createTeamSlice(() => {}, () => useAppStore.getState(), {} as any),
    ui: createUISlice(() => {}, () => useAppStore.getState(), {} as any),
    auth: createAuthSlice(() => {}, () => useAppStore.getState(), {} as any),
    consciousness: createConsciousnessSlice(() => {}, () => useAppStore.getState(), {} as any)
  });
};

// Store health monitoring
export const validateStoreIntegrity = (): boolean => {
  try {
    const state = useAppStore.getState();
    
    // Validate required state properties
    const checks = [
      typeof state.voice === 'object',
      typeof state.project === 'object',
      typeof state.team === 'object',
      typeof state.ui === 'object',
      typeof state.auth === 'object',
      typeof state.consciousness === 'object'
    ];
    
    const isValid = checks.every(check => check);
    
    storeLogger.info('Store integrity validation', {
      isValid,
      timestamp: new Date().toISOString()
    });
    
    return isValid;
  } catch (error) {
    storeLogger.error('Store integrity validation failed', error as Error);
    return false;
  }
};