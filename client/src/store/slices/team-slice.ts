// Team collaboration and Matrix integration slice
// Following AI_INSTRUCTIONS.md patterns with real-time state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { TeamState, AppState, Team, TeamMember, CollaborativeSession, MatrixMessage, ConsciousnessMetrics } from '../types';

// Initial state
const initialTeamState: Omit<TeamState, 'actions'> = {
  teams: {},
  activeTeam: null,
  members: {},
  invitations: [],
  activeSessions: [],
  sharedVoices: [],
  matrixRooms: {},
  chatMessages: {},
  consciousnessMetrics: {
    individual: 5.0,
    team: 3.0,
    archetype: {},
    shadow: 2.0,
    spiralPhase: 'council'
  }
};

// Team slice creator
export const createTeamSlice: StateCreator<
  AppState,
  [],
  [],
  TeamState
> = (set, get) => ({
  ...initialTeamState,
  
  actions: {
    setActiveTeam: (teamId: string | null) => {
      set(produce((state: AppState) => {
        state.team.activeTeam = teamId;
        storeLogger.info('Active team changed', { teamId });
      }));
    },
    
    addTeamMember: (teamId: string, member: TeamMember) => {
      set(produce((state: AppState) => {
        if (!state.team.members[teamId]) {
          state.team.members[teamId] = [];
        }
        state.team.members[teamId].push(member);
        
        storeLogger.info('Team member added', { teamId, memberId: member.id });
      }));
    },
    
    removeTeamMember: (teamId: string, memberId: string) => {
      set(produce((state: AppState) => {
        if (state.team.members[teamId]) {
          state.team.members[teamId] = state.team.members[teamId].filter(
            member => member.id !== memberId
          );
        }
        
        storeLogger.info('Team member removed', { teamId, memberId });
      }));
    },
    
    createSession: (session: CollaborativeSession) => {
      set(produce((state: AppState) => {
        state.team.activeSessions.push(session);
        storeLogger.info('Collaborative session created', { sessionId: session.id });
      }));
    },
    
    addChatMessage: (roomId: string, message: MatrixMessage) => {
      set(produce((state: AppState) => {
        if (!state.team.chatMessages[roomId]) {
          state.team.chatMessages[roomId] = [];
        }
        state.team.chatMessages[roomId].push(message);
        
        // Keep only last 100 messages per room
        if (state.team.chatMessages[roomId].length > 100) {
          state.team.chatMessages[roomId] = state.team.chatMessages[roomId].slice(-100);
        }
        
        storeLogger.info('Chat message added', { roomId, messageId: message.id });
      }));
    },
    
    updateConsciousness: (metrics: Partial<ConsciousnessMetrics>) => {
      set(produce((state: AppState) => {
        Object.assign(state.team.consciousnessMetrics, metrics);
        storeLogger.info('Consciousness metrics updated', { metrics });
      }));
    }
  }
});