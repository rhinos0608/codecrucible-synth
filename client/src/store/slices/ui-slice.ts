// UI state management slice
// Following AI_INSTRUCTIONS.md patterns with comprehensive interface state

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { createPersistentSlice } from '../utils/persistence';
import { storeLogger } from '../utils/logger';
import type { UIState, AppState } from '../types';

// Initial UI state
const initialUIState: Omit<UIState, 'actions'> = {
  panels: {
    projects: false,
    analytics: false,
    teams: false,
    voiceProfiles: false,
    learning: false
  },
  modals: {
    upgrade: false,
    fileSelection: false,
    confirmation: false,
    avatarCustomizer: false
  },
  sidebarCollapsed: false,
  activeTab: 'dashboard',
  theme: 'system',
  loadingStates: {},
  errors: {}
};

// UI slice creator
export const createUISlice: StateCreator<
  AppState,
  [],
  [],
  UIState
> = (set, get) => ({
  ...initialUIState,
  
  actions: {
    // Toggle panel visibility
    togglePanel: (panel: keyof UIState['panels']) => {
      set(produce((state: AppState) => {
        const wasOpen = state.ui.panels[panel];
        
        // Close all other panels first (single panel mode)
        Object.keys(state.ui.panels).forEach(p => {
          state.ui.panels[p as keyof UIState['panels']] = false;
        });
        
        // Toggle the requested panel
        state.ui.panels[panel] = !wasOpen;
        
        storeLogger.info('Panel toggled', {
          panel,
          isOpen: state.ui.panels[panel]
        });
      }));
    },

    // Open specific modal
    openModal: (modal: keyof UIState['modals']) => {
      set(produce((state: AppState) => {
        state.ui.modals[modal] = true;
        
        storeLogger.info('Modal opened', { modal });
      }));
    },

    // Close specific modal
    closeModal: (modal: keyof UIState['modals']) => {
      set(produce((state: AppState) => {
        state.ui.modals[modal] = false;
        
        storeLogger.info('Modal closed', { modal });
      }));
    },

    // Set active tab
    setActiveTab: (tab: string) => {
      set(produce((state: AppState) => {
        state.ui.activeTab = tab;
        
        storeLogger.info('Active tab changed', { tab });
      }));
    },

    // Set theme
    setTheme: (theme: UIState['theme']) => {
      set(produce((state: AppState) => {
        state.ui.theme = theme;
        
        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.add('dark');
        } else if (theme === 'light') {
          root.classList.remove('dark');
        } else {
          // System theme
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (prefersDark) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        }
        
        storeLogger.info('Theme changed', { theme });
      }));
    },

    // Set loading state for specific operations
    setLoading: (key: string, loading: boolean) => {
      set(produce((state: AppState) => {
        if (loading) {
          state.ui.loadingStates[key] = true;
        } else {
          delete state.ui.loadingStates[key];
        }
        
        storeLogger.info('Loading state changed', { key, loading });
      }));
    },

    // Set error for specific operations
    setError: (key: string, error: string | null) => {
      set(produce((state: AppState) => {
        if (error) {
          state.ui.errors[key] = error;
        } else {
          delete state.ui.errors[key];
        }
        
        storeLogger.info('Error state changed', { key, hasError: !!error });
      }));
    },

    // Clear all errors
    clearErrors: () => {
      set(produce((state: AppState) => {
        state.ui.errors = {};
        
        storeLogger.info('All errors cleared');
      }));
    }
  }
});

// UI slice with persistence for user preferences
export const useUIStore = createPersistentSlice<UIState>({
  name: 'ui-store',
  version: 1,
  partialize: (state) => ({
    sidebarCollapsed: state.sidebarCollapsed,
    theme: state.theme,
    activeTab: state.activeTab
  })
});

// UI state utilities
export const isAnyPanelOpen = (): boolean => {
  const state = get().ui;
  return Object.values(state.panels).some(isOpen => isOpen);
};

export const isAnyModalOpen = (): boolean => {
  const state = get().ui;
  return Object.values(state.modals).some(isOpen => isOpen);
};

export const getActiveLoadingOperations = (): string[] => {
  const state = get().ui;
  return Object.keys(state.loadingStates);
};

export const getActiveErrors = (): Array<{ key: string; message: string }> => {
  const state = get().ui;
  return Object.entries(state.errors).map(([key, message]) => ({ key, message }));
};

export const hasAnyErrors = (): boolean => {
  const state = get().ui;
  return Object.keys(state.errors).length > 0;
};

// Theme utilities
export const getCurrentTheme = (): 'light' | 'dark' => {
  const state = get().ui;
  
  if (state.theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  
  return state.theme as 'light' | 'dark';
};

export const initializeTheme = (): void => {
  const state = get().ui;
  state.actions.setTheme(state.theme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (state.theme === 'system') {
      state.actions.setTheme('system'); // Trigger theme application
    }
  });
};

// Panel management utilities
export const closeAllPanels = (): void => {
  const state = get().ui;
  Object.keys(state.panels).forEach(panel => {
    if (state.panels[panel as keyof UIState['panels']]) {
      state.actions.togglePanel(panel as keyof UIState['panels']);
    }
  });
};

export const closeAllModals = (): void => {
  const state = get().ui;
  Object.keys(state.modals).forEach(modal => {
    if (state.modals[modal as keyof UIState['modals']]) {
      state.actions.closeModal(modal as keyof UIState['modals']);
    }
  });
};