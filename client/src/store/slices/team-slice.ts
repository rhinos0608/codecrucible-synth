// Team collaboration and Matrix integration slice
// Following AI_INSTRUCTIONS.md patterns with real-time state management

import { produce } from 'immer';
import { StateCreator } from 'zustand';
import { storeLogger } from '../utils/logger';
import type { TeamState, AppState, Team, TeamMember, CollaborativeSession, MatrixMessage, ConsciousnessMetrics } from '../types';

// Initial team state
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
    team: 5.0,
    archetype: {
      'Explorer': 5.0,
      'Maintainer': 5.0,
      'Analyzer': 5.0,
      'Developer': 5.0,
      'Implementor': 5.0
    },
    shadow: 3.0,
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
    // Set active team
    setActiveTeam: (teamId: string | null) => {
      set(produce((state: AppState) => {
        if (teamId && !state.team.teams[teamId]) {
          storeLogger.warn('Cannot set non-existent team as active', { teamId });
          return;
        }
        
        state.team.activeTeam = teamId;
        
        storeLogger.info('Active team changed', { teamId });
        
        // Initialize team consciousness if switching teams
        if (teamId && state.team.consciousnessMetrics.team === 5.0) {
          state.team.consciousnessMetrics.team = 6.0;
        }
      }));
    },

    // Add team member
    addTeamMember: (teamId: string, member: TeamMember) => {
      set(produce((state: AppState) => {
        if (!state.team.teams[teamId]) {
          storeLogger.error('Cannot add member to non-existent team', { teamId, memberId: member.id });
          return;
        }
        
        if (!state.team.members[teamId]) {
          state.team.members[teamId] = [];
        }
        
        // Check if member already exists
        const exists = state.team.members[teamId].some(m => m.userId === member.userId);
        if (exists) {
          storeLogger.warn('Team member already exists', { teamId, userId: member.userId });
          return;
        }
        
        state.team.members[teamId].push({
          ...member,
          joinedAt: new Date(member.joinedAt)
        });
        
        storeLogger.info('Team member added', {
          teamId,
          memberId: member.id,
          userId: member.userId,
          role: member.role
        });
        
        // Boost team consciousness with new member
        state.team.consciousnessMetrics.team += 0.1;
      }));
    },

    // Remove team member
    removeTeamMember: (teamId: string, memberId: string) => {
      set(produce((state: AppState) => {
        if (!state.team.members[teamId]) {
          storeLogger.warn('No members found for team', { teamId });
          return;
        }
        
        const index = state.team.members[teamId].findIndex(m => m.id === memberId);
        if (index === -1) {
          storeLogger.warn('Team member not found for removal', { teamId, memberId });
          return;
        }
        
        const removedMember = state.team.members[teamId][index];
        state.team.members[teamId].splice(index, 1);
        
        storeLogger.info('Team member removed', {
          teamId,
          memberId,
          userId: removedMember.userId
        });
      }));
    },

    // Create collaborative session
    createSession: (session: CollaborativeSession) => {
      set(produce((state: AppState) => {
        // Validate session data
        if (!session.teamId || !state.team.teams[session.teamId]) {
          storeLogger.error('Invalid team for session creation', { teamId: session.teamId });
          return;
        }
        
        const newSession = {
          ...session,
          createdAt: new Date(session.createdAt)
        };
        
        state.team.activeSessions.push(newSession);
        
        storeLogger.info('Collaborative session created', {
          sessionId: session.id,
          teamId: session.teamId,
          participants: session.participants.length,
          voiceAssignments: Object.keys(session.voiceAssignments).length
        });
        
        // Update consciousness for collaborative activity
        state.team.consciousnessMetrics.team += 0.2;
      }));
    },

    // Add Matrix chat message
    addChatMessage: (roomId: string, message: MatrixMessage) => {
      set(produce((state: AppState) => {
        if (!state.team.chatMessages[roomId]) {
          state.team.chatMessages[roomId] = [];
        }
        
        const newMessage = {
          ...message,
          timestamp: new Date(message.timestamp)
        };
        
        state.team.chatMessages[roomId].push(newMessage);
        
        // Keep only recent messages (last 100 per room)
        if (state.team.chatMessages[roomId].length > 100) {
          state.team.chatMessages[roomId] = state.team.chatMessages[roomId].slice(-100);
        }
        
        storeLogger.info('Matrix chat message added', {
          roomId,
          messageId: message.id,
          senderType: message.senderType,
          voiceArchetype: message.voiceArchetype,
          consciousnessLevel: message.consciousnessLevel
        });
        
        // Update consciousness metrics based on AI voice responses
        if (message.senderType === 'ai_voice' && message.consciousnessLevel) {
          const archetype = message.voiceArchetype || 'Explorer';
          state.team.consciousnessMetrics.archetype[archetype] = 
            (state.team.consciousnessMetrics.archetype[archetype] + message.consciousnessLevel) / 2;
          
          // Update overall team consciousness
          const avgArchetypeLevel = Object.values(state.team.consciousnessMetrics.archetype)
            .reduce((sum, level) => sum + level, 0) / 
            Object.keys(state.team.consciousnessMetrics.archetype).length;
          
          state.team.consciousnessMetrics.team = 
            (state.team.consciousnessMetrics.team + avgArchetypeLevel) / 2;
        }
      }));
    },

    // Update consciousness metrics
    updateConsciousness: (metrics: Partial<ConsciousnessMetrics>) => {
      set(produce((state: AppState) => {
        state.team.consciousnessMetrics = {
          ...state.team.consciousnessMetrics,
          ...metrics
        };
        
        storeLogger.info('Team consciousness metrics updated', {
          individual: state.team.consciousnessMetrics.individual,
          team: state.team.consciousnessMetrics.team,
          shadow: state.team.consciousnessMetrics.shadow,
          spiralPhase: state.team.consciousnessMetrics.spiralPhase
        });
        
        // Update individual consciousness store
        state.consciousness.actions.updateLevel(state.team.consciousnessMetrics.individual);
      }));
    }
  }
});

