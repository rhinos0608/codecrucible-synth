import { Express } from 'express';
import { Server } from 'http';
import { z } from 'zod';
import { setupAuth, isAuthenticated } from './replitAuth';

// Simple logger implementation
const logger = {
  info: (message: string, meta?: any) => {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  error: (message: string, meta?: any) => {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta) : '');
  },
  warn: (message: string, meta?: any) => {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta) : '');
  }
};

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Setup authentication first
  await setupAuth(app);
  
  // Test endpoint
  app.get('/api/test', (req, res) => {
    res.json({ status: 'Real-Time Multiplayer CodeCrucible Server Running!' });
  });

  // Auth routes are now handled by setupAuth
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // Mock user data for now - in production this would come from database
      const user = {
        id: userId,
        email: req.user.claims.email,
        name: req.user.claims.name,
        planTier: 'free',
        createdAt: new Date()
      };
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Create collaborative session
  app.post('/api/collaboration/sessions', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { name, prompt, accessType, selectedVoices } = req.body;

      const sessionId = `collab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session = {
        id: sessionId,
        name: name || 'Unnamed Session',
        creatorId: userId,
        shareableLink: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/teams?session=${sessionId}`,
        accessType: accessType || 'invite_only',
        participants: [{
          userId,
          name: 'Creator',
          role: 'creator',
          isActive: true,
          assignedVoices: selectedVoices || [],
          joinedAt: new Date(),
          lastSeenAt: new Date()
        }],
        prompt: prompt || '',
        selectedVoices: selectedVoices || [],
        voiceOutputs: {},
        status: 'active',
        createdAt: new Date(),
        lastActivity: new Date(),
        voiceAssignments: (selectedVoices || []).map(voice => ({
          voiceType: voice,
          assignedTo: userId,
          status: 'available'
        })),
        chatMessages: [{
          id: `msg_${Date.now()}`,
          userId: 'system',
          message: `Collaborative session "${name || 'Unnamed Session'}" created`,
          messageType: 'system',
          createdAt: new Date()
        }]
      };

      logger.info('Collaborative session created', {
        sessionId,
        creatorId: userId,
        voiceCount: selectedVoices?.length || 0
      });

      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  // Join collaborative session
  app.post('/api/collaboration/sessions/:sessionId/join', isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;
      const { role = 'collaborator' } = req.body;

      const joinResult = {
        sessionId,
        userId,
        role,
        joinedAt: new Date(),
        message: 'Successfully joined collaborative session'
      };

      logger.info('User joined collaborative session', {
        sessionId,
        userId,
        role
      });

      res.json(joinResult);
    } catch (error) {
      next(error);
    }
  });

  // Get session details
  app.get('/api/collaboration/sessions/:sessionId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;

      const mockSessionDetails = {
        id: sessionId,
        name: 'React Performance Optimization',
        creatorId: 'creator-user-id',
        shareableLink: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/teams?session=${sessionId}`,
        accessType: 'invite_only',
        participants: [
          {
            userId,
            name: 'You',
            role: 'creator',
            isActive: true,
            assignedVoices: ['Explorer', 'Performance Engineer'],
            joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            lastSeenAt: new Date()
          },
          {
            userId: 'other-user-1',
            name: 'Sarah Chen',
            role: 'collaborator',
            isActive: false,
            assignedVoices: ['Performance Engineer'],
            joinedAt: new Date(Date.now() - 45 * 60 * 1000),
            lastSeenAt: new Date(Date.now() - 2 * 60 * 1000)
          }
        ],
        prompt: 'Optimize this React component for better performance and accessibility',
        selectedVoices: ['Explorer', 'Performance Engineer', 'UI/UX Engineer'],
        voiceOutputs: {
          Explorer: { code: '// Analysis code here', explanation: 'Component structure analysis' },
          'Performance Engineer': { code: '// Optimized code here', explanation: 'Performance improvements' }
        },
        status: 'active',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        lastActivity: new Date(Date.now() - 5 * 60 * 1000),
        voiceAssignments: [
          { voiceType: 'Explorer', assignedTo: userId, status: 'completed' },
          { voiceType: 'Performance Engineer', assignedTo: 'other-user-1', status: 'completed' },
          { voiceType: 'UI/UX Engineer', assignedTo: null, status: 'available' }
        ],
        chatMessages: [
          {
            id: '1',
            userId: 'system',
            message: 'Session created',
            messageType: 'system',
            createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
          },
          {
            id: '2',
            userId,
            message: 'Let\'s focus on performance optimizations first',
            messageType: 'text',
            createdAt: new Date(Date.now() - 90 * 60 * 1000)
          },
          {
            id: '3',
            userId: 'other-user-1',
            message: 'I\'ll handle the performance optimization voice',
            messageType: 'text',
            createdAt: new Date(Date.now() - 85 * 60 * 1000)
          }
        ]
      };

      logger.info('Fetched session details', {
        sessionId,
        userId,
        participantCount: mockSessionDetails.participants.length
      });

      res.json(mockSessionDetails);
    } catch (error) {
      next(error);
    }
  });

  // Send chat message
  app.post('/api/collaboration/sessions/:sessionId/chat', isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;
      const { message } = req.body;

      const chatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        userId,
        message,
        messageType: 'text',
        createdAt: new Date()
      };

      logger.info('Chat message sent', {
        sessionId,
        userId,
        messageLength: message.length
      });

      res.json(chatMessage);
    } catch (error) {
      next(error);
    }
  });

  // Assign voice to participant
  app.post('/api/collaboration/sessions/:sessionId/assign-voice', isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;
      const { voiceType, assignedTo } = req.body;

      const assignment = {
        sessionId,
        voiceType,
        assignedTo,
        assignedBy: userId,
        assignedAt: new Date(),
        status: 'assigned'
      };

      logger.info('Voice assigned', {
        sessionId,
        voiceType,
        assignedTo,
        assignedBy: userId
      });

      res.json(assignment);
    } catch (error) {
      next(error);
    }
  });

  // Get team sessions
  app.get('/api/collaboration/teams/:teamId/sessions', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      const mockTeamSessions = [
        {
          id: 'session_1',
          name: 'React Performance Optimization',
          creatorId: userId,
          status: 'active',
          participantCount: 2,
          lastActivity: new Date(Date.now() - 5 * 60 * 1000),
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
        },
        {
          id: 'session_2',
          name: 'API Security Enhancement',
          creatorId: 'other-user',
          status: 'paused',
          participantCount: 3,
          lastActivity: new Date(Date.now() - 30 * 60 * 1000),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      ];

      logger.info('Fetched team sessions', {
        teamId,
        userId,
        sessionCount: mockTeamSessions.length
      });

      res.json({ sessions: mockTeamSessions });
    } catch (error) {
      next(error);
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  return server;
}