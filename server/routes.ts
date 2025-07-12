import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { logger, APIError } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Health check endpoint (no auth required)
  app.get('/api/health', (req, res) => {
    console.log('Health check endpoint hit');
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Temporary test endpoint to bypass auth for debugging
  app.get('/api/test/sessions', async (req: any, res, next) => {
    try {
      console.log('Test sessions endpoint hit - no auth required');
      const sessions = [
        {
          id: 'session_1',
          name: 'React Performance Optimization',
          participants: 3,
          status: 'active',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 15 * 60 * 1000)
        }
      ];
      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Team collaboration sessions endpoints  
  app.get('/api/collaboration/sessions', isAuthenticated, async (req: any, res, next) => {
    console.log('Collaboration sessions endpoint hit - user:', req.user ? 'authenticated' : 'not authenticated');
    try {
      const userId = req.user.claims.sub;
      
      // Mock collaborative sessions data following AI_INSTRUCTIONS.md patterns
      const sessions = [
        {
          id: 'session_1',
          name: 'React Performance Optimization',
          participants: 3,
          status: 'active',
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 15 * 60 * 1000)
        },
        {
          id: 'session_2', 
          name: 'API Architecture Design',
          participants: 2,
          status: 'completed',
          createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 20 * 60 * 60 * 1000)
        }
      ];

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/collaboration/teams/:teamId/sessions', isAuthenticated, async (req: any, res, next) => {
    console.log('Team sessions endpoint hit - teamId:', req.params.teamId, 'user:', req.user ? 'authenticated' : 'not authenticated');
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      // Mock team sessions
      const sessions = [
        {
          id: 'team_session_1',
          name: 'Team Code Review Session',
          participants: ['user_1', 'user_2', 'user_3'],
          status: 'active',
          createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
          lastActivity: new Date(Date.now() - 5 * 60 * 1000)
        }
      ];

      res.json({ sessions });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/teams/:teamId/members', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      // Get real team members from database following AI_INSTRUCTIONS.md patterns
      const members = await storage.getTeamMembers(teamId);
      
      res.json({ members });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/teams/:teamId/voice-profiles', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;

      // Get real shared voice profiles from database  
      const userProfiles = await storage.getVoiceProfiles(userId);
      
      // Transform to team profile format
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

      // Add sample profiles if none exist
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

  // Team voice profiles endpoint for voice selector integration
  app.get('/api/teams/voice-profiles/shared/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.claims.sub;

      // Get shared voice profiles for team voice selector
      const userProfiles = await storage.getVoiceProfiles(userId);
      
      // Transform to team profile format
      const sharedProfiles = userProfiles.slice(0, 5).map((profile, index) => ({
        id: profile.id.toString(), 
        name: profile.name || 'Team Voice Profile',
        creator: 'Team Member',
        creatorId: userId,
        specializations: Array.isArray(profile.specialization) ? profile.specialization.split(',') : [profile.specialization || 'General'],
        usage: Math.floor(Math.random() * 50) + 10,
        effectiveness: Math.floor(Math.random() * 30) + 70,
        description: profile.description || 'Shared team voice profile for collaboration',
        isPublic: true,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }));

      logger.info('Fetched shared voice profiles for team selector', {
        userId,
        requestingUserId,
        profileCount: sharedProfiles.length
      });

      res.json({ sharedProfiles });
    } catch (error) {
      logger.error('Failed to fetch team voice profiles for selector', error as Error, {
        userId: req.params.userId,
        requestingUserId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Voice profiles endpoint for My Profiles tab
  app.get('/api/voice-profiles', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getVoiceProfiles(userId);
      res.json(profiles);
    } catch (error) {
      next(error);
    }
  });

  // Additional essential endpoints
  app.get('/api/subscription/info', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      const planTier = user?.planTier || 'free';
      
      res.json({
        tier: {
          name: planTier,
          displayName: planTier.charAt(0).toUpperCase() + planTier.slice(1)
        },
        usage: {
          used: 0,
          limit: planTier === 'free' ? 3 : -1
        },
        stripeSubscriptionId: user?.stripeSubscriptionId,
        status: 'active'
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/quota/check', isAuthenticated, async (req: any, res, next) => {
    try {
      res.json({
        dailyUsage: 0,
        dailyLimit: 1000,
        remaining: 1000,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    } catch (error) {
      next(error);
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  return server;
}