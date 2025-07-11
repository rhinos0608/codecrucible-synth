import { db } from "./db";
import { 
  users, 
  usageLimits, 
  subscriptionHistory,
  teams,
  teamMembers,
  type User,
  type Team,
  type TeamMember,
  type InsertSubscriptionHistory,
  type InsertTeam,
  type InsertTeamMember
} from "@shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";
import { logger } from "./logger";
import { isDevModeFeatureEnabled, logDevModeBypass } from "./lib/dev-mode";
import Stripe from "stripe";

interface SubscriptionTier {
  name: "free" | "pro" | "team";
  price: number; // in cents
  dailyGenerationLimit: number;
  features: string[];
  maxVoiceCombinations: number;
  allowsAnalytics: boolean;
  allowsTeams: boolean;
}

const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  free: {
    name: "free",
    price: 0,
    dailyGenerationLimit: 3,
    features: ["Basic 2-voice combinations", "3 generations per day"],
    maxVoiceCombinations: 2,
    allowsAnalytics: false,
    allowsTeams: false,
  },
  pro: {
    name: "pro",
    price: 1500, // $15/month
    dailyGenerationLimit: -1, // unlimited
    features: ["All voice combinations", "Unlimited generations", "Analytics dashboard", "Voice preference learning"],
    maxVoiceCombinations: 10,
    allowsAnalytics: true,
    allowsTeams: false,
  },
  team: {
    name: "team",
    price: 5000, // $50/month
    dailyGenerationLimit: -1, // unlimited
    features: ["Everything in Pro", "Team collaboration", "Shared voice profiles", "Team analytics", "Priority support"],
    maxVoiceCombinations: 10,
    allowsAnalytics: true,
    allowsTeams: true,
  },
};

