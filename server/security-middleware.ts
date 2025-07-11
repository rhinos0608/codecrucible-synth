import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Rate limiting store for different endpoints
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class SecurityMiddleware {
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private suspiciousActivityStore = new Map<string, number>();
  
  // Rate limiting based on endpoint and user/IP
  createRateLimit(windowMs: number, maxRequests: number, endpoint: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const userId = (req as any).user?.claims?.sub;
      const identifier = userId || req.ip;
      const key = `${endpoint}:${identifier}`;
      const now = Date.now();
      
      const entry = this.rateLimitStore.get(key);
      
      if (!entry || now > entry.resetTime) {
        // Reset or create new entry
        this.rateLimitStore.set(key, {
          count: 1,
          resetTime: now + windowMs
        });
        return next();
      }
      
      if (entry.count >= maxRequests) {
        logger.warn('Rate limit exceeded', {
          endpoint,
          identifier,
          attempts: entry.count,
          limit: maxRequests,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        // Track suspicious activity
        this.trackSuspiciousActivity(identifier);
        
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests to ${endpoint}. Please try again later.`,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
      }
      
      entry.count++;
      this.rateLimitStore.set(key, entry);
      next();
    };
  }
  
  // Track and flag suspicious activity patterns
  private trackSuspiciousActivity(identifier: string) {
    const current = this.suspiciousActivityStore.get(identifier) || 0;
    const newCount = current + 1;
    this.suspiciousActivityStore.set(identifier, newCount);
    
    if (newCount >= 5) {
      logger.error('Suspicious activity detected - potential attack', {
        identifier,
        violations: newCount,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Input validation middleware following AI_INSTRUCTIONS.md
  validateInput(schema: any) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const validated = schema.parse(req.body);
        req.body = validated;
        next();
      } catch (error) {
        logger.warn('Input validation failed - potential injection attempt', {
          error: error.message,
          body: req.body,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(400).json({
          error: 'Invalid input',
          message: 'Request data does not meet security requirements'
        });
      }
    };
  }
  
  // Security headers middleware
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Prevent clickjacking
      res.setHeader('X-Frame-Options', 'DENY');
      
      // Prevent MIME type sniffing
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Enable XSS protection
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // Strict transport security
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      
      // Content security policy
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.stripe.com");
      
      next();
    };
  }
  
  // Enhanced authentication monitoring
  monitorAuthentication() {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = (req as any).user;
      
      if (user) {
        logger.debug('Authenticated request', {
          userId: user.claims?.sub,
          endpoint: req.path,
          method: req.method,
          ip: req.ip
        });
      } else {
        logger.debug('Unauthenticated request', {
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
      
      next();
    };
  }
  
  // Clean up old rate limit entries
  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
    
    // Clean up suspicious activity older than 1 hour
    this.suspiciousActivityStore.clear();
  }
}

export const securityMiddleware = new SecurityMiddleware();

// Run cleanup every 5 minutes
setInterval(() => {
  securityMiddleware.cleanup();
}, 5 * 60 * 1000);