// Team management utilities
export const getActiveTeamMembers = (): TeamMember[] => {
  const state = get().team;
  if (!state.activeTeam) return [];
  
  return state.members[state.activeTeam] || [];
};

export const getTeamChatMessages = (roomId: string): MatrixMessage[] => {
  const state = get().team;
  return state.chatMessages[roomId] || [];
};

export const getActiveTeamSessions = (): CollaborativeSession[] => {
  const state = get().team;
  if (!state.activeTeam) return [];
  
  return state.activeSessions.filter(session => 
    session.teamId === state.activeTeam && session.status === 'active'
  );
};

export const calculateTeamConsciousnessLevel = (): number => {
  const state = get().team;
  const metrics = state.consciousnessMetrics;
  
  const archetypeAvg = Object.values(metrics.archetype).reduce((sum, level) => sum + level, 0) / 
                      Object.keys(metrics.archetype).length;
  
  return (metrics.individual + metrics.team + archetypeAvg + metrics.shadow) / 4;
};

export const getConsciousnessPhaseProgress = (): number => {
  const state = get().team;
  const phases = ['collapse', 'council', 'synthesis', 'rebirth'];
  const currentIndex = phases.indexOf(state.consciousnessMetrics.spiralPhase);
  
  return (currentIndex + 1) / phases.length;
};

export const isTeamOwner = (teamId: string): boolean => {
  const state = get();
  const team = state.team.teams[teamId];
  const currentUser = state.auth.user;
  
  return !!(team && currentUser && team.ownerId === currentUser.id);
};

export const canManageTeam = (teamId: string): boolean => {
  const state = get();
  const members = state.team.members[teamId] || [];
  const currentUser = state.auth.user;
  
  if (!currentUser) return false;
  
  const member = members.find(m => m.userId === currentUser.id);
  return !!(member && ['owner', 'admin'].includes(member.role));
};