// Subscription Enforcement Middleware - AI_INSTRUCTIONS.md Security Patterns
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { hasFeatureAccess, getRequiredFeature, getMinimumTier, getUpgradeUrl } from '../feature-access';
import { subscriptionService } from '../subscription-service';
import { logger, APIError } from '../logger';
import { isDevModeFeatureEnabled } from '../lib/dev-mode';

// Enhanced request interface with user info
interface AuthenticatedRequest extends Request {
  user?: {
    claims?: {
      sub: string;
    };
  };
}

/**
 * Middleware to enforce subscription limits on protected routes
 * Follows AI_INSTRUCTIONS.md security patterns for input validation and error handling
 */
export const enforceSubscriptionLimits = async (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Extract user ID from authenticated request
    const userId = req.user?.claims?.sub;
    if (!userId) {
      throw new APIError(401, 'User authentication required for subscription enforcement');
    }

    // Get required feature for this route
    const feature = getRequiredFeature(req.path);
    if (!feature) {
      // Route doesn't require specific feature access
      return next();
    }

    // Dev mode bypass for development environment
    if (isDevModeFeatureEnabled('unlimitedGenerations')) {
      logger.info('Dev mode bypass: subscription_enforcement_bypassed', {
        userId: userId.substring(0, 8) + '...',
        feature,
        route: req.path,
        method: req.method
      });
      return next();
    }

    // Get user subscription information
    const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
    const userTier = subscriptionInfo.tier.name;

    // Check feature access
    if (!hasFeatureAccess(userTier, feature)) {
      const requiredTier = getMinimumTier(feature);
      const upgradeUrl = getUpgradeUrl(feature, requiredTier);
      
      logger.warn('Feature access denied', {
        userId: userId.substring(0, 8) + '...',
        currentTier: userTier,
        requiredFeature: feature,
        requiredTier,
        route: req.path
      });

      throw new APIError(403, 'Feature requires subscription upgrade', {
        error: 'Feature requires upgrade',
        feature,
        currentTier: userTier,
        requiredTier,
        upgradeUrl
      });
    }

    // Additional usage limit checks for generation endpoints
    if (feature === 'unlimited_generations' || req.path.includes('/generate')) {
      const canGenerate = await subscriptionService.checkUsageLimit(userId);
      if (!canGenerate) {
        logger.warn('Generation limit exceeded', {
          userId: userId.substring(0, 8) + '...',
          tier: userTier,
          usage: subscriptionInfo.usage
        });

        throw new APIError(429, 'Daily generation limit exceeded', {
          error: 'Daily generation limit reached',
          currentUsage: subscriptionInfo.usage.used,
          limit: subscriptionInfo.usage.limit,
          upgradeUrl: getUpgradeUrl('unlimited_generations')
        });
      }
    }

    // Voice combination limits for free tier
    if (req.method === 'POST' && req.body?.voices) {
      const voiceCount = Array.isArray(req.body.voices) ? req.body.voices.length : 0;
      if (userTier === 'free' && voiceCount > 2) {
        throw new APIError(403, 'Free tier limited to 2 voice combinations', {
          error: 'Voice combination limit exceeded',
          currentVoices: voiceCount,
          freeLimit: 2,
          upgradeUrl: getUpgradeUrl('voice_combinations_unlimited')
        });
      }
    }

    // Log successful feature access
    logger.debug('Feature access granted', {
      userId: userId.substring(0, 8) + '...',
      feature,
      tier: userTier,
      route: req.path
    });

    next();
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.status).json(error.context || { message: error.message });
    } else {
      logger.error('Subscription enforcement error', error as Error);
      res.status(500).json({ 
        message: 'Internal subscription service error',
        upgradeUrl: '/subscribe'
      });
    }
  }
};

/**
 * Middleware specifically for synthesis endpoint protection
 */
export const enforceSynthesisAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      throw new APIError(401, 'Authentication required');
    }

    // Dev mode bypass
    if (isDevModeFeatureEnabled('unlimitedGenerations')) {
      return next();
    }

    const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
    const userTier = subscriptionInfo.tier.name;

    if (!hasFeatureAccess(userTier, 'synthesis_engine')) {
      const requiredTier = getMinimumTier('synthesis_engine');
      throw new APIError(403, 'Synthesis requires Pro subscription', {
        error: 'Synthesis engine requires upgrade',
        feature: 'synthesis_engine',
        currentTier: userTier,
        requiredTier,
        upgradeUrl: getUpgradeUrl('synthesis_engine', requiredTier)
      });
    }

    next();
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.status).json(error.context || { message: error.message });
    } else {
      logger.error('Synthesis access enforcement error', error as Error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

/**
 * Middleware for team feature protection
 */
export const enforceTeamAccess = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.claims?.sub;
    if (!userId) {
      throw new APIError(401, 'Authentication required');
    }

    const subscriptionInfo = await subscriptionService.getUserSubscriptionInfo(userId);
    const userTier = subscriptionInfo.tier.name;

    if (!hasFeatureAccess(userTier, 'team_collaboration')) {
      throw new APIError(403, 'Team features require Team subscription', {
        error: 'Team features require upgrade',
        feature: 'team_collaboration',
        currentTier: userTier,
        requiredTier: 'team',
        upgradeUrl: getUpgradeUrl('team_collaboration', 'team')
      });
    }

    next();
  } catch (error) {
    if (error instanceof APIError) {
      res.status(error.status).json(error.context || { message: error.message });
    } else {
      logger.error('Team access enforcement error', error as Error);
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

export default {
  enforceSubscriptionLimits,
  enforceSynthesisAccess,
  enforceTeamAccess
};