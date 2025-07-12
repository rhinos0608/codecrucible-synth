// Team Collaboration Service - AI_INSTRUCTIONS.md Security Patterns
import { z } from 'zod';
import { logger } from './logger';
import { hasFeatureAccess } from './feature-access';
import { db } from './db';
import { teams, teamMembers } from '../shared/schema';
import { eq, and } from 'drizzle-orm';

// Input validation schemas following AI_INSTRUCTIONS.md
const collaborativeSessionSchema = z.object({
  teamId: z.string().uuid(),
  initiatorId: z.string(),
  prompt: z.string().min(1).max(5000),
  voices: z.array(z.object({
    perspective: z.string(),
    role: z.string()
  })).min(1).max(10)
});

const participantSchema = z.object({
  userId: z.string(),
  role: z.enum(['initiator', 'collaborator', 'observer']),
  joinedAt: z.date()
});

interface CollaborativeSession {
  id: string;
  teamId: string;
  participants: Participant[];
  sharedVoices: VoiceSelection[];
  liveDocument: SharedDocument;
  voiceOutputs: Map<string, VoiceOutput>;
  chatHistory: ChatMessage[];
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
}

interface Participant {
  userId: string;
  role: 'initiator' | 'collaborator' | 'observer';
  joinedAt: Date;
  isActive: boolean;
}

interface VoiceSelection {
  perspective: string;
  role: string;
  assignedTo?: string;
}

interface SharedDocument {
  id: string;
  content: string;
  lastModified: Date;
  version: number;
  editors: string[];
}

interface VoiceOutput {
  id: string;
  voiceId: string;
  userId: string;
  code: string;
  explanation: string;
  timestamp: Date;
  status: 'generating' | 'completed' | 'error';
}

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  timestamp: Date;
  type: 'chat' | 'system' | 'voice_assignment';
}

class CollaborationService {
  private activeSessions = new Map<string, CollaborativeSession>();
  private sessionParticipants = new Map<string, Set<string>>();
  
  /**
   * Create a new collaborative coding session
   * @param sessionData - Session configuration
   * @returns Created session
   */
  async createCollaborativeSession(sessionData: z.infer<typeof collaborativeSessionSchema>): Promise<CollaborativeSession> {
    try {
      // Validate input following AI_INSTRUCTIONS.md patterns
      const validatedData = collaborativeSessionSchema.parse(sessionData);
      
      // Check team collaboration access
      await this.validateTeamAccess(validatedData.initiatorId, validatedData.teamId);
      
      // Generate session ID
      const sessionId = this.generateSessionId();
      
      // Create session object
      const session: CollaborativeSession = {
        id: sessionId,
        teamId: validatedData.teamId,
        participants: [{
          userId: validatedData.initiatorId,
          role: 'initiator',
          joinedAt: new Date(),
          isActive: true
        }],
        sharedVoices: validatedData.voices.map(v => ({
          perspective: v.perspective,
          role: v.role,
          assignedTo: validatedData.initiatorId
        })),
        liveDocument: this.createSharedDocument(sessionId),
        voiceOutputs: new Map(),
        chatHistory: [{
          id: this.generateId(),
          userId: 'system',
          message: `Collaborative session started by ${validatedData.initiatorId}`,
          timestamp: new Date(),
          type: 'system'
        }],
        status: 'active',
        createdAt: new Date()
      };
      
      // Store session
      this.activeSessions.set(sessionId, session);
      this.sessionParticipants.set(sessionId, new Set([validatedData.initiatorId]));
      
      logger.info('Collaborative session created', {
        sessionId,
        teamId: validatedData.teamId,
        initiator: validatedData.initiatorId.substring(0, 8) + '...',
        voiceCount: validatedData.voices.length
      });
      
      return session;
    } catch (error) {
      logger.error('Failed to create collaborative session', error as Error);
      throw error;
    }
  }
  
  /**
   * Add participant to collaborative session
   * @param sessionId - Session identifier
   * @param userId - User to add
   * @param role - Participant role
   */
  async addParticipant(sessionId: string, userId: string, role: 'collaborator' | 'observer' = 'collaborator'): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Validate team membership
    await this.validateTeamMembership(userId, session.teamId);
    
    // Check if already participating
    const existingParticipant = session.participants.find(p => p.userId === userId);
    if (existingParticipant) {
      existingParticipant.isActive = true;
      return;
    }
    
    // Add participant
    const participant: Participant = {
      userId,
      role,
      joinedAt: new Date(),
      isActive: true
    };
    
