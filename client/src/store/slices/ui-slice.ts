// UI state management slice
// Following AI_INSTRUCTIONS.md patterns with responsive design support

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { UIState, AppState } from '../types';

// Initial state
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
  theme: 'dark',
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
    togglePanel: (panel: keyof UIState['panels']) => {
      set(produce((state: AppState) => {
        state.ui.panels[panel] = !state.ui.panels[panel];
        
        // Close other panels when opening one (mobile-first approach)
        if (state.ui.panels[panel]) {
          Object.keys(state.ui.panels).forEach(key => {
            if (key !== panel) {
              state.ui.panels[key as keyof UIState['panels']] = false;
            }
          });
        }
        
        storeLogger.info('Panel toggled', { panel, isOpen: state.ui.panels[panel] });
      }));
    },
    
    openModal: (modal: keyof UIState['modals']) => {
      set(produce((state: AppState) => {
        state.ui.modals[modal] = true;
        storeLogger.info('Modal opened', { modal });
      }));
    },
    
    closeModal: (modal: keyof UIState['modals']) => {
      set(produce((state: AppState) => {
        state.ui.modals[modal] = false;
        storeLogger.info('Modal closed', { modal });
      }));
    },
    
    setActiveTab: (tab: string) => {
      set(produce((state: AppState) => {
        state.ui.activeTab = tab;
        storeLogger.info('Active tab changed', { tab });
      }));
    },
    
    setTheme: (theme: UIState['theme']) => {
      set(produce((state: AppState) => {
        state.ui.theme = theme;
        
        // Apply theme to document
        if (typeof document !== 'undefined') {
          const root = document.documentElement;
          root.classList.remove('light', 'dark');
          
          if (theme === 'system') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            root.classList.add(prefersDark ? 'dark' : 'light');
          } else {
            root.classList.add(theme);
          }
        }
        
        storeLogger.info('Theme changed', { theme });
      }));
    },
    
    setLoading: (key: string, loading: boolean) => {
      set(produce((state: AppState) => {
        if (loading) {
          state.ui.loadingStates[key] = true;
        } else {
          delete state.ui.loadingStates[key];
        }
      }));
    },
    
    setError: (key: string, error: string | null) => {
      set(produce((state: AppState) => {
        if (error) {
          state.ui.errors[key] = error;
        } else {
          delete state.ui.errors[key];
        }
      }));
    },
    
    clearErrors: () => {
      set(produce((state: AppState) => {
        state.ui.errors = {};
        storeLogger.info('All errors cleared');
      }));
    }
  }
});