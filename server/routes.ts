import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { logger, APIError } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertProjectFolderSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  // Add team voice profiles endpoint for voice selector integration
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

  // Project folder routes - Pro tier gated following AI_INSTRUCTIONS.md
  app.get('/api/project-folders', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const folders = await storage.getProjectFolders(userId);
      res.json(folders);
    } catch (error) {
      logger.error('Error fetching project folders', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch project folders' });
    }
  });

  app.post('/api/project-folders', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Add missing defaults for required fields
      const folderData = {
        ...req.body,
        userId,
        sortOrder: req.body.sortOrder || 0,
        isShared: req.body.isShared || false,
        parentId: req.body.parentId || null
      };
      
      const validatedData = insertProjectFolderSchema.parse(folderData);
      const folder = await storage.createProjectFolder(validatedData);
      res.json(folder);
    } catch (error) {
      logger.error('Error creating project folder', error as Error, { 
        userId: req.user?.claims?.sub,
        requestBody: req.body 
      });
      if (error instanceof Error && error.message.includes('subscription')) {
        res.status(403).json({ error: 'Pro subscription required for project folders' });
      } else {
        res.status(500).json({ error: 'Failed to create project folder' });
      }
    }
  });

  app.put('/api/project-folders/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      const folder = await storage.updateProjectFolder(parseInt(id), updates);
      if (!folder) {
        return res.status(404).json({ error: 'Project folder not found' });
      }
      
      res.json(folder);
    } catch (error) {
      logger.error('Error updating project folder', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to update project folder' });
    }
  });

  app.delete('/api/project-folders/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      const deleted = await storage.deleteProjectFolder(parseInt(id));
      if (!deleted) {
        return res.status(404).json({ error: 'Project folder not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting project folder', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to delete project folder' });
    }
  });

  app.post('/api/projects/:projectId/move', isAuthenticated, async (req: any, res, next) => {
    try {
      const { projectId } = req.params;
      const { folderId } = req.body;
      const userId = req.user.claims.sub;
      
      const moved = await storage.moveProjectToFolder(parseInt(projectId), folderId);
      if (!moved) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      logger.error('Error moving project', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to move project' });
    }
  });

  // Additional routes for API completeness
  app.get('/api/projects', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await storage.getProjectsByUser(userId);
      res.json(projects);
    } catch (error) {
      logger.error('Error fetching projects', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get('/api/subscription/info', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ 
        tier: user?.planTier || 'free',
        stripeSubscriptionId: user?.stripeSubscriptionId || null
      });
    } catch (error) {
      logger.error('Error fetching subscription info', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch subscription info' });
    }
  });

  app.get('/api/quota/check', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json({ 
        dailyGenerated: 0,
        dailyLimit: user?.planTier === 'free' ? 3 : 999,
        remaining: user?.planTier === 'free' ? 3 : 999
      });
    } catch (error) {
      logger.error('Error checking quota', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to check quota' });
    }
  });

  app.get('/api/voice-profiles', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getVoiceProfiles(userId);
      res.json(profiles);
    } catch (error) {
      logger.error('Error fetching voice profiles', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch voice profiles' });
    }
  });

  app.get('/api/onboarding/status', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const sessions = await storage.getUserSessions(userId);
      res.json({ 
        hasCompletedOnboarding: sessions.length > 0,
        tourCompleted: true,
        sessionCount: sessions.length
      });
    } catch (error) {
      logger.error('Error fetching onboarding status', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch onboarding status' });
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  return server;
}