    session.participants.push(participant);
    this.sessionParticipants.get(sessionId)?.add(userId);
    
    // Add system message
    session.chatHistory.push({
      id: this.generateId(),
      userId: 'system',
      message: `${userId} joined the session as ${role}`,
      timestamp: new Date(),
      type: 'system'
    });
    
    logger.info('Participant added to collaborative session', {
      sessionId,
      userId: userId.substring(0, 8) + '...',
      role
    });
  }
  
  /**
   * Update shared voice selection
   * @param sessionId - Session identifier
   * @param userId - User making the change
   * @param voices - New voice selection
   */
  async updateSharedVoices(sessionId: string, userId: string, voices: VoiceSelection[]): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Validate participant
    if (!this.sessionParticipants.get(sessionId)?.has(userId)) {
      throw new Error('User not authorized for this session');
    }
    
    // Update voice selection
    session.sharedVoices = voices;
    
    // Add system message
    session.chatHistory.push({
      id: this.generateId(),
      userId: 'system',
      message: `Voice selection updated by ${userId}`,
      timestamp: new Date(),
      type: 'voice_assignment'
    });
    
    logger.info('Shared voices updated', {
      sessionId,
      userId: userId.substring(0, 8) + '...',
      voiceCount: voices.length
    });
  }
  
  /**
   * Add voice output to collaborative session
   * @param sessionId - Session identifier
   * @param voiceOutput - Generated voice output
   */
  async addVoiceOutput(sessionId: string, voiceOutput: VoiceOutput): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Store voice output
    session.voiceOutputs.set(voiceOutput.id, voiceOutput);
    
    // Update shared document if needed
    if (voiceOutput.status === 'completed') {
      await this.updateSharedDocument(sessionId, voiceOutput);
    }
    
    logger.info('Voice output added to collaborative session', {
      sessionId,
      voiceId: voiceOutput.voiceId,
      userId: voiceOutput.userId.substring(0, 8) + '...',
      status: voiceOutput.status
    });
  }
  
  /**
   * Get collaborative session by ID
   * @param sessionId - Session identifier
   * @returns Session data
   */
  async getSession(sessionId: string): Promise<CollaborativeSession | null> {
    return this.activeSessions.get(sessionId) || null;
  }
  
  /**
   * Get active sessions for a team
   * @param teamId - Team identifier
   * @returns Active sessions
   */
  async getTeamSessions(teamId: string): Promise<CollaborativeSession[]> {
    const sessions = Array.from(this.activeSessions.values());
    return sessions.filter(session => 
      session.teamId === teamId && session.status === 'active'
    );
  }
  
  /**
   * Validate team collaboration access
   */
  private async validateTeamAccess(userId: string, teamId: string): Promise<void> {
    // Check subscription tier for team features
    const hasTeamAccess = hasFeatureAccess('team', 'team_collaboration');
    if (!hasTeamAccess) {
      throw new Error('Team collaboration requires Team subscription');
    }
    
    // Validate team membership
    await this.validateTeamMembership(userId, teamId);
  }
  
  /**
   * Validate team membership
   */
  private async validateTeamMembership(userId: string, teamId: string): Promise<void> {
    const membership = await db.select()
      .from(teamMembers)
      .where(and(
        eq(teamMembers.userId, userId),
        eq(teamMembers.teamId, parseInt(teamId))
      ))
      .limit(1);
    
    if (membership.length === 0) {
      throw new Error('User is not a member of this team');
    }
  }
  
  /**
   * Create shared document for collaboration
   */
  private createSharedDocument(sessionId: string): SharedDocument {
    return {
      id: this.generateId(),
      content: '',
      lastModified: new Date(),
      version: 1,
      editors: []
    };
  }
  
  /**
   * Update shared document with new voice output
   */
  private async updateSharedDocument(sessionId: string, voiceOutput: VoiceOutput): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    // Append voice output to shared document
    const separator = session.liveDocument.content ? '\n\n---\n\n' : '';
    session.liveDocument.content += separator + 
      `## ${voiceOutput.voiceId}\n\n${voiceOutput.code}\n\n*${voiceOutput.explanation}*`;
    
    session.liveDocument.lastModified = new Date();
    session.liveDocument.version++;
    
    if (!session.liveDocument.editors.includes(voiceOutput.userId)) {
      session.liveDocument.editors.push(voiceOutput.userId);
    }
  }
  
  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const collaborationService = new CollaborationService();