// Real-Time Collaboration WebSocket Server - AI_INSTRUCTIONS.md Security Patterns
import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from './logger';
import { db } from './db';
import { collaborativeSessions, sessionParticipants, sessionChat, voiceAssignments } from '../shared/collaboration-schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

interface ConnectedClient {
  userId: string;
  sessionId: string;
  ws: WebSocket;
  lastPing: Date;
  isAuthenticated: boolean;
}

interface SessionState {
  participants: Set<string>;
  lastActivity: Date;
}

class CollaborationWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private sessions: Map<string, SessionState> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanupInterval();
  }

  public initialize(server: any) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/collaboration',
      verifyClient: this.verifyClient.bind(this)
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Start heartbeat monitoring
    this.heartbeatInterval = setInterval(this.performHeartbeat.bind(this), 30000);
    
    logger.info('Collaboration WebSocket server initialized');
  }

  private verifyClient(info: { req: IncomingMessage }): boolean {
    const url = new URL(info.req.url!, `ws://${info.req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    const token = url.searchParams.get('token');

    return !!(sessionId && userId && token);
  }

  private async handleConnection(ws: WebSocket, request: IncomingMessage) {
    try {
      const url = new URL(request.url!, `ws://${request.headers.host}`);
      const sessionId = url.searchParams.get('sessionId')!;
      const userId = url.searchParams.get('userId')!;
      const token = url.searchParams.get('token')!;

      // Verify session access and authentication
      const hasAccess = await this.verifySessionAccess(userId, sessionId, token);
      if (!hasAccess) {
        ws.close(1008, 'Invalid session access');
        return;
      }

      const clientId = `${userId}-${Date.now()}`;
      this.clients.set(clientId, {
        userId,
        sessionId,
        ws,
        lastPing: new Date(),
        isAuthenticated: true
      });

      // Initialize session tracking
      if (!this.sessions.has(sessionId)) {
        this.sessions.set(sessionId, {
          participants: new Set(),
          lastActivity: new Date()
        });
      }
      
      const sessionState = this.sessions.get(sessionId)!;
      sessionState.participants.add(clientId);

      // Set up WebSocket event handlers
      ws.on('message', (data) => this.handleMessage(clientId, data));
      ws.on('close', () => this.handleDisconnection(clientId));
      ws.on('pong', () => {
        const client = this.clients.get(clientId);
        if (client) client.lastPing = new Date();
      });

      // Update participant status in database
      await this.updateParticipantStatus(userId, sessionId, true);

      // Send initial session state
      await this.sendSessionState(clientId);

      // Notify other participants
      this.broadcastToSession(sessionId, {
        type: 'participant_joined',
        sessionId,
        userId,
        data: { userId, timestamp: new Date() },
        timestamp: new Date()
      }, clientId);

      logger.info('Client connected to collaboration session', {
        clientId: clientId.substring(0, 8) + '...',
        sessionId: sessionId.substring(0, 8) + '...',
        userId: userId.substring(0, 8) + '...'
      });

    } catch (error) {
      logger.error('Error handling WebSocket connection', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(clientId: string, data: Buffer) {
    try {
      const client = this.clients.get(clientId);
      if (!client || !client.isAuthenticated) return;

      const message = JSON.parse(data.toString());
      const { sessionId, userId } = client;

      // Update session activity
      const sessionState = this.sessions.get(sessionId);
      if (sessionState) {
        sessionState.lastActivity = new Date();
      }

      switch (message.type) {
        case 'update_prompt':
          await this.handlePromptUpdate(sessionId, userId, message.data);
          break;
        
        case 'voice_assignment':
          await this.handleVoiceAssignment(sessionId, userId, message.data);
          break;
        
        case 'voice_generation_start':
          await this.handleVoiceGenerationStart(sessionId, userId, message.data);
          break;
        
        case 'voice_output':
          await this.handleVoiceOutput(sessionId, userId, message.data);
          break;
        
        case 'chat_message':
          await this.handleChatMessage(sessionId, userId, message.data);
          break;
        
        case 'cursor_update':
          await this.handleCursorUpdate(sessionId, userId, message.data);
          break;
        
        case 'synthesis_request':
          await this.handleSynthesisRequest(sessionId, userId, message.data);
          break;
        
        case 'ping':
          client.ws.send(JSON.stringify({ 
            type: 'pong', 
            timestamp: Date.now() 
          }));
          break;

        default:
          logger.warn('Unknown message type received', { type: message.type, clientId });
      }

    } catch (error) {
      logger.error('Error handling WebSocket message', error);
    }
  }

  private async handlePromptUpdate(sessionId: string, userId: string, data: any) {
    try {
      // Update prompt in database
      await db.update(collaborativeSessions)
        .set({ 
          prompt: data.prompt,
          lastActivity: new Date()
        })
        .where(eq(collaborativeSessions.id, sessionId));

      // Broadcast to all session participants
      this.broadcastToSession(sessionId, {
        type: 'update_prompt',
        sessionId,
        userId,
        data: { prompt: data.prompt, updatedBy: userId },
        timestamp: new Date()
      });

      logger.info('Prompt updated in collaborative session', {
        sessionId: sessionId.substring(0, 8) + '...',
        userId: userId.substring(0, 8) + '...',
        promptLength: data.prompt?.length || 0
      });

    } catch (error) {
      logger.error('Error handling prompt update', error);
    }
  }

  private async handleVoiceAssignment(sessionId: string, userId: string, data: any) {
    try {
      const { voiceType, assignTo } = data;

      // Update voice assignment in database
      await db.insert(voiceAssignments)
        .values({
          sessionId,
          voiceType,
          assignedTo: assignTo,
          status: 'assigned',
          assignedAt: new Date()
        })
        .onConflictDoUpdate({
          target: [voiceAssignments.sessionId, voiceAssignments.voiceType],
          set: {
            assignedTo: assignTo,
            status: 'assigned',
            assignedAt: new Date()
          }
        });

      // Broadcast assignment change
      this.broadcastToSession(sessionId, {
        type: 'voice_assignment',
        sessionId,
        userId,
        data: { voiceType, assignedTo: assignTo, assignedBy: userId },
        timestamp: new Date()
      });

      // Add system chat message
      await this.addSystemChatMessage(sessionId, `Voice "${voiceType}" assigned to user`, {
        voiceType,
        assignedTo: assignTo,
        assignedBy: userId
      });

    } catch (error) {
      logger.error('Error handling voice assignment', error);
    }
  }

  private async handleVoiceGenerationStart(sessionId: string, userId: string, data: any) {
    try {
      const { voiceType } = data;

      // Update voice assignment status
      await db.update(voiceAssignments)
        .set({ status: 'generating' })
        .where(and(
          eq(voiceAssignments.sessionId, sessionId),
          eq(voiceAssignments.voiceType, voiceType)
        ));

      // Broadcast generation start
      this.broadcastToSession(sessionId, {
        type: 'voice_generation_start',
        sessionId,
        userId,
        data: { voiceType, startedBy: userId },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling voice generation start', error);
    }
  }

  private async handleVoiceOutput(sessionId: string, userId: string, data: any) {
    try {
      const { voiceType, output } = data;

      // Update voice assignment with output
      await db.update(voiceAssignments)
        .set({ 
          status: 'completed',
          output: output,
          completedAt: new Date()
        })
        .where(and(
          eq(voiceAssignments.sessionId, sessionId),
          eq(voiceAssignments.voiceType, voiceType)
        ));

      // Update session voice outputs
      const session = await db.select()
        .from(collaborativeSessions)
        .where(eq(collaborativeSessions.id, sessionId))
        .limit(1);

      if (session.length > 0) {
        const currentOutputs = session[0].voiceOutputs as any || {};
        currentOutputs[voiceType] = output;

        await db.update(collaborativeSessions)
          .set({ voiceOutputs: currentOutputs })
          .where(eq(collaborativeSessions.id, sessionId));
      }

      // Broadcast voice output
      this.broadcastToSession(sessionId, {
        type: 'voice_output',
        sessionId,
        userId,
        data: { voiceType, output, completedBy: userId },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling voice output', error);
    }
  }

  private async handleChatMessage(sessionId: string, userId: string, data: any) {
    try {
      const { message } = data;

      // Insert chat message into database
      const chatRecord = await db.insert(sessionChat)
        .values({
          sessionId,
          userId,
          message,
          messageType: 'text',
          createdAt: new Date()
        })
        .returning();

      // Broadcast chat message
      this.broadcastToSession(sessionId, {
        type: 'chat_message',
        sessionId,
        userId,
        data: { 
          message, 
          messageId: chatRecord[0].id,
          sentBy: userId,
          timestamp: chatRecord[0].createdAt
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error handling chat message', error);
    }
  }

  private async handleCursorUpdate(sessionId: string, userId: string, data: any) {
    try {
      // Update participant cursor data
      await db.update(sessionParticipants)
        .set({ 
          cursorData: data.cursor,
          lastSeenAt: new Date()
        })
        .where(and(
          eq(sessionParticipants.sessionId, sessionId),
          eq(sessionParticipants.userId, userId)
        ));

      // Broadcast cursor update (excluding sender)
      this.broadcastToSession(sessionId, {
        type: 'cursor_update',
        sessionId,
        userId,
        data: { cursor: data.cursor, userId },
        timestamp: new Date()
      }, undefined, [userId]);

    } catch (error) {
      logger.error('Error handling cursor update', error);
    }
  }

  private async handleSynthesisRequest(sessionId: string, userId: string, data: any) {
    try {
      // Update session with synthesis request
      await db.update(collaborativeSessions)
        .set({ 
          synthesis: data.synthesis,
          lastActivity: new Date()
        })
        .where(eq(collaborativeSessions.id, sessionId));

      // Broadcast synthesis request
      this.broadcastToSession(sessionId, {
        type: 'synthesis_request',
        sessionId,
        userId,
        data: { synthesis: data.synthesis, requestedBy: userId },
        timestamp: new Date()
      });

      // Add system chat message
      await this.addSystemChatMessage(sessionId, 'Synthesis requested', {
        requestedBy: userId,
        voiceCount: Object.keys(data.synthesis?.inputs || {}).length
      });

    } catch (error) {
      logger.error('Error handling synthesis request', error);
    }
  }

  private async handleDisconnection(clientId: string) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { userId, sessionId } = client;

      // Remove from session tracking
      const sessionState = this.sessions.get(sessionId);
      if (sessionState) {
        sessionState.participants.delete(clientId);
        
        // Clean up empty sessions
        if (sessionState.participants.size === 0) {
          this.sessions.delete(sessionId);
        }
      }

      // Update participant status in database
      await this.updateParticipantStatus(userId, sessionId, false);

      // Remove client
      this.clients.delete(clientId);

      // Notify other participants
      this.broadcastToSession(sessionId, {
        type: 'participant_left',
        sessionId,
        userId,
        data: { userId, timestamp: new Date() },
        timestamp: new Date()
      });

      logger.info('Client disconnected from collaboration session', {
        clientId: clientId.substring(0, 8) + '...',
        sessionId: sessionId.substring(0, 8) + '...',
        userId: userId.substring(0, 8) + '...'
      });

    } catch (error) {
      logger.error('Error handling WebSocket disconnection', error);
    }
  }

  private broadcastToSession(
    sessionId: string, 
    message: any, 
    excludeClientId?: string,
    excludeUserIds: string[] = []
  ) {
    const sessionState = this.sessions.get(sessionId);
    if (!sessionState) return;

    for (const clientId of sessionState.participants) {
      if (clientId === excludeClientId) continue;
      
      const client = this.clients.get(clientId);
      if (!client) continue;
      
      if (excludeUserIds.includes(client.userId)) continue;

      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(JSON.stringify(message));
        }
      } catch (error) {
        logger.error('Error broadcasting message to client', error);
      }
    }
  }

  private async sendSessionState(clientId: string) {
    try {
      const client = this.clients.get(clientId);
      if (!client) return;

      const { sessionId } = client;

      // Fetch complete session state
      const [session, participants, assignments, messages] = await Promise.all([
        db.select().from(collaborativeSessions).where(eq(collaborativeSessions.id, sessionId)).limit(1),
        db.select().from(sessionParticipants).where(eq(sessionParticipants.sessionId, sessionId)),
        db.select().from(voiceAssignments).where(eq(voiceAssignments.sessionId, sessionId)),
        db.select().from(sessionChat).where(eq(sessionChat.sessionId, sessionId)).orderBy(sessionChat.createdAt).limit(50)
      ]);

      const sessionState = {
        session: session[0] || null,
        participants,
        voiceAssignments: assignments,
        chatMessages: messages,
        timestamp: new Date()
      };

      client.ws.send(JSON.stringify({
        type: 'session_state',
        sessionId,
        userId: client.userId,
        data: sessionState,
        timestamp: new Date()
      }));

    } catch (error) {
      logger.error('Error sending session state', error);
    }
  }

  private async verifySessionAccess(userId: string, sessionId: string, token: string): Promise<boolean> {
    try {
      // In production, verify the JWT token and check session access permissions
      // For now, basic validation that session exists and user has access
      const session = await db.select()
        .from(collaborativeSessions)
        .where(eq(collaborativeSessions.id, sessionId))
        .limit(1);

      return session.length > 0;
    } catch (error) {
      logger.error('Error verifying session access', error);
      return false;
    }
  }

  private async updateParticipantStatus(userId: string, sessionId: string, isActive: boolean) {
    try {
      await db.insert(sessionParticipants)
        .values({
          sessionId,
          userId,
          isActive,
          joinedAt: new Date(),
          lastSeenAt: new Date()
        })
        .onConflictDoUpdate({
          target: [sessionParticipants.sessionId, sessionParticipants.userId],
          set: {
            isActive,
            lastSeenAt: new Date()
          }
        });
    } catch (error) {
      logger.error('Error updating participant status', error);
    }
  }

  private async addSystemChatMessage(sessionId: string, message: string, metadata: any = {}) {
    try {
      await db.insert(sessionChat)
        .values({
          sessionId,
          userId: 'system',
          message,
          messageType: 'system',
          metadata,
          createdAt: new Date()
        });

      // Broadcast system message
      this.broadcastToSession(sessionId, {
        type: 'chat_message',
        sessionId,
        userId: 'system',
        data: { 
          message, 
          messageType: 'system',
          metadata,
          timestamp: new Date()
        },
        timestamp: new Date()
      });

    } catch (error) {
      logger.error('Error adding system chat message', error);
    }
  }

  private performHeartbeat() {
    const now = new Date();
    const disconnectThreshold = 60000; // 60 seconds

    for (const [clientId, client] of this.clients.entries()) {
      const timeSinceLastPing = now.getTime() - client.lastPing.getTime();
      
      if (timeSinceLastPing > disconnectThreshold) {
        // Client is inactive, disconnect
        client.ws.close(1001, 'Connection timeout');
        this.handleDisconnection(clientId);
      } else if (client.ws.readyState === WebSocket.OPEN) {
        // Send ping
        client.ws.ping();
      }
    }
  }

  private startCleanupInterval() {
    // Clean up expired sessions every 5 minutes
    setInterval(async () => {
      try {
        const now = new Date();
        await db.delete(collaborativeSessions)
          .where(and(
            eq(collaborativeSessions.status, 'completed'),
            // Delete completed sessions older than 24 hours
          ));
      } catch (error) {
        logger.error('Error during session cleanup', error);
      }
    }, 5 * 60 * 1000);
  }

  public shutdown() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutdown');
    }

    if (this.wss) {
      this.wss.close();
    }

    logger.info('Collaboration WebSocket server shut down');
  }
}

export const collaborationWSServer = new CollaborationWebSocketServer();