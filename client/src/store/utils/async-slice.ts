// Async state management utilities
// Following AI_INSTRUCTIONS.md patterns with comprehensive async handling

import { produce } from 'immer';
import { storeLogger } from './logger';
import type { AsyncState } from '../types';

// Create async slice helper
export const createAsyncSlice = <T, P = any>(
  name: string,
  asyncAction: (params: P) => Promise<T>
) => {
  return {
    // Initial async state
    state: {
      data: null,
      loading: false,
      error: null,
      lastFetch: null
    } as AsyncState<T>,
    
    // Async action wrapper
    execute: async (params: P, setState: (updater: (state: any) => void) => void): Promise<T | null> => {
      setState(produce((state: any) => {
        state[name].loading = true;
        state[name].error = null;
      }));
      
      try {
        storeLogger.info(`${name} async action started`, { params });
        
        const result = await asyncAction(params);
        
        setState(produce((state: any) => {
          state[name].data = result;
          state[name].loading = false;
          state[name].lastFetch = new Date();
        }));
        
        storeLogger.info(`${name} async action completed`, { 
          dataType: typeof result,
          timestamp: new Date().toISOString()
        });
        
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        setState(produce((state: any) => {
          state[name].loading = false;
          state[name].error = errorMessage;
        }));
        
        storeLogger.error(`${name} async action failed`, error as Error, { params });
        
        return null;
      }
    },
    
    // Reset async state
    reset: (setState: (updater: (state: any) => void) => void): void => {
      setState(produce((state: any) => {
        state[name] = {
          data: null,
          loading: false,
          error: null,
          lastFetch: null
        };
      }));
      
      storeLogger.info(`${name} async state reset`);
    }
  };
};

// Async state utilities
export const isStale = <T>(asyncState: AsyncState<T>, maxAge: number = 5 * 60 * 1000): boolean => {
  if (!asyncState.lastFetch) return true;
  
  const now = new Date().getTime();
  const lastFetch = new Date(asyncState.lastFetch).getTime();
  
  return now - lastFetch > maxAge;
};

export const shouldRefetch = <T>(asyncState: AsyncState<T>): boolean => {
  return !asyncState.loading && (asyncState.error !== null || isStale(asyncState));
};

export const getAsyncStateStatus = <T>(asyncState: AsyncState<T>): 'idle' | 'loading' | 'success' | 'error' => {
  if (asyncState.loading) return 'loading';
  if (asyncState.error) return 'error';
  if (asyncState.data !== null) return 'success';
  return 'idle';
};