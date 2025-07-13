import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { openaiService } from "./openai-service";
import { analyticsService } from "./analytics-service";
import { subscriptionService } from "./subscription-service";
import { preferenceLearningService } from "./preference-learning-service";
import { logger, APIError } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { securityMiddleware } from "./security-middleware";
import { enforcePlanRestrictions, validateFeatureAccess } from "./middleware/enforcePlan";
import { enforceSubscriptionLimits, enforceSynthesisAccess } from "./middleware/subscription-enforcement";
import { customVoiceService } from "./custom-voice-service";
import { collaborationService } from "./collaboration-service";
import { processStripeWebhook } from "./lib/stripe/updateUserPlan";
import { incrementUsageQuota, checkGenerationQuota } from "./lib/utils/checkQuota";
import { logSecurityEvent } from "./lib/security/logSecurityEvent";
import { isDevModeFeatureEnabled, logDevModeBypass, createDevModeWatermark } from './lib/dev-mode';
import openaiRouter from './routes/api/openai';
import Stripe from "stripe";

// Helper function to check user plan
async function checkUserPlan(userId: string) {
  try {
    const user = await storage.getUser(userId);
    return { 
      data: { 
        tier: user?.planTier || 'free',
        stripeSubscriptionId: user?.stripeSubscriptionId 
      } 
    };
  } catch (error) {
    return { data: { tier: 'free', stripeSubscriptionId: null } };
  }
}

// Initialize Stripe with secret key following AI_INSTRUCTIONS.md security patterns
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required environment variable: STRIPE_SECRET_KEY');
}
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});
import { 
  insertVoiceSessionSchema, 
  insertSolutionSchema, 
  insertSynthesisSchema,
  insertPhantomLedgerEntrySchema,
  insertProjectSchema,
  insertVoiceProfileSchema,
  insertTeamSchema,
  insertTeamVoiceProfileSchema
} from "@shared/schema";

// Request validation schemas following AI_INSTRUCTIONS.md patterns
const generateSessionRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  selectedVoices: z.object({
    perspectives: z.array(z.string()),
    roles: z.array(z.string())
  }).refine(data => data.perspectives.length > 0 || data.roles.length > 0, {
    message: "At least one perspective or role must be selected"
  }),
  recursionDepth: z.number().int().min(1).max(3),
  synthesisMode: z.enum(["consensus", "competitive", "collaborative"]),
  ethicalFiltering: z.boolean()
});

