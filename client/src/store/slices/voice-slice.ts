// Voice selection and AI consciousness slice
// Following AI_INSTRUCTIONS.md patterns with comprehensive state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { createPersistentSlice } from '../utils/persistence';
import { storeLogger } from '../utils/logger';
import type { VoiceState, AppState, VoiceSession, VoiceRecommendation, CustomVoice } from '../types';

// Initial state following CodingPhilosophy.md consciousness principles
const initialVoiceState: Omit<VoiceState, 'actions'> = {
  selectedPerspectives: [],
  selectedRoles: [],
  customVoices: [],
  recommendations: [],
  analysisContext: '',
  activeSession: null,
  sessionHistory: []
};

// Create stable action references to prevent infinite loops - following AI_INSTRUCTIONS.md patterns
const createVoiceActions = (set: any, get: any) => {
  // Cache actions to prevent re-creation on every render
  const actions = {
  // Set selected voice perspectives with validation
  selectPerspectives: (perspectives: string[]) => {
    set(produce((state: AppState) => {
      // Validate perspectives against available options
      const validPerspectives = perspectives.filter(p => 
        ['seeker', 'steward', 'witness', 'nurturer', 'decider'].includes(p)
      );
      
      state.voice.selectedPerspectives = validPerspectives;
      
      storeLogger.info('Voice perspectives selected', {
        perspectives: validPerspectives,
        count: validPerspectives.length
      });
      
      // Trigger consciousness evolution if significant change
      if (validPerspectives.length >= 3) {
        // TODO: Add consciousness tracking integration
        console.log('Consciousness evolution triggered');
      }
    }));
  },

  // Set selected voice roles with validation
  selectRoles: (roles: string[]) => {
    set(produce((state: AppState) => {
      const validRoles = roles.filter(r => 
        ['guardian', 'architect', 'designer', 'optimizer'].includes(r)
      );
      
      state.voice.selectedRoles = validRoles;
      
      storeLogger.info('Voice roles selected', {
        roles: validRoles,
        count: validRoles.length
      });
    }));
  },

  // Add custom voice with validation
  addCustomVoice: (voice: CustomVoice) => {
    set(produce((state: AppState) => {
      // Validate custom voice data
      if (!voice.name || !voice.description) {
        storeLogger.error('Invalid custom voice data', voice);
        return;
      }
      
      // Check for duplicate names
      const exists = state.voice.customVoices.some(v => v.name === voice.name);
      if (exists) {
        storeLogger.warn('Custom voice with this name already exists', { name: voice.name });
        return;
      }
      
      state.voice.customVoices.push({
        ...voice,
        id: voice.id || `voice_${Date.now()}`,
        userId: state.auth.user?.id || 'anonymous'
      });
      
      storeLogger.info('Custom voice added', {
        voiceId: voice.id,
        name: voice.name,
        specialization: voice.specialization
      });
    }));
  },

  // Update recommendations with scoring
  updateRecommendations: (recommendations: VoiceRecommendation[]) => {
    set(produce((state: AppState) => {
      state.voice.recommendations = recommendations.slice(0, 5); // Keep top 5
      
      storeLogger.info('Voice recommendations updated', {
        count: recommendations.length,
        topScore: recommendations[0]?.score || 0
      });
    }));
  },

  // Set analysis context for voice recommendations
  setAnalysisContext: (context: string) => {
    set(produce((state: AppState) => {
      state.voice.analysisContext = context;
      
      // Trigger recommendation update if context is substantial
      if (context.length > 10) {
        // TODO: Trigger voice recommendation analysis
        console.log('Analysis context updated:', context.slice(0, 50) + '...');
      }
    }));
  },

  // Create new voice session
  createSession: (perspectives: string[], roles: string[], prompt: string) => {
    set(produce((state: AppState) => {
      const newSession: VoiceSession = {
        id: `session_${Date.now()}`,
        perspectives,
        roles,
        prompt,
        timestamp: Date.now(),
        solutions: [],
        synthesisResult: null
      };
      
      // Set as active session
      state.voice.activeSession = newSession;
      
      // Add to history (keep last 50 sessions)
      state.voice.sessionHistory.unshift(newSession);
      if (state.voice.sessionHistory.length > 50) {
        state.voice.sessionHistory = state.voice.sessionHistory.slice(0, 50);
      }
      
      storeLogger.info('Voice session created', {
        sessionId: newSession.id,
        perspectives: newSession.perspectives,
        roles: newSession.roles,
        promptLength: newSession.prompt.length
      });
      
      // Note: Consciousness tracking will be handled separately to avoid circular references
      // TODO: Implement consciousness tracking in session management layer
    }));
  },

  // Clear voice selection
  clearSelection: () => {
    set(produce((state: AppState) => {
      state.voice.selectedPerspectives = [];
      state.voice.selectedRoles = [];
      state.voice.recommendations = [];
      state.voice.analysisContext = '';
      
      storeLogger.info('Voice selection cleared');
    }));
  }
  };
  
  // Return cached actions object to prevent infinite loops
  return actions;
};

// Voice slice creator with stable action references
export const createVoiceSlice: StateCreator<
  AppState,
  [],
  [],
  VoiceState
> = (set, get) => {
  const actions = createVoiceActions(set, get);
  return {
    ...initialVoiceState,
    actions
  };
};

// Voice slice with persistence
export const useVoiceStore = createPersistentSlice<VoiceState>({
  name: 'voice-store',
  version: 1,
  partialize: (state) => ({
    selectedPerspectives: state.selectedPerspectives,
    selectedRoles: state.selectedRoles,
    customVoices: state.customVoices,
    sessionHistory: state.sessionHistory.slice(0, 10) // Persist only recent history
  })
});

// Voice selection utilities
export const getSelectedVoiceCount = (): number => {
  const state = useVoiceStore.getState();
  return state.selectedPerspectives.length + state.selectedRoles.length;
};

export const hasValidVoiceSelection = (): boolean => {
  const count = getSelectedVoiceCount();
  return count > 0 && count <= 5; // Following voice selection limits
};

export const getVoiceCombinationString = (): string => {
  const state = useVoiceStore.getState();
  const all = [...state.selectedPerspectives, ...state.selectedRoles];
  return all.join(' + ') || 'No voices selected';
};

// Voice recommendation scoring
export const calculateRecommendationScore = (
  prompt: string,
  perspectives: string[],
  roles: string[]
): number => {
  const combinationSize = perspectives.length + roles.length;
  const promptComplexity = Math.min(prompt.length / 100, 5);
  const diversityBonus = new Set([...perspectives, ...roles]).size === combinationSize ? 0.2 : 0;
  
  return Math.min(10, combinationSize * 1.5 + promptComplexity + diversityBonus);
};