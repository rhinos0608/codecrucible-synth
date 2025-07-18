// Central exports for the CodeCrucible state management system
// Following AI_INSTRUCTIONS.md patterns with consciousness-driven stable state access

import { useAppStore } from './app-store';
import { shallow } from 'zustand/shallow';

export { useAppStore, initializeStore, validateStoreIntegrity, resetStore, mockStoreState } from './app-store';
export type { AppState, VoiceState, ProjectState, UIState, AuthState, TeamState, ConsciousnessState } from './types';

// Voice selection hooks with stable selectors - following CodingPhilosophy.md patterns
export const useVoiceSelection = () => {
  return useAppStore(state => ({
    perspectives: state.voice.selectedPerspectives,
    roles: state.voice.selectedRoles,
    customVoices: state.voice.customVoices,
    recommendations: state.voice.recommendations,
    activeSession: state.voice.activeSession,
    sessionHistory: state.voice.sessionHistory,
    actions: state.voice.actions
  }), shallow);
};

// Project management hooks with consciousness stability
export const useProjectManagement = () => {
  return useAppStore(state => ({
    projects: state.project.projects,
    folders: state.project.folders,
    files: state.project.files,
    selectedProject: state.project.selectedProject,
    selectedFolder: state.project.selectedFolder,
    expandedFolders: state.project.expandedFolders,
    isCreating: state.project.isCreating,
    isDeleting: state.project.isDeleting,
    isMoving: state.project.isMoving,
    actions: state.project.actions
  }), shallow);
};

// UI state management hooks with living spiral stability
export const useUIState = () => {
  return useAppStore(state => ({
    panels: state.ui.panels,
    modals: state.ui.modals,
    sidebarCollapsed: state.ui.sidebarCollapsed,
    activeTab: state.ui.activeTab,
    theme: state.ui.theme,
    loadingStates: state.ui.loadingStates,
    errors: state.ui.errors,
    actions: state.ui.actions
  }), shallow);
};

// Authentication state hooks with consciousness awareness
export const useAuthState = () => {
  return useAppStore(state => ({
    user: state.auth.user,
    isAuthenticated: state.auth.isAuthenticated,
    isLoading: state.auth.isLoading,
    subscription: state.auth.subscription,
    sessionExpiry: state.auth.sessionExpiry,
    actions: state.auth.actions
  }), shallow);
};

// Team collaboration hooks with multi-voice consciousness
export const useTeamCollaboration = () => {
  return useAppStore(state => ({
    teams: state.team.teams,
    activeTeam: state.team.activeTeam,
    members: state.team.members,
    invitations: state.team.invitations,
    activeSessions: state.team.activeSessions,
    sharedVoices: state.team.sharedVoices,
    matrixRooms: state.team.matrixRooms,
    chatMessages: state.team.chatMessages,
    consciousnessMetrics: state.team.consciousnessMetrics,
    actions: state.team.actions
  }), shallow);
};

// Consciousness tracking hooks with Jung's depth integration
export const useConsciousnessTracking = () => {
  return useAppStore(state => ({
    level: state.consciousness.level,
    evolution: state.consciousness.evolution,
    councilSessions: state.consciousness.councilSessions,
    synthesisHistory: state.consciousness.synthesisHistory,
    patterns: state.consciousness.patterns,
    shadowIntegration: state.consciousness.shadowIntegration,
    archetypeBalance: state.consciousness.archetypeBalance,
    actions: state.consciousness.actions
  }), shallow);
};

// Selective state hooks for performance optimization
export const useVoicePerspectives = () => {
  return useAppStore(state => state.voice.selectedPerspectives);
};

export const useVoiceRoles = () => {
  return useAppStore(state => state.voice.selectedRoles);
};

export const useCurrentUser = () => {
  return useAppStore(state => state.auth.user);
};

export const useSubscriptionTier = () => {
  return useAppStore(state => state.auth.subscription.tier);
};

export const useActiveProject = () => {
  return useAppStore(state => {
    const projectId = state.project.selectedProject;
    return projectId ? state.project.projects[projectId] : null;
  }, shallow);
};

export const useConsciousnessLevel = () => {
  return useAppStore(state => state.consciousness.level);
};

export const useTheme = () => {
  return useAppStore(state => state.ui.theme);
};

export const useActivePanel = () => {
  return useAppStore(state => {
    const panels = state.ui.panels;
    return Object.entries(panels).find(([, isOpen]) => isOpen)?.[0] || null;
  }, shallow);
};

// Import the main store for components that need direct access
import { useAppStore } from './app-store';