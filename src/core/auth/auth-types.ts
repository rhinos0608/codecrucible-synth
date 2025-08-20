/**
 * Enterprise Authentication & Authorization Types
 * Implements OAuth2, JWT, and RBAC patterns following OWASP guidelines
 */

export interface AuthConfig {
  provider: 'jwt' | 'oauth2' | 'saml' | 'ldap';
  secret: string;
  expiry: number;
  refreshTokens: boolean;
  algorithms: string[];
  issuer: string;
  audience: string;
  clockTolerance: number;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  metadata: Record<string, any>;
  createdAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface TokenPayload {
  sub: string; // subject (user ID)
  iat: number; // issued at
  exp: number; // expiration
  iss: string; // issuer
  aud: string; // audience
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenFamily: string;
  exp: number;
}

export interface AuthSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
  expiresAt: Date;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  inheritsFrom?: string[];
}

export interface AuthResult {
  success: boolean;
  user?: User;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
  errorCode?: string;
}

export interface AuthenticationError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, any>;
}

// RBAC Policy Types
export interface Policy {
  effect: 'allow' | 'deny';
  principal: string | string[];
  action: string | string[];
  resource: string | string[];
  condition?: Record<string, any>;
}

export interface PolicyContext {
  principal: string;
  action: string;
  resource: string;
  environment: Record<string, any>;
}

// OAuth2 Types
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope?: string;
}

// SAML Types
export interface SAMLConfig {
  entryPoint: string;
  issuer: string;
  cert: string;
  privateKey: string;
  signatureAlgorithm: string;
}

// Rate Limiting Types
export interface RateLimitConfig {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: any) => string;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsLimit: number;
  remainingHits: number;
  msBeforeNext: number;
}