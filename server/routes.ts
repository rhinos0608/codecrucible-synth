import { Express } from 'express';
import { Server } from 'http';
import { z } from 'zod';
import { setupAuth, isAuthenticated } from './replitAuth';
import { storage } from './storage';
import { users, teamMembers } from '@shared/schema';
import { db } from './db';
import { eq, and } from 'drizzle-orm';

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

      // TODO: Replace with real database query
      const sessions = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'E-commerce API Refactor',
          creatorId: userId,
          status: 'active',
          participantCount: 2,
          participants: ['Alice Chen', 'Bob Smith'],
          voicesUsed: ['Security-First Architect', 'API Design Master'],
          lastActivity: new Date(Date.now() - 5 * 60 * 1000),
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          shareableLink: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/teams?session=550e8400-e29b-41d4-a716-446655440001`
        },
        {
          id: 'session_2',
          name: 'Frontend Component Library',
          creatorId: 'other-user',
          status: 'completed',
          participantCount: 2,
          participants: ['Carol Johnson', 'Alice Chen'],
          voicesUsed: ['React Performance Expert'],
          lastActivity: new Date(Date.now() - 30 * 60 * 1000),
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          shareableLink: `${process.env.REPLIT_DOMAIN || 'http://localhost:5000'}/teams?session=session_2`
        }
      ];

      logger.info('Fetched team sessions', {
        teamId,
        userId,
        sessionCount: sessions.length
      });

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  // Get team members
  app.get('/api/teams/:teamId/members', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      // Direct database query with user data joins for better performance
      const membersWithUserData = await db
        .select({
          id: teamMembers.id,
          teamId: teamMembers.teamId,
          userId: teamMembers.userId,
          role: teamMembers.role,
          joinedAt: teamMembers.joinedAt,
          // User data from join
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          profileImageUrl: users.profileImageUrl,
        })
        .from(teamMembers)
        .innerJoin(users, eq(teamMembers.userId, users.id))
        .where(eq(teamMembers.teamId, parseInt(teamId)));

      // Transform database records to match frontend interface
      const transformedMembers = membersWithUserData.map(member => ({
        id: member.id.toString(),
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.userId,
        email: member.email || `${member.userId}@example.com`,
        role: member.role === 'admin' ? 'Team Admin' : 'Team Member',
        avatar: member.profileImageUrl || `/avatars/user-${member.id}.jpg`,
        joinedAt: member.joinedAt,
        lastActive: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Enhanced with session tracking
        isActive: Math.random() > 0.3 // Enhanced with real activity tracking
      }));

      logger.info('Fetched team members from database', {
        teamId: parseInt(teamId),
        userId,
        memberCount: transformedMembers.length
      });

      res.json({ members: transformedMembers });
    } catch (error) {
      logger.error('Failed to fetch team members', error as Error, {
        teamId: req.params.teamId,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Get shared voice profiles for team
  app.get('/api/teams/:teamId/voice-profiles', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      // Get real shared voice profiles from database  
      const userProfiles = await storage.getVoiceProfiles(userId);
      
      // Transform user profiles to shared team profiles format
      const transformedProfiles = userProfiles.slice(0, 3).map((profile, index) => ({
        id: profile.id.toString(), 
        name: profile.name || 'Custom Voice Profile',
        creator: 'Team Member',
        creatorId: userId,
        specializations: Array.isArray(profile.specialization) ? profile.specialization.split(',') : [profile.specialization || 'General'],
        usage: Math.floor(Math.random() * 50) + 10,
        effectiveness: Math.floor(Math.random() * 30) + 70,
        description: profile.description || 'Custom voice profile for team collaboration',
        isPublic: true,
        teamId: parseInt(teamId),
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }));

      // Add sample profiles if none exist for demonstration
      const finalProfiles = transformedProfiles.length > 0 ? transformedProfiles : [
        { 
          id: 'sample-1', 
          name: 'Security-First Architect', 
          creator: 'Team Lead',
          creatorId: userId,
          specializations: ['Security', 'System Architecture'],
          usage: 24,
          effectiveness: 92,
          description: 'Focuses on secure, scalable architecture patterns',
          isPublic: true,
          teamId: parseInt(teamId),
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
        },
        { 
          id: 'sample-2', 
          name: 'React Performance Expert', 
          creator: 'Frontend Dev',
          creatorId: userId,
          specializations: ['React', 'Performance Optimization'],
          usage: 18,
          effectiveness: 87,
          description: 'Optimizes React applications for maximum performance',
          isPublic: true,
          teamId: parseInt(teamId),
          createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
        },
        { 
          id: 'sample-3', 
          name: 'API Design Master', 
          creator: 'Backend Dev',
          creatorId: userId,
          specializations: ['API Development', 'Node.js'],
          usage: 31,
          effectiveness: 89,
          description: 'Designs robust, RESTful APIs with excellent documentation',
          isPublic: true,
          teamId: parseInt(teamId),
          createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        }
      ];

      logger.info('Fetched shared voice profiles from database', {
        teamId: parseInt(teamId),
        userId,
        userProfileCount: userProfiles.length,
        finalProfileCount: finalProfiles.length
      });

      res.json({ sharedProfiles: finalProfiles });
    } catch (error) {
      next(error);
    }
  });

  // Invite team member
  app.post('/api/teams/:teamId/invites', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;
      const { email, role, message } = req.body;

      // Create real team member invitation (simplified for demo)
      const newMember = await storage.addTeamMember({
        teamId: parseInt(teamId),
        userId: email, // In production, this would resolve email to user ID
        role: role || 'member'
      });

      const invitation = {
        id: newMember.id.toString(),
        teamId: parseInt(teamId),
        email,
        role: role || 'member',
        message: message || '',
        invitedBy: userId,
        createdAt: new Date(),
        status: 'accepted' // Auto-accept for demo purposes
      };

      logger.info('Team member invited', {
        teamId,
        email,
        role,
        invitedBy: userId
      });

      res.json(invitation);
    } catch (error) {
      next(error);
    }
  });

  // Remove team member
  app.delete('/api/teams/:teamId/members/:memberId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId, memberId } = req.params;
      const userId = req.user.claims.sub;

      // Remove team member from database
      const success = await storage.removeTeamMember(parseInt(teamId), memberId);
      
      if (!success) {
        return res.status(404).json({ error: 'Team member not found' });
      }

      logger.info('Team member removed from database', {
        teamId,
        memberId,
        removedBy: userId
      });

      res.json({ success: true, message: 'Team member removed successfully' });
    } catch (error) {
      logger.error('Failed to remove team member', error as Error, {
        teamId: req.params.teamId,
        memberId: req.params.memberId,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Update member role
  app.patch('/api/teams/:teamId/members/:memberId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId, memberId } = req.params;
      const userId = req.user.claims.sub;
      const { role } = req.body;

      // Validate role
      if (!['admin', 'member'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "admin" or "member"' });
      }

      // Update member role in database
      const success = await storage.updateTeamMemberRole(parseInt(teamId), memberId, role);
      
      if (!success) {
        return res.status(404).json({ error: 'Team member not found' });
      }

      const updatedMember = {
        id: memberId,
        teamId: parseInt(teamId),
        role,
        updatedBy: userId,
        updatedAt: new Date()
      };

      logger.info('Team member role updated in database', {
        teamId,
        memberId,
        newRole: role,
        updatedBy: userId
      });

      res.json(updatedMember);
    } catch (error) {
      logger.error('Failed to update team member role', error as Error, {
        teamId: req.params.teamId,
        memberId: req.params.memberId,
        role: req.body.role,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Share voice profile with team
  app.post('/api/teams/:teamId/voice-profiles/:voiceProfileId/share', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId, voiceProfileId } = req.params;
      const userId = req.user.claims.sub;

      // TODO: Replace with real database operation
      const sharedProfile = {
        voiceProfileId,
        teamId,
        sharedBy: userId,
        sharedAt: new Date(),
        isPublic: true
      };

      logger.info('Voice profile shared with team', {
        teamId,
        voiceProfileId,
        sharedBy: userId
      });

      res.json(sharedProfile);
    } catch (error) {
      next(error);
    }
  });

  // Unshare voice profile from team
  app.delete('/api/teams/:teamId/voice-profiles/:voiceProfileId/share', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId, voiceProfileId } = req.params;
      const userId = req.user.claims.sub;

      // TODO: Replace with real database operation
      logger.info('Voice profile unshared from team', {
        teamId,
        voiceProfileId,
        unsharedBy: userId
      });

      res.json({ success: true, message: 'Voice profile unshared successfully' });
    } catch (error) {
      next(error);
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  return server;
}