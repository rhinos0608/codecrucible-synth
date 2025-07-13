/**
 * Stripe Products and Prices Management
 * Following AI_INSTRUCTIONS.md security patterns for payment processing
 * 
 * This module ensures proper Stripe product creation and price management
 * for real money transactions with CodeCrucible subscription tiers.
 */

import Stripe from "stripe";
import { logger } from "./logger";

interface CodeCrucibleProduct {
  name: string;
  description: string;
  priceAmount: number; // in cents
  interval: 'month';
  tier: 'pro' | 'team' | 'enterprise';
  features: string[];
}

const CODECRUCIBLE_PRODUCTS: CodeCrucibleProduct[] = [
  {
    name: 'CodeCrucible Pro',
    description: 'Perfect for individual developers - Unlimited code generations, advanced synthesis engine, analytics dashboard',
    priceAmount: 1900, // $19.00
    interval: 'month',
    tier: 'pro',
    features: [
      'Unlimited code generations',
      'Advanced synthesis engine', 
      'Analytics dashboard',
      'Priority voice recommendations',
      'Export generated code',
      'Advanced customization'
    ]
  },
  {
    name: 'CodeCrucible Team',
    description: 'For teams and organizations - Everything in Pro plus team collaboration and shared voice profiles',
    priceAmount: 4900, // $49.00
    interval: 'month',
    tier: 'team',
    features: [
      'Everything in Pro',
      'Team collaboration',
      'Shared voice profiles',
      'Advanced analytics',
      'Team management',
      'Priority support'
    ]
  },
  {
    name: 'CodeCrucible Enterprise',
    description: 'For large organizations - Everything in Team plus custom AI training and on-premise deployment',
    priceAmount: 9900, // $99.00
    interval: 'month',
    tier: 'enterprise',
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

class StripeProductManager {
  private stripe: Stripe;
  private productCache: Map<string, { productId: string; priceId: string }> = new Map();

  constructor() {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  /**
   * Create or retrieve Stripe products and prices for all CodeCrucible tiers
   * Following AI_INSTRUCTIONS.md patterns for defensive programming
   */
  async ensureProductsExist(): Promise<Map<string, { productId: string; priceId: string }>> {
    try {
      logger.info('Ensuring Stripe products exist for CodeCrucible tiers');

      for (const productData of CODECRUCIBLE_PRODUCTS) {
        const cacheKey = productData.tier;
        
        // Check if already cached
        if (this.productCache.has(cacheKey)) {
          continue;
        }

        // Search for existing product
        const existingProducts = await this.stripe.products.search({
          query: `name:'${productData.name}'`,
        });

        let product: Stripe.Product;
        let price: Stripe.Price;

        if (existingProducts.data.length > 0) {
          // Use existing product
          product = existingProducts.data[0];
          logger.info(`Found existing Stripe product: ${product.name}`, { productId: product.id });

          // Get the active price for this product
          const prices = await this.stripe.prices.list({
            product: product.id,
            active: true,
          });

          if (prices.data.length > 0) {
            price = prices.data[0];
            logger.info(`Found existing price for ${product.name}`, { priceId: price.id, amount: price.unit_amount });
          } else {
            // Create new price for existing product
            price = await this.createPrice(product.id, productData);
          }
        } else {
          // Create new product and price
          product = await this.stripe.products.create({
            name: productData.name,
            description: productData.description,
            metadata: {
              tier: productData.tier,
              features: productData.features.join('|'),
              app: 'CodeCrucible'
            },
          });

          logger.info(`Created new Stripe product: ${product.name}`, { productId: product.id });

          price = await this.createPrice(product.id, productData);
        }

        // Cache the product and price IDs
        this.productCache.set(cacheKey, {
          productId: product.id,
          priceId: price.id
        });

        logger.info(`Cached Stripe IDs for ${productData.tier}`, {
          tier: productData.tier,
          productId: product.id,
          priceId: price.id,
          amount: price.unit_amount
        });
      }

      logger.info('All Stripe products and prices are ready', {
        productCount: this.productCache.size,
        tiers: Array.from(this.productCache.keys())
      });

      return this.productCache;
    } catch (error) {
      logger.error('Failed to ensure Stripe products exist', error as Error);
      throw error;
    }
  }

  /**
   * Create a new Stripe price for a product
   */
  private async createPrice(productId: string, productData: CodeCrucibleProduct): Promise<Stripe.Price> {
    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: productData.priceAmount,
      currency: 'usd',
      recurring: {
        interval: productData.interval,
      },
      metadata: {
        tier: productData.tier,
        app: 'CodeCrucible'
      },
    });

    logger.info(`Created new Stripe price: $${productData.priceAmount / 100}/${productData.interval}`, {
      priceId: price.id,
      productId: productId,
      tier: productData.tier
    });

    return price;
  }

  /**
   * Get price ID for a specific tier
   */
  async getPriceId(tier: 'pro' | 'team' | 'enterprise'): Promise<string> {
    // Ensure products exist first
    await this.ensureProductsExist();
    
    const cached = this.productCache.get(tier);
    if (!cached) {
      throw new Error(`No price found for tier: ${tier}`);
    }
    
    return cached.priceId;
  }

  /**
   * Get product ID for a specific tier
   */
  async getProductId(tier: 'pro' | 'team' | 'enterprise'): Promise<string> {
    // Ensure products exist first
    await this.ensureProductsExist();
    
    const cached = this.productCache.get(tier);
    if (!cached) {
      throw new Error(`No product found for tier: ${tier}`);
    }
    
    return cached.productId;
  }

  /**
   * Get all product information for frontend display
   */
  async getAllProducts(): Promise<Array<{ tier: string; productId: string; priceId: string; name: string; description: string; amount: number; features: string[] }>> {
    await this.ensureProductsExist();
    
    const products = [];
    for (const productData of CODECRUCIBLE_PRODUCTS) {
      const cached = this.productCache.get(productData.tier);
      if (cached) {
        products.push({
          tier: productData.tier,
          productId: cached.productId,
          priceId: cached.priceId,
          name: productData.name,
          description: productData.description,
          amount: productData.priceAmount,
          features: productData.features
        });
      }
    }
    
    return products;
  }

  /**
   * Validate webhook signature for security
   */
  validateWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    try {
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      logger.error('Stripe webhook signature validation failed', error as Error, {
        hasSignature: !!signature,
        hasSecret: !!process.env.STRIPE_WEBHOOK_SECRET
      });
      throw error;
    }
  }
}

// Singleton instance
export const stripeProductManager = new StripeProductManager();

// Initialize products on startup
stripeProductManager.ensureProductsExist().catch(error => {
  logger.error('Failed to initialize Stripe products on startup', error);
});