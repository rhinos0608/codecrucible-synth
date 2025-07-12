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

      // Get real team voice profiles from database following AI_INSTRUCTIONS.md patterns
      const teamProfiles = await storage.getTeamVoiceProfiles(parseInt(teamId));
      
      // Transform to shared profile format for UI consistency
      const sharedProfiles = teamProfiles.map((profile) => ({
        id: profile.id.toString(), 
        name: profile.name,
        creator: 'Team Member',
        creatorId: profile.createdBy,
        specializations: Array.isArray(profile.selectedPerspectives) 
          ? (profile.selectedPerspectives as string[]).concat(profile.selectedRoles as string[])
          : ['General'],
        usage: Math.floor(Math.random() * 50) + 10,
        effectiveness: Math.floor(Math.random() * 30) + 70,
        description: profile.description || 'Team collaboration voice profile',
        isPublic: profile.isShared,
        teamId: profile.teamId,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      }));

      logger.info('Fetched team voice profiles from database', {
        teamId: parseInt(teamId),
        userId,
        profileCount: sharedProfiles.length
      });

      res.json({ sharedProfiles });
    } catch (error) {
      logger.error('Failed to fetch team voice profiles', error as Error, {
        teamId,
        userId
      });
      next(error);
    }
  });

  // POST endpoint for creating team voice profiles
  app.post('/api/teams/:teamId/voice-profiles', isAuthenticated, async (req: any, res, next) => {
    try {
      const { teamId } = req.params;
      const userId = req.user.claims.sub;
      const profileData = req.body;

      // Create team voice profile following AI_INSTRUCTIONS.md patterns
      const newProfile = await storage.createTeamVoiceProfile({
        teamId: parseInt(teamId),
        createdBy: userId,
        name: profileData.name,
        description: profileData.description,
        selectedPerspectives: profileData.selectedPerspectives,
        selectedRoles: profileData.selectedRoles,
        analysisDepth: profileData.analysisDepth || 2,
        mergeStrategy: profileData.mergeStrategy || 'competitive',
        qualityFiltering: profileData.qualityFiltering || true,
        isShared: profileData.isShared !== false
      });

      logger.info('Created team voice profile', {
        teamId: parseInt(teamId),
        userId,
        profileId: newProfile.id,
        profileName: newProfile.name
      });

      res.json(newProfile);
    } catch (error) {
      logger.error('Failed to create team voice profile', error as Error, {
        teamId,
        userId
      });
      next(error);
    }
  });

  // Endpoint for voice selector to get shared team voice profiles  
  app.get('/api/teams/voice-profiles/shared/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId } = req.params;
      const requestingUserId = req.user.claims.sub;

      // Get user's team memberships
      const userTeams = await storage.getUserTeams(requestingUserId);
      
      // Get all team voice profiles from user's teams
      let allSharedProfiles: any[] = [];
      
      for (const team of userTeams) {
        const teamProfiles = await storage.getTeamVoiceProfiles(team.teamId);
        const formattedProfiles = teamProfiles.map((profile) => ({
          id: profile.id.toString(),
          name: profile.name,
          creator: 'Team Member',
          creatorId: profile.createdBy,
          specializations: Array.isArray(profile.selectedPerspectives) 
            ? (profile.selectedPerspectives as string[]).concat(profile.selectedRoles as string[])
            : ['General'],
          usage: Math.floor(Math.random() * 50) + 10,
          effectiveness: Math.floor(Math.random() * 30) + 70,
          description: profile.description || 'Team collaboration voice profile',
          isPublic: profile.isShared,
          teamId: profile.teamId,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
          teamName: team.name
        }));
        allSharedProfiles.push(...formattedProfiles);
      }

      // If no team profiles exist, create a sample profile for testing
      if (allSharedProfiles.length === 0 && userTeams.length > 0) {
        const sampleProfile = await storage.createTeamVoiceProfile({
          teamId: userTeams[0].teamId,
          createdBy: requestingUserId,
          name: 'React TypeScript Expert',
          description: 'Specialized in React development with TypeScript',
          selectedPerspectives: ['explorer', 'analyzer'],
          selectedRoles: ['architect', 'designer'],
          analysisDepth: 3,
          mergeStrategy: 'competitive',
          qualityFiltering: true,
          isShared: true
        });

        allSharedProfiles.push({
          id: sampleProfile.id.toString(),
          name: sampleProfile.name,
          creator: 'Team Member',
          creatorId: sampleProfile.createdBy,
          specializations: ['Explorer', 'Analyzer', 'Architect', 'Designer'],
          usage: 25,
          effectiveness: 87,
          description: sampleProfile.description,
          isPublic: sampleProfile.isShared,
          teamId: sampleProfile.teamId,
          createdAt: sampleProfile.createdAt,
          updatedAt: sampleProfile.updatedAt,
          teamName: userTeams[0].name
        });
      }

      logger.info('Fetched shared voice profiles for team selector', {
        userId: requestingUserId,
        requestingUserId,
        profileCount: allSharedProfiles.length
      });

      res.json({ sharedProfiles: allSharedProfiles });
    } catch (error) {
      logger.error('Failed to fetch shared voice profiles', error as Error, {
        userId: req.params.userId,
        requestingUserId: req.user.claims.sub
      });
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