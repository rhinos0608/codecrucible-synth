// Authentication and user management slice
// Following AI_INSTRUCTIONS.md patterns with secure state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { AuthState, AppState, User } from '../types';

// Initial state
const initialAuthState: Omit<AuthState, 'actions'> = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  subscription: {
    tier: 'free',
    status: 'active',
    quotaUsed: 0,
    quotaLimit: 3
  },
  sessionExpiry: null,
  refreshToken: null
};

// Auth slice creator
export const createAuthSlice: StateCreator<
  AppState,
  [],
  [],
  AuthState
> = (set, get) => ({
  ...initialAuthState,
  
  actions: {
    setUser: (user: User | null) => {
      set(produce((state: AppState) => {
        state.auth.user = user;
        state.auth.isAuthenticated = !!user;
        
        storeLogger.info('User state updated', { 
          userId: user?.id, 
          isAuthenticated: !!user 
        });
      }));
    },
    
    setAuthenticated: (authenticated: boolean) => {
      set(produce((state: AppState) => {
        state.auth.isAuthenticated = authenticated;
        
        if (!authenticated) {
          state.auth.user = null;
          state.auth.sessionExpiry = null;
          state.auth.refreshToken = null;
        }
        
        storeLogger.info('Authentication status changed', { authenticated });
      }));
    },
    
    updateSubscription: (subscription: Partial<AuthState['subscription']>) => {
      set(produce((state: AppState) => {
        Object.assign(state.auth.subscription, subscription);
        
        storeLogger.info('Subscription updated', { subscription });
      }));
    },
    
    logout: () => {
      set(produce((state: AppState) => {
        state.auth.user = null;
        state.auth.isAuthenticated = false;
        state.auth.sessionExpiry = null;
        state.auth.refreshToken = null;
        
        // Reset other state slices on logout
        state.voice.selectedPerspectives = [];
        state.voice.selectedRoles = [];
        state.project.selectedProject = null;
        
        storeLogger.info('User logged out - state reset');
      }));
    },
    
    refreshSession: async () => {
      // TODO: Implement session refresh logic
      storeLogger.info('Session refresh requested');
    }
  }
});