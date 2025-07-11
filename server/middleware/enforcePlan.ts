import { Request, Response, NextFunction } from 'express';
import { checkGenerationQuota } from '../lib/utils/checkQuota';
import { logSecurityEvent } from '../lib/security/logSecurityEvent';
import { isDevModeFeatureEnabled, logDevModeBypass } from '../lib/dev-mode';
import { APIError } from '../logger';

/**
 * Middleware to enforce subscription plan restrictions
 * Following AI_INSTRUCTIONS.md security patterns with dual-channel validation
 */
export function enforcePlanRestrictions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const userId = user?.claims?.sub;
      
      if (!userId) {
        logSecurityEvent({
          ipAddress: req.ip,
          timestamp: new Date(),
          errorType: 'unauthorized_access',
          planState: {
            currentPlan: 'none',
            quotaUsed: 0,
            quotaLimit: 0,
            subscriptionStatus: 'no_auth'
          },
          userAgent: req.get('User-Agent'),
          severity: 'high'
        });
        
        throw new APIError(401, 'Authentication required for generation', {
          code: 'AUTH_REQUIRED',
          symbolic: 'Authentication required to generate code.'
        });
      }

      // Check generation quota with comprehensive validation
      const quotaCheck = await checkGenerationQuota(
        userId,
        req.ip,
        req.get('User-Agent')
      );

      if (!quotaCheck.allowed) {
        const errorContext = {
          code: quotaCheck.reason?.toUpperCase() || 'QUOTA_EXCEEDED',
          quotaUsed: quotaCheck.quotaUsed,
          quotaLimit: quotaCheck.quotaLimit,
          planTier: quotaCheck.planTier,
          upgradeRequired: quotaCheck.planTier === 'free'
        };

        let message: string;
        let symbolic: string;

        switch (quotaCheck.reason) {
          case 'quota_exceeded':
            message = `Daily generation limit reached (${quotaCheck.quotaUsed}/${quotaCheck.quotaLimit}). Upgrade to Pro for unlimited generations.`;
            symbolic = 'Your daily generation quota has been reached.';
            break;
          case 'user_not_found':
            message = 'User account not found';
            symbolic = 'Account verification required.';
            break;
          case 'quota_check_failed':
            message = 'Unable to verify subscription status';
            symbolic = 'Service temporarily unavailable.';
            break;
          default:
            message = 'Generation not allowed';
            symbolic = 'Access restricted.';
        }

        throw new APIError(403, message, {
          ...errorContext,
          symbolic
        });
      }

      // Store quota info for downstream use
      (req as any).quotaInfo = quotaCheck;
      next();

    } catch (error) {
      if (error instanceof APIError) {
        next(error);
      } else {
        // Log unexpected errors
        logSecurityEvent({
          userId: (req as any).user?.claims?.sub,
          ipAddress: req.ip,
          timestamp: new Date(),
          errorType: 'invalid_subscription',
          planState: {
            currentPlan: 'error',
            quotaUsed: 0,
            quotaLimit: 0,
            subscriptionStatus: 'middleware_error'
          },
          userAgent: req.get('User-Agent'),
          requestDetails: { error: error.message },
          severity: 'critical'
        });
        
        next(new APIError(500, 'Subscription verification failed', {
          code: 'VERIFICATION_ERROR',
          symbolic: 'Service temporarily unavailable.'
        }));
      }
    }
  };
}

/**
 * Middleware to validate subscription features access
 */
export function validateFeatureAccess(requiredFeature: 'synthesis' | 'analytics' | 'teams') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Dev mode bypass: Allow unlimited synthesis access in development
      if (requiredFeature === 'synthesis' && isDevModeFeatureEnabled('unlimitedSynthesis')) {
        logDevModeBypass('synthesis_access_bypassed', {
          userId: (req as any).user?.claims?.sub?.substring(0, 8) + '...' || 'anonymous',
          ipAddress: req.ip,
          feature: requiredFeature
        });
        return next();
      }

      const quotaInfo = (req as any).quotaInfo;
      const planTier = quotaInfo?.planTier || 'free';
      
      const featureAccess = {
        synthesis: ['pro', 'team'],
        analytics: ['pro', 'team'],
        teams: ['team']
      };

      if (!featureAccess[requiredFeature].includes(planTier)) {
        logSecurityEvent({
          userId: (req as any).user?.claims?.sub,
          ipAddress: req.ip,
          timestamp: new Date(),
          errorType: 'unauthorized_access',
          planState: {
            currentPlan: planTier,
            quotaUsed: quotaInfo?.quotaUsed || 0,
            quotaLimit: quotaInfo?.quotaLimit || 0,
            subscriptionStatus: 'feature_restricted'
          },
          userAgent: req.get('User-Agent'),
          requestDetails: { requestedFeature: requiredFeature },
          severity: 'medium'
        });

        const upgradeMessage = planTier === 'free' 
          ? `${requiredFeature.charAt(0).toUpperCase() + requiredFeature.slice(1)} feature requires Pro or Team subscription.`
          : `${requiredFeature.charAt(0).toUpperCase() + requiredFeature.slice(1)} feature requires Team subscription.`;

        throw new APIError(403, upgradeMessage, {
          code: 'FEATURE_RESTRICTED',
          feature: requiredFeature,
          currentPlan: planTier,
          upgradeRequired: true,
          symbolic: `Upgrade to continue using ${requiredFeature}.`
        });
      }

      next();
    } catch (error) {
      next(error instanceof APIError ? error : new APIError(500, 'Feature validation failed'));
    }
  };
}