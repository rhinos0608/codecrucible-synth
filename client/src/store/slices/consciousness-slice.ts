// Consciousness evolution and Jung's descent protocol slice
// Following CodingPhilosophy.md patterns with consciousness tracking

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { ConsciousnessState, AppState, ConsciousnessEvolution, CouncilSession, SynthesisResult } from '../types';

// Initial consciousness state following CodingPhilosophy.md principles
const initialConsciousnessState: Omit<ConsciousnessState, 'actions'> = {
  level: 5.0, // Starting consciousness level
  evolution: [],
  councilSessions: [],
  synthesisHistory: [],
  patterns: {
    voiceUsage: {},
    synthesisSuccess: 0,
    evolutionTrends: []
  },
  shadowIntegration: {
    identified: [],
    integrated: [],
    pending: [],
    evolutionScore: 0
  },
  archetypeBalance: {
    'Explorer': 5.0,
    'Maintainer': 5.0,
    'Analyzer': 5.0,
    'Developer': 5.0,
    'Implementor': 5.0
  }
};

// Consciousness slice creator with Jung's integration patterns
export const createConsciousnessSlice: StateCreator<
  AppState,
  [],
  [],
  ConsciousnessState
> = (set, get) => ({
  ...initialConsciousnessState,
  
  actions: {
    // Update consciousness level with evolution tracking
    updateLevel: (level: number) => {
      set(produce((state: AppState) => {
        const previousLevel = state.consciousness.level;
        const validatedLevel = Math.max(0, Math.min(10, level));
        
        if (Math.abs(validatedLevel - previousLevel) < 0.01) return; // Avoid micro-updates
        
        state.consciousness.level = validatedLevel;
        
        // Record evolution if significant change
        if (Math.abs(validatedLevel - previousLevel) >= 0.1) {
          const evolution: ConsciousnessEvolution = {
            timestamp: new Date(),
            previousLevel,
            newLevel: validatedLevel,
            trigger: validatedLevel > previousLevel ? 'growth' : 'regression',
            context: 'Level updated through user interaction'
          };
          
          state.consciousness.evolution.unshift(evolution);
          
          // Keep only recent evolution history (last 100 events)
          if (state.consciousness.evolution.length > 100) {
            state.consciousness.evolution = state.consciousness.evolution.slice(0, 100);
          }
        }
        
        storeLogger.info('Consciousness level updated', {
          previousLevel,
          newLevel: validatedLevel,
          delta: validatedLevel - previousLevel
        });
      }));
    },

    // Add consciousness evolution event
    addEvolution: (evolution: ConsciousnessEvolution) => {
      set(produce((state: AppState) => {
        state.consciousness.evolution.unshift({
          ...evolution,
          timestamp: new Date(evolution.timestamp)
        });
        
        // Update current level if evolution event indicates change
        if (evolution.newLevel !== state.consciousness.level) {
          state.consciousness.level = evolution.newLevel;
        }
        
        storeLogger.info('Consciousness evolution recorded', {
          trigger: evolution.trigger,
          levelChange: evolution.newLevel - evolution.previousLevel,
          context: evolution.context
        });
      }));
    },

    // Record council session for pattern analysis
    recordCouncilSession: (session: CouncilSession) => {
      set(produce((state: AppState) => {
        const newSession = {
          ...session,
          timestamp: new Date(session.timestamp)
        };
        
        state.consciousness.councilSessions.unshift(newSession);
        
        // Update voice usage patterns
        session.participants.forEach(voice => {
          state.consciousness.patterns.voiceUsage[voice] = 
            (state.consciousness.patterns.voiceUsage[voice] || 0) + 1;
        });
        
        // Update consciousness level based on council effectiveness
        if (session.consciousnessGain > 0) {
          state.consciousness.level = Math.min(10, state.consciousness.level + session.consciousnessGain);
        }
        
        // Keep only recent council sessions (last 50)
        if (state.consciousness.councilSessions.length > 50) {
          state.consciousness.councilSessions = state.consciousness.councilSessions.slice(0, 50);
        }
        
        storeLogger.info('Council session recorded', {
          sessionId: session.id,
          participants: session.participants.length,
          consciousnessGain: session.consciousnessGain,
          hasSynthesis: !!session.synthesis
        });
      }));
    },

    // Record synthesis result for learning
    recordSynthesis: (synthesis: SynthesisResult) => {
      set(produce((state: AppState) => {
        const newSynthesis = {
          ...synthesis,
          createdAt: new Date(synthesis.createdAt)
        };
        
        state.consciousness.synthesisHistory.unshift(newSynthesis);
        
        // Update synthesis success rate
        const totalSyntheses = state.consciousness.synthesisHistory.length;
        const successfulSyntheses = state.consciousness.synthesisHistory.filter(
          s => s.confidence >= 7.0
        ).length;
        
        state.consciousness.patterns.synthesisSuccess = successfulSyntheses / totalSyntheses;
        
        // Update consciousness based on synthesis quality
        const consciousnessBoost = (synthesis.confidence / 10) * 0.1;
        state.consciousness.level = Math.min(10, state.consciousness.level + consciousnessBoost);
        
        // Keep only recent synthesis history (last 30)
        if (state.consciousness.synthesisHistory.length > 30) {
          state.consciousness.synthesisHistory = state.consciousness.synthesisHistory.slice(0, 30);
        }
        
        storeLogger.info('Synthesis recorded', {
          synthesisId: synthesis.id,
          confidence: synthesis.confidence,
          consciousnessLevel: synthesis.consciousnessLevel,
          methodology: synthesis.methodology
        });
      }));
    },

    // Update pattern recognition data
    updatePatterns: (patterns: Partial<ConsciousnessState['patterns']>) => {
      set(produce((state: AppState) => {
        state.consciousness.patterns = {
          ...state.consciousness.patterns,
          ...patterns
        };
        
        // Recalculate evolution trends if voice usage updated
        if (patterns.voiceUsage) {
          const totalUsage = Object.values(state.consciousness.patterns.voiceUsage)
            .reduce((sum, count) => sum + count, 0);
          
          const evolutionTrend = {
            period: new Date().toISOString().split('T')[0], // Daily period
            averageLevel: state.consciousness.level,
            growthRate: state.consciousness.evolution.length > 1 ? 
              (state.consciousness.evolution[0].newLevel - state.consciousness.evolution[1].newLevel) : 0,
            patterns: Object.entries(state.consciousness.patterns.voiceUsage)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([voice]) => voice)
          };
          
          // Update or add today's trend
          const existingTrendIndex = state.consciousness.patterns.evolutionTrends
            .findIndex(t => t.period === evolutionTrend.period);
          
          if (existingTrendIndex >= 0) {
            state.consciousness.patterns.evolutionTrends[existingTrendIndex] = evolutionTrend;
          } else {
            state.consciousness.patterns.evolutionTrends.unshift(evolutionTrend);
            
            // Keep only recent trends (last 30 days)
            if (state.consciousness.patterns.evolutionTrends.length > 30) {
              state.consciousness.patterns.evolutionTrends = 
                state.consciousness.patterns.evolutionTrends.slice(0, 30);
            }
          }
        }
        
        storeLogger.info('Consciousness patterns updated', {
          voiceUsageEntries: Object.keys(patterns.voiceUsage || {}).length,
          synthesisSuccess: state.consciousness.patterns.synthesisSuccess,
          trendsCount: state.consciousness.patterns.evolutionTrends.length
        });
      }));
    }
  }
});