class SubscriptionService {
  private stripe: Stripe | null = null;

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2023-10-16",
      });
    }
  }

  async getUserSubscriptionInfo(userId: string) {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new Error("User not found");
      }

      // Dev mode override: Provide unlimited tier in development
      let tier = SUBSCRIPTION_TIERS[user.subscriptionTier || "free"];
      if (isDevModeFeatureEnabled('unlimitedGenerations')) {
        tier = {
          ...tier,
          dailyGenerationLimit: -1,
          maxVoiceCombinations: 10,
          allowsAnalytics: true,
          name: "dev" as any
        };
        logDevModeBypass('subscription_tier_overridden', {
          userId: userId.substring(0, 8) + '...',
          originalTier: user.subscriptionTier || "free",
          devTier: "unlimited"
        });
      }
      const today = new Date().toISOString().split('T')[0];
      
      // Get or create usage limits for today
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
          generationsLimit: tier.dailyGenerationLimit,
        }).returning();
      }

      // Get team info if user is in a team
      let teamInfo = null;
      if (user.subscriptionTier === "team") {
        const [member] = await db.select()
          .from(teamMembers)
          .where(eq(teamMembers.userId, userId));
        
        if (member) {
          const [team] = await db.select()
            .from(teams)
            .where(eq(teams.id, member.teamId));
          teamInfo = { team, role: member.role };
        }
      }

      return {
        user,
        tier,
        usage: {
          used: usageLimit.generationsUsed,
          limit: usageLimit.generationsLimit,
          remaining: tier.dailyGenerationLimit === -1 ? -1 : 
            Math.max(0, usageLimit.generationsLimit - usageLimit.generationsUsed),
        },
        teamInfo,
        canGenerate: tier.dailyGenerationLimit === -1 || 
          usageLimit.generationsUsed < usageLimit.generationsLimit,
      };
    } catch (error) {
      logger.error("Error getting subscription info", error as Error);
      throw error;
    }
  }

  async checkUsageLimit(userId: string): Promise<boolean> {
    // Dev mode bypass: Allow unlimited generations in development
    if (isDevModeFeatureEnabled('unlimitedGenerations')) {
      logDevModeBypass('subscription_usage_limit_bypassed', {
        userId: userId.substring(0, 8) + '...',
        feature: 'unlimitedGenerations',
        service: 'subscription_service'
      });
      return true;
    }

    const info = await this.getUserSubscriptionInfo(userId);
    return info.canGenerate;
  }

  async incrementUsage(userId: string) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      await db
        .update(usageLimits)
        .set({
          generationsUsed: sql`${usageLimits.generationsUsed} + 1`,
        })
        .where(and(
          eq(usageLimits.userId, userId),
          eq(usageLimits.date, today)
        ));
      
      logger.info("Incremented usage", { userId, date: today });
    } catch (error) {
      logger.error("Error incrementing usage", error as Error);
      throw error;
    }
  }

  async createCheckoutSession(userId: string, tier: "pro" | "team", successUrl: string, cancelUrl: string) {
    if (!this.stripe) {
      throw new Error("Stripe not configured");
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }

    const subscription = SUBSCRIPTION_TIERS[tier];
    
    // Create or retrieve Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await this.stripe.customers.create({
        email: user.email || undefined,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;
      
      // Update user with Stripe customer ID
      await db.update(users)
        .set({ stripeCustomerId })
        .where(eq(users.id, userId));
    }

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `CodeCrucible ${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`,
              description: subscription.features.join(", "),
            },
            unit_amount: subscription.price,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        tier,
      },
    });

    return session;
  }

  async handleWebhook(event: Stripe.Event) {
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const userId = session.metadata?.userId;
          const tier = session.metadata?.tier as "pro" | "team";
          
          if (!userId || !tier) {
            logger.error("Missing metadata in checkout session", { sessionId: session.id });
            return;
          }

          // Update user subscription
          await this.upgradeSubscription(userId, tier, session.subscription as string);
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionUpdate(subscription);
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await this.handleSubscriptionCancellation(subscription);
          break;
        }

        default:
          logger.info("Unhandled webhook event", { type: event.type });
      }
    } catch (error) {
      logger.error("Error handling webhook", error as Error);
      throw error;
    }
  }

  private async upgradeSubscription(userId: string, tier: "pro" | "team", stripeSubscriptionId: string) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      throw new Error("User not found");
    }

    const previousTier = user.subscriptionTier;
    
    // Update user subscription
    await db.update(users)
      .set({
        subscriptionTier: tier,
        subscriptionStatus: "active",
        stripeSubscriptionId,
        subscriptionStartDate: new Date(),
      })
      .where(eq(users.id, userId));

    // Record subscription history
    await db.insert(subscriptionHistory).values({
      userId,
      stripeSubscriptionId,
      tier,
      action: previousTier === "free" ? "created" : "upgraded",
      previousTier: previousTier as "free" | "pro" | "team",
      amount: SUBSCRIPTION_TIERS[tier].price,
      currency: "usd",
    });

    // If team subscription, create a team
    if (tier === "team") {
      const [team] = await db.insert(teams).values({
        name: `${user.firstName || "User"}'s Team`,
        ownerId: userId,
        stripeSubscriptionId,
      }).returning();

      // Add user as team admin
      await db.insert(teamMembers).values({
        teamId: team.id,
        userId,
        role: "admin",
      });
    }

    logger.info("Subscription upgraded", { userId, tier, previousTier });
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.stripeSubscriptionId, subscription.id));
    
    if (!user) {
      logger.warn("User not found for subscription", { subscriptionId: subscription.id });
      return;
    }

    await db.update(users)
      .set({
        subscriptionStatus: subscription.status,
        subscriptionEndDate: subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000) 
          : null,
      })
      .where(eq(users.id, user.id));
  }

  private async handleSubscriptionCancellation(subscription: Stripe.Subscription) {
    const [user] = await db.select()
      .from(users)
      .where(eq(users.stripeSubscriptionId, subscription.id));
    
    if (!user) {
      logger.warn("User not found for subscription", { subscriptionId: subscription.id });
      return;
    }

    const previousTier = user.subscriptionTier;

    // Downgrade to free tier
    await db.update(users)
      .set({
        subscriptionTier: "free",
        subscriptionStatus: "canceled",
        subscriptionEndDate: new Date(),
      })
      .where(eq(users.id, user.id));

    // Record cancellation
    await db.insert(subscriptionHistory).values({
      userId: user.id,
      stripeSubscriptionId: subscription.id,
      tier: "free",
      action: "canceled",
      previousTier: previousTier as "free" | "pro" | "team",
    });

    logger.info("Subscription canceled", { userId: user.id, previousTier });
  }

  async createTeam(userId: string, teamData: InsertTeam): Promise<Team> {
    const userInfo = await this.getUserSubscriptionInfo(userId);
    if (userInfo.tier.name !== "team") {
      throw new Error("Team features require a team subscription");
    }

    const [team] = await db.insert(teams).values({
      ...teamData,
      ownerId: userId,
    }).returning();

    // Add creator as admin
    await db.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role: "admin",
    });

    return team;
  }

  async addTeamMember(teamId: number, userId: string, role: "admin" | "member" = "member") {
    // Check if team exists and has space
    const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
    if (!team) {
      throw new Error("Team not found");
    }

    const memberCount = await db.select({ count: sql<number>`count(*)` })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));
    
    if (memberCount[0].count >= team.maxMembers) {
      throw new Error("Team is at maximum capacity");
    }

    // Add member
    await db.insert(teamMembers).values({
      teamId,
      userId,
      role,
    });

    // Update user's subscription info
    await db.update(users)
      .set({ subscriptionTier: "team" })
      .where(eq(users.id, userId));
  }

  getTierInfo(tierName: string) {
    return SUBSCRIPTION_TIERS[tierName] || SUBSCRIPTION_TIERS.free;
  }

  getAllTiers() {
    return Object.values(SUBSCRIPTION_TIERS);
  }
}

export const subscriptionService = new SubscriptionService();