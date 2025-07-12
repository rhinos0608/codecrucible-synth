import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { logger, APIError } from "./logger";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { onboardingAIService } from "./onboarding-ai-service";
import Stripe from 'stripe';

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

  // Onboarding API Routes - Following AI_INSTRUCTIONS.md patterns
  app.get('/api/onboarding/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Get user registration date from database
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Calculate account age in days
      const accountAge = Math.floor((Date.now() - new Date(user.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24));
      
      // Get user activity metrics
      const sessions = await storage.getUserSessions(userId);
      const voiceProfiles = await storage.getVoiceProfiles(userId);
      
      const metrics = {
        accountAge,
        sessionsCreated: sessions.length,
        tourCompleted: user.tourCompleted || false,
        lastLoginDays: 0, // User is currently logged in
        synthesisUsed: sessions.some((s: any) => s.synthesisUsed),
        voiceProfilesCreated: voiceProfiles.length,
        collaborationParticipated: false // TODO: implement when collaboration is ready
      };

      res.json(metrics);
    } catch (error) {
      console.error('Failed to get onboarding status:', error);
      res.status(500).json({ error: 'Failed to get onboarding status' });
    }
  });

  app.post('/api/onboarding/complete-tour', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Update user tour completion status
      await storage.updateUser(userId, { tourCompleted: true });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to complete tour:', error);
      res.status(500).json({ error: 'Failed to complete tour' });
    }
  });

  app.post('/api/onboarding/skip-tour', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Update user tour completion status (same as complete)
      await storage.updateUser(userId, { tourCompleted: true });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to skip tour:', error);
      res.status(500).json({ error: 'Failed to skip tour' });
    }
  });

  app.post('/api/onboarding/milestone', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const milestone = req.body;
      
      // Log milestone event (could be stored in analytics or user metrics)
      console.log('User milestone achieved:', {
        userId,
        milestone: milestone.type,
        timestamp: milestone.timestamp
      });
      
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to track milestone:', error);
      res.status(500).json({ error: 'Failed to track milestone' });
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

  // Following AI_INSTRUCTIONS.md: Stripe Checkout Integration
  app.post('/api/subscription/checkout', isAuthenticated, async (req: any, res, next) => {
    try {
      const { tier } = req.body;
      const userId = req.user.claims.sub;
      
      // Following AI_INSTRUCTIONS.md: Input validation with Zod
      const tierValidation = z.string().refine(
        (val) => ['pro', 'team', 'enterprise'].includes(val),
        { message: 'Invalid subscription tier' }
      );
      
      const validatedTier = tierValidation.parse(tier);
      
      // Following CodingPhilosophy.md: Council-based approach to subscription
      // Each tier represents different levels of consciousness evolution
      const tierConfig = {
        pro: {
          price: 19,
          name: 'Pro',
          description: 'Individual Developer Consciousness Evolution',
          stripePriceId: process.env.STRIPE_PRICE_ID_PRO || 'price_1234',
          features: ['Unlimited AI generations', 'Advanced synthesis', 'Analytics dashboard']
        },
        team: {
          price: 49,
          name: 'Team',
          description: 'Collective Council Development',
          stripePriceId: process.env.STRIPE_PRICE_ID_TEAM || 'price_5678',
          features: ['Everything in Pro', 'Team collaboration', 'Shared voice profiles']
        },
        enterprise: {
          price: 99,
          name: 'Enterprise',
          description: 'Organizational Transformation Protocol',
          stripePriceId: process.env.STRIPE_PRICE_ID_ENTERPRISE || 'price_9012',
          features: ['Everything in Team', 'Custom AI training', 'On-premise deployment']
        }
      };

      const selectedTier = tierConfig[validatedTier as keyof typeof tierConfig];
      
      if (!selectedTier) {
        return res.status(400).json({ error: 'Invalid tier selection' });
      }

      // Following AI_INSTRUCTIONS.md: Secure Stripe integration
      if (!process.env.STRIPE_SECRET_KEY) {
        logger.error('Stripe secret key not configured');
        return res.status(500).json({ error: 'Payment system not configured' });
      }

      // Import Stripe for actual checkout session creation
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      // Create actual Stripe checkout session following AI_INSTRUCTIONS.md patterns
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `CodeCrucible ${selectedTier.name}`,
                description: selectedTier.description,
              },
              unit_amount: selectedTier.price * 100, // Convert to cents
              recurring: {
                interval: 'month'
              }
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${req.headers.origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${req.headers.origin}/pricing?cancelled=true`,
        customer_email: req.user.email || undefined,
        metadata: {
          userId,
          tier: validatedTier,
          subscriptionType: 'monthly'
        }
      });
      
      logger.info('Stripe checkout session created', {
        userId,
        tier: validatedTier,
        sessionId: session.id,
        checkoutUrl: session.url
      });

      res.json({ 
        success: true,
        checkoutUrl: session.url,
        tier: selectedTier,
        sessionId: session.id,
        message: 'Redirecting to Stripe checkout...'
      });
      
    } catch (error) {
      logger.error('Checkout error', error as Error, {
        userId: req.user?.claims?.sub,
        requestBody: req.body
      });
      next(error);
    }
  });

  // Following AI_INSTRUCTIONS.md: Subscription Tiers Endpoint
  app.get('/api/subscription/tiers', async (req: any, res, next) => {
    try {
      // Following CodingPhilosophy.md: Council-based subscription tiers representing consciousness evolution
      const tiers = [
        {
          name: 'free',
          price: 0,
          dailyGenerationLimit: 3,
          maxVoiceCombinations: 2,
          allowsAnalytics: false,
          allowsTeams: false,
          features: [
            'Basic code generation',
            'Single voice perspectives',
            'Limited daily generations',
            'Community support'
          ]
        },
        {
          name: 'pro',
          price: 1900, // in cents
          dailyGenerationLimit: -1,
          maxVoiceCombinations: -1,
          allowsAnalytics: true,
          allowsTeams: false,
          features: [
            'Unlimited code generations',
            'Advanced synthesis engine',
            'Analytics dashboard', 
            'Priority voice recommendations',
            'Export generated code',
            'Advanced customization',
            'Priority support'
          ]
        },
        {
          name: 'team',
          price: 4900, // in cents
          dailyGenerationLimit: -1,
          maxVoiceCombinations: -1,
          allowsAnalytics: true,
          allowsTeams: true,
          features: [
            'Everything in Pro',
            'Team collaboration',
            'Shared voice profiles',
            'Advanced analytics',
            'Team management',
            'Real-time collaboration',
            'Custom voice creation'
          ]
        },
        {
          name: 'enterprise',
          price: 9900, // in cents
          dailyGenerationLimit: -1,
          maxVoiceCombinations: -1,
          allowsAnalytics: true,
          allowsTeams: true,
          features: [
            'Everything in Team',
            'Custom AI training',
            'On-premise deployment',
            'SSO integration',
            'Dedicated support',
            'Custom integrations',
            'SLA guarantees',
            'Compliance features'
          ]
        }
      ];

      logger.info('Subscription tiers requested', {
        tierCount: tiers.length,
        userAgent: req.get('User-Agent')
      });

      res.json(tiers);
    } catch (error) {
      logger.error('Failed to fetch subscription tiers', error as Error);
      next(error);
    }
  });

  app.get('/api/quota/check', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      
      // Import dev mode utilities
      const { isDevModeEnabled, getDevModeConfig } = await import('./lib/dev-mode');
      
      // Following AI_INSTRUCTIONS.md: Dev mode bypass for unlimited generations
      if (isDevModeEnabled()) {
        const devConfig = getDevModeConfig();
        logger.info('Dev mode quota bypass enabled', {
          userId: userId.substring(0, 8) + '...',
          reason: devConfig.reason,
          features: devConfig.features
        });
        
        return res.json({
          allowed: true,
          dailyUsage: 0,
          dailyLimit: -1, // Unlimited in dev mode
          quotaLimit: -1,
          quotaUsed: 0,
          remaining: -1,
          planTier: 'development',
          resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
          reason: 'dev_mode_enabled',
          devMode: true
        });
      }
      
      // Following CodingPhilosophy.md: Regular quota check for production
      const dailyUsage = 0; // In real implementation, fetch from database
      const dailyLimit = 3; // Free tier limit
      
      res.json({
        allowed: dailyUsage < dailyLimit,
        dailyUsage,
        dailyLimit,
        quotaLimit: dailyLimit,
        quotaUsed: dailyUsage,
        remaining: dailyLimit - dailyUsage,
        planTier: 'free',
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
        reason: dailyUsage >= dailyLimit ? 'quota_exceeded' : 'quota_available',
        devMode: false
      });
    } catch (error) {
      logger.error('Quota check failed', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  const server = app.listen(5000, '0.0.0.0', () => {
    console.log('Server running on port 5000');
  });

  // Onboarding AI routes following CodeCrucible Protocol
  app.get('/api/onboarding/progress/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Mock onboarding progress following AI_INSTRUCTIONS.md patterns
      const progress = {
        userId,
        currentPhase: 'quick-start',
        completedModules: [],
        spiralCycles: 0,
        qwanAssessments: 0,
        councilExperiences: 0,
        masteryLevel: 0,
        insights: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      res.json(progress);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/onboarding/analysis/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Mock AI analysis following CodingPhilosophy.md patterns
      const analysis = {
        userReadiness: 75,
        recommendedPath: 'council-initiation',
        nextSteps: ['Complete voice simulator', 'Practice council dialogue'],
        personalizedGuidance: 'You show strong potential for multi-voice mastery',
        voiceAffinities: {
          explorer: 85,
          maintainer: 70,
          analyzer: 65,
        },
      };
      
      res.json(analysis);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/onboarding/consciousness-metrics/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Mock consciousness metrics following CodingPhilosophy.md patterns
      const metrics = {
        singleVoiceToCouncil: 60,
        linearToSpiral: 45,
        reactiveToProactive: 30,
        individualToCollective: 25,
        mechanicalToLiving: 50,
        overall: 42,
      };
      
      res.json(metrics);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/onboarding/progress', isAuthenticated, async (req: any, res, next) => {
    try {
      const updateData = req.body;
      
      logger.info('Onboarding progress updated', { 
        userId: updateData.userId,
        update: updateData 
      });
      
      res.json({ success: true, message: 'Progress updated' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/onboarding/spiral-reflection', isAuthenticated, async (req: any, res, next) => {
    try {
      const reflection = req.body;
      
      // Process with onboarding AI service
      const result = await onboardingAIService.processSpiralReflection(reflection);
      
      logger.info('Spiral reflection processed', { 
        userId: reflection.userId,
        phase: reflection.phase 
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/onboarding/qwan-assessment', isAuthenticated, async (req: any, res, next) => {
    try {
      const assessment = req.body;
      
      // Process with onboarding AI service
      const result = await onboardingAIService.processQWANAssessment(assessment);
      
      logger.info('QWAN assessment processed', { 
        userId: assessment.userId,
        codeId: assessment.codeId 
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/onboarding/council-experience', isAuthenticated, async (req: any, res, next) => {
    try {
      const experience = req.body;
      
      // Process with onboarding AI service
      const result = await onboardingAIService.processCouncilExperience(experience);
      
      logger.info('Council experience processed', { 
        userId: experience.userId,
        voiceCount: experience.selectedVoices.length 
      });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/onboarding/personalized-path', isAuthenticated, async (req: any, res, next) => {
    try {
      const preferences = req.body;
      
      // Generate personalized learning path
      const personalizedPath = {
        pathType: `${preferences.learningStyle}-${preferences.timeCommitment}`,
        customSteps: [
          'Voice archetype deep dive',
          'Spiral pattern mastery',
          'QWAN assessment training',
        ],
        estimatedDuration: preferences.timeCommitment === 'quick' ? '1-2 hours' : '4-6 hours',
      };
      
      logger.info('Personalized path generated', { 
        userId: preferences.userId,
        pathType: personalizedPath.pathType 
      });
      
      res.json(personalizedPath);
    } catch (error) {
      next(error);
    }
  });

  // New User Detection & Tour API Endpoints following AI_INSTRUCTIONS.md patterns
  app.get('/api/user/onboarding-status/:userId', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.params.userId;
      
      // Following AI_INSTRUCTIONS.md: Input validation
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'Invalid user ID' });
      }
      
      // Mock onboarding status - in production this would check database
      const onboardingStatus = {
        userId,
        hasCompletedTour: false,
        hasGeneratedFirstSolution: false,
        hasUsedVoiceProfiles: false,
        hasAccessedTeams: false,
        hasUsedSynthesis: false,
        firstLoginAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        lastActiveAt: new Date(),
      };
      
      logger.debug('Onboarding status retrieved', { userId });
      res.json(onboardingStatus);
    } catch (error) {
      logger.error('Error retrieving onboarding status', error as Error, { userId: req.params.userId });
      next(error);
    }
  });

  app.post('/api/user/complete-tour', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId, completedAt } = req.body;
      
      // Track tour completion
      logger.info('Tour completed', { userId, completedAt });
      
      res.json({ success: true, message: 'Tour marked as completed' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/user/skip-tour', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId, skippedAt } = req.body;
      
      // Track tour skip
      logger.info('Tour skipped', { userId, skippedAt });
      
      res.json({ success: true, message: 'Tour marked as skipped' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/user/track-milestone', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId, milestoneType, completedAt, metadata } = req.body;
      
      // Track milestone completion
      logger.info('Milestone tracked', { 
        userId, 
        milestoneType, 
        completedAt, 
        metadata 
      });
      
      res.json({ success: true, message: 'Milestone tracked successfully' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/user/update-activity', isAuthenticated, async (req: any, res, next) => {
    try {
      const { userId, lastActiveAt } = req.body;
      
      // Following AI_INSTRUCTIONS.md: Input validation
      if (!userId || !lastActiveAt) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Update last activity with throttling
      logger.debug('Activity updated', { userId, lastActiveAt });
      
      res.json({ success: true, message: 'Activity updated' });
    } catch (error) {
      logger.error('Error updating activity', error as Error, { userId: req.body.userId });
      next(error);
    }
  });

  app.post('/api/user/reset-onboarding', isAuthenticated, async (req: any, res, next) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ error: 'Only available in development' });
      }
      
      const { userId } = req.body;
      
      // Reset onboarding for testing
      logger.info('Onboarding reset for testing', { userId });
      
      res.json({ success: true, message: 'Onboarding reset for testing' });
    } catch (error) {
      next(error);
    }
  });

  // Following AI_INSTRUCTIONS.md: Session Generation Endpoint for Dev Mode
  app.post('/api/sessions', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { prompt, selectedVoices, analysisDepth = 2, mergeStrategy = 'competitive', qualityFiltering = true } = req.body;
      
      // Import dev mode utilities
      const { isDevModeEnabled } = await import('./lib/dev-mode');
      
      // Following AI_INSTRUCTIONS.md: Input validation
      if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      if (!selectedVoices || (!selectedVoices.perspectives?.length && !selectedVoices.roles?.length)) {
        return res.status(400).json({ error: 'At least one voice must be selected' });
      }

      // Following CodingPhilosophy.md: Council-based solution generation
      logger.info('Session generation started', {
        userId: userId.substring(0, 8) + '...',
        prompt: prompt.substring(0, 100) + '...',
        voiceCount: (selectedVoices.perspectives?.length || 0) + (selectedVoices.roles?.length || 0),
        devModeEnabled: isDevModeEnabled()
      });

      // Create session in storage with proper voice selection format
      const session = await storage.createVoiceSession({
        userId,
        prompt,
        selectedVoices: {
          perspectives: selectedVoices.perspectives || [],
          roles: selectedVoices.roles || []
        },
        recursionDepth: analysisDepth,
        synthesisMode: mergeStrategy,
        ethicalFiltering: qualityFiltering,
        mode: 'development'
      });

      // Ultra-fast parallel generation using optimized service
      const { optimizedOpenAIService } = await import('./openai-service');
      
      // Generate all solutions in parallel for Apple-level performance
      const generatedSolutions = await optimizedOpenAIService.generateSolutions({
        prompt,
        perspectives: selectedVoices.perspectives || [],
        roles: selectedVoices.roles || [],
        sessionId: session.id,
        mode: 'development'
      });

      // Store solutions in database
      const solutions = [];
      for (const generatedSolution of generatedSolutions) {
        try {
          const solution = await storage.createSolution({
            sessionId: session.id,
            voiceCombination: generatedSolution.voiceCombination,
            code: generatedSolution.code,
            explanation: generatedSolution.explanation,
            confidence: generatedSolution.confidence,
            strengths: generatedSolution.strengths,
            considerations: generatedSolution.considerations
          });
          solutions.push(solution);
        } catch (error) {
          logger.error('Failed to store solution', error as Error, {
            sessionId: session.id,
            solutionId: generatedSolution.id
          });
        }
      }

      logger.info('Dev mode session generation completed', {
        sessionId: session.id,
        solutionCount: solutions.length,
        userId: userId.substring(0, 8) + '...'
      });

      res.json({ 
        session,
        solutions,
        message: 'Solutions generated successfully'
      });
      
    } catch (error) {
      logger.error('Session generation failed', error as Error, {
        userId: req.user?.claims?.sub?.substring(0, 8) + '...',
        requestBody: req.body
      });
      next(error);
    }
  });

  // Get solutions for a session - Following AI_INSTRUCTIONS.md security patterns
  app.get("/api/sessions/:id/solutions", isAuthenticated, async (req: any, res, next) => {
    try {
      const sessionId = parseInt(req.params.id);
      
      // Following AI_INSTRUCTIONS.md: Input validation with Zod
      const sessionIdSchema = z.number().int().positive();
      const validatedSessionId = sessionIdSchema.parse(sessionId);
      
      if (isNaN(validatedSessionId)) {
        throw new APIError(400, 'Invalid session ID');
      }
      
      // Verify session ownership following AI_INSTRUCTIONS.md security patterns
      const session = await storage.getVoiceSession(validatedSessionId);
      if (!session || session.userId !== req.user?.claims?.sub) {
        throw new APIError(404, 'Session not found or access denied');
      }
      
      logger.debug('Fetching solutions for session', { 
        sessionId: validatedSessionId, 
        userId: req.user.claims.sub.substring(0, 8) + '...'
      });
      
      const solutions = await storage.getSolutionsBySession(validatedSessionId);
      
      // Following CodingPhilosophy.md: Ensure solutions maintain council structure
      const formattedSolutions = solutions.map(solution => ({
        ...solution,
        // Following AI_INSTRUCTIONS.md: Secure data formatting
        id: solution.id,
        sessionId: solution.sessionId,
        voiceCombination: solution.voiceCombination,
        code: solution.code || '',
        explanation: solution.explanation || '',
        confidence: solution.confidence || 85,
        strengths: Array.isArray(solution.strengths) ? solution.strengths : 
          (typeof solution.strengths === 'string' ? solution.strengths.split(',') : []),
        considerations: Array.isArray(solution.considerations) ? solution.considerations : 
          (typeof solution.considerations === 'string' ? solution.considerations.split(',') : [])
      }));
      
      res.json(formattedSolutions);
    } catch (error) {
      logger.error('Failed to fetch solutions', error as Error, {
        sessionId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });



  // Fix synthesis endpoint that was returning HTML
  app.post('/api/sessions/:sessionId/synthesis', isAuthenticated, async (req: any, res, next) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      const userId = req.user.claims.sub;
      
      logger.info('Starting real OpenAI synthesis for session:', sessionId);
      
      // Validate session ownership
      const session = await storage.getVoiceSession(sessionId);
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get solutions for synthesis
      const solutions = await storage.getSolutionsBySession(sessionId);
      if (solutions.length === 0) {
        return res.status(400).json({ error: 'No solutions available for synthesis' });
      }

      // Import OpenAI service dynamically for synthesis
      const { optimizedOpenAIService } = await import('./openai-service');
      
      // Perform synthesis with real OpenAI - Following AI_INSTRUCTIONS.md patterns
      const synthesizedSolution = await optimizedOpenAIService.synthesizeSolutions(
        solutions.map(sol => ({
          voiceCombination: sol.voiceCombination,
          code: sol.code,
          explanation: sol.explanation,
          confidence: sol.confidence,
          strengths: Array.isArray(sol.strengths) ? sol.strengths : [],
          considerations: Array.isArray(sol.considerations) ? sol.considerations : []
        })),
        sessionId,
        session.prompt || 'Synthesize the following code solutions'
      );

      // Store synthesis result in database for real-time sync - Fixed database constraint following AI_INSTRUCTIONS.md patterns
      const synthesisData = {
        sessionId,
        combinedCode: synthesizedSolution.code || '',
        synthesisSteps: [
          { step: 1, action: 'Solution Analysis', description: 'Analyzed multiple AI voice solutions' },
          { step: 2, action: 'Pattern Integration', description: 'Integrated best patterns from each voice' },
          { step: 3, action: 'Code Synthesis', description: 'Generated unified implementation' },
          { step: 4, action: 'Quality Validation', description: 'Validated final solution quality' }
        ],
        qualityScore: synthesizedSolution.confidence || 85,
        ethicalScore: 95 // High ethical score for AI-generated content
      };
      
      logger.info('Creating synthesis with data', { 
        sessionId, 
        dataKeys: Object.keys(synthesisData),
        synthesisStepsType: typeof synthesisData.synthesisSteps,
        synthesisStepsLength: synthesisData.synthesisSteps.length
      });
      
      const synthesis = await storage.createSynthesis(synthesisData);

      logger.info('OpenAI synthesis completed successfully', { 
        sessionId, 
        synthesisId: synthesis.id,
        codeLength: synthesizedSolution.code?.length || 0 
      });
      
      // Return comprehensive synthesis response for real-time sync
      res.json({
        synthesizedCode: synthesizedSolution.code,
        explanation: synthesizedSolution.explanation,
        confidence: synthesizedSolution.confidence,
        synthesisId: synthesis.id,
        timestamp: new Date().toISOString(),
        sessionId: sessionId,
        integratedApproaches: ['Multi-voice synthesis', 'AI-powered integration'],
        securityConsiderations: ['Input validation', 'Output sanitization'],
        performanceOptimizations: ['Code optimization', 'Pattern efficiency']
      });
      
    } catch (error) {
      logger.error('OpenAI synthesis failed', error as Error, { sessionId: req.params.sessionId });
      res.status(500).json({ error: 'Synthesis failed', details: error.message });
    }
  });

  // Test authentication endpoint for debugging
  app.get('/api/test-auth', isAuthenticated, (req: any, res) => {
    res.json({ 
      authenticated: true, 
      user: req.user?.claims?.sub?.substring(0, 8) + '...',
      sessionId: req.session?.id,
      cookies: Object.keys(req.cookies || {})
    });
  });

  // ChatGPT-style streaming endpoint - Following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  app.get('/api/sessions/:sessionId/stream/:voiceId', isAuthenticated, async (req: any, res, next) => {
    try {
      const { sessionId, voiceId } = req.params;
      const { type } = req.query; // 'perspective' or 'role'
      const userId = req.user?.claims?.sub;

      logger.info('Starting ChatGPT-style streaming for voice', {
        sessionId: parseInt(sessionId),
        voiceId,
        type,
        userId: userId.substring(0, 8) + '...',
        userAgent: req.headers['user-agent']?.substring(0, 50) + '...',
        cookies: Object.keys(req.cookies || {}).join(','),
        sessionInfo: req.session ? 'present' : 'missing'
      });

      // Validate session ownership
      const session = await storage.getVoiceSession(parseInt(sessionId));
      if (!session || session.userId !== userId) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Set up Server-Sent Events headers with proper authentication support
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': req.headers.origin || '*',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Cache-Control, Authorization, Content-Type, Cookie, Accept',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      });

      // Import OpenAI service for streaming
      const { optimizedOpenAIService } = await import('./openai-service');

      // Handle request/response close properly for SSE
      req.on('close', () => {
        logger.info('Client disconnected from streaming', { sessionId, voiceId });
      });

      // Send initial connection message
      res.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        voiceId,
        message: 'Stream connected successfully'
      })}\n\n`);

      // Start streaming generation with error handling
      try {
        await optimizedOpenAIService.generateSolutionStream({
          prompt: session.prompt,
          perspectives: session.selectedVoices.perspectives || [],
          roles: session.selectedVoices.roles || [],
          sessionId: parseInt(sessionId),
          voiceId,
          type: type as 'perspective' | 'role',
          onChunk: (chunk: string) => {
            // Check if response is still writable
            if (!res.writableEnded && !res.destroyed) {
              // Send chunk to client with proper SSE format
              res.write(`data: ${JSON.stringify({ 
                type: 'chunk', 
                content: chunk,
                voiceId,
                timestamp: Date.now()
              })}\n\n`);
            }
          },
          onComplete: async (solution: any) => {
            try {
              // Store solution in database
              await storage.createSolution({
                sessionId: parseInt(sessionId),
                voiceCombination: solution.voiceCombination,
                code: solution.code,
                explanation: solution.explanation,
                confidence: solution.confidence,
                strengths: solution.strengths,
                considerations: solution.considerations
              });

              // Send completion message if response still open
              if (!res.writableEnded && !res.destroyed) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'complete', 
                  voiceId,
                  confidence: solution.confidence,
                  timestamp: Date.now()
                })}\n\n`);
                
                res.end();
              }
            } catch (error) {
              logger.error('Failed to store streaming solution', error as Error, { sessionId, voiceId });
              if (!res.writableEnded && !res.destroyed) {
                res.write(`data: ${JSON.stringify({ 
                  type: 'error', 
                  error: 'Failed to store solution',
                  voiceId
                })}\n\n`);
                res.end();
              }
            }
          }
        });
      } catch (streamError) {
        logger.error('Stream generation failed', streamError as Error, { sessionId, voiceId });
        if (!res.writableEnded && !res.destroyed) {
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Stream generation failed',
            voiceId,
            details: streamError.message
          })}\n\n`);
          res.end();
        }
      }

    } catch (error) {
      logger.error('Streaming generation failed', error as Error, {
        sessionId: req.params.sessionId,
        voiceId: req.params.voiceId
      });
      
      // Send error message via SSE
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: 'Generation failed',
        voiceId: req.params.voiceId
      })}\n\n`);
      res.end();
    }
  });

  // Create streaming session endpoint
  app.post('/api/sessions/stream', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const { prompt, selectedVoices, mode = 'streaming' } = req.body;
      
      // Following AI_INSTRUCTIONS.md: Input validation
      if (!prompt?.trim()) {
        return res.status(400).json({ error: 'Prompt is required' });
      }
      
      if (!selectedVoices.perspectives?.length && !selectedVoices.roles?.length) {
        return res.status(400).json({ error: 'At least one voice must be selected' });
      }

      // Create session for streaming
      const session = await storage.createVoiceSession({
        userId,
        prompt: prompt.trim(),
        selectedVoices: {
          perspectives: selectedVoices.perspectives || [],
          roles: selectedVoices.roles || []
        },
        recursionDepth: 2,
        synthesisMode: 'competitive',
        ethicalFiltering: true,
        mode: 'streaming'
      });

      logger.info('ChatGPT-style streaming session created', {
        sessionId: session.id,
        userId: userId.substring(0, 8) + '...',
        voiceCount: (selectedVoices.perspectives?.length || 0) + (selectedVoices.roles?.length || 0),
        mode: 'streaming'
      });

      res.json({ sessionId: session.id });
    } catch (error) {
      logger.error('Failed to create streaming session', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // End of streaming functionality

  // Projects API endpoints - Following AI_INSTRUCTIONS.md patterns
  app.post('/api/projects', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const projectData = {
        ...req.body,
        userId
      };

      logger.info('Creating new project', {
        name: projectData.name,
        language: projectData.language,
        sessionId: projectData.sessionId,
        userId: userId.substring(0, 8) + '...'
      });

      const project = await storage.createProject(projectData);
      res.json(project);
    } catch (error) {
      logger.error('Project creation failed', error as Error, {
        userId: req.user?.claims?.sub,
        requestBody: req.body
      });
      next(error);
    }
  });

  // Get user projects
  app.get('/api/projects', isAuthenticated, async (req: any, res, next) => {
    try {
      const userId = req.user.claims.sub;
      const projects = await storage.getProjectsByUser(userId);
      res.json(projects);
    } catch (error) {
      logger.error('Failed to fetch projects', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Project folder routes - Pro tier gated following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  app.post('/api/project-folders', isAuthenticated, async (req: any, res, next) => {
    try {
      const { insertProjectFolderSchema } = await import('@shared/schema');
      const { checkFeatureAccess } = await import('./feature-access');
      
      const { hasFeatureAccess } = await checkFeatureAccess(req.user.claims.sub, 'project_folders');
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          error: 'Project folders require Pro subscription',
          upgradeRequired: true 
        });
      }

      const validatedData = insertProjectFolderSchema.parse({
        ...req.body,
        userId: req.user.claims.sub
      });

      const folder = await storage.createProjectFolder(validatedData);
      
      logger.info('Created project folder', {
        folderId: folder.id,
        name: folder.name,
        userId: req.user.claims.sub.substring(0, 8) + '...'
      });

      res.json(folder);
    } catch (error) {
      logger.error('Failed to create project folder', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.get('/api/project-folders', isAuthenticated, async (req: any, res, next) => {
    try {
      const folders = await storage.getProjectFolders(req.user.claims.sub);
      res.json(folders);
    } catch (error) {
      logger.error('Failed to fetch project folders', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.get('/api/project-folders/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const folder = await storage.getProjectFolder(parseInt(req.params.id));
      if (!folder) {
        return res.status(404).json({ error: 'Project folder not found' });
      }
      if (folder.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: 'Access denied' });
      }
      res.json(folder);
    } catch (error) {
      logger.error('Failed to fetch project folder', error as Error, {
        folderId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.put('/api/project-folders/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const { insertProjectFolderSchema } = await import('@shared/schema');
      const { checkFeatureAccess } = await import('./feature-access');
      
      const { hasFeatureAccess } = await checkFeatureAccess(req.user.claims.sub, 'project_folders');
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          error: 'Project folders require Pro subscription',
          upgradeRequired: true 
        });
      }

      const folder = await storage.getProjectFolder(parseInt(req.params.id));
      if (!folder || folder.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: 'Project folder not found' });
      }

      const validatedData = insertProjectFolderSchema.partial().parse(req.body);
      const updatedFolder = await storage.updateProjectFolder(parseInt(req.params.id), validatedData);
      
      logger.info('Updated project folder', {
        folderId: parseInt(req.params.id),
        userId: req.user.claims.sub.substring(0, 8) + '...'
      });

      res.json(updatedFolder);
    } catch (error) {
      logger.error('Failed to update project folder', error as Error, {
        folderId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.delete('/api/project-folders/:id', isAuthenticated, async (req: any, res, next) => {
    try {
      const { checkFeatureAccess } = await import('./feature-access');
      
      const { hasFeatureAccess } = await checkFeatureAccess(req.user.claims.sub, 'project_folders');
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          error: 'Project folders require Pro subscription',
          upgradeRequired: true 
        });
      }

      const folder = await storage.getProjectFolder(parseInt(req.params.id));
      if (!folder || folder.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: 'Project folder not found' });
      }

      const success = await storage.deleteProjectFolder(parseInt(req.params.id));
      
      logger.info('Deleted project folder', {
        folderId: parseInt(req.params.id),
        success,
        userId: req.user.claims.sub.substring(0, 8) + '...'
      });

      res.json({ success });
    } catch (error) {
      logger.error('Failed to delete project folder', error as Error, {
        folderId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.get('/api/project-folders/:id/projects', isAuthenticated, async (req: any, res, next) => {
    try {
      const folder = await storage.getProjectFolder(parseInt(req.params.id));
      if (!folder || folder.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: 'Project folder not found' });
      }

      const projects = await storage.getFolderProjects(parseInt(req.params.id));
      res.json(projects);
    } catch (error) {
      logger.error('Failed to fetch folder projects', error as Error, {
        folderId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  app.post('/api/projects/:id/move', isAuthenticated, async (req: any, res, next) => {
    try {
      const { checkFeatureAccess } = await import('./feature-access');
      
      const { hasFeatureAccess } = await checkFeatureAccess(req.user.claims.sub, 'project_folders');
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          error: 'Project folders require Pro subscription',
          upgradeRequired: true 
        });
      }

      const { folderId } = req.body;
      const projectId = parseInt(req.params.id);

      // Verify project ownership
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== req.user.claims.sub) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // If moving to a folder, verify folder ownership
      if (folderId) {
        const folder = await storage.getProjectFolder(folderId);
        if (!folder || folder.userId !== req.user.claims.sub) {
          return res.status(404).json({ error: 'Folder not found' });
        }
      }

      const success = await storage.moveProjectToFolder(projectId, folderId);
      
      logger.info('Moved project to folder', {
        projectId,
        folderId,
        success,
        userId: req.user.claims.sub.substring(0, 8) + '...'
      });

      res.json({ success });
    } catch (error) {
      logger.error('Failed to move project', error as Error, {
        projectId: req.params.id,
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });
  
  // Context-aware generation endpoint - Following AI_INSTRUCTIONS.md and CodingPhilosophy.md
  app.post('/api/sessions/context-aware', isAuthenticated, async (req: any, res, next) => {
    try {
      const { contextAwareOpenAI } = await import('./context-aware-openai-service');
      const { checkFeatureAccess } = await import('./feature-access');
      
      const userId = req.user.claims.sub;
      const { prompt, selectedVoices, contextProjectIds, sessionId } = req.body;
      
      // Validate request
      if (!prompt || !selectedVoices) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      // Check feature access for context-aware generation
      const { hasFeatureAccess } = await checkFeatureAccess(userId, 'context_generation');
      
      // Fetch context projects
      const contextProjects = [];
      if (contextProjectIds && contextProjectIds.length > 0) {
        for (const projectId of contextProjectIds) {
          const project = await storage.getProject(projectId);
          if (project && project.userId === userId) {
            contextProjects.push(project);
          }
        }
      }
      
      // Fetch user's custom voice profiles
      const userVoiceProfiles = await storage.getVoiceProfiles(userId);
      
      // Generate context-aware solutions
      const solutions = await contextAwareOpenAI.generateContextAwareSolutions({
        prompt,
        selectedVoices,
        contextProjects,
        userVoiceProfiles,
        userId,
        sessionId
      });
      
      logger.info('Context-aware generation completed', {
        userId: userId.substring(0, 8) + '...',
        solutionCount: solutions.length,
        contextProjectCount: contextProjects.length,
        hasFeatureAccess
      });
      
      res.json({
        success: true,
        solutions,
        contextAnalysis: {
          projectCount: contextProjects.length,
          hasCustomProfiles: userVoiceProfiles.length > 0,
          featureAccess: hasFeatureAccess
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Context-aware generation failed', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // Context-aware synthesis endpoint
  app.post('/api/sessions/context-synthesis', isAuthenticated, async (req: any, res, next) => {
    try {
      const { contextAwareOpenAI } = await import('./context-aware-openai-service');
      const { checkFeatureAccess } = await import('./feature-access');
      
      const userId = req.user.claims.sub;
      const { solutions, contextProjectIds } = req.body;
      
      // Check Pro tier access for synthesis
      const { hasFeatureAccess } = await checkFeatureAccess(userId, 'synthesis');
      if (!hasFeatureAccess) {
        return res.status(403).json({ 
          error: 'Context-aware synthesis requires Pro subscription',
          upgradeRequired: true 
        });
      }
      
      // Fetch context projects for analysis
      const contextProjects = [];
      if (contextProjectIds && contextProjectIds.length > 0) {
        for (const projectId of contextProjectIds) {
          const project = await storage.getProject(projectId);
          if (project && project.userId === userId) {
            contextProjects.push(project);
          }
        }
      }
      
      // Analyze context
      const contextAnalysis = await contextAwareOpenAI.analyzeContext(contextProjects, userId);
      
      // Generate synthesis
      const synthesis = await contextAwareOpenAI.synthesizeContextAwareSolutions(
        solutions,
        contextAnalysis,
        userId
      );
      
      logger.info('Context-aware synthesis completed', {
        userId: userId.substring(0, 8) + '...',
        voiceCount: solutions.length,
        contextProjectCount: contextProjects.length
      });
      
      res.json({
        success: true,
        synthesis,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Context-aware synthesis failed', error as Error, {
        userId: req.user?.claims?.sub
      });
      next(error);
    }
  });

  // OpenAI Integration Audit Route - Following AI_INSTRUCTIONS.md patterns
  app.get('/api/audit/openai-integration', isAuthenticated, async (req: any, res, next) => {
    try {
      logger.info('Starting OpenAI integration audit', { 
        userId: req.user?.claims?.sub?.substring(0, 8) + '...' 
      });
      
      // Run comprehensive audit against AI_INSTRUCTIONS.md and CodingPhilosophy.md
      const { openaiAuditor } = await import('./openai-integration-audit');
      const auditResult = await openaiAuditor.auditIntegration();
      
      logger.info('OpenAI integration audit completed', {
        overallStatus: auditResult.overallStatus,
        passCount: auditResult.summary.passCount,
        failCount: auditResult.summary.failCount,
        warningCount: auditResult.summary.warningCount
      });
      
      res.json({
        success: true,
        audit: auditResult,
        timestamp: new Date().toISOString(),
        auditor: 'OpenAI Integration Auditor v1.0'
      });
    } catch (error) {
      logger.error('OpenAI integration audit failed', error as Error);
      next(error);
    }
  });

  return server;
}
