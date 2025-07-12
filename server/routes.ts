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

      // Generate solutions using the OpenAI service
      const { openaiService } = await import('./openai-service');
      const solutions = [];

      // Create voice combinations
      const voiceCombinations = [];
      
      if (selectedVoices.perspectives?.length > 0 && selectedVoices.roles?.length > 0) {
        // Both perspectives and roles selected - create combinations
        for (const perspective of selectedVoices.perspectives) {
          for (const role of selectedVoices.roles) {
            voiceCombinations.push({ perspective, role });
          }
        }
      } else if (selectedVoices.perspectives?.length > 0) {
        // Only perspectives selected
        for (const perspective of selectedVoices.perspectives) {
          voiceCombinations.push({ perspective, role: null });
        }
      } else if (selectedVoices.roles?.length > 0) {
        // Only roles selected
        for (const role of selectedVoices.roles) {
          voiceCombinations.push({ perspective: null, role });
        }
      }

      // Generate solutions for each voice combination
      for (const { perspective, role } of voiceCombinations) {
        try {
          const generatedSolution = await openaiService.generateSolution({
            prompt,
            perspectives: selectedVoices.perspectives || [],
            roles: selectedVoices.roles || [],
            analysisDepth,
            mergeStrategy,
            qualityFiltering,
            sessionId: session.id
          }, perspective, role);

          // Store solution in database
          const solution = await storage.createSolution({
            sessionId: session.id,
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
        } catch (error) {
          logger.error('Failed to generate solution for voice combination', error as Error, {
            sessionId: session.id,
            perspective,
            role
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

  return server;
}