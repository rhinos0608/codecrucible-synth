// Authentication and subscription state slice
// Following AI_INSTRUCTIONS.md patterns with secure auth state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { createPersistentSlice } from '../utils/persistence';
import { storeLogger } from '../utils/logger';
import type { AuthState, AppState, User } from '../types';

// Initial auth state
const initialAuthState: Omit<AuthState, 'actions'> = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  subscription: {
    tier: 'free',
    status: 'inactive',
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
    // Set user data
    setUser: (user: User | null) => {
      set(produce((state: AppState) => {
        state.auth.user = user;
        state.auth.isAuthenticated = !!user;
        
        storeLogger.info('User state updated', {
          hasUser: !!user,
          userId: user?.id,
          email: user?.email
        });
        
        // Reset other state when user changes
        if (!user) {
          state.voice.actions.clearSelection();
          state.project.selectedProject = null;
          state.team.activeTeam = null;
          state.consciousness.level = 0;
        }
      }));
    },

    // Set authentication status
    setAuthenticated: (authenticated: boolean) => {
      set(produce((state: AppState) => {
        state.auth.isAuthenticated = authenticated;
        state.auth.isLoading = false;
        
        if (!authenticated) {
          state.auth.user = null;
          state.auth.sessionExpiry = null;
          state.auth.refreshToken = null;
        }
        
        storeLogger.info('Authentication status changed', { authenticated });
      }));
    },

    // Update subscription information
    updateSubscription: (subscription: Partial<AuthState['subscription']>) => {
      set(produce((state: AppState) => {
        state.auth.subscription = {
          ...state.auth.subscription,
          ...subscription
        };
        
        storeLogger.info('Subscription updated', {
          tier: state.auth.subscription.tier,
          status: state.auth.subscription.status,
          quotaUsed: state.auth.subscription.quotaUsed,
          quotaLimit: state.auth.subscription.quotaLimit
        });
      }));
    },

    // Logout user
    logout: () => {
      set(produce((state: AppState) => {
        state.auth = {
          ...initialAuthState,
          actions: state.auth.actions
        };
        
        // Clear other user-specific state
        state.voice.actions.clearSelection();
        state.project.selectedProject = null;
        state.team.activeTeam = null;
        state.consciousness.level = 0;
        
        storeLogger.info('User logged out');
      }));
    },

    // Refresh session
    refreshSession: async () => {
      set(produce((state: AppState) => {
        state.auth.isLoading = true;
      }));
      
      try {
        // This would integrate with your auth API
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          
          set(produce((state: AppState) => {
            state.auth.isLoading = false;
            state.auth.sessionExpiry = new Date(data.expiresAt);
            state.auth.refreshToken = data.refreshToken;
          }));
          
          storeLogger.info('Session refreshed successfully');
        } else {
          throw new Error('Session refresh failed');
        }
      } catch (error) {
        set(produce((state: AppState) => {
          state.auth.isLoading = false;
          state.auth.isAuthenticated = false;
          state.auth.user = null;
        }));
        
        storeLogger.error('Session refresh failed', error as Error);
      }
    }
  }
});

// Auth slice with selective persistence
export const useAuthStore = createPersistentSlice<AuthState>({
  name: 'auth-store',
  version: 1,
  partialize: (state) => ({
    // Only persist user preferences, not sensitive auth data
    user: state.user ? {
      id: state.user.id,
      email: state.user.email,
      name: state.user.name,
      preferences: state.user.preferences
    } : null,
    subscription: {
      tier: state.subscription.tier,
      status: state.subscription.status
    }
  })
});

// Auth utilities
export const hasValidSubscription = (): boolean => {
  const state = get().auth;
  return state.subscription.status === 'active' && 
         ['pro', 'team', 'enterprise'].includes(state.subscription.tier);
};

export const getRemainingQuota = (): number => {
  const state = get().auth;
  if (state.subscription.quotaLimit === -1) return Infinity; // Unlimited
  return Math.max(0, state.subscription.quotaLimit - state.subscription.quotaUsed);
};

export const canPerformAction = (requiredTier: string): boolean => {
  const state = get().auth;
  
  const tierHierarchy = {
    'free': 0,
    'pro': 1,
    'team': 2,
    'enterprise': 3
  };
  
  const userTierLevel = tierHierarchy[state.subscription.tier as keyof typeof tierHierarchy] || 0;
  const requiredTierLevel = tierHierarchy[requiredTier as keyof typeof tierHierarchy] || 0;
  
  return userTierLevel >= requiredTierLevel;
};

export const isSessionExpiring = (): boolean => {
  const state = get().auth;
  if (!state.sessionExpiry) return false;
  
  const now = new Date().getTime();
  const expiry = new Date(state.sessionExpiry).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  return expiry - now < fiveMinutes;
};