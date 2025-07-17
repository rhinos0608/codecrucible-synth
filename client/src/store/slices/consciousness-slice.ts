// Consciousness evolution and tracking slice
// Following CodingPhilosophy.md with Jung's Descent Protocol integration

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { ConsciousnessState, AppState, ConsciousnessEvolution, CouncilSession, SynthesisResult } from '../types';

// Initial state
const initialConsciousnessState: Omit<ConsciousnessState, 'actions'> = {
  level: 5.0,
  evolution: [],
  councilSessions: [],
  synthesisHistory: [],
  patterns: {
    voiceUsage: {},
    synthesisSuccess: 0.75,
    evolutionTrends: []
  },
  shadowIntegration: {
    identified: [],
    integrated: [],
    pending: [],
    evolutionScore: 0.5
  },
  archetypeBalance: {
    Explorer: 0.2,
    Maintainer: 0.2,
    Analyzer: 0.2,
    Developer: 0.2,
    Implementor: 0.2
  }
};

// Consciousness slice creator
export const createConsciousnessSlice: StateCreator<
  AppState,
  [],
  [],
  ConsciousnessState
> = (set, get) => ({
  ...initialConsciousnessState,
  
  actions: {
    updateLevel: (level: number) => {
      set(produce((state: AppState) => {
        const previousLevel = state.consciousness.level;
        state.consciousness.level = Math.max(0, Math.min(10, level));
        
        // Record evolution if significant change
        if (Math.abs(state.consciousness.level - previousLevel) >= 0.1) {
          state.consciousness.evolution.push({
            timestamp: new Date(),
            previousLevel,
            newLevel: state.consciousness.level,
            trigger: 'voice_selection',
            context: 'Multi-voice collaboration evolution'
          });
        }
        
        storeLogger.info('Consciousness level updated', { 
          previousLevel, 
          newLevel: state.consciousness.level 
        });
      }));
    },
    
    addEvolution: (evolution: ConsciousnessEvolution) => {
      set(produce((state: AppState) => {
        state.consciousness.evolution.push(evolution);
        
        // Keep only last 50 evolution records
        if (state.consciousness.evolution.length > 50) {
          state.consciousness.evolution = state.consciousness.evolution.slice(-50);
        }
        
        storeLogger.info('Consciousness evolution recorded', { 
          trigger: evolution.trigger 
        });
      }));
    },
    
    recordCouncilSession: (session: CouncilSession) => {
      set(produce((state: AppState) => {
        state.consciousness.councilSessions.push(session);
        
        // Update consciousness level based on session success
        if (session.consciousnessGain > 0) {
          state.consciousness.level += session.consciousnessGain;
          state.consciousness.level = Math.min(10, state.consciousness.level);
        }
        
        storeLogger.info('Council session recorded', { 
          sessionId: session.id,
          consciousnessGain: session.consciousnessGain 
        });
      }));
    },
    
    recordSynthesis: (synthesis: SynthesisResult) => {
      set(produce((state: AppState) => {
        state.consciousness.synthesisHistory.push(synthesis);
        
        // Update synthesis success rate
        const recentSyntheses = state.consciousness.synthesisHistory.slice(-10);
        const successRate = recentSyntheses.reduce((acc, s) => acc + s.confidence, 0) / recentSyntheses.length;
        state.consciousness.patterns.synthesisSuccess = successRate;
        
        storeLogger.info('Synthesis recorded', { 
          synthesisId: synthesis.id,
          confidence: synthesis.confidence 
        });
      }));
    },
    
    updatePatterns: (patterns: Partial<ConsciousnessState['patterns']>) => {
      set(produce((state: AppState) => {
        Object.assign(state.consciousness.patterns, patterns);
        storeLogger.info('Consciousness patterns updated', { patterns });
      }));
    }
  }
});