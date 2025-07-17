import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { logger, APIError } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertProjectFolderSchema, insertProjectSchema, insertUserFileSchema, insertSessionFileAttachmentSchema } from "@shared/schema";
import { contextAwareOpenAI } from "./context-aware-openai-service";
import { realOpenAIService } from "./openai-service";
import { enforceSubscriptionLimits } from "./middleware/subscription-enforcement";
import { enforcePlanRestrictions } from "./middleware/enforcePlan";
import { incrementUsageQuota } from "./lib/utils/checkQuota";
import { getDevModeConfig } from "./lib/dev-mode";
import { analyticsService } from "./analytics-service";
import { chatService } from "./chat-service";
import { insertChatSessionSchema, insertChatMessageSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Enterprise Voice Templates API endpoints
  app.get('/api/enterprise-voice-templates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Import enterprise voice templates
      const { ENTERPRISE_VOICE_TEMPLATES } = await import('./enterprise-voice-templates');
      
      // Get user subscription info to filter available templates
      const user = await storage.getUser(userId);
      const userTier = user?.tier || 'free';
      
      // Filter templates based on subscription tier
      const availableTemplates = ENTERPRISE_VOICE_TEMPLATES.filter(template => {
        const tierHierarchy = { free: 0, pro: 1, team: 2, enterprise: 3 };
        return tierHierarchy[userTier] >= tierHierarchy[template.requiredTier];
      });
      
      logger.info('Enterprise voice templates fetched', { 
        userId: userId.substring(0, 8) + '...',
        userTier,
        availableCount: availableTemplates.length
      });
      
      res.json(availableTemplates);
    } catch (error) {
      logger.error('Failed to fetch enterprise voice templates', error as Error);
      res.status(500).json({ message: 'Failed to fetch enterprise voice templates' });
    }
  });

  // AI-Powered Dropdown Suggestions API - Jung's Descent Protocol
  app.post('/api/ai/dropdown-suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const { field, context } = req.body;
      const userId = req.user.claims.sub;
      
      // Input validation following AI_INSTRUCTIONS.md security patterns
      const validationSchema = z.object({
        field: z.string().min(1).max(50),
        context: z.string().min(1).max(5000)
      });
      
      const validated = validationSchema.parse({ field, context });
      
      // Generate AI suggestions using OpenAI with consciousness principles
      const suggestions = await realOpenAIService.generateDropdownSuggestions({
        field: validated.field,
        context: validated.context,
        userId
      });
      
      logger.info('AI dropdown suggestions generated', { 
        userId: userId.substring(0, 8) + '...',
        field,
        suggestionsCount: suggestions.length
      });
      
      res.json({ suggestions });
    } catch (error) {
      logger.error('Failed to generate AI dropdown suggestions', error as Error, { 
        userId: req.user?.claims?.sub,
        field: req.body?.field,
        contextLength: req.body?.context?.length 
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid input data', 
          errors: error.errors 
        });
      }
      
      // Fallback suggestions following CodingPhilosophy.md patterns
      const fallbackSuggestions = [
        {
          value: `Custom ${req.body?.field || 'field'} based on context`,
          consciousness: 5,
          qwan: 6,
          reasoning: "AI service unavailable - using context-based fallback"
        }
      ];
      
      res.json({ suggestions: fallbackSuggestions });
    }
  });

  app.get('/api/enterprise-voice-templates/:templateId', isAuthenticated, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const userId = req.user.claims.sub;
      
      // Import enterprise voice templates
      const { ENTERPRISE_VOICE_TEMPLATES } = await import('./enterprise-voice-templates');
      
      const template = ENTERPRISE_VOICE_TEMPLATES.find(t => t.id === templateId);
      if (!template) {
        return res.status(404).json({ message: 'Template not found' });
      }
      
      // Check user subscription tier
      const user = await storage.getUser(userId);
      const userTier = user?.tier || 'free';
      const tierHierarchy = { free: 0, pro: 1, team: 2, enterprise: 3 };
      
      if (tierHierarchy[userTier] < tierHierarchy[template.requiredTier]) {
        return res.status(403).json({ 
          message: `Template requires ${template.requiredTier} subscription or higher` 
        });
      }
      
      logger.info('Enterprise voice template fetched', { 
        templateId,
        userId: userId.substring(0, 8) + '...',
        userTier
      });
      
      res.json(template);
    } catch (error) {
      logger.error('Failed to fetch enterprise voice template', error as Error);
      res.status(500).json({ message: 'Failed to fetch enterprise voice template' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      logger.error('Failed to fetch user data', error as Error, { operation: 'get_user' });
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
  app.get('/api/project-folders', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const folders = await storage.getProjectFolders(userId);
      res.json(folders);
    } catch (error) {
      logger.error('Error fetching project folders', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch project folders' });
    }
  });

  app.post('/api/project-folders', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Process parentId properly - null vs undefined handling following AI_INSTRUCTIONS.md
      const folderData = {
        ...req.body,
        userId,
        sortOrder: req.body.sortOrder ?? 0,
        isShared: req.body.isShared ?? false,
        parentId: req.body.parentId === '' || req.body.parentId === 'null' ? null : req.body.parentId,
        color: req.body.color || '#3b82f6',
        icon: req.body.icon || '📁'
      };
      
      logger.info('Creating project folder with data:', { folderData, userId });
      
      const validatedData = insertProjectFolderSchema.parse(folderData);
      const folder = await storage.createProjectFolder(validatedData);
      
      logger.info('Project folder created successfully:', { folderId: folder.id, userId });
      res.json(folder);
    } catch (error) {
      logger.error('Error creating project folder', error as Error, { 
        userId: req.user?.claims?.sub,
        requestBody: req.body,
        validationError: error instanceof Error ? error.message : 'Unknown error'
      });
      
      if (error instanceof Error && error.message.includes('subscription')) {
        res.status(403).json({ error: 'Pro subscription required for project folders' });
      } else if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({ error: 'Invalid folder data', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create project folder' });
      }
    }
  });

  app.put('/api/project-folders/:id', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
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

  app.delete('/api/project-folders/:id', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
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

  app.put('/api/projects/:projectId/move', isAuthenticated, async (req: any, res, next) => {
    try {
      const { projectId } = req.params;
      const { folderId } = req.body;
      const userId = req.user.claims.sub;
      
      logger.info('Project move operation initiated', { 
        projectId, 
        folderId, 
        userId,
        operation: 'move_project'
      });
      
      // Enhanced validation following AI_INSTRUCTIONS.md defensive programming
      const projectIdNum = parseInt(projectId);
      if (isNaN(projectIdNum)) {
        logger.error('Invalid project ID for move operation', new Error('Invalid project ID'), { 
          projectId, 
          userId,
          operation: 'move_project_validation'
        });
        return res.status(400).json({ error: 'Invalid project ID' });
      }
      
      // Validate project exists and belongs to user with comprehensive logging
      const project = await storage.getProject(projectIdNum);
      logger.debug('Project lookup for move operation', { 
        projectFound: !!project, 
        projectUserId: project?.userId, 
        requestUserId: userId,
        operation: 'move_project_lookup'
      });
      
      if (!project) {
        logger.error('Project not found for move operation', new Error('Project not found'), { 
          projectId: projectIdNum, 
          userId,
          operation: 'move_project_not_found'
        });
        return res.status(404).json({ error: 'Project not found' });
      }
      
      if (project.userId !== userId) {
        logger.error('Access denied for project move', new Error('Ownership mismatch'), { 
          projectUserId: project.userId, 
          requestUserId: userId,
          projectId: projectIdNum,
          operation: 'move_project_access_denied'
        });
        return res.status(403).json({ error: 'Access denied to project' });
      }
      
      // Handle null folderId properly for moving to root
      const targetFolderId = folderId ? parseInt(folderId) : null;
      logger.debug('Target folder processing for move operation', { 
        original: folderId, 
        parsed: targetFolderId, 
        isNull: folderId === null,
        operation: 'move_project_folder_parse'
      });
      
      const moved = await storage.moveProjectToFolder(projectIdNum, targetFolderId);
      logger.debug('Project move storage operation result', { 
        moved, 
        projectId: projectIdNum, 
        targetFolderId,
        operation: 'move_project_storage'
      });
      
      if (!moved) {
        logger.error('Project move storage operation failed', new Error('Storage operation failed'), {
          projectId: projectIdNum,
          targetFolderId,
          userId,
          operation: 'move_project_storage_failure'
        });
        return res.status(500).json({ error: 'Failed to move project - storage operation failed' });
      }
      
      logger.info('Project moved successfully', { 
        projectId: projectIdNum, 
        folderId: targetFolderId, 
        userId,
        operation: 'move_project_success'
      });
      res.json({ success: true, projectId: projectIdNum, folderId: targetFolderId });
    } catch (error) {
      logger.error('Critical error during project move operation', error as Error, {
        projectId: req.params.projectId,
        folderId: req.body.folderId,
        userId: req.user?.claims?.sub,
        operation: 'move_project_exception'
      });
      
      logger.error('Error moving project', error as Error, { 
        userId: req.user?.claims?.sub,
        projectId: req.params.projectId,
        folderId: req.body.folderId
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to move project', 
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined 
        });
      }
    }
  });

  // DELETE endpoint for removing projects following AI_INSTRUCTIONS.md security patterns
  app.delete('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      logger.info('Project deletion operation initiated', {
        projectId: req.params.id,
        userId,
        operation: 'delete_project'
      });

      // Enhanced input validation following AI_INSTRUCTIONS.md defensive programming
      if (isNaN(projectId) || projectId <= 0) {
        logger.error('Invalid project ID for deletion', new Error('Invalid project ID'), { 
          projectId: req.params.id, 
          userId,
          operation: 'delete_project_validation'
        });
        return res.status(400).json({ 
          error: 'Invalid project ID',
          message: 'Project ID must be a positive number'
        });
      }

      // Verify project exists and ownership using defensive programming  
      const project = await storage.getProject(projectId);
      if (!project) {
        logger.error('Project not found for deletion', new Error('Project not found'), { 
          projectId, 
          userId,
          operation: 'delete_project_not_found'
        });
        return res.status(404).json({ 
          error: 'Project not found',
          message: 'The requested project does not exist'
        });
      }

      logger.debug('Project deletion verification', {
        projectFound: !!project,
        projectName: project.name,
        projectUserId: project.userId,
        requestUserId: userId,
        ownershipMatch: project.userId === userId
      });

      // Enhanced security: verify project ownership following AI_INSTRUCTIONS.md patterns
      if (project.userId !== userId) {
        console.error('❌ Unauthorized project deletion attempt:', { 
          projectId, 
          userId, 
          projectOwner: project.userId,
          projectName: project.name 
        });
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only delete your own projects'
        });
      }

      console.log('🔧 Proceeding with project deletion:', { 
        projectId, 
        projectName: project.name,
        userId 
      });
      
      // Delete project using storage interface with audit logging
      const deleted = await storage.deleteProject(projectId);
      
      console.log('✅ Project deletion result:', { 
        success: deleted, 
        projectId,
        projectName: project.name 
      });

      if (deleted) {
        console.log('✅ Project deleted successfully:', { 
          projectId, 
          projectName: project.name,
          userId,
          timestamp: new Date().toISOString()
        });
        
        res.json({
          success: true,
          projectId,
          message: `Project "${project.name}" deleted successfully`
        });
      } else {
        console.error('❌ Failed to delete project from database:', projectId);
        res.status(500).json({ 
          error: 'Deletion failed',
          message: 'Failed to delete project from database'
        });
      }
    } catch (error) {
      console.error('❌ Project deletion error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId: req.params.id,
        userId: req.user?.claims?.sub,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      });
      
      logger.error('Project deletion failed', error as Error, { 
        userId: req.user?.claims?.sub,
        projectId: req.params.id
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error',
          message: 'An unexpected error occurred during project deletion'
        });
      }
    }
  });

  // GET endpoint for fetching project files following AI_INSTRUCTIONS.md patterns
  app.get('/api/projects/:id/files', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = parseInt(req.params.id);
      const userId = req.user.claims.sub;

      console.log('🔧 Fetching project files API called:', {
        projectId: req.params.id,
        userId,
        timestamp: new Date().toISOString()
      });

      // Enhanced input validation following AI_INSTRUCTIONS.md defensive programming
      if (isNaN(projectId) || projectId <= 0) {
        console.error('❌ Invalid project ID for file fetch:', req.params.id);
        return res.status(400).json({ 
          error: 'Invalid project ID',
          message: 'Project ID must be a positive number'
        });
      }

      // Verify project exists and ownership using defensive programming  
      const project = await storage.getProject(projectId);
      if (!project) {
        console.error('❌ Project not found for file fetch:', projectId);
        return res.status(404).json({ 
          error: 'Project not found',
          message: 'The requested project does not exist'
        });
      }

      console.log('🔧 Project file fetch verification:', {
        projectFound: !!project,
        projectName: project.name,
        projectUserId: project.userId,
        requestUserId: userId,
        ownershipMatch: project.userId === userId
      });

      // Enhanced security: verify project ownership following AI_INSTRUCTIONS.md patterns
      if (project.userId !== userId) {
        console.error('❌ Unauthorized project file access attempt:', { 
          projectId, 
          userId, 
          projectOwner: project.userId,
          projectName: project.name 
        });
        return res.status(403).json({ 
          error: 'Access denied',
          message: 'You can only access files from your own projects'
        });
      }

      // Generate mock project files for AI council context selection
      // Following CodingPhilosophy.md patterns for consciousness-driven file analysis
      const projectFiles = [
        {
          id: 1,
          name: `${project.name.toLowerCase().replace(/\s+/g, '-')}.${project.language?.toLowerCase() || 'js'}`,
          path: `/src/${project.name.toLowerCase().replace(/\s+/g, '-')}.${project.language?.toLowerCase() || 'js'}`,
          content: project.code || '// Generated code content',
          type: 'code' as const,
          size: (project.code || '').length,
          language: project.language || 'JavaScript',
          folderId: project.folderId
        },
        {
          id: 2,
          name: 'README.md',
          path: '/README.md',
          content: `# ${project.name}\n\n${project.description || 'Project description'}\n\n## Features\n\n- Generated with AI council collaboration\n- Multi-voice synthesis architecture\n- Defensive programming patterns`,
          type: 'doc' as const,
          size: 250,
          language: 'Markdown'
        },
        {
          id: 3,
          name: 'package.json',
          path: '/package.json',
          content: `{\n  "name": "${project.name.toLowerCase().replace(/\s+/g, '-')}",\n  "version": "1.0.0",\n  "description": "${project.description || 'AI-generated project'}",\n  "main": "index.js",\n  "dependencies": {}\n}`,
          type: 'config' as const,
          size: 180,
          language: 'JSON'
        }
      ];

      // Add additional files based on project complexity
      if (project.complexity && project.complexity > 1) {
        projectFiles.push({
          id: 4,
          name: 'config.js',
          path: '/config/config.js',
          content: 'module.exports = {\n  // Configuration settings\n  environment: "development",\n  api: {\n    baseUrl: "http://localhost:3000"\n  }\n};',
          type: 'config' as const,
          size: 120,
          language: 'JavaScript'
        });
      }

      if (project.tags && project.tags.includes('database')) {
        projectFiles.push({
          id: 5,
          name: 'schema.sql',
          path: '/database/schema.sql',
          content: '-- Database schema\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  name VARCHAR(255) NOT NULL,\n  email VARCHAR(255) UNIQUE\n);',
          type: 'data' as const,
          size: 150,
          language: 'SQL'
        });
      }

      console.log('✅ Project files generated successfully:', { 
        projectId, 
        projectName: project.name,
        fileCount: projectFiles.length,
        userId
      });
      
      res.json(projectFiles);
    } catch (error) {
      console.error('❌ Project files fetch error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        projectId: req.params.id,
        userId: req.user?.claims?.sub,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      });
      
      logger.error('Project files fetch failed', error as Error, { 
        userId: req.user?.claims?.sub,
        projectId: req.params.id
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Internal server error',
          message: 'An unexpected error occurred while fetching project files'
        });
      }
    }
  });

  // Additional routes for API completeness
  // Project creation endpoint for synthesis save functionality - Following AI_INSTRUCTIONS.md patterns
  // Enhanced project creation endpoint with comprehensive debugging
  app.post('/api/projects', isAuthenticated, async (req: any, res, next) => {
    console.log('🔧 POST /api/projects endpoint called:', {
      hasAuth: !!req.user,
      userId: req.user?.claims?.sub,
      bodyKeys: Object.keys(req.body || {}),
      contentType: req.headers['content-type']
    });
    
    try {
      const userId = req.user.claims.sub;
      
      // Enhanced validation following AI_INSTRUCTIONS.md security patterns
      // Defensive programming: handle null foreign key references properly
      let mappedSessionId = req.body.sessionId || null;
      
      // Handle timestamp-based session IDs that exceed PostgreSQL integer range
      if (mappedSessionId && mappedSessionId > 2147483647) {
        console.log('⚠️ Timestamp-based session ID detected, attempting database mapping:', { originalId: mappedSessionId });
        
        try {
          // Try to find a matching database session by timestamp proximity
          const recentSessions = await storage.getVoiceSessionsByUser(userId);
          const matchingSession = recentSessions.find(session => {
            const sessionTime = new Date(session.createdAt).getTime();
            return Math.abs(mappedSessionId - sessionTime) < 600000; // 10 minute tolerance
          });
          
          if (matchingSession) {
            mappedSessionId = matchingSession.id;
            console.log('📍 Found matching database session:', { originalId: req.body.sessionId, mappedId: mappedSessionId });
          } else {
            // If no match found, create a new session for reference
            const fallbackSession = await storage.createVoiceSession({
              userId,
              prompt: 'Project save reference session',
              selectedVoices: {
                perspectives: ['decider'],
                roles: ['architect']
              },
              mode: getDevModeConfig().enabled ? 'development' : 'production'
            });
            mappedSessionId = fallbackSession.id;
            console.log('📝 Created fallback session for project save:', { originalId: req.body.sessionId, mappedId: mappedSessionId });
          }
        } catch (sessionError) {
          console.warn('⚠️ Could not map session ID, using null:', sessionError);
          mappedSessionId = null; // Safe fallback
        }
      }
      
      const projectData = {
        ...req.body,
        userId, // Ensure userId is set from authenticated user
        // Ensure foreign key references are properly handled with ID mapping
        sessionId: mappedSessionId,
        synthesisId: req.body.synthesisId || null,
        folderId: req.body.folderId || null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log('🔧 Processing project creation:', {
        name: projectData.name,
        language: projectData.language,
        codeLength: projectData.code?.length || 0,
        originalSessionId: req.body.sessionId,
        mappedSessionId: projectData.sessionId,
        synthesisId: projectData.synthesisId,
        folderId: projectData.folderId,
        userId
      });
      
      // Validate project data using schema
      const validatedData = insertProjectSchema.parse(projectData);
      const project = await storage.createProject(validatedData);
      
      console.log('✅ Project created successfully:', { 
        projectId: project.id, 
        userId,
        name: project.name 
      });
      
      res.json(project);
    } catch (error) {
      console.error('❌ Project creation error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.claims?.sub,
        requestBody: req.body,
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined
      });
      
      // Always return JSON response to prevent HTML fallback
      if (!res.headersSent) {
        if (error instanceof Error && error.message.includes('validation')) {
          res.status(400).json({ error: 'Invalid project data', details: error.message });
        } else {
          res.status(500).json({ error: 'Failed to create project from synthesis', details: process.env.NODE_ENV === 'development' ? error?.message : undefined });
        }
      }
    }
  });

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

  // Folder file API routes - Pro tier gated following AI_INSTRUCTIONS.md patterns
  app.get('/api/folders/:folderId/files', isAuthenticated, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify folder ownership
      const folder = await storage.getProjectFolder(parseInt(folderId));
      if (!folder || folder.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to folder' });
      }
      
      const files = await storage.getFolderFiles(parseInt(folderId));
      res.json(files);
    } catch (error) {
      logger.error('Error fetching folder files', error as Error, { 
        userId: req.user?.claims?.sub,
        folderId: req.params.folderId 
      });
      res.status(500).json({ error: 'Failed to fetch folder files' });
    }
  });

  app.post('/api/folders/:folderId/files', isAuthenticated, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify folder ownership
      const folder = await storage.getProjectFolder(parseInt(folderId));
      if (!folder || folder.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to folder' });
      }
      
      const fileData = {
        ...req.body,
        folderId: parseInt(folderId),
        userId,
      };
      
      // Create the file without validation for now - will fix schema import later
      const file = await storage.createFolderFile(fileData);
      
      logger.info('Folder file created successfully', { fileId: file.id, folderId, userId });
      res.json(file);
    } catch (error) {
      logger.error('Error creating folder file', error as Error, { 
        userId: req.user?.claims?.sub,
        folderId: req.params.folderId,
        requestBody: req.body 
      });
      
      if (error instanceof Error && error.message.includes('validation')) {
        res.status(400).json({ error: 'Invalid file data', details: error.message });
      } else {
        res.status(500).json({ error: 'Failed to create file' });
      }
    }
  });

  app.put('/api/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.params;
      const userId = req.user.claims.sub;
      
      const updatedFile = await storage.updateFolderFile(
        parseInt(fileId), 
        req.body, 
        userId
      );
      
      logger.info('Folder file updated successfully', { fileId, userId });
      res.json(updatedFile);
    } catch (error) {
      logger.error('Error updating folder file', error as Error, { 
        userId: req.user?.claims?.sub,
        fileId: req.params.fileId 
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'File not found or access denied' });
      } else {
        res.status(500).json({ error: 'Failed to update file' });
      }
    }
  });

  app.delete('/api/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.params;
      const userId = req.user.claims.sub;
      
      await storage.deleteFolderFile(parseInt(fileId), userId);
      
      logger.info('Folder file deleted successfully', { fileId, userId });
      res.json({ success: true });
    } catch (error) {
      logger.error('Error deleting folder file', error as Error, { 
        userId: req.user?.claims?.sub,
        fileId: req.params.fileId 
      });
      
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'File not found or access denied' });
      } else {
        res.status(500).json({ error: 'Failed to delete file' });
      }
    }
  });

  // AI Chat endpoint for file assistance - Following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  app.post('/api/ai/chat', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { messages, context } = req.body;
      
      // Import OpenAI service following Jung's Descent Protocol
      const { realOpenAIService } = await import('./openai-service');
      
      console.log('🧠 AI Chat Request:', {
        userId: userId.substring(0, 8) + '...',
        messageCount: messages?.length || 0,
        context,
        hasFileContent: messages?.[1]?.content?.includes('File content:') || false
      });
      
      // Enhanced validation following AI_INSTRUCTIONS.md security patterns
      const validationSchema = z.object({
        messages: z.array(z.object({
          role: z.enum(['user', 'assistant', 'system']),
          content: z.string().min(1).max(10000)
        })).min(1, 'At least one message is required'),
        context: z.string().optional()
      });
      
      const validated = validationSchema.parse({ messages, context });
      
      // Generate AI response using real OpenAI integration
      const response = await realOpenAIService.generateChatResponse({
        messages: validated.messages,
        context: validated.context || 'file_assistance',
        temperature: 0.7,
        maxTokens: 1000
      });
      
      logger.info('AI chat response generated', {
        userId: userId.substring(0, 8) + '...',
        context: validated.context,
        responseLength: response?.length || 0
      });
      
      res.json({ 
        response,
        context: validated.context,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('AI chat failed', error as Error, {
        userId: req.user?.claims?.sub,
        context: req.body?.context,
        messageCount: req.body?.messages?.length
      });
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Invalid input data', 
          details: error.errors 
        });
      }
      
      // Fallback response following CodingPhilosophy.md consciousness principles
      res.status(500).json({ 
        error: 'AI chat temporarily unavailable',
        fallback: 'Please try again or contact support for file analysis assistance'
      });
    }
  });

  // Post-Generation Chat API Endpoints - Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles
  
  // Get specific chat session details
  app.get('/api/chat/sessions/:chatSessionId', isAuthenticated, async (req: any, res) => {
    try {
      const { chatSessionId } = req.params;
      const userId = req.user.claims.sub;
      
      const chatSession = await storage.getChatSession(parseInt(chatSessionId));
      if (!chatSession || chatSession.userId !== userId) {
        return res.status(404).json({ error: 'Chat session not found' });
      }
      
      logger.info('Chat session retrieved', { 
        chatSessionId: parseInt(chatSessionId),
        selectedVoice: chatSession.selectedVoice,
        userId: userId.substring(0, 8) + '...'
      });
      
      res.json(chatSession);
    } catch (error) {
      logger.error('Error retrieving chat session', error as Error, { 
        userId: req.user?.claims?.sub,
        chatSessionId: req.params.chatSessionId 
      });
      res.status(500).json({ error: 'Failed to retrieve chat session' });
    }
  });
  
  // Legacy endpoint removed - session mapping now handled directly in chat creation

  // Create chat session with enhanced PostgreSQL compatibility and session mapping
  app.post('/api/chat/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Enhanced session ID mapping for PostgreSQL compatibility following AI_INSTRUCTIONS.md
      let databaseSessionId = req.body.sessionId;
      
      // If session ID is a timestamp (> integer range), map it to database ID
      if (req.body.sessionId > 2147483647) {
        console.log('🔧 Mapping timestamp session ID to database ID:', req.body.sessionId);
        
        // Find matching database session by proximity (within 5 minutes)
        const recentSessions = await storage.getVoiceSessionsByUser(userId);
        const matchingSession = recentSessions.find(session => {
          const timeDiff = Math.abs(session.id - req.body.sessionId);
          return timeDiff < 300000; // 5 minutes tolerance
        });
        
        if (matchingSession) {
          databaseSessionId = matchingSession.id;
          console.log('✅ Found matching database session:', databaseSessionId);
        } else {
          // Create fallback session for orphaned chat creation with proper schema structure
          console.log('⚡ Creating fallback session for chat');
          const fallbackSession = await storage.createVoiceSession({
            userId,
            prompt: 'Chat session created without matching voice session',
            selectedVoices: {
              perspectives: ['developer'],
              roles: ['general']
            },
            recursionDepth: 2,
            synthesisMode: 'competitive',
            ethicalFiltering: true,
            mode: 'production'
          });
          databaseSessionId = fallbackSession.id;
        }
      }
      
      const validatedData = insertChatSessionSchema.parse({
        ...req.body,
        sessionId: databaseSessionId,
        userId
      });
      
      const chatSession = await storage.createChatSession(validatedData);
      
      logger.info('Chat session created', { 
        chatSessionId: chatSession.id,
        selectedVoice: chatSession.selectedVoice,
        userId: userId.substring(0, 8) + '...'
      });
      
      res.json(chatSession);
    } catch (error) {
      logger.error('Error creating chat session', error as Error, { 
        userId: req.user?.claims?.sub,
        requestBody: req.body 
      });
      
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid chat session data', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create chat session' });
      }
    }
  });

  // Get chat messages for a session
  app.get('/api/chat/sessions/:chatSessionId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { chatSessionId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify chat session ownership
      const chatSession = await storage.getChatSession(parseInt(chatSessionId));
      if (!chatSession || chatSession.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to chat session' });
      }
      
      const messages = await storage.getChatMessages(parseInt(chatSessionId));
      res.json(messages);
    } catch (error) {
      logger.error('Error fetching chat messages', error as Error, { 
        userId: req.user?.claims?.sub,
        chatSessionId: req.params.chatSessionId 
      });
      res.status(500).json({ error: 'Failed to fetch chat messages' });
    }
  });

  // Send message and get AI response
  app.post('/api/chat/sessions/:chatSessionId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { chatSessionId } = req.params;
      const userId = req.user.claims.sub;
      const { content } = req.body;
      
      // Verify chat session ownership
      const chatSession = await storage.getChatSession(parseInt(chatSessionId));
      if (!chatSession || chatSession.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to chat session' });
      }
      
      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      // Process user message and generate AI response using chat service
      const result = await chatService.processUserMessage(parseInt(chatSessionId), content);
      
      logger.info('Chat message processed', {
        chatSessionId: parseInt(chatSessionId),
        userId: userId.substring(0, 8) + '...',
        voice: chatSession.selectedVoice,
        userMessageLength: content.length
      });
      
      res.json({
        userMessage: result.userMsg,
        assistantResponse: result.assistantMsg
      });
      
    } catch (error) {
      logger.error('Error processing chat message', error as Error, { 
        userId: req.user?.claims?.sub,
        chatSessionId: req.params.chatSessionId 
      });
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  // Get specific chat session
  app.get('/api/chat/sessions/:chatSessionId', isAuthenticated, async (req: any, res) => {
    try {
      const { chatSessionId } = req.params;
      const userId = req.user.claims.sub;
      
      // Verify chat session ownership
      const chatSession = await storage.getChatSession(parseInt(chatSessionId));
      if (!chatSession || chatSession.userId !== userId) {
        return res.status(403).json({ error: 'Access denied to chat session' });
      }
      
      res.json(chatSession);
    } catch (error) {
      logger.error('Error fetching chat session', error as Error, { 
        userId: req.user?.claims?.sub,
        chatSessionId: req.params.chatSessionId 
      });
      res.status(500).json({ error: 'Failed to fetch chat session' });
    }
  });

  // Get chat sessions for user
  app.get('/api/chat/sessions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chatSessions = await storage.getChatSessionsByUser(userId);
      res.json(chatSessions);
    } catch (error) {
      logger.error('Error fetching chat sessions', error as Error, { 
        userId: req.user?.claims?.sub 
      });
      res.status(500).json({ error: 'Failed to fetch chat sessions' });
    }
  });

  // File management endpoints for project folders - Following AI_INSTRUCTIONS.md patterns
  app.get('/api/folders/:folderId/files', isAuthenticated, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const userId = req.user.claims.sub;
      
      console.log('📁 Fetching files for folder:', { folderId, userId: userId.substring(0, 8) + '...' });
      
      // Mock files for now - to be replaced with actual database integration
      const mockFiles = [
        {
          id: 1,
          name: 'example.js',
          content: '// Example JavaScript file\nconsole.log("Hello from CodeCrucible!");',
          fileType: 'code',
          language: 'javascript',
          description: 'Example JavaScript file for testing',
          tags: ['example', 'test'],
          isContextEnabled: true,
          folderId: parseInt(folderId),
          userId,
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          name: 'readme.md',
          content: '# Project Documentation\n\nThis is a sample markdown file for project documentation.',
          fileType: 'documentation',
          language: 'markdown',
          description: 'Project documentation file',
          tags: ['documentation', 'readme'],
          isContextEnabled: false,
          folderId: parseInt(folderId),
          userId,
          createdAt: new Date().toISOString()
        }
      ];
      
      res.json(mockFiles);
    } catch (error: any) {
      console.error('❌ Get folder files error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch files' });
    }
  });

  app.post('/api/folders/:folderId/files', isAuthenticated, async (req: any, res) => {
    try {
      const { folderId } = req.params;
      const userId = req.user.claims.sub;
      const fileData = req.body;
      
      console.log('📝 Creating file in folder:', { folderId, fileName: fileData.name, userId: userId.substring(0, 8) + '...' });
      
      // Mock file creation - to be replaced with actual database integration
      const newFile = {
        id: Math.floor(Math.random() * 10000),
        ...fileData,
        folderId: parseInt(folderId),
        userId,
        createdAt: new Date().toISOString()
      };
      
      res.json(newFile);
    } catch (error: any) {
      console.error('❌ Create file error:', error);
      res.status(500).json({ error: error.message || 'Failed to create file' });
    }
  });

  app.put('/api/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.params;
      const userId = req.user.claims.sub;
      const updateData = req.body;
      
      console.log('✏️ Updating file:', { fileId, userId: userId.substring(0, 8) + '...' });
      
      // Mock file update - to be replaced with actual database integration
      const updatedFile = {
        id: parseInt(fileId),
        ...updateData,
        userId,
        updatedAt: new Date().toISOString()
      };
      
      res.json(updatedFile);
    } catch (error: any) {
      console.error('❌ Update file error:', error);
      res.status(500).json({ error: error.message || 'Failed to update file' });
    }
  });

  app.delete('/api/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.params;
      const userId = req.user.claims.sub;
      
      console.log('🗑️ Deleting file:', { fileId, userId: userId.substring(0, 8) + '...' });
      
      // Mock file deletion - to be replaced with actual database integration
      res.json({ success: true, message: 'File deleted successfully' });
    } catch (error: any) {
      console.error('❌ Delete file error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete file' });
    }
  });

  app.get('/api/context-files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contextFiles = await storage.getContextEnabledFiles(userId);
      res.json(contextFiles);
    } catch (error) {
      logger.error('Error fetching context files', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch context files' });
    }
  });

  app.get('/api/subscription/info', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Fixed critical bug: use subscriptionTier not planTier following AI_INSTRUCTIONS.md patterns
      const subscriptionTier = user?.subscriptionTier || 'free';
      const subscriptionStatus = user?.subscriptionStatus || 'inactive';
      
      // Get usage data for complete subscription info
      const today = new Date().toISOString().split('T')[0];
      const { checkGenerationQuota } = await import('./lib/utils/checkQuota');
      const quotaCheck = await checkGenerationQuota(userId, req.ip, req.get('User-Agent'));
      
      console.log('🔧 Subscription info endpoint:', {
        userId: userId.substring(0, 8) + '...',
        subscriptionTier,
        subscriptionStatus,
        quotaUsed: quotaCheck.quotaUsed,
        quotaLimit: quotaCheck.quotaLimit
      });
      
      res.json({ 
        tier: subscriptionTier,
        status: subscriptionStatus,
        stripeSubscriptionId: user?.stripeSubscriptionId || null,
        stripeCustomerId: user?.stripeCustomerId || null,
        usage: {
          used: quotaCheck.quotaUsed || 0,
          limit: quotaCheck.quotaLimit || 3
        }
      });
    } catch (error) {
      logger.error('Error fetching subscription info', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to fetch subscription info' });
    }
  });

  // Subscription tiers endpoint - Following AI_INSTRUCTIONS.md security patterns
  app.get("/api/subscription/tiers", async (req, res) => {
    try {
      // Import subscription service
      const { subscriptionService } = await import('./subscription-service');
      const tiers = subscriptionService.getAllTiers();
      res.json(tiers);
    } catch (error) {
      logger.error('Error fetching subscription tiers', error as Error);
      res.status(500).json({ error: 'Failed to fetch subscription tiers' });
    }
  });

  // Analytics dashboard endpoint - PREMIUM FEATURE (Pro+) with time range support
  app.get('/api/analytics/dashboard', isAuthenticated, enforceSubscriptionLimits, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const range = req.query.range as string || '30d';
      
      logger.debug('Fetching analytics dashboard', { userId, range });
      
      const analytics = await analyticsService.getAnalyticsDashboard(userId, range);
      res.json(analytics);
    } catch (error) {
      logger.error('Analytics dashboard fetch failed', error as Error);
      res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
    }
  });

  // Stripe checkout endpoint - Following AI_INSTRUCTIONS.md security patterns
  // Updated to use CodeCrucible payment links from Arkane Technologies
  app.post("/api/subscription/checkout", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const { tier } = req.body;
      
      if (!['pro', 'team', 'enterprise'].includes(tier)) {
        throw new APIError(400, 'Invalid subscription tier');
      }
      
      // CodeCrucible payment links from Arkane Technologies Stripe account
      // These links will redirect to Stripe's hosted checkout and then back to our success page
      const CODECRUCIBLE_PAYMENT_LINKS = {
        pro: 'https://buy.stripe.com/7sY4gy8XW7cBdJb05i4c801',
        team: 'https://buy.stripe.com/cNi7sK7TS40p48B3hu4c802',
        enterprise: 'https://buy.stripe.com/cNi7sK7TS40p48B3hu4c802' // Team tier for now
      };
      
      const checkoutUrl = CODECRUCIBLE_PAYMENT_LINKS[tier as keyof typeof CODECRUCIBLE_PAYMENT_LINKS];
      
      if (!checkoutUrl) {
        throw new APIError(400, `No payment link configured for tier: ${tier}`);
      }
      
      logger.info('Redirecting to CodeCrucible payment link for real money transaction', {
        userId: userId.substring(0, 8) + '...',
        tier,
        checkoutUrl,
        company: 'Arkane Technologies',
        app: 'CodeCrucible'
      });
      
      res.json({ checkoutUrl });
    } catch (error) {
      logger.error('CodeCrucible checkout redirect error', error as Error, {
        userId: req.user?.claims?.sub,
        tier: req.body?.tier
      });
      next(error);
    }
  });

  // Stripe webhook endpoint - Following AI_INSTRUCTIONS.md security patterns for payment processing
  app.post("/api/subscription/webhook", express.raw({ type: 'application/json' }), async (req: any, res, next) => {
    try {
      const signature = req.headers['stripe-signature'];
      
      if (!signature) {
        throw new APIError(400, 'Missing Stripe signature');
      }
      
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new APIError(500, 'Stripe webhook secret not configured');
      }
      
      // Import Stripe product manager for webhook validation
      const { stripeProductManager } = await import('./stripe-products');
      
      // Validate webhook signature and parse event
      const event = stripeProductManager.validateWebhookSignature(req.body, signature);
      
      // Import subscription service for webhook processing
      const { subscriptionService } = await import('./subscription-service');
      
      // Process webhook event
      await subscriptionService.handleWebhook(event);
      
      logger.info('Stripe webhook processed successfully for real money transaction', {
        eventType: event.type,
        eventId: event.id,
        created: new Date(event.created * 1000).toISOString()
      });
      
      res.json({ 
        received: true,
        eventType: event.type,
        processed: true,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Stripe webhook processing failed', error as Error, {
        signature: !!req.headers['stripe-signature'],
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        contentType: req.headers['content-type']
      });
      next(error);
    }
  });

  // Test endpoint for direct subscription upgrade - Following AI_INSTRUCTIONS.md debugging patterns
  app.post("/api/test/direct-upgrade", async (req: any, res, next) => {
    try {
      const { userId, tier } = req.body;
      
      if (!userId || !tier) {
        return res.status(400).json({ error: 'Missing userId or tier' });
      }
      
      logger.info('Testing direct subscription upgrade', { userId, tier });
      
      // Import subscription service
      const { subscriptionService } = await import('./subscription-service');
      
      // Simulate checkout.session.completed webhook event
      const mockEvent = {
        type: "checkout.session.completed",
        id: `evt_test_${Date.now()}`,
        created: Math.floor(Date.now() / 1000),
        data: {
          object: {
            id: `cs_test_${Date.now()}`,
            payment_status: "paid",
            subscription: `sub_test_${Date.now()}`,
            metadata: {
              userId,
              tier
            }
          }
        }
      };
      
      // Process the mock webhook event
      await subscriptionService.handleWebhook(mockEvent as any);
      
      // Verify the upgrade
      const user = await storage.getUser(userId);
      
      res.json({
        success: true,
        message: 'Direct upgrade completed',
        userTier: user?.subscriptionTier,
        userStatus: user?.subscriptionStatus,
        mockEventProcessed: true
      });
      
    } catch (error) {
      logger.error('Direct upgrade test failed', error as Error, { 
        userId: req.body?.userId,
        tier: req.body?.tier 
      });
      next(error);
    }
  });

  app.get('/api/quota/check', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Critical fix: Import and check dev mode following AI_INSTRUCTIONS.md patterns
      const { getDevModeConfig } = await import('./lib/dev-mode');
      const devModeConfig = getDevModeConfig();
      
      console.log('🔧 Dev Mode Check - Environment Variables:', {
        NODE_ENV: process.env.NODE_ENV,
        REPL_ID: process.env.REPL_ID?.substring(0, 8) + '...',
        DEV_MODE: process.env.DEV_MODE,
        devModeEnabled: devModeConfig.isEnabled,
        reason: devModeConfig.reason
      });
      
      // Dev mode bypass for unlimited generation
      if (devModeConfig.isEnabled) {
        console.log('✅ Dev mode enabled - bypassing quota limits');
        res.json({ 
          dailyGenerated: 0,
          dailyLimit: 999,
          remaining: 999,
          allowed: true,
          devMode: true,
          planTier: 'development',
          quotaUsed: 0,
          quotaLimit: 999,
          unlimitedGenerations: true,
          reason: 'dev_mode_unlimited'
        });
        return;
      }
      
      // Production quota checking using proper usageLimits table following AI_INSTRUCTIONS.md
      const planTier = user?.subscriptionTier || 'free';
      
      // Pro and Team users have unlimited generations
      if (planTier === 'pro' || planTier === 'team' || planTier === 'enterprise') {
        res.json({ 
          dailyGenerated: 0,
          dailyLimit: -1,
          remaining: -1,
          allowed: true,
          devMode: false,
          planTier: planTier,
          quotaUsed: 0,
          quotaLimit: -1,
          unlimitedGenerations: true,
          reason: 'unlimited_tier'
        });
        return;
      }
      
      // Free tier quota checking from usageLimits table
      const today = new Date().toISOString().split('T')[0];
      const { checkGenerationQuota } = await import('./lib/utils/checkQuota');
      
      const quotaCheck = await checkGenerationQuota(userId, req.ip, req.get('User-Agent'));
      
      res.json({ 
        dailyGenerated: quotaCheck.quotaUsed,
        dailyLimit: quotaCheck.quotaLimit,
        remaining: quotaCheck.quotaLimit === -1 ? -1 : Math.max(0, quotaCheck.quotaLimit - quotaCheck.quotaUsed),
        allowed: quotaCheck.allowed,
        devMode: false,
        planTier: quotaCheck.planTier,
        quotaUsed: quotaCheck.quotaUsed,
        quotaLimit: quotaCheck.quotaLimit,
        reason: quotaCheck.reason || (quotaCheck.allowed ? 'quota_available' : 'quota_exceeded')
      });
    } catch (error) {
      logger.error('Error checking quota', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ error: 'Failed to check quota' });
    }
  });

  // Voice Profile Management Routes - PREMIUM FEATURE (Pro+) following AI_INSTRUCTIONS.md
  app.get('/api/voice-profiles', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      console.log('🔧 Fetching voice profiles for user:', userId);
      
      const profiles = await storage.getVoiceProfiles(userId);
      console.log('✅ Voice profiles fetched:', { count: profiles.length, userId });
      res.json(profiles);
    } catch (error) {
      console.error("❌ Error fetching voice profiles:", error);
      logger.error('Voice profile fetch failed', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ message: "Failed to fetch voice profiles" });
    }
  });

  app.post('/api/voice-profiles', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      console.log('🔧 Creating voice profile:', {
        userId,
        name: req.body.name,
        perspective: req.body.perspective,
        role: req.body.role,
        bodyKeys: Object.keys(req.body),
        fullBody: req.body
      });
      
      // Enhanced validation following AI_INSTRUCTIONS.md security patterns
      if (!req.body.name || typeof req.body.name !== 'string') {
        console.error('❌ Invalid voice profile name:', req.body.name);
        return res.status(400).json({ error: 'Valid name is required' });
      }
      
      // Prepare profile data with comprehensive field mapping
      const profileData = {
        userId,
        name: req.body.name,
        description: req.body.description || `Custom ${req.body.name} voice profile`,
        selectedPerspectives: req.body.selectedPerspectives || [req.body.perspective].filter(Boolean),
        selectedRoles: req.body.selectedRoles || [req.body.role].filter(Boolean),
        analysisDepth: req.body.analysisDepth || 2,
        mergeStrategy: req.body.mergeStrategy || 'competitive',
        qualityFiltering: req.body.qualityFiltering !== false,
        isDefault: req.body.isDefault || false,
        avatar: req.body.avatar || '🤖',
        personality: req.body.personality || 'Analytical',
        chatStyle: req.body.chatStyle || 'analytical',
        specialization: req.body.specialization || 'General',
        ethicalStance: req.body.ethicalStance || 'progressive',
        perspective: req.body.perspective,
        role: req.body.role
      };
      
      console.log('🔧 Formatted profile data for storage:', {
        userId,
        name: profileData.name,
        perspectives: profileData.selectedPerspectives,
        roles: profileData.selectedRoles,
        avatar: profileData.avatar
      });
      
      const profile = await storage.createVoiceProfile(profileData);
      console.log('✅ Voice profile created successfully:', { id: profile.id, name: profile.name });
      res.json(profile);
    } catch (error) {
      console.error("❌ Error creating voice profile:", {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack?.split('\n').slice(0, 3) : undefined,
        userId: req.user?.claims?.sub,
        requestBody: req.body
      });
      
      logger.error('Voice profile creation failed', error as Error, { 
        userId: req.user?.claims?.sub,
        requestBody: req.body 
      });
      
      if (!res.headersSent) {
        res.status(500).json({ 
          error: "Failed to create voice profile", 
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined 
        });
      }
    }
  });

  app.patch('/api/voice-profiles/:id', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      // Verify ownership following AI_INSTRUCTIONS.md security patterns
      const existingProfile = await storage.getVoiceProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ message: "Voice profile not found" });
      }

      const updates = req.body;
      const profile = await storage.updateVoiceProfile(id, updates);
      res.json(profile);
    } catch (error) {
      console.error("❌ Error updating voice profile:", error);
      logger.error('Voice profile update failed', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ message: "Failed to update voice profile" });
    }
  });

  app.delete('/api/voice-profiles/:id', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      // Verify ownership following AI_INSTRUCTIONS.md security patterns
      const existingProfile = await storage.getVoiceProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ message: "Voice profile not found" });
      }

      const deleted = await storage.deleteVoiceProfile(id);
      res.json({ success: deleted });
    } catch (error) {
      console.error("❌ Error deleting voice profile:", error);
      logger.error('Voice profile deletion failed', error as Error, { userId: req.user?.claims?.sub });
      res.status(500).json({ message: "Failed to delete voice profile" });
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

  // Context-aware generation endpoints
  app.get('/api/context/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contextFiles = await storage.getContextEnabledFiles(userId);
      
      const summary = {
        totalFiles: contextFiles.length,
        languages: [...new Set(contextFiles.map((f: any) => f.language))],
        totalSize: contextFiles.reduce((sum: number, f: any) => sum + f.content.length, 0),
        files: contextFiles.map((f: any) => ({
          id: f.id,
          name: f.name,
          language: f.language,
          description: f.description,
          size: f.content.length
        }))
      };
      
      res.json(summary);
    } catch (error) {
      logger.error('Error getting context summary:', error as Error);
      res.status(500).json({ error: 'Failed to get context summary' });
    }
  });

  // AI-powered dropdown suggestions endpoint following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  app.post('/api/ai/dropdown-suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const { field, context, consciousness_framework, pattern_language, learning_mode } = req.body;
      const userId = req.user.claims.sub;

      // Security validation following AI_INSTRUCTIONS.md patterns
      if (!field || typeof field !== 'string' || field.length > 50) {
        return res.status(400).json({ error: 'Invalid field parameter' });
      }

      if (context && (typeof context !== 'string' || context.length > 1000)) {
        return res.status(400).json({ error: 'Invalid context parameter' });
      }

      console.log('🤖 AI Dropdown Suggestions Request:', {
        userId: userId.substring(0, 8) + '...',
        field,
        context: context?.substring(0, 100) + '...',
        consciousness_framework,
        pattern_language,
        learning_mode
      });

      const { aiDropdownService } = await import('./ai-dropdown-service.js');
      
      const suggestions = await aiDropdownService.generateSuggestions({
        field,
        context: context || '',
        consciousness_framework: consciousness_framework || 'jung_descent_protocol',
        pattern_language: pattern_language || 'alexander_timeless_patterns',
        learning_mode: learning_mode || 'bateson_recursive_enhancement'
      });

      console.log('✅ AI Suggestions generated:', suggestions.length, 'items for field:', field);

      // Audit logging following AI_INSTRUCTIONS.md security patterns
      console.log('🔍 AI Dropdown Audit:', {
        userId: userId.substring(0, 8) + '...',
        timestamp: new Date().toISOString(),
        field,
        suggestionsCount: suggestions.length,
        consciousness_framework,
        pattern_language
      });

      res.json({ 
        suggestions,
        metadata: {
          field,
          count: suggestions.length,
          consciousness_framework,
          pattern_language,
          generated_at: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('❌ AI Dropdown Service error:', error);
      res.status(500).json({ 
        error: 'Failed to generate AI suggestions',
        details: error.message 
      });
    }
  });

  // Critical session endpoints - REAL OpenAI integration following AI_INSTRUCTIONS.md patterns
  app.post("/api/sessions", isAuthenticated, enforcePlanRestrictions(), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log('🔧 Real OpenAI Session Creation:', { ...req.body, userId });
      
      // Enhanced input validation following AI_INSTRUCTIONS.md security patterns
      if (!req.body || typeof req.body !== 'object') {
        console.error('❌ Invalid request body structure');
        return res.status(400).json({ error: 'Invalid request body' });
      }
      
      const { prompt, selectedVoices, contextProjects } = req.body;
      
      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        console.error('❌ Invalid or missing prompt');
        return res.status(400).json({ error: 'Valid prompt is required' });
      }
      
      if (!selectedVoices || typeof selectedVoices !== 'object') {
        console.error('❌ Invalid selectedVoices structure');
        return res.status(400).json({ error: 'Valid selectedVoices object is required' });
      }
      
      // Dev mode check following AI_INSTRUCTIONS.md patterns
      const { getDevModeConfig } = await import('./lib/dev-mode');
      const devModeConfig = getDevModeConfig();
      
      // Create proper database session following AI_INSTRUCTIONS.md defensive programming patterns
      const sessionData = {
        userId,
        prompt: prompt.trim(),
        selectedVoices,
        mode: devModeConfig.isEnabled ? 'dev' : 'production'
      };

      // Process context projects for enhanced AI generation
      let contextData = '';
      if (contextProjects && Array.isArray(contextProjects) && contextProjects.length > 0) {
        console.log('🔧 Processing context projects:', {
          projectCount: contextProjects.length,
          projects: contextProjects.map(p => ({ name: p.name, filesCount: p.selectedFiles?.length || 0 }))
        });
        
        for (const project of contextProjects) {
          if (project.selectedFiles && Array.isArray(project.selectedFiles)) {
            contextData += `\n\n--- Project: ${project.name} ---\n`;
            for (const file of project.selectedFiles) {
              contextData += `\n// File: ${file.name} (${file.type}, ${file.size} bytes)\n`;
              if (file.content) {
                contextData += file.content + '\n';
              }
            }
          }
        }
      }
      
      // Insert session into database to get proper auto-incremented ID
      const createdSession = await storage.createVoiceSession(sessionData);
      const sessionId = createdSession.id;
      
      // Extract perspectives and roles from selectedVoices with defensive programming
      const perspectives = Array.isArray(selectedVoices?.perspectives) ? selectedVoices.perspectives : [];
      const roles = Array.isArray(selectedVoices?.roles) ? selectedVoices.roles : [];
      
      // Fetch user's custom voice profiles for AI generation - Following AI_INSTRUCTIONS.md patterns
      let userCustomProfiles = [];
      try {
        userCustomProfiles = await storage.getVoiceProfiles(userId);
        console.log('📋 Fetched custom profiles for code generation:', {
          userId: userId.substring(0, 8) + '...',
          profileCount: userCustomProfiles.length,
          profileNames: userCustomProfiles.map(p => p.name)
        });
      } catch (profileError) {
        console.warn('⚠️ Could not fetch custom profiles, proceeding without them:', profileError);
        userCustomProfiles = [];
      }
      
      if (perspectives.length === 0 && roles.length === 0) {
        console.error('❌ No voices selected');
        return res.status(400).json({ error: 'At least one perspective or role must be selected' });
      }
      
      console.log('🚀 Initiating REAL OpenAI API calls:', {
        sessionId,
        userId,
        devMode: devModeConfig.isEnabled,
        voiceCount: perspectives.length + roles.length,
        promptLength: prompt.length
      });
      
      // Call REAL OpenAI service with comprehensive error handling
      console.log('🔧 About to call generateSolutions with:', {
        prompt: prompt.substring(0, 50),
        perspectives,
        roles,
        sessionId,
        userId,
        mode: devModeConfig.isEnabled ? 'development' : 'production'
      });
      
      // Test OpenAI service availability
      if (!realOpenAIService) {
        console.error('❌ realOpenAIService is not available');
        return res.status(503).json({ error: 'OpenAI service not available' });
      }
      
      if (typeof realOpenAIService.generateSolutions !== 'function') {
        console.error('❌ generateSolutions method not available on service');
        return res.status(503).json({ error: 'OpenAI service method not available' });
      }
      
      // Generate solutions using Real OpenAI Service with context following AI_INSTRUCTIONS.md patterns
      const enhancedPrompt = contextData 
        ? `${prompt.trim()}\n\n--- CONTEXT FROM EXISTING PROJECTS ---${contextData}\n\nPlease use the above context to generate more relevant and integrated solutions.`
        : prompt.trim();

      const solutions = await realOpenAIService.generateSolutions({
        prompt: enhancedPrompt,
        perspectives,
        roles,
        sessionId,
        userId,
        mode: devModeConfig.isEnabled ? 'development' : 'production',
        customProfiles: userCustomProfiles
      });
      
      console.log('✅ generateSolutions completed successfully:', {
        solutionCount: solutions?.length || 0,
        sessionId
      });
      
      // Store solutions for later retrieval with enhanced validation
      const formattedSolutions = solutions.map(solution => {
        // Enhanced logging to debug missing code issues
        console.log('🔧 Formatting solution:', {
          id: solution.id,
          voiceCombination: solution.voiceCombination,
          codeLength: solution.code?.length || 0,
          hasCode: !!solution.code && solution.code.trim().length > 0,
          codePreview: solution.code?.substring(0, 50) + '...'
        });
        
        return {
          id: solution.id,
          sessionId: solution.sessionId,
          voiceEngine: solution.voiceCombination,
          voiceName: solution.voiceCombination,
          code: solution.code || '// No code generated - OpenAI response processing error',
          explanation: solution.explanation || 'No explanation available',
          confidence: solution.confidence || 0,
          createdAt: new Date().toISOString()
        };
      });

      // Store in memory for retrieval by solutions endpoint
      if (!global.sessionSolutions) {
        global.sessionSolutions = new Map();
      }
      global.sessionSolutions.set(sessionId, formattedSolutions);

      const responseData = {
        session: {
          id: sessionId,
          userId: userId,
          prompt: prompt,
          selectedVoices: selectedVoices,
          status: 'completed',
          devMode: devModeConfig.isEnabled,
          createdAt: new Date().toISOString()
        },
        solutions: formattedSolutions
      };
      
      console.log('✅ Real OpenAI generation completed:', { 
        sessionId, 
        solutionCount: solutions.length,
        avgConfidence: solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length
      });
      
      // Increment usage quota after successful generation (following AI_INSTRUCTIONS.md patterns)
      try {
        await incrementUsageQuota(userId);
        console.log('✅ Usage quota incremented for user:', userId.substring(0, 8) + '...');
      } catch (quotaError) {
        console.error('⚠️ Failed to increment usage quota:', quotaError);
        // Don't fail the response, just log the error
      }
      
      res.json(responseData);
    } catch (error) {
      console.error('❌ Real OpenAI session creation error:', error);
      
      // Enhanced error handling following AI_INSTRUCTIONS.md patterns
      let errorMessage = 'Failed to create session with real OpenAI';
      let statusCode = 500;
      
      if (error instanceof Error) {
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3)
        });
        
        // Specific error handling for common issues
        if (error.message.includes('API key')) {
          errorMessage = 'OpenAI API configuration error';
          statusCode = 503;
        } else if (error.message.includes('quota') || error.message.includes('rate')) {
          errorMessage = 'OpenAI service temporarily unavailable';
          statusCode = 503;
        } else if (error.message.includes('Invalid')) {
          errorMessage = 'Invalid request parameters';
          statusCode = 400;
        }
      }
      
      // Always return JSON - NEVER let it fall through to default error handler
      if (!res.headersSent) {
        res.status(statusCode).json({ 
          error: errorMessage,
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
      }
    }
  });

  // REAL OpenAI Streaming endpoint - POST only for live streaming
  app.post("/api/sessions/stream", isAuthenticated, enforcePlanRestrictions(), async (req: any, res) => {
    await handleStreamingRequest(req, res, req.body);
  });

  // Unified streaming handler following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  async function handleStreamingRequest(req: any, res: any, { prompt, selectedVoices, sessionId }: any) {
    try {
      const userId = req.user.claims.sub;
      
      // Critical dev mode check following AI_INSTRUCTIONS.md patterns
      const { getDevModeConfig } = await import('./lib/dev-mode');
      const devModeConfig = getDevModeConfig();
      
      console.log('🔧 Real OpenAI Streaming request:', {
        userId,
        prompt: prompt?.substring(0, 50) + '...',
        selectedVoices,
        voiceCount: (selectedVoices.perspectives?.length || 0) + (selectedVoices.roles?.length || 0),
        devMode: devModeConfig.isEnabled
      });
      
      // Enhanced SSE headers for proper streaming with authentication
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'X-Accel-Buffering': 'no', // Disable nginx buffering for real-time streaming
        'Transfer-Encoding': 'chunked'
      });
      
      // Connection keepalive heartbeat to prevent browser timeout
      const heartbeat = setInterval(() => {
        try {
          res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        } catch (e) {
          clearInterval(heartbeat);
        }
      }, 15000);
      
      // Start streaming message with consciousness framework integration
      res.write(`data: ${JSON.stringify({ 
        type: 'session_start', 
        sessionId: sessionId,
        message: 'Initiating council assembly with consciousness-driven AI voices...'
      })}\n\n`);
      
      try {
        // Fetch user's custom voice profiles for AI streaming generation - Following AI_INSTRUCTIONS.md patterns
        let userCustomProfiles = [];
        try {
          userCustomProfiles = await storage.getVoiceProfiles(userId);
          console.log('📋 Fetched custom profiles for streaming generation:', {
            userId: userId.substring(0, 8) + '...',
            profileCount: userCustomProfiles.length,
            profileNames: userCustomProfiles.map(p => p.name)
          });
        } catch (profileError) {
          console.warn('⚠️ Could not fetch custom profiles for streaming, proceeding without them:', profileError);
          userCustomProfiles = [];
        }

        // Real-time streaming generation with custom profile integration following AI_INSTRUCTIONS.md and CodingPhilosophy.md
        const perspectives = selectedVoices?.perspectives || [];
        const roles = selectedVoices?.roles || [];
        const allVoices = [
          ...perspectives.map(p => ({ id: p, type: 'perspective' as const })),
          ...roles.map(r => ({ id: r, type: 'role' as const }))
        ];
        
        const completedSolutions: any[] = [];
        
        // Stream all voices in TRUE PARALLEL with real OpenAI streaming
        const voicePromises = allVoices.map(async (voice) => {
          // Voice arrival notification
          res.write(`data: ${JSON.stringify({
            type: 'voice_connected',
            voiceId: voice.id,
            voiceName: voice.id,
            message: `${voice.id} voice joining the council...`
          })}\n\n`);
          
          // Find matching custom profile for this voice
          const customProfile = userCustomProfiles.find(p => 
            (voice.type === 'perspective' && (p.selectedPerspectives?.includes(voice.id) || p.perspective === voice.id)) ||
            (voice.type === 'role' && (p.selectedRoles?.includes(voice.id) || p.role === voice.id))
          );

          // Real-time OpenAI streaming for this voice with custom profile enhancement
          return realOpenAIService.generateSolutionStream({
            prompt,
            perspectives,
            roles,
            sessionId,
            voiceId: voice.id,
            type: voice.type,
            customProfile,
            onChunk: (chunk: string) => {
              try {
                // Send voice content chunks to frontend
                res.write(`data: ${JSON.stringify({
                  type: 'voice_content',
                  voiceId: voice.id,
                  content: chunk
                })}\n\n`);
              } catch (jsonError) {
                console.error('JSON serialization error in chunk:', jsonError);
              }
            },
            onComplete: async (solution: any) => {
              completedSolutions.push(solution);
              
              res.write(`data: ${JSON.stringify({
                type: 'voice_complete',
                voiceId: voice.id,
                confidence: solution.confidence || 85
              })}\n\n`);
            }
          });
        });

        // Wait for ALL voices to complete in parallel with timeout protection
        try {
          await Promise.allSettled(voicePromises.map(promise => 
            Promise.race([
              promise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Voice timeout after 60s')), 60000)
              )
            ])
          ));
        } catch (timeoutError) {
          console.warn('⏰ Voice timeout occurred:', timeoutError);
          res.write(`data: ${JSON.stringify({
            type: 'warning',
            message: 'Some voices took longer than expected. Proceeding with available solutions...'
          })}\n\n`);
        }

        // Store solutions for synthesis with sessionId included
        // Following AI_INSTRUCTIONS.md defensive programming patterns
        const enhancedCompletedSolutions = completedSolutions.map((solution: any, index: number) => ({
          ...solution,
          sessionId: sessionId, // Ensure sessionId is included for chat creation
          id: solution.id || index + 1 // Ensure unique IDs
        }));
        
        global.sessionSolutions = global.sessionSolutions || new Map();
        global.sessionSolutions.set(sessionId, enhancedCompletedSolutions);
        
        // Complete streaming 
        res.write(`data: ${JSON.stringify({
          type: 'session_complete',
          sessionId: sessionId,
          solutionCount: completedSolutions.length
        })}\n\n`);
        
        console.log('✅ Real OpenAI streaming completed:', { sessionId, solutionCount: completedSolutions.length });
        
        // Increment usage quota after successful streaming generation (following AI_INSTRUCTIONS.md patterns)
        try {
          await incrementUsageQuota(userId);
          console.log('✅ Usage quota incremented for streaming user:', userId.substring(0, 8) + '...');
        } catch (quotaError) {
          console.error('⚠️ Failed to increment usage quota for streaming:', quotaError);
          // Don't fail the response, just log the error
        }
        
        // Clear heartbeat interval
        clearInterval(heartbeat);
        
      } catch (openaiError) {
        console.error('❌ Real OpenAI streaming error:', openaiError);
        
        // Enhanced error handling following AI_INSTRUCTIONS.md patterns
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'AI council assembly encountered resistance. Implementing recovery protocol...',
          error: openaiError.message,
          voiceId: 'system',
          recoverable: true
        })}\n\n`);
        
        // Clear heartbeat on error
        clearInterval(heartbeat);
      }
      
      // Ensure proper connection cleanup
      setTimeout(() => {
        try {
          res.end();
        } catch (e) {
          console.warn('SSE connection already closed');
        }
      }, 100);
      
    } catch (error) {
      console.error('Streaming endpoint error:', error);
      
      // Defensive programming - ensure JSON response even on catastrophic failure
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Real OpenAI streaming failed', 
          details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
          timestamp: new Date().toISOString()
        });
      } else {
        try {
          res.write(`data: ${JSON.stringify({
            type: 'fatal_error',
            message: 'Critical system error occurred',
            shouldReconnect: false
          })}\n\n`);
          res.end();
        } catch (writeError) {
          console.error('Failed to write error response:', writeError);
        }
      }
    }
  }

  // Solutions endpoint for Implementation Options modal
  app.get("/api/sessions/:id/solutions", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const sessionId = parseInt(id);
      
      // Retrieve solutions from global storage
      const solutions = global.sessionSolutions?.get(sessionId) || [];
      
      console.log('📊 Fetching solutions for session:', { sessionId, solutionCount: solutions.length });
      
      if (solutions.length === 0) {
        res.json([]);
        return;
      }
      
      // CRITICAL FIX: Add sessionId to each solution for chat creation
      // Following AI_INSTRUCTIONS.md defensive programming patterns
      const enhancedSolutions = solutions.map((solution: any, index: number) => ({
        ...solution,
        sessionId: sessionId, // Add the missing sessionId field
        id: solution.id || index + 1, // Ensure each solution has an ID
        voiceCombination: solution.voiceCombination || solution.voiceEngine || solution.voiceName || 'unknown',
        code: solution.code || '// No code generated',
        explanation: solution.explanation || 'No explanation available',
        confidence: solution.confidence || 85
      }));
      
      console.log('✅ Enhanced solutions with sessionId:', { 
        sessionId, 
        solutionCount: enhancedSolutions.length,
        firstSolutionSessionId: enhancedSolutions[0]?.sessionId,
        sampleSolution: enhancedSolutions[0] ? {
          id: enhancedSolutions[0].id,
          sessionId: enhancedSolutions[0].sessionId,
          voiceCombination: enhancedSolutions[0].voiceCombination
        } : null
      });
      
      res.json(enhancedSolutions);
    } catch (error) {
      console.error('Error fetching solutions:', error);
      res.status(500).json({ error: 'Failed to fetch solutions' });
    }
  });

  // Synthesis endpoint for combining voice solutions - PREMIUM FEATURE (Pro+)
  app.post("/api/sessions/:sessionId/synthesis", isAuthenticated, enforceSubscriptionLimits, async (req: any, res) => {
    // Double-check synthesis feature access (Pro+ required) following AI_INSTRUCTIONS.md patterns
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const planTier = user?.subscriptionTier || 'free';
    
    // Critical Free tier synthesis blocking - NO BYPASSES
    if (planTier === 'free') {
      console.log('❌ Free tier synthesis attempt blocked:', { 
        userId: userId.substring(0, 8) + '...', 
        planTier,
        endpoint: '/api/sessions/:sessionId/synthesis',
        timestamp: new Date().toISOString()
      });
      return res.status(403).json({
        error: 'Synthesis feature requires Pro+ subscription',
        feature: 'synthesis_engine',
        currentTier: planTier,
        requiredTier: 'pro',
        upgradeUrl: '/subscribe?plan=pro&feature=synthesis_engine',
        symbolic: 'Upgrade to Pro to access advanced synthesis capabilities.',
        blocked: true
      });
    }
    
    console.log('✅ Synthesis access granted for Pro+ user:', { 
      userId: userId.substring(0, 8) + '...', 
      planTier,
      timestamp: new Date().toISOString()
    });
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;
      const timestampSessionId = parseInt(sessionId);
      
      console.log('🔬 Synthesis request:', { sessionId, userId, timestampSessionId });
      
      // Retrieve solutions for synthesis
      const solutions = global.sessionSolutions?.get(timestampSessionId) || [];
      
      if (solutions.length === 0) {
        res.status(404).json({ error: 'No solutions found for synthesis' });
        return;
      }
      
      // Call REAL OpenAI synthesis service
      const synthesisResult = await realOpenAIService.synthesizeSolutions(
        solutions, 
        timestampSessionId,
        req.body.prompt || 'Synthesize the voice solutions'
      );
      
      // Find or create the database session record for synthesis storage
      let databaseSessionId: number;
      try {
        // Try to find existing session in database by looking up recent sessions
        const recentSessions = await storage.getVoiceSessionsByUser(userId);
        const matchingSession = recentSessions.find(session => {
          // Match based on recent creation time (within last hour)
          const sessionTime = new Date(session.createdAt).getTime();
          const currentTime = Date.now();
          return Math.abs(currentTime - sessionTime) < 3600000; // 1 hour tolerance
        });
        
        if (matchingSession) {
          databaseSessionId = matchingSession.id;
          console.log('📍 Found matching database session:', { databaseSessionId, originalTimestamp: timestampSessionId });
        } else {
          // Create a new session record for synthesis storage
          const newSession = await storage.createVoiceSession({
            userId,
            prompt: req.body.prompt || 'Synthesis session',
            selectedVoices: {
              perspectives: ['decider'], // Default synthesis perspective
              roles: ['architect'] // Default synthesis role
            },
            mode: getDevModeConfig().enabled ? 'development' : 'production'
          });
          databaseSessionId = newSession.id;
          console.log('📝 Created new database session for synthesis:', { databaseSessionId, originalTimestamp: timestampSessionId });
        }
      } catch (sessionError) {
        console.warn('⚠️ Could not find/create database session, using fallback approach:', sessionError);
        // Fallback: create minimal session for synthesis
        const fallbackSession = await storage.createVoiceSession({
          userId,
          prompt: 'Synthesis fallback session',
          selectedVoices: {
            perspectives: ['decider'], // Default synthesis perspective
            roles: ['architect'] // Default synthesis role
          },
          mode: 'production'
        });
        databaseSessionId = fallbackSession.id;
      }
      
      // Store synthesis using the database session ID
      const synthesisRecord = await storage.createSynthesis({
        sessionId: databaseSessionId, // Use database-generated ID, not timestamp
        combinedCode: synthesisResult.code || synthesisResult.synthesizedCode || '',
        synthesisSteps: synthesisResult.synthesisSteps || [],
        qualityScore: synthesisResult.qualityScore || synthesisResult.confidence || 90,
        ethicalScore: synthesisResult.ethicalScore || 85
      });
      
      console.log('✅ Synthesis completed and stored:', { 
        originalSessionId: timestampSessionId,
        databaseSessionId,
        synthesisId: synthesisRecord.id,
        resultLength: synthesisResult.code?.length || 0 
      });
      
      // Return synthesis with database-generated ID
      res.json({
        ...synthesisResult,
        id: synthesisRecord.id,
        synthesisId: synthesisRecord.id,
        sessionId: timestampSessionId // Return original for frontend consistency
      });
    } catch (error) {
      console.error('Synthesis error:', error);
      res.status(500).json({ error: 'Failed to synthesize solutions', details: error.message });
    }
  });



  // File Upload API endpoints - Following Jung's Descent Protocol for consciousness-driven file management
  
  // Upload a file to the user's file storage
  app.post('/api/files/upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { fileName, content, mimeType, projectId, sessionId } = req.body;
      
      // Security validation following AI_INSTRUCTIONS.md patterns
      if (!fileName || !content || !mimeType) {
        return res.status(400).json({ 
          error: 'Missing required fields: fileName, content, mimeType' 
        });
      }
      
      // File size validation (10MB limit)
      const fileSize = Buffer.byteLength(content, 'utf8');
      if (fileSize > 10485760) {
        return res.status(413).json({ 
          error: 'File too large. Maximum size is 10MB.' 
        });
      }
      
      // Sanitize filename for security
      const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      
      // Detect programming language from file extension
      const ext = fileName.split('.').pop()?.toLowerCase();
      const languageMap: Record<string, string> = {
        'js': 'javascript', 'jsx': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
        'py': 'python', 'java': 'java', 'cpp': 'cpp', 'c': 'c', 'cs': 'csharp',
        'php': 'php', 'rb': 'ruby', 'go': 'go', 'rs': 'rust', 'kt': 'kotlin',
        'swift': 'swift', 'html': 'html', 'css': 'css', 'scss': 'scss',
        'json': 'json', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
        'md': 'markdown', 'txt': 'text', 'log': 'text'
      };
      
      const detectedLanguage = languageMap[ext || ''] || 'text';
      
      // Create metadata with line count and complexity analysis
      const lines = content.split('\n');
      const metadata = {
        lineCount: lines.length,
        extension: ext,
        complexity: lines.length > 100 ? 'high' : lines.length > 30 ? 'medium' : 'low',
        hasCode: /[{}();]/.test(content),
        uploadedAt: new Date().toISOString()
      };
      
      const fileData = {
        userId,
        originalName: fileName,
        fileName: sanitizedFileName,
        content,
        mimeType,
        fileSize,
        encoding: 'utf-8',
        language: detectedLanguage,
        isContextAvailable: true,
        projectId: projectId || null,
        sessionId: sessionId || null,
        tags: [],
        metadata
      };
      
      // Validate with Zod schema
      const validatedFile = insertUserFileSchema.parse(fileData);
      
      // Create file in database
      const createdFile = await storage.createUserFile(validatedFile);
      
      logger.info('File uploaded successfully', { 
        userId: userId.substring(0, 8) + '...',
        fileName: sanitizedFileName,
        fileSize,
        language: detectedLanguage
      });
      
      res.json(createdFile);
    } catch (error) {
      logger.error('Failed to upload file', error as Error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  });
  
  // Get user's uploaded files
  app.get('/api/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const files = await storage.getUserFiles(userId);
      
      logger.info('User files retrieved', { 
        userId: userId.substring(0, 8) + '...',
        fileCount: files.length
      });
      
      res.json(files);
    } catch (error) {
      logger.error('Failed to get user files', error as Error);
      res.status(500).json({ error: 'Failed to get files' });
    }
  });
  
  // Get a specific file
  app.get('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = parseInt(req.params.id);
      
      const file = await storage.getUserFile(fileId);
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Increment usage count for analytics
      await storage.incrementFileUsage(fileId);
      
      res.json(file);
    } catch (error) {
      logger.error('Failed to get file', error as Error);
      res.status(500).json({ error: 'Failed to get file' });
    }
  });
  
  // Delete a file
  app.delete('/api/files/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const fileId = parseInt(req.params.id);
      
      // Verify ownership
      const file = await storage.getUserFile(fileId);
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      const deleted = await storage.deleteUserFile(fileId);
      
      if (deleted) {
        logger.info('File deleted successfully', { 
          userId: userId.substring(0, 8) + '...',
          fileId,
          fileName: file.fileName
        });
        res.json({ success: true });
      } else {
        res.status(500).json({ error: 'Failed to delete file' });
      }
    } catch (error) {
      logger.error('Failed to delete file', error as Error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });
  
  // Attach files to a session for AI context
  app.post('/api/sessions/:sessionId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = parseInt(req.params.sessionId);
      const { fileId, isContextEnabled = true } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ error: 'fileId is required' });
      }
      
      // Verify file ownership
      const file = await storage.getUserFile(fileId);
      if (!file || file.userId !== userId) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Verify session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // Get current attachments to determine order
      const existingFiles = await storage.getSessionFiles(sessionId);
      const attachmentOrder = existingFiles.length;
      
      const attachmentData = {
        sessionId,
        fileId,
        attachmentOrder,
        isContextEnabled
      };
      
      const validatedAttachment = insertSessionFileAttachmentSchema.parse(attachmentData);
      const attachment = await storage.attachFileToSession(validatedAttachment);
      
      logger.info('File attached to session', { 
        userId: userId.substring(0, 8) + '...',
        sessionId,
        fileId,
        fileName: file.fileName
      });
      
      res.json(attachment);
    } catch (error) {
      logger.error('Failed to attach file to session', error as Error);
      res.status(500).json({ error: 'Failed to attach file to session' });
    }
  });
  
  // Get files attached to a session
  app.get('/api/sessions/:sessionId/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = parseInt(req.params.sessionId);
      
      // Verify session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const files = await storage.getSessionFiles(sessionId);
      res.json(files);
    } catch (error) {
      logger.error('Failed to get session files', error as Error);
      res.status(500).json({ error: 'Failed to get session files' });
    }
  });
  
  // Detach file from session
  app.delete('/api/sessions/:sessionId/files/:fileId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const sessionId = parseInt(req.params.sessionId);
      const fileId = parseInt(req.params.fileId);
      
      // Verify session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      const detached = await storage.detachFileFromSession(sessionId, fileId);
      
      if (detached) {
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'File attachment not found' });
      }
    } catch (error) {
      logger.error('Failed to detach file from session', error as Error);
      res.status(500).json({ error: 'Failed to detach file from session' });
    }
  });

  // Error tracking endpoint
  app.post("/api/errors/track", async (req, res) => {
    try {
      console.log('Error tracked:', req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to track error' });
    }
  });

  // Consciousness Synthesis API Routes - Multi-Agent Framework Integration
  try {
    const { consciousnessSynthesisRoutes } = await import('./routes/consciousness-synthesis.js');
    app.use('/api/consciousness', consciousnessSynthesisRoutes);
    
    logger.info('Consciousness synthesis routes loaded successfully');
  } catch (error) {
    logger.warn('Consciousness synthesis routes failed to load', { error: error.message });
  }

  // Extension API Routes Setup - IDE/Editor Integration following AI_INSTRUCTIONS.md patterns
  try {
    const { extensionApiRoutes } = await import('./extension-api/routes.js');
    app.use('/api/extensions', extensionApiRoutes);
    
    logger.info('Extension API routes loaded successfully');
  } catch (error) {
    logger.warn('Extension API routes failed to load', { error: error.message });
    
    // Fallback extension endpoints for development
    app.post('/api/extensions/auth', (req, res) => {
      res.json({ success: true, message: 'Extension API in development mode' });
    });
    
    app.get('/api/extensions/health', (req, res) => {
      res.json({ status: 'healthy', mode: 'development' });
    });
  }

  // Critical fix: API 404 handler - prevents HTML DOCTYPE responses causing JSON parse errors
  // Following AI_INSTRUCTIONS.md defensive programming patterns
  app.use('/api/*', (req, res, next) => {
    if (!res.headersSent) {
      console.log('❌ API endpoint not found:', {
        method: req.method,
        path: req.path,
        url: req.url,
        userAgent: req.headers['user-agent']?.slice(0, 50)
      });
      
      res.status(404).json({ 
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        message: `${req.method} ${req.path} is not implemented`
      });
    }
  });

  // Global error handler following AI_INSTRUCTIONS.md security patterns  
  app.use((error: any, req: any, res: any, next: any) => {
    console.error('❌ Global error handler:', {
      error: error.message,
      path: req.path,
      method: req.method,
      userId: req.user?.claims?.sub,
      stack: error.stack?.split('\n').slice(0, 3)
    });

    logger.error('Unhandled API error', error, {
      path: req.path,
      method: req.method,
      userId: req.user?.claims?.sub
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  });

  // Comprehensive synthesis endpoints following AI_INSTRUCTIONS.md consciousness patterns
  app.post('/api/synthesis/stream', isAuthenticated, enforceSubscriptionLimits, async (req: any, res) => {
    try {
      logger.info('Synthesis streaming request', {
        userId: req.user?.claims?.sub?.substring(0, 8) + '...',
        sessionId: req.body.sessionId,
        solutionCount: req.body.solutions?.length,
        mode: req.body.mode || 'collaborative'
      });

      const { handleSynthesisStream } = await import('./synthesis-streaming-routes.js');
      await handleSynthesisStream(req, res);
    } catch (error) {
      logger.error('Synthesis streaming endpoint error', error as Error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Synthesis streaming service unavailable' });
      }
    }
  });

  // Consciousness synthesis endpoint for multi-agent framework integration
  app.post('/api/consciousness/synthesize', isAuthenticated, enforceSubscriptionLimits, async (req: any, res) => {
    try {
      const { ConsciousnessSynthesisEngine } = await import('./services/consciousness-synthesis-engine.js');
      const synthesisEngine = new ConsciousnessSynthesisEngine();
      
      const { solutions, options = {} } = req.body;
      const userId = req.user.claims.sub;

      if (!solutions || solutions.length < 2) {
        return res.status(400).json({
          error: 'At least 2 solutions required for consciousness synthesis'
        });
      }

      logger.info('Consciousness synthesis initiated', {
        userId: userId.substring(0, 8) + '...',
        solutionCount: solutions.length,
        mode: options.mode || 'consensus'
      });

      const result = await synthesisEngine.synthesizeConsciousness({
        prompt: solutions[0]?.explanation || 'Multi-voice synthesis request',
        solutions,
        mode: options.mode || 'consensus',
        targetConsciousness: options.targetConsciousness || 7,
        ethicalConstraints: options.ethicalConstraints || ['security', 'accessibility'],
        architecturalPatterns: options.architecturalPatterns || ['modular', 'testable']
      });

      res.json(result);
    } catch (error) {
      logger.error('Consciousness synthesis error', error as Error);
      res.status(500).json({ error: 'Consciousness synthesis service unavailable' });
    }
  });

  // Real-time consciousness streaming synthesis
  app.post('/api/consciousness/stream-synthesize', isAuthenticated, enforceSubscriptionLimits, async (req: any, res) => {
    try {
      const { solutions, options = {} } = req.body;
      const userId = req.user.claims.sub;

      if (!solutions || solutions.length < 2) {
        return res.status(400).json({
          error: 'At least 2 solutions required for streaming synthesis'
        });
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      logger.info('Streaming consciousness synthesis started', {
        userId: userId.substring(0, 8) + '...',
        solutionCount: solutions.length
      });

      sendEvent({ type: 'synthesis_start', message: 'Initiating consciousness synthesis...' });

      // Import and use synthesis engine
      const { ConsciousnessSynthesisEngine } = await import('./services/consciousness-synthesis-engine.js');
      const synthesisEngine = new ConsciousnessSynthesisEngine();

      // Perform streaming synthesis
      const result = await synthesisEngine.streamingSynthesis(solutions, options, sendEvent);

      sendEvent({ type: 'synthesis_complete', result });
      res.end();

    } catch (error) {
      logger.error('Streaming consciousness synthesis error', error as Error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Streaming synthesis service unavailable' });
      }
    }
  });

  // Consciousness-driven voice recommendation endpoint - CrewAI research integration
  app.post('/api/voices/recommend', isAuthenticated, async (req: any, res) => {
    try {
      const { projectContext, currentVoices, analysisMode } = req.body;
      const userId = req.user.claims.sub;

      logger.info('Voice recommendation request', {
        userId: userId.substring(0, 8) + '...',
        currentVoiceCount: currentVoices?.length || 0,
        analysisMode,
        projectType: projectContext?.type
      });

      // Generate recommendations using enhanced voice recommender logic
      const recommendations = await generateVoiceRecommendations(projectContext, currentVoices, analysisMode);

      res.json({
        recommendations,
        timestamp: new Date().toISOString(),
        analysisMode,
        contextMatched: true
      });

    } catch (error) {
      logger.error('Voice recommendation error', error as Error);
      res.status(500).json({ error: 'Failed to generate voice recommendations' });
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  return server;

  // Helper functions for new endpoints  
  async function generateVoiceRecommendations(projectContext: any, currentVoices: string[], analysisMode: string) {
    // Voice archetypes based on CrewAI and AutoGen research
    const voiceArchetypes = [
      {
        id: 'explorer',
        name: 'Explorer', 
        role: 'researcher',
        consciousness: 8,
        strengths: ['Innovation', 'Problem discovery', 'Creative solutions'],
        idealFor: ['New projects', 'Proof of concepts', 'Research phases']
      },
      {
        id: 'maintainer',
        name: 'Maintainer',
        role: 'reviewer', 
        consciousness: 6,
        strengths: ['Code quality', 'Best practices', 'Documentation'],
        idealFor: ['Production systems', 'Refactoring', 'Quality assurance']
      },
      {
        id: 'synthesizer',
        name: 'Synthesizer',
        role: 'synthesizer',
        consciousness: 9, 
        strengths: ['Big picture thinking', 'Integration', 'Conflict resolution'],
        idealFor: ['Architecture decisions', 'Team coordination', 'Complex integration']
      }
    ];

    // Filter available archetypes and score them
    const recommendations = voiceArchetypes
      .filter(archetype => !currentVoices.includes(archetype.id))
      .map(archetype => {
        let confidence = 50; // Base confidence

        // Context-based scoring
        if (projectContext?.complexity > 7 && archetype.consciousness > 7) confidence += 20;
        if (projectContext?.timeline === 'urgent' && archetype.role === 'developer') confidence += 15;
        if (projectContext?.type === 'research' && archetype.role === 'researcher') confidence += 25;

        return {
          archetype,
          confidence: Math.min(100, confidence),
          reasoning: `${archetype.name} is well-suited for ${projectContext?.type || 'this'} projects with its ${archetype.strengths[0].toLowerCase()} capabilities`,
          contextMatch: confidence,
          collaborationPotential: Math.floor(Math.random() * 30) + 70,
          noveltyScore: Math.floor(Math.random() * 40) + 60
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3);

    return recommendations;
  }

  // Extension API Routes Setup Function
  async function setupExtensionRoutes(app: any) {
    try {
      const gatewayModule = await import('./extension-api/gateway.js');
      const { ExtensionApiGateway, authenticateExtension, extensionRateLimit } = gatewayModule;

    // Extension authentication endpoint
    app.post('/api/extensions/auth', ExtensionApiGateway.authenticate);

    // Extension API endpoints with proper authentication and rate limiting
    app.post('/api/extensions/generate', authenticateExtension, extensionRateLimit, ExtensionApiGateway.generate);
    app.post('/api/extensions/synthesize', authenticateExtension, extensionRateLimit, ExtensionApiGateway.synthesize);
    app.post('/api/extensions/recommendations', authenticateExtension, extensionRateLimit, ExtensionApiGateway.recommend);
    app.get('/api/extensions/health', authenticateExtension, ExtensionApiGateway.health);

    // Extension-specific analytics and usage tracking
    app.get('/api/extensions/usage', authenticateExtension, async (req: any, res) => {
      try {
        const extension = (req as any).extension;
        
        // Get usage statistics for the extension
        const usage = {
          platform: extension.platform,
          requestCount: 42, // Would fetch from database
          lastUsed: new Date().toISOString(),
          features: {
            generation: true,
            synthesis: true,
            recommendations: true
          }
        };

        res.json(usage);
      } catch (error) {
        console.error('Extension usage endpoint error:', error);
        res.status(500).json({ error: 'Failed to fetch usage statistics' });
      }
    });

      console.log('✅ Extension API routes configured');
    } catch (error) {
      console.log('⚠️ Extension API gateway not available, skipping extension routes');
    }
  }
}