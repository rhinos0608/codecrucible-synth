import { db } from "../../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../../logger";
import { logSecurityEvent } from "../security/logSecurityEvent";
import Stripe from "stripe";

export interface SubscriptionUpdate {
  userId: string;
  planTier: 'free' | 'pro' | 'team';
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'expired';
  stripeSubscriptionId?: string;
  subscriptionStartDate?: Date;
  subscriptionEndDate?: Date;
}

/**
 * Real-time Stripe subscription synchronization
 * Following AI_INSTRUCTIONS.md security patterns with comprehensive validation
 */
export async function updateUserPlan(update: SubscriptionUpdate): Promise<void> {
  try {
    logger.info('Updating user subscription plan', {
      userId: update.userId,
      planTier: update.planTier,
      status: update.subscriptionStatus
    });

    // Validate user exists
    const [existingUser] = await db.select().from(users).where(eq(users.id, update.userId));
    
    if (!existingUser) {
      logSecurityEvent({
        userId: update.userId,
        ipAddress: 'stripe-webhook',
        timestamp: new Date(),
        errorType: 'unauthorized_access',
        planState: {
          currentPlan: update.planTier,
          quotaUsed: 0,
          quotaLimit: 0,
          subscriptionStatus: 'user_not_found'
        },
        requestDetails: { stripeSubscriptionId: update.stripeSubscriptionId },
        severity: 'high'
      });
      throw new Error(`User ${update.userId} not found for subscription update`);
    }

    // Update user subscription info
    await db
      .update(users)
      .set({
        subscriptionTier: update.planTier,
        subscriptionStatus: update.subscriptionStatus,
        stripeSubscriptionId: update.stripeSubscriptionId,
        subscriptionStartDate: update.subscriptionStartDate,
        subscriptionEndDate: update.subscriptionEndDate,
        updatedAt: new Date()
      })
      .where(eq(users.id, update.userId));

    logger.info('Successfully updated user subscription', {
      userId: update.userId,
      oldPlan: existingUser.subscriptionTier,
      newPlan: update.planTier,
      status: update.subscriptionStatus
    });

    // Log subscription changes for audit trail
    logSecurityEvent({
      userId: update.userId,
      ipAddress: 'stripe-webhook',
      timestamp: new Date(),
      errorType: 'plan_spoofing', // Reused for plan changes
      planState: {
        currentPlan: update.planTier,
        quotaUsed: 0,
        quotaLimit: update.planTier === 'free' ? 3 : -1,
        subscriptionStatus: update.subscriptionStatus
      },
      requestDetails: {
        previousPlan: existingUser.subscriptionTier,
        stripeSubscriptionId: update.stripeSubscriptionId,
        changeType: 'webhook_update'
      },
      severity: 'low'
    });

  } catch (error) {
    logger.error('Failed to update user subscription', error as Error, {
      userId: update.userId,
      planTier: update.planTier,
      error: error.message
    });
    throw error;
  }
}

/**
 * Process Stripe webhook events for subscription changes
 */
export async function processStripeWebhook(event: Stripe.Event): Promise<void> {
  try {
    logger.info('Processing Stripe webhook', { 
      type: event.type,
      id: event.id 
    });

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Extract user ID from subscription metadata
        const userId = subscription.metadata?.userId;
        if (!userId) {
          logger.warn('Subscription webhook missing userId in metadata', {
            subscriptionId: subscription.id,
            customerId: subscription.customer
          });
          return;
        }

        // Determine plan tier from subscription
        const planTier = determinePlanTier(subscription);
        
        await updateUserPlan({
          userId,
          planTier,
          subscriptionStatus: subscription.status === 'active' ? 'active' : 
                            subscription.status === 'past_due' ? 'past_due' :
                            subscription.status === 'canceled' ? 'canceled' : 'expired',
          stripeSubscriptionId: subscription.id,
          subscriptionStartDate: new Date(subscription.start_date * 1000),
          subscriptionEndDate: subscription.current_period_end ? 
            new Date(subscription.current_period_end * 1000) : undefined
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        
        if (!userId) {
          logger.warn('Subscription deletion webhook missing userId', {
            subscriptionId: subscription.id
          });
          return;
        }

        // Downgrade to free tier
        await updateUserPlan({
          userId,
          planTier: 'free',
          subscriptionStatus: 'canceled',
          stripeSubscriptionId: subscription.id,
          subscriptionEndDate: new Date()
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscription = invoice.subscription;
        
        if (typeof subscription === 'string') {
          // Handle failed payment - could trigger grace period
          logger.warn('Payment failed for subscription', {
            subscriptionId: subscription,
            invoiceId: invoice.id
          });
        }
        break;
      }

      default:
        logger.debug('Unhandled Stripe webhook event', { type: event.type });
    }

  } catch (error) {
    logger.error('Error processing Stripe webhook', error as Error, {
      eventType: event.type,
      eventId: event.id
    });
    throw error;
  }
}

/**
 * Determine plan tier from Stripe subscription
 * Updated with correct Stripe price IDs from user
 */
function determinePlanTier(subscription: Stripe.Subscription): 'free' | 'pro' | 'team' {
  // Check subscription items for price information
  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    const unitAmount = item.price.unit_amount;
    
    // Match against correct Stripe price IDs provided by user
    if (priceId === 'price_1RkNL6A1twisVzen0NGxfG7f') { // Pro tier
      return 'pro';
    } else if (priceId === 'price_1RkNLgA1twisVzenGkDoiILm') { // Team tier
      return 'team';
    }
    
    // Fallback to unit amount matching (updated for Arkane Technologies)
    if (unitAmount === 1900) { // $19.00
      return 'pro';
    } else if (unitAmount === 4900) { // $49.00
      return 'team';
    } else if (unitAmount === 9900) { // $99.00
      return 'team'; // Enterprise maps to team for now
    }
  }
  
  // Check metadata for explicit plan designation
  const planTier = subscription.metadata?.planTier;
  if (planTier === 'pro' || planTier === 'team') {
    return planTier;
  }
  
  // Default to pro for paid subscriptions
  return 'pro';
}

/**
 * Validate subscription status in real-time
 */
export async function validateSubscriptionStatus(userId: string): Promise<{
  isValid: boolean;
  planTier: string;
  status: string;
}> {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        isValid: false,
        planTier: 'free',
        status: 'user_not_found'
      };
    }

    const now = new Date();
    const isExpired = user.subscriptionEndDate && user.subscriptionEndDate < now;
    
    if (isExpired) {
      // Auto-downgrade expired subscriptions
      await updateUserPlan({
        userId,
        planTier: 'free',
        subscriptionStatus: 'expired'
      });
      
      return {
        isValid: false,
        planTier: 'free',
        status: 'expired'
      };
    }

    return {
      isValid: user.subscriptionStatus === 'active',
      planTier: user.subscriptionTier || 'free',
      status: user.subscriptionStatus || 'unknown'
    };

  } catch (error) {
    logger.error('Error validating subscription status', error as Error, { userId });
    
    // Fail-safe: treat as free tier
    return {
      isValid: false,
      planTier: 'free',
      status: 'validation_error'
    };
  }
}