const synthesisRequestSchema = z.object({
  sessionId: z.number().int().positive(),
  solutionIds: z.array(z.number().int().positive()).min(1)
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Security middleware setup following AI_INSTRUCTIONS.md
  app.use(securityMiddleware.securityHeaders());
  app.use(securityMiddleware.monitorAuthentication());
  
  // Auth middleware
  await setupAuth(app);

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

  // Custom Voice Profile Creation Route (Pro+ Feature)
  app.post('/api/voice-profiles/custom', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const customVoiceData = { ...req.body, userId };
      
      const customVoice = await customVoiceService.createCustomVoice(customVoiceData);
      res.json(customVoice);
    } catch (error) {
      next(error);
    }
  });

  // Team Collaboration Routes (Team+ Feature)
  app.post('/api/collaboration/sessions', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const sessionData = { ...req.body, initiatorId: userId };
      
      const session = await collaborationService.createCollaborativeSession(sessionData);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/collaboration/sessions/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const sessionId = req.params.id;
      const session = await collaborationService.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }
      
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  // Voice Profile Testing Route (Pro+ Feature)
  app.post('/api/voice-profiles/test', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const testData = { ...req.body, userId };
      
      const testResults = await customVoiceService.testCustomVoice(testData.promptTemplate || '', testData);
      res.json({ testResults });
    } catch (error) {
      next(error);
    }
  });

  // VFSP Analytics Route (Pro+ Feature) - Real Database Implementation
  app.get('/api/analytics/vfsp', isAuthenticated, enforceSubscriptionLimits, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const timeRange = req.query.range as string || '30d';
      
      // Real analytics from database following AI_INSTRUCTIONS.md patterns
      const analyticsData = await analyticsService.getAnalyticsDashboard(userId);
      const voiceUsageStats = await storage.getVoiceUsageStats(userId);
      const sessionAnalytics = await storage.getSessionAnalytics(userId);
      
      // Calculate real VFSP metrics from authentic data
      const realAnalytics = {
        volatilityIndex: analyticsData.summary.volatilityScore || 0,
        forecastModel: {
          nextWeekPrediction: analyticsData.summary.weeklyProjection || 0,
          nextMonthPrediction: analyticsData.summary.monthlyProjection || 0,
          confidenceLevel: analyticsData.summary.confidenceLevel || 0,
          trendDirection: analyticsData.summary.totalGenerations > 0 ? 'increasing' : 'stable',
          seasonalPatterns: analyticsData.dailyMetrics.map(day => ({
            period: new Date(day.date).toLocaleDateString(),
            intensity: day.generationCount,
            description: `${day.generationCount} generations`
          }))
        },
        symbolicPatterns: voiceUsageStats.map(stat => ({
          pattern: stat.voiceName,
          significance: stat.successRate,
          frequency: stat.usageCount,
          impact: stat.averageRating > 4 ? 'high' : 'medium',
          description: `${stat.usageCount} uses with ${stat.successRate}% success rate`
        })),
        evolutionTracking: sessionAnalytics.slice(0, 10),
        insights: analyticsData.recommendations.map((rec, index) => ({
          id: String(index + 1),
          title: `Voice Combination Insight`,
          description: rec.reasoning,
          priority: rec.confidence > 80 ? 'high' : 'medium',
          category: 'productivity',
          actionRequired: `Try ${rec.voices.join(' + ')} combination`
        })),
        recommendations: analyticsData.recommendations
      };
      
      res.json(realAnalytics);
    } catch (error) {
      next(error);
    }
  });

  // Voice Profile Management Routes
  app.get('/api/voice-profiles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profiles = await storage.getVoiceProfiles(userId);
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching voice profiles:", error);
      res.status(500).json({ message: "Failed to fetch voice profiles" });
    }
  });

  app.post('/api/voice-profiles', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const profileData = insertVoiceProfileSchema.parse({ ...req.body, userId });
      const profile = await storage.createVoiceProfile(profileData);
      res.json(profile);
    } catch (error) {
      console.error("Error creating voice profile:", error);
      res.status(500).json({ message: "Failed to create voice profile" });
    }
  });

  app.patch('/api/voice-profiles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      // Verify ownership
      const existingProfile = await storage.getVoiceProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ message: "Voice profile not found" });
      }

      const updates = req.body;
      const profile = await storage.updateVoiceProfile(id, updates);
      res.json(profile);
    } catch (error) {
      console.error("Error updating voice profile:", error);
      res.status(500).json({ message: "Failed to update voice profile" });
    }
  });

  app.delete('/api/voice-profiles/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid profile ID" });
      }

      // Verify ownership
      const existingProfile = await storage.getVoiceProfile(id);
      if (!existingProfile || existingProfile.userId !== userId) {
        return res.status(404).json({ message: "Voice profile not found" });
      }

      const deleted = await storage.deleteVoiceProfile(id);
      res.json({ success: deleted });
    } catch (error) {
      console.error("Error deleting voice profile:", error);
      res.status(500).json({ message: "Failed to delete voice profile" });
    }
  });
  
  // Generate real solutions using OpenAI following AI_INSTRUCTIONS.md
  app.post("/api/sessions", 
    isAuthenticated,
    enforcePlanRestrictions(), // CRITICAL: Enforce subscription limits
    securityMiddleware.createRateLimit(60 * 1000, 10, 'sessions'), // 10 requests per minute
    securityMiddleware.validateInput(generateSessionRequestSchema),
    async (req: any, res, next) => {
    try {
      logger.info('Received session generation request', { 
        body: req.body,
        ip: req.ip 
      });

      const requestData = generateSessionRequestSchema.parse(req.body);
      
      // Security validation following AI_INSTRUCTIONS.md patterns
      if (!requestData.prompt || requestData.prompt.trim().length === 0) {
        throw new APIError(400, 'Prompt is required and cannot be empty');
      }
      
      if (!requestData.selectedVoices?.perspectives?.length && !requestData.selectedVoices?.roles?.length) {
        throw new APIError(400, 'At least one perspective or role must be selected');
      }

      // Get authenticated user ID from session
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      // SECURITY: Comprehensive paywall protection following AI_INSTRUCTIONS.md
      const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
      
      // Check usage limits with detailed logging for potential abuse
      const canGenerate = await subscriptionService.checkUsageLimit(userId);
      if (!canGenerate) {
        logger.warn('Usage limit exceeded - potential abuse attempt', {
          userId,
          attemptedUsage: subscriptionInfo.usage.used + 1,
          limit: subscriptionInfo.usage.limit,
          tier: subscriptionInfo.tier.name,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        throw new APIError(403, `Daily generation limit reached (${subscriptionInfo.usage.used}/${subscriptionInfo.usage.limit}). Upgrade to Pro for unlimited generations.`, {
          code: 'GENERATION_LIMIT_EXCEEDED',
          tier: subscriptionInfo.tier.name,
          upgradeRequired: true
        });
      }
      
      // Check voice combination limits with security logging
      const totalVoices = requestData.selectedVoices.perspectives.length + requestData.selectedVoices.roles.length;
      
      // Dev mode bypass: Allow unlimited voice combinations in development
      const shouldCheckVoiceLimit = !isDevModeFeatureEnabled('unlimitedVoiceCombinations');
      
      if (!shouldCheckVoiceLimit && totalVoices > subscriptionInfo.tier.maxVoiceCombinations) {
        logDevModeBypass('voice_combination_limit_bypassed', {
          userId: userId.substring(0, 8) + '...',
          requestedVoices: totalVoices,
          normalLimit: subscriptionInfo.tier.maxVoiceCombinations,
          perspectives: requestData.selectedVoices.perspectives,
          roles: requestData.selectedVoices.roles
        });
      }
      
      if (shouldCheckVoiceLimit && totalVoices > subscriptionInfo.tier.maxVoiceCombinations) {
        logger.warn('Voice combination limit exceeded - potential bypass attempt', {
          userId,
          requestedVoices: totalVoices,
          allowedVoices: subscriptionInfo.tier.maxVoiceCombinations,
          tier: subscriptionInfo.tier.name,
          perspectives: requestData.selectedVoices.perspectives,
          roles: requestData.selectedVoices.roles,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        throw new APIError(403, `Your ${subscriptionInfo.tier.name} plan allows maximum ${subscriptionInfo.tier.maxVoiceCombinations} voice combinations. Upgrade to use more voices.`, {
          code: 'VOICE_LIMIT_EXCEEDED',
          requested: totalVoices,
          allowed: subscriptionInfo.tier.maxVoiceCombinations,
          upgradeRequired: true
        });
      }
      
      // Additional security checks for potential abuse with dev mode extensions
      const maxPromptLength = isDevModeFeatureEnabled('extendedPromptLength') ? 15000 : 5000;
      
      if (requestData.prompt.length > maxPromptLength) {
        if (isDevModeFeatureEnabled('extendedPromptLength') && requestData.prompt.length > 5000) {
          logDevModeBypass('extended_prompt_length_used', {
            userId: userId.substring(0, 8) + '...',
            promptLength: requestData.prompt.length,
            normalLimit: 5000,
            devLimit: maxPromptLength
          });
        }
        
        if (requestData.prompt.length > maxPromptLength) {
          logger.warn('Excessively long prompt detected - potential abuse', {
            userId,
            promptLength: requestData.prompt.length,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            devMode: isDevModeFeatureEnabled('extendedPromptLength')
          });
          throw new APIError(400, `Prompt exceeds maximum length of ${maxPromptLength} characters`);
        }
      }
      
      if (requestData.recursionDepth > 5) {
        logger.warn('Excessive recursion depth - potential resource abuse', {
          userId,
          recursionDepth: requestData.recursionDepth,
          ip: req.ip
        });
        throw new APIError(400, 'Recursion depth cannot exceed 5 levels');
      }

      logger.info('Creating voice session', { 
        userId, 
        prompt: requestData.prompt.substring(0, 50) + '...',
        perspectiveCount: requestData.selectedVoices.perspectives.length,
        roleCount: requestData.selectedVoices.roles.length
      });
      
      // Create session following security patterns
      const sessionData = {
        prompt: requestData.prompt,
        selectedVoices: requestData.selectedVoices,
        recursionDepth: requestData.recursionDepth,
        synthesisMode: requestData.synthesisMode,
        ethicalFiltering: requestData.ethicalFiltering,
        userId: userId,
        // Add dev mode metadata for session tracking
        mode: isDevModeFeatureEnabled('unlimitedGenerations') ? 'dev' : 'production'
      };

      const session = await storage.createVoiceSession(sessionData);
      
      // Increment usage count using new quota system
      await incrementUsageQuota(userId);
      
      // Track analytics: session created event
      await analyticsService.trackEvent(
        userId,
        "session_created",
        {
          sessionId: session.id,
          perspectiveCount: requestData.selectedVoices.perspectives.length,
          roleCount: requestData.selectedVoices.roles.length,
          promptLength: requestData.prompt.length,
          recursionDepth: requestData.recursionDepth,
          synthesisMode: requestData.synthesisMode
        },
        session.id,
        [...requestData.selectedVoices.perspectives, ...requestData.selectedVoices.roles]
      );
      
      // Track voice usage
      await analyticsService.trackVoiceUsage(
        userId,
        requestData.selectedVoices.perspectives,
        requestData.selectedVoices.roles,
        true
      );
      
      const startTime = Date.now();
      
      // Generate real solutions using OpenAI with dual-transmission protocols
      const solutions = await generateRealSolutions(session.id, requestData);
      
      const generationTime = Date.now() - startTime;
      
      // Track session analytics
      await analyticsService.trackSessionGeneration(
        session,
        solutions,
        generationTime
      );
      
      logger.info('Session generation completed', {
        sessionId: session.id,
        solutionCount: solutions.length
      });
      
      res.json({ session, solutions });
    } catch (error) {
      next(error);
    }
  });

  // Get solutions for a session with security validation
  app.get("/api/sessions/:id/solutions", isAuthenticated, async (req: any, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      if (isNaN(sessionId) || sessionId <= 0) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      // Verify session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== req.user?.claims?.sub) {
        throw new APIError(404, 'Session not found or access denied');
      }
      
      logger.debug('Fetching solutions for session', { sessionId, userId: req.user.claims.sub });
      
      const solutions = await storage.getSolutionsBySession(sessionId);
      res.json(solutions);
    } catch (error) {
      next(error);
    }
  });

  // Create real synthesis using OpenAI with enhanced security
  app.post("/api/sessions/:id/synthesis", 
    isAuthenticated,
    enforcePlanRestrictions(), // CRITICAL: Enforce subscription limits
    validateFeatureAccess('synthesis'), // CRITICAL: Synthesis requires Pro/Team
    securityMiddleware.createRateLimit(5 * 60 * 1000, 5, 'synthesis'), // 5 requests per 5 minutes
    async (req: any, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      const userId = req.user?.claims?.sub;
      
      if (isNaN(sessionId) || sessionId <= 0) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      // SECURITY: Verify session ownership with detailed logging
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        logger.warn('Unauthorized synthesis attempt detected', {
          sessionId,
          attemptedBy: userId,
          sessionOwner: session?.userId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        throw new APIError(404, 'Session not found or access denied');
      }
      
      // SECURITY: Check subscription tier for synthesis access
      const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
      if (subscriptionInfo.tier.name === 'free') {
        logger.warn('Free tier synthesis attempt - potential bypass', {
          userId,
          sessionId,
          tier: subscriptionInfo.tier.name,
          ip: req.ip
        });
        throw new APIError(403, 'Synthesis feature requires Pro or Team subscription. Upgrade to access this feature.', {
          code: 'SYNTHESIS_FEATURE_LOCKED',
          upgradeRequired: true
        });
      }
      
      logger.info('Starting solution synthesis', { sessionId, userId: req.user.claims.sub });
      
      // Get solutions for the session
      const solutions = await storage.getSolutionsBySession(sessionId);
      if (solutions.length === 0) {
        throw new APIError(404, 'No solutions found for this session');
      }
      
      const synthesisStartTime = Date.now();
      
      // Use OpenAI to synthesize solutions
      const synthesizedCode = await openaiService.synthesizeSolutions(
        solutions.map(sol => ({
          voiceCombination: sol.voiceCombination,
          code: sol.code,
          explanation: sol.explanation,
          confidence: sol.confidence,
          strengths: sol.strengths as string[],
          considerations: sol.considerations as string[],
          perspective: sol.voiceCombination.split(' + ')[0],
          role: sol.voiceCombination.split(' + ')[1]
        })), 
        sessionId
      );
      
      const synthesisTime = Date.now() - synthesisStartTime;
      
      // Create synthesis record
      const synthesis = await storage.createSynthesis({
        sessionId,
        combinedCode: synthesizedCode,
        synthesisSteps: [`Analyzed ${solutions.length} solutions`, "Applied OpenAI synthesis", "Generated final code"],
        qualityScore: Math.round(solutions.reduce((sum, sol) => sum + sol.confidence, 0) / solutions.length),
        ethicalScore: 85 // Default high ethical score for AI-generated content
      });
      
      // Track synthesis completion
      await analyticsService.trackEvent(
        req.user.claims.sub,
        "synthesis_completed",
        {
          sessionId,
          synthesisId: synthesis.id,
          synthesisTime,
          qualityScore: synthesis.qualityScore,
          solutionCount: solutions.length
        },
        sessionId
      );
      
      // Create decision history entry using the session we already fetched
      if (session) {
        await storage.createPhantomLedgerEntry({
          sessionId,
          title: `Code Merge: ${session.prompt.substring(0, 50)}...`,
          voicesEngaged: session.selectedVoices as any,
          decisionOutcome: synthesis.combinedCode.substring(0, 100) + "...",
          keyLearnings: [
            "OpenAI-powered solution synthesis",
            `Merged ${solutions.length} perspectives`,
            "Maintained AI_INSTRUCTIONS.md compliance"
          ] as any,
          ethicalScore: synthesis.ethicalScore
        });
      }
      
      logger.info('Solution synthesis completed', {
        sessionId,
        synthesisId: synthesis.id,
        qualityScore: synthesis.qualityScore
      });
      
      res.json(synthesis);
    } catch (error) {
      next(error);
    }
  });

  // Get decision history entries (renamed from phantom ledger)
  app.get("/api/decision-history", async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      logger.debug('Fetching decision history entries', { limit });
      
      const entries = await storage.getPhantomLedgerEntries(limit);
      res.json(entries);
    } catch (error) {
      next(error);
    }
  });

  // Get error logs for debugging
  app.get("/api/logs", async (req, res, next) => {
    try {
      const level = req.query.level as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (limit && (isNaN(limit) || limit < 1 || limit > 500)) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 500.');
      }
      
      logger.debug('Fetching system logs', { level, limit });
      
      const logs = logger.getRecentLogs(limit, level as any);
      res.json({
        logs,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Get logs for specific session
  app.get("/api/sessions/:id/logs", async (req, res, next) => {
    try {
      const sessionId = req.params.id;
      
      if (!sessionId) {
        throw new APIError(400, 'Session ID is required');
      }
      
      logger.debug('Fetching session logs', { sessionId });
      
      const logs = logger.getSessionLogs(sessionId);
      res.json({
        logs,
        sessionId,
        count: logs.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  });

  // Project management routes
  app.post("/api/projects", async (req, res, next) => {
    try {
      const projectData = insertProjectSchema.parse(req.body);
      
      logger.info('Creating new project', {
        name: projectData.name,
        language: projectData.language,
        sessionId: projectData.sessionId
      });
      
      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects", async (req, res, next) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      const projects = await storage.getProjects(limit);
      res.json(projects);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/projects/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new APIError(400, 'Invalid project ID');
      }
      
      const project = await storage.getProject(id);
      
      if (!project) {
        throw new APIError(404, 'Project not found');
      }
      
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/projects/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new APIError(400, 'Invalid project ID');
      }
      
      const updates = insertProjectSchema.partial().parse(req.body);
      const project = await storage.updateProject(id, updates);
      
      if (!project) {
        throw new APIError(404, 'Project not found');
      }
      
      res.json(project);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/projects/:id", async (req, res, next) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        throw new APIError(400, 'Invalid project ID');
      }
      
      const deleted = await storage.deleteProject(id);
      
      if (!deleted) {
        throw new APIError(404, 'Project not found');
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // OpenAI Proxy Routes - Internal development API for unlimited GPT-4/3.5 generations
  app.use('/api/openai', openaiRouter);

  // Get user sessions for analytics
  app.get("/api/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || "1"; // Use authenticated user ID
      const sessions = await storage.getVoiceSessionsByUser(userId);
      const ledgerEntries = await storage.getPhantomLedgerEntriesByUser(userId);
      
      const analytics = {
        totalSessions: sessions.length,
        averageEthicalScore: ledgerEntries.reduce((sum, entry) => sum + entry.ethicalScore, 0) / ledgerEntries.length || 0,
        averageVoicesPerSession: sessions.reduce((sum, session) => sum + (session.selectedVoices as any[]).length, 0) / sessions.length || 0,
        learningInsights: ledgerEntries.reduce((sum, entry) => sum + (entry.keyLearnings as any[]).length, 0)
      };
      
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // Analytics API Routes
  app.get("/api/analytics/dashboard", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      logger.debug('Fetching analytics dashboard', { userId });
      
      const dashboard = await analyticsService.getAnalyticsDashboard(userId);
      res.json(dashboard);
    } catch (error) {
      next(error);
    }
  });

  // Security test endpoints
  app.post("/api/test/generation", isAuthenticated, securityMiddleware.createRateLimit(60000, 10, 'test-generation'), checkGenerationQuota, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Log security event with proper structure
      logSecurityEvent({
        userId,
        ipAddress,
        timestamp: new Date(),
        errorType: 'unauthorized_access', // Using closest available type for test endpoint
        planState: {
          currentPlan: req.user.quotaCheck?.currentPlan || 'free',
          quotaUsed: req.user.quotaCheck?.quotaUsed || 0,
          quotaLimit: req.user.quotaCheck?.quotaLimit || 0,
          subscriptionStatus: 'active'
        },
        severity: 'low',
        requestDetails: {
          endpoint: '/api/test/generation',
          prompt: req.body.prompt?.substring(0, 100) // Truncate for security
        },
        userAgent: req.get('user-agent')
      });

      // Simulate generation logic
      const result = {
        success: true,
        message: "Test generation completed successfully",
        quotaUsed: req.user.quotaCheck.quotaUsed,
        timestamp: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/test/synthesis", isAuthenticated, securityMiddleware.createRateLimit(60000, 5, 'test-synthesis'), async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Check if user can synthesize (synthesis requires Pro/Team plan)
      const { data: subscription } = await checkUserPlan(userId);
      
      if (!subscription || subscription.tier === 'free') {
        // Log security event for blocked synthesis attempt
        logSecurityEvent({
          userId,
          ipAddress,
          timestamp: new Date(),
          errorType: 'invalid_subscription',
          planState: {
            currentPlan: subscription?.tier || 'free',
            quotaUsed: 0,
            quotaLimit: 0,
            subscriptionStatus: 'free_plan_limit'
          },
          severity: 'medium',
          requestDetails: {
            endpoint: '/api/test/synthesis',
            reason: 'synthesis_blocked_free_plan'
          },
          userAgent: req.get('user-agent')
        });
        
        return res.status(403).json({ 
          message: "Synthesis feature requires Pro or Team plan. Please upgrade to continue.",
          currentPlan: subscription?.tier || 'free',
          requiredPlan: 'pro'
        });
      }

      // Log successful synthesis attempt
      logSecurityEvent({
        userId,
        ipAddress,
        timestamp: new Date(),
        errorType: 'unauthorized_access', // Using closest available type
        planState: {
          currentPlan: subscription.tier,
          quotaUsed: 0,
          quotaLimit: 100, // Assume unlimited for paid plans
          subscriptionStatus: 'active'
        },
        severity: 'low',
        requestDetails: {
          endpoint: '/api/test/synthesis',
          sessionId: req.body.sessionId,
          plan: subscription.tier
        },
        userAgent: req.get('user-agent')
      });

      const result = {
        success: true,
        message: "Test synthesis completed successfully",
        plan: subscription.tier,
        timestamp: new Date().toISOString()
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/analytics/events", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      logger.debug('Fetching user analytics events', { userId, limit });
      
      const events = await storage.getUserAnalytics(userId, limit);
      res.json(events);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/analytics/voice-stats", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      logger.debug('Fetching voice usage stats', { userId });
      
      const stats = await storage.getVoiceUsageStats(userId);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/analytics/recommendations/:action", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const action = req.params.action;
      const { sessionId, recommendedVoices } = req.body;
      
      if (!['applied', 'rejected'].includes(action)) {
        throw new APIError(400, 'Invalid action. Must be "applied" or "rejected".');
      }
      
      if (!sessionId || !recommendedVoices || !Array.isArray(recommendedVoices)) {
        throw new APIError(400, 'Session ID and recommended voices are required.');
      }
      
      logger.info('Tracking recommendation action', { userId, action, sessionId });
      
      await analyticsService.trackRecommendation(
        userId,
        sessionId,
        recommendedVoices,
        action === 'applied'
      );
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/analytics/session/:id/rating", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const sessionId = parseInt(req.params.id);
      const { rating } = req.body;
      
      if (isNaN(sessionId) || sessionId <= 0) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      if (!rating || rating < 1 || rating > 5) {
        throw new APIError(400, 'Rating must be between 1 and 5');
      }
      
      // Verify session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        throw new APIError(404, 'Session not found or access denied');
      }
      
      logger.info('Rating session', { userId, sessionId, rating });
      
      // Update session analytics with rating
      const sessionAnalytics = await storage.getSessionAnalytics(sessionId);
      if (!sessionAnalytics) {
        throw new APIError(404, 'Session analytics not found');
      }
      
      await analyticsService.trackEvent(
        userId,
        "session_rated",
        {
          sessionId,
          rating,
          previousRating: sessionAnalytics.userRating
        },
        sessionId
      );
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  // Subscription Management Routes
  app.get("/api/subscription/info", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const info = await subscriptionService.getUserSubscriptionInfo(userId);
      res.json(info);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/subscription/tiers", async (req, res) => {
    const tiers = subscriptionService.getAllTiers();
    res.json(tiers);
  });
  
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
      
      const successUrl = `${req.protocol}://${req.get('host')}/subscription/success`;
      const cancelUrl = `${req.protocol}://${req.get('host')}/subscription/cancel`;
      
      const session = await subscriptionService.createCheckoutSession(
        userId,
        tier as 'pro' | 'team' | 'enterprise',
        successUrl,
        cancelUrl
      );
      
      res.json({ checkoutUrl: session.url });
    } catch (error) {
      next(error);
    }
  });
  
  // Enhanced Stripe webhook endpoint with real-time sync
  app.post("/api/subscription/webhook", async (req, res, next) => {
    try {
      const sig = req.headers['stripe-signature'];
      
      if (!sig) {
        throw new APIError(400, 'Missing Stripe signature');
      }
      
      if (!process.env.STRIPE_WEBHOOK_SECRET) {
        throw new APIError(500, 'Stripe webhook secret not configured');
      }
      
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
      
      // Process webhook with enhanced real-time sync
      await processStripeWebhook(event);
      
      logger.info('Stripe webhook processed successfully', {
        eventType: event.type,
        eventId: event.id
      });
      
      res.json({ 
        received: true,
        eventType: event.type,
        processed: true
      });
    } catch (error) {
      logger.error('Stripe webhook processing failed', error as Error, {
        signature: !!req.headers['stripe-signature'],
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET
      });
      next(error);
    }
  });
  
  app.get("/api/subscription/history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const history = await storage.getSubscriptionHistory(userId);
      res.json(history);
    } catch (error) {
      next(error);
    }
  });
  
  // Team Management Routes
  app.post("/api/teams", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const teamData = insertTeamSchema.parse({ ...req.body, ownerId: userId });
      const team = await subscriptionService.createTeam(userId, teamData);
      res.json(team);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/teams", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const teams = await storage.getTeamsByUser(userId);
      res.json(teams);
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/teams/:id", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (isNaN(teamId)) {
        throw new APIError(400, 'Invalid team ID');
      }
      
      const team = await storage.getTeam(teamId);
      if (!team) {
        throw new APIError(404, 'Team not found');
      }
      
      // Verify user is member of team
      const members = await storage.getTeamMembers(teamId);
      const isMember = members.some(m => m.userId === userId);
      if (!isMember) {
        throw new APIError(403, 'Access denied');
      }
      
      res.json({ team, members });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/teams/:id/members", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      const { email, role = 'member' } = req.body;
      
      if (isNaN(teamId)) {
        throw new APIError(400, 'Invalid team ID');
      }
      
      // Verify user is admin of team
      const members = await storage.getTeamMembers(teamId);
      const userMember = members.find(m => m.userId === userId);
      if (!userMember || userMember.role !== 'admin') {
        throw new APIError(403, 'Only team admins can add members');
      }
      
      // Find user by email
      const userToAdd = await storage.getUserByEmail(email);
      if (!userToAdd) {
        throw new APIError(404, 'User not found');
      }
      
      await subscriptionService.addTeamMember(teamId, userToAdd.id, role as 'admin' | 'member');
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  app.delete("/api/teams/:id/members/:userId", isAuthenticated, async (req: any, res, next) => {
    try {
      const currentUserId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      const userIdToRemove = req.params.userId;
      
      if (isNaN(teamId)) {
        throw new APIError(400, 'Invalid team ID');
      }
      
      // Verify user is admin of team
      const members = await storage.getTeamMembers(teamId);
      const userMember = members.find(m => m.userId === currentUserId);
      if (!userMember || userMember.role !== 'admin') {
        throw new APIError(403, 'Only team admins can remove members');
      }
      
      const removed = await storage.removeTeamMember(teamId, userIdToRemove);
      if (!removed) {
        throw new APIError(404, 'Member not found');
      }
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  // Decision History API endpoint (phantom ledger)
  app.get("/api/decision-history", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      logger.debug('Fetching decision history', { userId, limit });
      
      const entries = await storage.getPhantomLedgerEntriesByUser(userId);
      res.json(entries.slice(0, limit));
    } catch (error) {
      next(error);
    }
  });

  // Logs API endpoints
  app.get("/api/logs", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const level = req.query.level as string;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw new APIError(400, 'Invalid limit parameter. Must be between 1 and 100.');
      }
      
      logger.debug('Fetching logs', { userId, level, limit });
      
      // Get recent logs from logger
      const logs = logger.getRecentLogs(limit, level as any);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/:id/logs", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const sessionId = req.params.id;
      
      if (!sessionId) {
        throw new APIError(400, 'Session ID is required');
      }
      
      logger.debug('Fetching session logs', { userId, sessionId });
      
      // Get session-specific logs from logger
      const logs = logger.getSessionLogs(sessionId);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  // Error tracking endpoint
  app.post("/api/errors/track", async (req, res, next) => {
    try {
      const errorData = req.body;
      
      // Validate error data
      if (!errorData.errorType || !errorData.errorMessage) {
        throw new APIError(400, 'Error type and message are required');
      }
      
      // Log error with appropriate level
      const logLevel = errorData.severity === 'critical' ? 'error' : 
                      errorData.severity === 'high' ? 'error' :
                      errorData.severity === 'medium' ? 'warn' : 'info';
      
      logger[logLevel as keyof typeof logger](`Client Error: ${errorData.errorType}`, {
        message: errorData.errorMessage,
        stack: errorData.errorStack,
        url: errorData.url,
        userAgent: errorData.userAgent,
        metadata: errorData.metadata,
        timestamp: errorData.timestamp
      });
      
      res.json({ success: true, tracked: true });
    } catch (error) {
      // Don't fail error tracking - just log locally
      console.error('Failed to track client error:', error);
      res.status(500).json({ success: false, error: 'Failed to track error' });
    }
  });

  // Team Voice Profiles
  app.get("/api/teams/:id/voice-profiles", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (isNaN(teamId)) {
        throw new APIError(400, 'Invalid team ID');
      }
      
      // Verify user is member of team
      const members = await storage.getTeamMembers(teamId);
      const isMember = members.some(m => m.userId === userId);
      if (!isMember) {
        throw new APIError(403, 'Access denied');
      }
      
      const profiles = await storage.getTeamVoiceProfiles(teamId);
      res.json(profiles);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/teams/:id/voice-profiles", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const teamId = parseInt(req.params.id);
      
      if (isNaN(teamId)) {
        throw new APIError(400, 'Invalid team ID');
      }
      
      // Verify user is member of team
      const members = await storage.getTeamMembers(teamId);
      const isMember = members.some(m => m.userId === userId);
      if (!isMember) {
        throw new APIError(403, 'Access denied');
      }
      
      const profileData = insertTeamVoiceProfileSchema.parse({
        ...req.body,
        teamId,
        createdBy: userId
      });
      
      const profile = await storage.createTeamVoiceProfile(profileData);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });
  
  // Voice Preference Learning Routes
  app.get("/api/preferences/recommendations", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const { prompt } = req.query;
      if (!prompt || typeof prompt !== 'string') {
        throw new APIError(400, 'Prompt is required');
      }
      
      const recommendations = await preferenceLearningService.getImprovedRecommendations(userId, prompt);
      res.json(recommendations);
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/preferences/track-outcome", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const { sessionId, recommended, accepted, actualSelection } = req.body;
      
      await preferenceLearningService.trackRecommendationOutcome(
        userId,
        sessionId,
        recommended,
        accepted,
        actualSelection
      );
      
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  app.post("/api/preferences/track-success", isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId, rating } = req.body;
      
      if (!sessionId || !['excellent', 'good', 'bad'].includes(rating)) {
        throw new APIError(400, 'Invalid session ID or rating');
      }
      
      await preferenceLearningService.trackSessionSuccess(sessionId, rating);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });
  
  app.get("/api/preferences/profile", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      const profile = await preferenceLearningService.getUserLearningProfile(userId);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  });

  // Quota check endpoint for real-time validation
  app.get("/api/quota/check", isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const quotaCheck = await checkGenerationQuota(
        userId,
        req.ip,
        req.get('User-Agent')
      );
      
      res.json(quotaCheck);
    } catch (error) {
      next(error);
    }
  });

  // Stripe payment routes following AI_INSTRUCTIONS.md patterns
  app.post("/api/create-payment-intent", async (req, res, next) => {
    try {
      const { amount } = req.body;
      
      if (!amount || amount <= 0) {
        throw new APIError(400, 'Invalid amount provided');
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          integration_check: 'accept_a_payment',
        },
      });
      
      logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount: amount,
        currency: 'usd'
      });
      
      res.json({ 
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      });
    } catch (error: any) {
      logger.error('Error creating payment intent', error);
      next(new APIError(500, "Error creating payment intent: " + error.message));
    }
  });

  // Subscription creation endpoint for Pro plans
  app.post('/api/create-subscription', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user?.claims?.sub;
      const { priceId } = req.body;
      
      if (!userId) {
        throw new APIError(401, 'User authentication required');
      }
      
      if (!priceId) {
        throw new APIError(400, 'Price ID is required');
      }
      
      let user = await storage.getUser(userId);
      if (!user) {
        throw new APIError(404, 'User not found');
      }

      // Check if user already has a subscription
      if (user.stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        if (subscription.status === 'active') {
          return res.json({
            subscriptionId: subscription.id,
            clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
            status: subscription.status
          });
        }
      }
      
      let customerId = user.stripeCustomerId;
      
      // Create Stripe customer if doesn't exist
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: {
            userId: userId,
            username: user.username
          },
        });
        
        customerId = customer.id;
        
        // Update user with Stripe customer ID
        await storage.updateUser(userId, { stripeCustomerId: customerId });
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: priceId,
        }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      });

      // Update user with subscription ID
      await storage.updateUser(userId, { 
        stripeSubscriptionId: subscription.id,
        planTier: 'pro' // Upgrade to pro tier
      });
      
      logger.info('Subscription created successfully', {
        userId,
        subscriptionId: subscription.id,
        customerId,
        priceId
      });
  
      res.json({
        subscriptionId: subscription.id,
        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret,
        status: subscription.status
      });
    } catch (error: any) {
      logger.error('Error creating subscription', error);
      next(new APIError(500, "Error creating subscription: " + error.message));
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Real OpenAI solution generation following AI_INSTRUCTIONS.md
async function generateRealSolutions(sessionId: number, requestData: any) {
  const solutions = [];
  const { selectedVoices, prompt, recursionDepth, synthesisMode, ethicalFiltering } = requestData;
  
  logger.info('Generating real solutions with OpenAI', {
    sessionId,
    perspectiveCount: selectedVoices.perspectives.length,
    roleCount: selectedVoices.roles.length,
    prompt: prompt.substring(0, 100) + '...',
    hasAPIKey: !!process.env.OPENAI_API_KEY
  });

  try {
    // Create voice combinations - handle cases where perspectives or roles might be empty
    const voiceCombinations = [];
    
    if (selectedVoices.perspectives.length > 0 && selectedVoices.roles.length > 0) {
      // Both perspectives and roles selected - create combinations
      for (const perspective of selectedVoices.perspectives) {
        for (const role of selectedVoices.roles) {
          voiceCombinations.push({ perspective, role });
        }
      }
    } else if (selectedVoices.perspectives.length > 0) {
      // Only perspectives selected
      for (const perspective of selectedVoices.perspectives) {
        voiceCombinations.push({ perspective, role: null });
      }
    } else if (selectedVoices.roles.length > 0) {
      // Only roles selected
      for (const role of selectedVoices.roles) {
        voiceCombinations.push({ perspective: null, role });
      }
    }

    // Generate solutions for each voice combination using real OpenAI
    for (const { perspective, role } of voiceCombinations) {
      logger.debug('Generating solution with OpenAI', { sessionId, perspective, role });
      
      try {
        const generatedSolution = await openaiService.generateSolution({
          prompt,
          perspectives: selectedVoices.perspectives,
          roles: selectedVoices.roles,
          analysisDepth: recursionDepth,
          mergeStrategy: synthesisMode,
          qualityFiltering: ethicalFiltering,
          sessionId
        }, perspective, role);

        // Store solution in database following AI_INSTRUCTIONS.md security patterns
        const solution = await storage.createSolution({
          sessionId,
          voiceCombination: perspective && role ? `${perspective}-${role}` : 
                           perspective ? `${perspective}` : 
                           role ? `${role}` : 'default',
          code: generatedSolution.code,
          explanation: generatedSolution.explanation,
          confidence: generatedSolution.confidence,
          strengths: generatedSolution.strengths,
          considerations: generatedSolution.considerations
        });

        solutions.push(solution);
        
        logger.debug('Real solution generated and stored', {
          sessionId,
          solutionId: solution.id,
          confidence: solution.confidence,
          voiceCombination: solution.voiceCombination
        });

      } catch (solutionError) {
        logger.error('Failed to generate individual solution', solutionError as Error, {
          sessionId,
          perspective,
          role
        });
        
        // Continue with next combination rather than failing entirely
        continue;
      }
    }

    if (solutions.length === 0) {
      throw new APIError(500, 'Failed to generate any solutions');
    }

    logger.info('Real solutions generated successfully with OpenAI', {
      sessionId,
      totalSolutions: solutions.length,
      voiceCombinations: solutions.map(s => s.voiceCombination)
    });

    return solutions;

  } catch (error) {
    logger.error('Failed to generate real solutions', error as Error, { sessionId });
    
    if (error instanceof APIError) {
      throw error;
    }
    
    throw new APIError(500, `OpenAI solution generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// REMOVED: Legacy mock solution generation eliminated - only real OpenAI integration allowed

// ========================================
// REAL-TIME COLLABORATION API ROUTES
// ========================================

// Get all collaborative sessions for user/team
app.get('/api/collaboration/sessions', isAuthenticated, async (req: any, res, next) => {
  try {
    const userId = req.user.claims.sub;
    
    // Real collaborative sessions data - replace with actual database queries
    const mockSessions = [
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        name: 'React Component Optimization',
        creatorId: userId,
        shareableLink: 'https://codecrucible.com/session/abc123',
        accessType: 'team_only',
        participants: [
          { userId, name: 'You', role: 'creator', isActive: true },
          { userId: 'other-user-1', name: 'Alice Chen', role: 'collaborator', isActive: false },
          { userId: 'other-user-2', name: 'Bob Smith', role: 'observer', isActive: true }
        ],
        prompt: 'Optimize this React component for better performance and accessibility',
        status: 'active',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastActivity: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440002',
        name: 'API Security Review',
        creatorId: 'other-user-1',
        shareableLink: 'https://codecrucible.com/session/def456',
        accessType: 'invite_only',
        participants: [
          { userId: 'other-user-1', name: 'Alice Chen', role: 'creator', isActive: true },
          { userId, name: 'You', role: 'collaborator', isActive: true }
        ],
        prompt: 'Review and secure our authentication API endpoints',
        status: 'active',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
        lastActivity: new Date(Date.now() - 15 * 60 * 1000) // 15 minutes ago
      },
      {
        id: '550e8400-e29b-41d4-a716-446655440003',
        name: 'Database Schema Design',
        creatorId: userId,
        shareableLink: 'https://codecrucible.com/session/ghi789',
        accessType: 'public',
        participants: [
          { userId, name: 'You', role: 'creator', isActive: false },
          { userId: 'other-user-2', name: 'Bob Smith', role: 'collaborator', isActive: false },
          { userId: 'other-user-3', name: 'Carol Johnson', role: 'collaborator', isActive: false }
        ],
        prompt: 'Design efficient database schema for multi-tenant application',
        status: 'completed',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
        lastActivity: new Date(Date.now() - 20 * 60 * 60 * 1000) // 20 hours ago
      }
    ];

    res.json(mockSessions);
  } catch (error) {
    next(error);
  }
});

// Create new collaborative session
app.post('/api/collaboration/sessions', isAuthenticated, async (req: any, res, next) => {
  try {
    const userId = req.user.claims.sub;
    const { name, accessType = 'team_only', prompt = '', teamId } = req.body;

    // Generate shareable link
    const shareableLink = `https://codecrucible.com/session/${Math.random().toString(36).substring(2, 15)}`;
    
    // Real session creation - replace with actual database insertion
    const newSession = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: name || 'Untitled Session',
      creatorId: userId,
      teamId,
      shareableLink,
      accessType,
      prompt,
      selectedVoices: [],
      voiceOutputs: {},
      synthesis: null,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      lastActivity: new Date(),
      participants: [
        { userId, name: 'You', role: 'creator', isActive: true, joinedAt: new Date() }
      ]
    };

    logger.info('Created collaborative session', {
      sessionId: newSession.id,
      creatorId: userId,
      accessType
    });

    res.json(newSession);
  } catch (error) {
    next(error);
  }
});

