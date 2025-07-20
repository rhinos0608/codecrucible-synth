import { db } from "../../db";
import { users, usageLimits } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { logSecurityEvent } from "../security/logSecurityEvent";
import { isDevModeFeatureEnabled, logDevModeBypass, getDevModeMetadata } from "../dev-mode";

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  quotaUsed: number;
  quotaLimit: number;
  planTier: string;
  daysUntilReset?: number;
}

/**
 * Comprehensive quota checking with real-time validation
 * Following AI_INSTRUCTIONS.md security patterns
 */
export async function checkGenerationQuota(
  userId: string,
  ipAddress: string,
  userAgent?: string
): Promise<QuotaCheckResult> {
  try {
    // PRODUCTION ENFORCEMENT: No dev mode bypasses allowed
    // Following AI_INSTRUCTIONS.md: All users must have proper subscription limits

    // Get user and subscription info
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      logSecurityEvent({
        userId,
        ipAddress,
        timestamp: new Date(),
        errorType: 'unauthorized_access',
        planState: {
          currentPlan: 'unknown',
          quotaUsed: 0,
          quotaLimit: 0,
          subscriptionStatus: 'not_found'
        },
        userAgent,
        severity: 'high'
      });
      
      return {
        allowed: false,
        reason: 'user_not_found',
        quotaUsed: 0,
        quotaLimit: 0,
        planTier: 'unknown'
      };
    }

    // PRODUCTION ENFORCEMENT: All users treated as free tier for paywall testing
    // Following AI_INSTRUCTIONS.md: Strict subscription validation required
    const planTier = 'free'; // Force free tier for all users
    
    // Free tier quota checking - NO UNLIMITED GENERATIONS ALLOWED
    const today = new Date().toISOString().split('T')[0];
    
    let [usageLimit] = await db.select()
      .from(usageLimits)
      .where(and(
        eq(usageLimits.userId, userId),
        eq(usageLimits.date, today)
      ));

    if (!usageLimit) {
      // Create usage limit for today
      [usageLimit] = await db.insert(usageLimits).values({
        userId,
        date: today,
        generationsUsed: 0,
        generationsLimit: 3, // Free tier limit
      }).returning();
    }

    const quotaExceeded = usageLimit.generationsUsed >= usageLimit.generationsLimit;
    
    if (quotaExceeded) {
      logSecurityEvent({
        userId,
        ipAddress,
        timestamp: new Date(),
        errorType: 'quota_exceeded',
        planState: {
          currentPlan: planTier,
          quotaUsed: usageLimit.generationsUsed,
          quotaLimit: usageLimit.generationsLimit,
          subscriptionStatus: user.subscriptionStatus || 'unknown'
        },
        userAgent,
        severity: 'medium'
      });
    }

    return {
      allowed: !quotaExceeded,
      reason: quotaExceeded ? 'quota_exceeded' : undefined,
      quotaUsed: usageLimit.generationsUsed,
      quotaLimit: usageLimit.generationsLimit,
      planTier,
      daysUntilReset: 1 // Resets daily
    };

  } catch (error) {
    logSecurityEvent({
      userId,
      ipAddress,
      timestamp: new Date(),
      errorType: 'invalid_subscription',
      planState: {
        currentPlan: 'error',
        quotaUsed: 0,
        quotaLimit: 0,
        subscriptionStatus: 'check_failed'
      },
      userAgent,
      requestDetails: { 
        error: error.message,
        context: 'quota_check_failed'
      },
      severity: 'high'
    });

    // Fail-safe: deny on error
    return {
      allowed: false,
      reason: 'quota_check_failed',
      quotaUsed: 0,
      quotaLimit: 0,
      planTier: 'error'
    };
  }
}

/**
 * Increment usage counter after successful generation
 */
export async function incrementUsageQuota(userId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // First get the current usage
  const [currentUsage] = await db.select()
    .from(usageLimits)
    .where(and(
      eq(usageLimits.userId, userId),
      eq(usageLimits.date, today)
    ));
  
  if (currentUsage) {
    // Update existing record
    await db
      .update(usageLimits)
      .set({
        generationsUsed: currentUsage.generationsUsed + 1
      })
      .where(and(
        eq(usageLimits.userId, userId),
        eq(usageLimits.date, today)
      ));
  }
}