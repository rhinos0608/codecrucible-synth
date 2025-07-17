// Store persistence utilities
// Following AI_INSTRUCTIONS.md patterns with browser storage management

import type { PersistConfig } from '../types';

// Check if localStorage is available and working
export const validateStorageHealth = (): boolean => {
  try {
    const testKey = '__storage_test__';
    const testValue = 'test';
    
    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    return retrieved === testValue;
  } catch {
    return false;
  }
};

// Safe localStorage operations with error handling
export const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  }
};

// Create persistent slice with selective storage
export const createPersistentSlice = <T>(
  config: PersistConfig & { initialState: T }
): { getPersistedState: () => T; persistState: (state: T) => void } => {
  const storageKey = `codecrucible_${config.name}`;
  
  const getPersistedState = (): T => {
    try {
      const stored = safeLocalStorage.getItem(storageKey);
      if (!stored) return config.initialState;
      
      const parsed = JSON.parse(stored);
      
      // Version check
      if (config.version && parsed.version !== config.version) {
        return config.initialState;
      }
      
      // Merge with current state if merge function provided
      if (config.merge) {
        return config.merge(parsed.state, config.initialState);
      }
      
      return parsed.state || config.initialState;
    } catch {
      return config.initialState;
    }
  };
  
  const persistState = (state: T): void => {
    try {
      const toStore = config.partialize ? config.partialize(state) : state;
      
      const persistData = {
        state: toStore,
        version: config.version || 1,
        timestamp: Date.now()
      };
      
      safeLocalStorage.setItem(storageKey, JSON.stringify(persistData));
    } catch (error) {
      console.warn(`Failed to persist ${config.name}:`, error);
    }
  };
  
  return { getPersistedState, persistState };
};