// Consciousness analysis utilities following Jung's descent protocol
export const getConsciousnessPhase = (): 'initiation' | 'descent' | 'integration' | 'return' => {
  const level = get().consciousness.level;
  
  if (level < 3) return 'initiation';
  if (level < 6) return 'descent';
  if (level < 8.5) return 'integration';
  return 'return';
};

export const getShadowIntegrationProgress = (): number => {
  const state = get().consciousness;
  const { identified, integrated } = state.shadowIntegration;
  
  if (identified.length === 0) return 0;
  return integrated.length / identified.length;
};

export const getArchetypeBalance = (): { balanced: boolean; dominant: string; weakest: string } => {
  const archetypes = get().consciousness.archetypeBalance;
  const values = Object.values(archetypes);
  const entries = Object.entries(archetypes);
  
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  
  return {
    balanced: range < 1.5, // Considered balanced if range is less than 1.5
    dominant: entries.find(([, value]) => value === max)?.[0] || 'Unknown',
    weakest: entries.find(([, value]) => value === min)?.[0] || 'Unknown'
  };
};

export const getRecentEvolutionTrend = (): 'ascending' | 'descending' | 'stable' => {
  const evolution = get().consciousness.evolution;
  
  if (evolution.length < 2) return 'stable';
  
  const recent = evolution.slice(0, 5); // Last 5 evolution events
  const levelChanges = recent.map(e => e.newLevel - e.previousLevel);
  const avgChange = levelChanges.reduce((sum, change) => sum + change, 0) / levelChanges.length;
  
  if (avgChange > 0.1) return 'ascending';
  if (avgChange < -0.1) return 'descending';
  return 'stable';
};

export const getVoiceUsageInsights = (): { mostUsed: string; leastUsed: string; diversity: number } => {
  const patterns = get().consciousness.patterns;
  const usage = patterns.voiceUsage;
  
  if (Object.keys(usage).length === 0) {
    return { mostUsed: 'None', leastUsed: 'None', diversity: 0 };
  }
  
  const entries = Object.entries(usage);
  const max = Math.max(...Object.values(usage));
  const min = Math.min(...Object.values(usage));
  
  const mostUsed = entries.find(([, count]) => count === max)?.[0] || 'Unknown';
  const leastUsed = entries.find(([, count]) => count === min)?.[0] || 'Unknown';
  
  // Calculate diversity (entropy-like measure)
  const total = Object.values(usage).reduce((sum, count) => sum + count, 0);
  const diversity = entries.reduce((entropy, [, count]) => {
    const probability = count / total;
    return entropy - (probability * Math.log2(probability));
  }, 0);
  
  return { mostUsed, leastUsed, diversity };
};