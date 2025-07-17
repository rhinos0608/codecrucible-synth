// Storage persistence utilities for Zustand
// Following AI_INSTRUCTIONS.md patterns with localStorage integration

import { persist, PersistOptions } from 'zustand/middleware';
import { storeLogger } from './logger';
import type { PersistConfig } from '../types';

// Default persistence configuration
const DEFAULT_PERSIST_CONFIG = {
  version: 1,
  migrate: (persistedState: any, version: number) => {
    storeLogger.info('Store migration triggered', { version, persistedState: !!persistedState });
    return persistedState;
  },
  onRehydrateStorage: (name: string) => {
    return (state: any, error: any) => {
      if (error) {
        storeLogger.error('Store rehydration failed', error, { storeName: name });
      } else {
        storeLogger.info('Store rehydrated successfully', { storeName: name });
      }
    };
  }
} as const;

// Create persistent slice with custom configuration
export const createPersistentSlice = <T>(config: PersistConfig) => {
  const persistOptions: PersistOptions<T> = {
    name: config.name,
    version: config.version || 1,
    partialize: config.partialize,
    merge: config.merge,
    ...DEFAULT_PERSIST_CONFIG,
    onRehydrateStorage: DEFAULT_PERSIST_CONFIG.onRehydrateStorage(config.name)
  };

  return persist<T>(
    (set, get, api) => ({} as T),
    persistOptions
  );
};

// Storage utilities
export const clearPersistedStore = (storeName: string): void => {
  try {
    localStorage.removeItem(storeName);
    storeLogger.info('Persisted store cleared', { storeName });
  } catch (error) {
    storeLogger.error('Failed to clear persisted store', error as Error, { storeName });
  }
};

export const getPersistedStoreVersion = (storeName: string): number | null => {
  try {
    const stored = localStorage.getItem(storeName);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    return parsed.version || null;
  } catch (error) {
    storeLogger.error('Failed to get persisted store version', error as Error, { storeName });
    return null;
  }
};

export const migratePersistedStore = (storeName: string, fromVersion: number, toVersion: number): boolean => {
  try {
    const stored = localStorage.getItem(storeName);
    if (!stored) return false;
    
    const parsed = JSON.parse(stored);
    
    // Apply version-specific migrations
    let migrated = parsed;
    
    // Example migration logic
    if (fromVersion < 2 && toVersion >= 2) {
      // Migration from v1 to v2
      migrated = {
        ...migrated,
        version: 2,
        // Add migration logic here
      };
    }
    
    localStorage.setItem(storeName, JSON.stringify(migrated));
    
    storeLogger.info('Store migration completed', {
      storeName,
      fromVersion,
      toVersion
    });
    
    return true;
  } catch (error) {
    storeLogger.error('Store migration failed', error as Error, {
      storeName,
      fromVersion,
      toVersion
    });
    return false;
  }
};

// Storage health check
export const validateStorageHealth = (): boolean => {
  try {
    const testKey = '__storage_test__';
    const testValue = 'test';
    
    localStorage.setItem(testKey, testValue);
    const retrieved = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    
    const isHealthy = retrieved === testValue;
    
    storeLogger.info('Storage health check', { isHealthy });
    
    return isHealthy;
  } catch (error) {
    storeLogger.error('Storage health check failed', error as Error);
    return false;
  }
};