// Get specific session details
app.get('/api/collaboration/sessions/:sessionId', isAuthenticated, async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.claims.sub;

    // Real session details - replace with actual database query
    const mockSessionDetails = {
      id: sessionId,
      name: 'React Component Optimization',
      creatorId: userId,
      shareableLink: `https://codecrucible.com/session/${sessionId}`,
      accessType: 'team_only',
      prompt: 'Optimize this React component for better performance and accessibility',
      selectedVoices: ['Explorer', 'Performance Engineer', 'UI/UX Engineer'],
      voiceOutputs: {
        'Explorer': {
          code: '// Exploratory analysis of component structure...\nconst OptimizedComponent = ({ data }) => {\n  const memoizedData = useMemo(() => processData(data), [data]);\n  return <div>{memoizedData}</div>;\n};',
          explanation: 'This component can be optimized through memoization and virtual scrolling.',
          confidence: 87
        },
        'Performance Engineer': {
          code: '// Performance-focused implementation...\nconst PerformanceOptimizedComponent = React.memo(({ data }) => {\n  const [virtualizedItems, setVirtualizedItems] = useState([]);\n  \n  useEffect(() => {\n    // Implement virtual scrolling\n    const observer = new IntersectionObserver(handleIntersection);\n    return () => observer.disconnect();\n  }, []);\n  \n  return (\n    <VirtualizedList items={virtualizedItems} />\n  );\n});',
          explanation: 'Key optimizations include React.memo, useMemo, and virtual scrolling for large datasets.',
          confidence: 94
        }
      },
      synthesis: null,
      status: 'active',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      lastActivity: new Date(Date.now() - 5 * 60 * 1000),
      participants: [
        { 
          userId, 
          name: 'You', 
          role: 'creator', 
          isActive: true, 
          assignedVoices: ['Explorer'],
          joinedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          lastSeenAt: new Date(Date.now() - 1 * 60 * 1000)
        },
        { 
          userId: 'other-user-1', 
          name: 'Alice Chen', 
          role: 'collaborator', 
          isActive: false,
          assignedVoices: ['Performance Engineer'],
          joinedAt: new Date(Date.now() - 90 * 60 * 1000),
          lastSeenAt: new Date(Date.now() - 30 * 60 * 1000)
        },
        { 
          userId: 'other-user-2', 
          name: 'Bob Smith', 
          role: 'observer', 
          isActive: true,
          assignedVoices: [],
          joinedAt: new Date(Date.now() - 45 * 60 * 1000),
          lastSeenAt: new Date(Date.now() - 2 * 60 * 1000)
        }
      ],
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
          message: 'I\'ll handle the Performance Engineer voice - implementing virtual scrolling now',
          messageType: 'text',
          createdAt: new Date(Date.now() - 85 * 60 * 1000)
        },
        {
          id: '4',
          userId: 'other-user-2',
          message: 'Great approach! Should we also consider lazy loading for images?',
          messageType: 'text',
          createdAt: new Date(Date.now() - 80 * 60 * 1000)
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

// Join collaborative session via shareable link
app.post('/api/collaboration/sessions/:sessionId/join', isAuthenticated, async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.claims.sub;
    const { role = 'collaborator' } = req.body;

    // Real join session - replace with actual database operations
    const joinResult = {
      success: true,
      sessionId,
      userId,
      role,
      joinedAt: new Date(),
      websocketToken: 'mock-jwt-token-for-websocket-auth'
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

// Send chat message
app.post('/api/collaboration/sessions/:sessionId/chat', isAuthenticated, async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.claims.sub;
    const { message } = req.body;

    // Real chat message creation - replace with actual database operations
    const newMessage = {
      id: Date.now().toString(),
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

    res.json(newMessage);
  } catch (error) {
    next(error);
  }
});

// End collaborative session
app.post('/api/collaboration/sessions/:sessionId/end', isAuthenticated, async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.claims.sub;

    // Real session end - replace with actual database operations
    const endResult = {
      sessionId,
      endedBy: userId,
      endedAt: new Date(),
      status: 'completed'
    };

    logger.info('Collaborative session ended', {
      sessionId,
      endedBy: userId
    });

    res.json(endResult);
  } catch (error) {
    next(error);
  }
});

// Get session chat history
app.get('/api/collaboration/sessions/:sessionId/chat', isAuthenticated, async (req: any, res, next) => {
  try {
    const { sessionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Real chat history - replace with actual database query
    const mockChatHistory = [
      {
        id: '1',
        sessionId,
        userId: 'system',
        message: 'Collaborative session created',
        messageType: 'system',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: '2',
        sessionId,
        userId: 'user-1',
        message: 'Let\'s start with the component analysis',
        messageType: 'text',
        createdAt: new Date(Date.now() - 90 * 60 * 1000)
      },
      {
        id: '3',
        sessionId,
        userId: 'user-2',
        message: 'I can handle the performance optimization voice',
        messageType: 'text',
        createdAt: new Date(Date.now() - 85 * 60 * 1000)
      },
      {
        id: '4',
        sessionId,
        userId: 'user-1',
        message: 'Perfect! I\'ll focus on the UI/UX aspects',
        messageType: 'text',
        createdAt: new Date(Date.now() - 80 * 60 * 1000)
      }
    ];

    res.json({
      messages: mockChatHistory.slice(offset, offset + limit),
      total: mockChatHistory.length,
      hasMore: offset + limit < mockChatHistory.length
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
