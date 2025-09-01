/**
 * Enterprise JWT Authentication System
 * Implements secure JWT token management with refresh tokens and session tracking
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { logger } from '../logger.js';
import {
  AuthConfig,
  User,
  TokenPayload,
  RefreshTokenPayload,
  AuthResult,
  AuthSession,
} from './auth-types.js';

export class JWTAuthenticator {
  private config: AuthConfig;
  private activeSessions = new Map<string, AuthSession>();
  private refreshTokens = new Map<string, RefreshTokenPayload>();
  private blacklistedTokens = new Set<string>();
  private cleanupIntervalId: NodeJS.Timeout | null = null;

  constructor(config: AuthConfig) {
    this.config = {
      ...config,
      algorithms: config.algorithms || ['HS256'],
      clockTolerance: config.clockTolerance || 30,
    };

    // Start cleanup interval for expired sessions
    this.cleanupIntervalId = setInterval(() => this.cleanupExpiredSessions(), 60000); // Every minute
  }

  /**
   * Generate access and refresh tokens
   */
  async generateTokens(user: User, ipAddress: string, userAgent: string): Promise<AuthResult> {
    try {
      const sessionId = crypto.randomUUID();
      const tokenFamily = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);

      // Create session
      const session: AuthSession = {
        id: sessionId,
        userId: user.id,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        ipAddress,
        userAgent,
        isActive: true,
        expiresAt: new Date(Date.now() + this.config.expiry * 1000),
      };

      this.activeSessions.set(sessionId, session);

      // Create access token payload
      const accessPayload: TokenPayload = {
        sub: user.id,
        iat: now,
        exp: now + this.config.expiry,
        iss: this.config.issuer,
        aud: this.config.audience,
        userId: user.id,
        username: user.username,
        roles: user.roles,
        permissions: user.permissions,
        sessionId,
      };

      // Generate access token
      const accessToken = jwt.sign(accessPayload, this.config.secret, {
        algorithm: this.config.algorithms[0] as jwt.Algorithm,
        expiresIn: this.config.expiry,
      });

      let refreshToken: string | undefined;

      if (this.config.refreshTokens) {
        // Create refresh token payload
        const refreshPayload: RefreshTokenPayload = {
          userId: user.id,
          sessionId,
          tokenFamily,
          exp: now + this.config.expiry * 7, // Refresh tokens last 7x longer
        };

        refreshToken = jwt.sign(refreshPayload, `${this.config.secret}_refresh`, {
          algorithm: this.config.algorithms[0] as jwt.Algorithm,
          expiresIn: this.config.expiry * 7,
        });

        this.refreshTokens.set(tokenFamily, refreshPayload);
      }

      logger.info('User authenticated successfully', {
        userId: user.id,
        sessionId,
        ipAddress,
        userAgent: userAgent.substring(0, 100),
      });

      return {
        success: true,
        user,
        accessToken,
        refreshToken,
        expiresIn: this.config.expiry,
      };
    } catch (error) {
      logger.error('Token generation failed', {
        error: error as Error,
        userId: user.id,
        ipAddress,
      });

      throw new AuthenticationError('Token generation failed', {
        code: 'TOKEN_GENERATION_ERROR',
        statusCode: 500,
      });
    }
  }

  /**
   * Verify and decode access token
   */
  async verifyToken(token: string): Promise<TokenPayload> {
    try {
      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        throw new AuthenticationError('Token has been revoked', {
          code: 'TOKEN_REVOKED',
          statusCode: 401,
        });
      }

      const payload = jwt.verify(token, this.config.secret, {
        algorithms: this.config.algorithms as jwt.Algorithm[],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: this.config.clockTolerance,
      }) as TokenPayload;

      // Verify session is still active
      const session = this.activeSessions.get(payload.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        throw new AuthenticationError('Session expired or invalid', {
          code: 'SESSION_INVALID',
          statusCode: 401,
        });
      }

      // Update last accessed time
      session.lastAccessedAt = new Date();

      return payload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token', {
          code: 'TOKEN_INVALID',
          statusCode: 401,
        });
      }

      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired', {
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
        });
      }

      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<AuthResult> {
    try {
      const payload = jwt.verify(
        refreshToken,
        `${this.config.secret}_refresh`
      ) as RefreshTokenPayload;

      // Verify refresh token exists and is valid
      const storedPayload = this.refreshTokens.get(payload.tokenFamily);
      if (!storedPayload || storedPayload.exp < Math.floor(Date.now() / 1000)) {
        throw new AuthenticationError('Refresh token expired or invalid', {
          code: 'REFRESH_TOKEN_INVALID',
          statusCode: 401,
        });
      }

      // Get session
      const session = this.activeSessions.get(payload.sessionId);
      if (!session || !session.isActive) {
        throw new AuthenticationError('Session invalid', {
          code: 'SESSION_INVALID',
          statusCode: 401,
        });
      }

      // For security, we need to get the user again (in real app, from database)
      // For now, create a mock user with basic info
      const user: User = {
        id: payload.userId,
        username: 'user', // In production, fetch from database
        email: 'user@example.com',
        roles: ['user'],
        permissions: ['read:own'],
        metadata: {},
        createdAt: new Date(),
        isActive: true,
      };

      // Generate new tokens
      return await this.generateTokens(user, session.ipAddress, session.userAgent);
    } catch (error) {
      logger.error('Token refresh failed', error as Error);
      throw error;
    }
  }

  /**
   * Revoke token (add to blacklist)
   */
  async revokeToken(token: string): Promise<void> {
    try {
      const payload = jwt.decode(token) as TokenPayload;

      if (payload && payload.sessionId) {
        // Deactivate session
        const session = this.activeSessions.get(payload.sessionId);
        if (session) {
          session.isActive = false;
        }
      }

      // Add to blacklist
      this.blacklistedTokens.add(token);

      logger.info('Token revoked', {
        userId: payload?.userId,
        sessionId: payload?.sessionId,
      });
    } catch (error) {
      logger.error('Token revocation failed', error as Error);
      throw error;
    }
  }

  /**
   * Revoke all tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    // Deactivate all user sessions
    for (const [_sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        session.isActive = false;
      }
    }

    // Remove all refresh tokens for user
    for (const [tokenFamily, payload] of this.refreshTokens.entries()) {
      if (payload.userId === userId) {
        this.refreshTokens.delete(tokenFamily);
      }
    }

    logger.info('All tokens revoked for user', { userId });
  }

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): AuthSession[] {
    return Array.from(this.activeSessions.values()).filter(
      session => session.userId === userId && session.isActive
    );
  }

  /**
   * Clean up expired sessions and tokens
   */
  private cleanupExpiredSessions(): void {
    const now = new Date();
    let cleanedSessions = 0;
    let cleanedRefreshTokens = 0;

    // Clean expired sessions
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
        cleanedSessions++;
      }
    }

    // Clean expired refresh tokens
    const nowSeconds = Math.floor(now.getTime() / 1000);
    for (const [tokenFamily, payload] of this.refreshTokens.entries()) {
      if (payload.exp < nowSeconds) {
        this.refreshTokens.delete(tokenFamily);
        cleanedRefreshTokens++;
      }
    }

    if (cleanedSessions > 0 || cleanedRefreshTokens > 0) {
      logger.debug('Cleaned up expired auth artifacts', {
        cleanedSessions,
        cleanedRefreshTokens,
      });
    }
  }

  /**
   * Express middleware for authentication
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            error: 'Authentication required',
            code: 'NO_AUTH_HEADER',
          });
        }

        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
          return res.status(401).json({
            error: 'Invalid authorization header format',
            code: 'INVALID_AUTH_FORMAT',
          });
        }

        const token = parts[1];
        const payload = await this.verifyToken(token);

        // Attach user info to request
        req.user = payload;
        req.sessionId = payload.sessionId;

        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return res.status(error.statusCode).json({
            error: error.message,
            code: error.code,
          });
        }

        logger.error('Authentication middleware error', error as Error);
        return res.status(500).json({
          error: 'Internal authentication error',
          code: 'AUTH_INTERNAL_ERROR',
        });
      }
    };
  }

  /**
   * Cleanup and destroy the authenticator
   */
  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }

    // Clear all session data
    this.activeSessions.clear();
    this.refreshTokens.clear();
    this.blacklistedTokens.clear();

    logger.debug('JWTAuthenticator destroyed and resources cleaned up');
  }

  /**
   * Hash password securely
   */
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify password against hash
   */
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}

/**
 * Custom Authentication Error class
 */
class AuthenticationError extends Error {
  public code: string;
  public statusCode: number;
  public details?: Record<string, any>;

  constructor(
    message: string,
    options: { code: string; statusCode: number; details?: Record<string, any> }
  ) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}
