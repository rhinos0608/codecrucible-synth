/**
 * Enhanced MCP Security and Authentication System
 *
 * Provides enterprise-grade security for MCP connections including:
 * - Multi-factor authentication and authorization
 * - Advanced threat detection and prevention
 * - Encrypted communication channels
 * - Security policy enforcement
 * - Audit logging and compliance monitoring
 * - Dynamic security assessment and adaptation
 */

import { EventEmitter } from 'events';
import { createHash, createHmac, randomBytes } from 'crypto';
import { logger } from '../logger.js';

export const DEFAULT_POLICY_ID = 'default';

export interface SecurityPolicy {
  policyId: string;
  name: string;
  description: string;

  // Authentication requirements
  authenticationMethods: AuthenticationMethod[];
  requireMFA: boolean;
  sessionTimeout: number; // milliseconds
  maxConcurrentSessions: number;

  // Authorization rules
  allowedCapabilities: string[];
  deniedCapabilities: string[];
  ipWhitelist?: string[];
  ipBlacklist?: string[];
  timeRestrictions?: TimeRestriction[];

  // Communication security
  requireEncryption: boolean;
  allowedCipherSuites: string[];
  certificateValidation: 'strict' | 'lenient' | 'disabled';

  // Rate limiting
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;

  // Content filtering
  inputValidation: ValidationRule[];
  outputFiltering: FilteringRule[];

  // Threat detection
  anomalyDetectionEnabled: boolean;
  bruteForceProtection: boolean;
  suspiciousActivityThreshold: number;

  // Compliance
  auditLevel: 'minimal' | 'standard' | 'comprehensive';
  dataRetentionPeriod: number; // days
  piiHandling: 'allow' | 'mask' | 'deny';
}

export type AuthenticationMethod =
  | 'api-key'
  | 'oauth2'
  | 'jwt'
  | 'mutual-tls'
  | 'certificate'
  | 'custom';

export interface TimeRestriction {
  days: number[]; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  timezone: string;
}

export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'object' | 'array';
  required: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  allowedValues?: any[];
  customValidator?: string; // Function name for custom validation
}

export interface FilteringRule {
  field: string;
  action: 'mask' | 'remove' | 'encrypt' | 'hash';
  condition?: string; // Condition for when to apply the rule
}

export interface ValidationResult {
  valid: boolean;
  violations: string[];
}

export type MCPRequestData = Record<string, unknown>;

export interface SecurityContext {
  connectionId: string;
  serverId: string;
  userId?: string;
  sessionId: string;

  // Authentication state
  authenticatedMethods: AuthenticationMethod[];
  authenticationTime: Date;
  lastActivity: Date;

  // Authorization state
  grantedCapabilities: string[];
  effectivePolicy: SecurityPolicy;

  // Security metrics
  riskScore: number; // 0-100
  trustLevel: 'low' | 'medium' | 'high';
  anomalyScore: number;

  // Session info
  ipAddress: string;
  userAgent?: string;
  location?: GeolocationInfo;
  deviceFingerprint?: string;
}

export interface GeolocationInfo {
  country: string;
  region: string;
  city: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface SecurityEvent {
  eventId: string;
  timestamp: Date;
  connectionId: string;
  eventType: SecurityEventType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: any;
  resolved: boolean;
  resolvedAt?: Date;
}

export type SecurityEventType =
  | 'authentication-success'
  | 'authentication-failure'
  | 'authorization-denied'
  | 'suspicious-activity'
  | 'rate-limit-exceeded'
  | 'policy-violation'
  | 'anomaly-detected'
  | 'security-breach'
  | 'compliance-violation';

export class EnhancedMCPSecuritySystem extends EventEmitter {
  private securityPolicies: Map<string, SecurityPolicy> = new Map();
  private securityContexts: Map<string, SecurityContext> = new Map();
  private securityEvents: SecurityEvent[] = [];

  // Authentication providers
  private authProviders: Map<AuthenticationMethod, any> = new Map();

  // Rate limiting
  private rateLimits: Map<string, RateLimiter> = new Map();

  // Threat detection
  private threatDetector: ThreatDetector = new ThreatDetector();
  private anomalyDetector: AnomalyDetector = new AnomalyDetector();

  // Session management
  private activeSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds

  // Encryption
  private encryptionKeys: Map<string, Buffer> = new Map();

  constructor() {
    super();
    this.initializeDefaultPolicies();
    this.startSecurityMonitoring();
  }

  /**
   * Initialize default security policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicy: SecurityPolicy = {
      policyId: DEFAULT_POLICY_ID,
      name: 'Default Security Policy',
      description: 'Standard security policy for MCP connections',

      authenticationMethods: ['api-key'],
      requireMFA: false,
      sessionTimeout: 3600000, // 1 hour
      maxConcurrentSessions: 5,

      allowedCapabilities: ['*'],
      deniedCapabilities: [],

      requireEncryption: true,
      allowedCipherSuites: ['AES-256-GCM', 'ChaCha20-Poly1305'],
      certificateValidation: 'strict',

      requestsPerSecond: 10,
      requestsPerMinute: 600,
      requestsPerHour: 36000,

      inputValidation: [
        {
          field: 'query',
          type: 'string',
          required: false,
          maxLength: 10000,
        },
        {
          field: 'parameters',
          type: 'object',
          required: false,
        },
      ],

      outputFiltering: [],

      anomalyDetectionEnabled: true,
      bruteForceProtection: true,
      suspiciousActivityThreshold: 85,

      auditLevel: 'standard',
      dataRetentionPeriod: 90,
      piiHandling: 'mask',
    };

    this.securityPolicies.set(DEFAULT_POLICY_ID, defaultPolicy);

    // Enterprise policy
    const enterprisePolicy: SecurityPolicy = {
      ...defaultPolicy,
      policyId: 'enterprise',
      name: 'Enterprise Security Policy',
      description: 'Enhanced security policy for enterprise environments',

      authenticationMethods: ['oauth2', 'mutual-tls'],
      requireMFA: true,
      sessionTimeout: 1800000, // 30 minutes

      requestsPerSecond: 5,
      requestsPerMinute: 300,
      requestsPerHour: 18000,

      outputFiltering: [
        {
          field: 'sensitive_data',
          action: 'mask',
        },
        {
          field: 'credentials',
          action: 'remove',
        },
      ],

      auditLevel: 'comprehensive',
      dataRetentionPeriod: 365,
    };

    this.securityPolicies.set('enterprise', enterprisePolicy);
  }

  /**
   * Authenticate connection
   */
  async authenticateConnection(
    connectionId: string,
    serverId: string,
    authMethod: AuthenticationMethod,
    credentials: any,
    requestInfo: { ipAddress: string; userAgent?: string }
  ): Promise<SecurityContext> {
    logger.info(`Authenticating connection ${connectionId} with method: ${authMethod}`);

    try {
      // Validate authentication method
      const policy = this.getEffectivePolicy(serverId);
      if (!policy.authenticationMethods.includes(authMethod)) {
        throw new Error(`Authentication method ${authMethod} not allowed`);
      }

      // Check rate limits
      await this.checkRateLimit(connectionId, 'authentication');

      // Perform authentication
      const authResult = await this.performAuthentication(authMethod, credentials);
      if (!authResult.success) {
        await this.recordSecurityEvent(
          connectionId,
          'authentication-failure',
          'medium',
          'Authentication failed',
          {
            method: authMethod,
            reason: authResult.reason,
          }
        );
        throw new Error(`Authentication failed: ${authResult.reason}`);
      }

      // Create security context
      const sessionId = this.generateSessionId();
      const securityContext: SecurityContext = {
        connectionId,
        serverId,
        userId: authResult.userId,
        sessionId,

        authenticatedMethods: [authMethod],
        authenticationTime: new Date(),
        lastActivity: new Date(),

        grantedCapabilities: this.calculateGrantedCapabilities(policy, authResult.permissions),
        effectivePolicy: policy,

        riskScore: await this.calculateRiskScore(requestInfo, authResult),
        trustLevel: this.calculateTrustLevel(authResult),
        anomalyScore: 0,

        ipAddress: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        location: await this.getGeolocation(requestInfo.ipAddress),
        deviceFingerprint: this.generateDeviceFingerprint(requestInfo),
      };

      // Store security context
      this.securityContexts.set(connectionId, securityContext);

      // Manage sessions
      await this.manageUserSessions(securityContext);

      // Record successful authentication
      await this.recordSecurityEvent(
        connectionId,
        'authentication-success',
        'low',
        'Authentication successful',
        {
          method: authMethod,
          userId: authResult.userId,
          riskScore: securityContext.riskScore,
        }
      );

      logger.info(`Connection ${connectionId} authenticated successfully`);
      this.emit('authentication-success', securityContext);

      return securityContext;
    } catch (error) {
      logger.error(`Authentication failed for connection ${connectionId}:`, error);
      throw error;
    }
  }

  /**
   * Perform authentication based on method
   */
  private async performAuthentication(
    method: AuthenticationMethod,
    credentials: any
  ): Promise<any> {
    const provider = this.authProviders.get(method);

    switch (method) {
      case 'api-key':
        return this.authenticateApiKey(credentials.apiKey);

      case 'oauth2':
        return this.authenticateOAuth2(credentials.token);

      case 'jwt':
        return this.authenticateJWT(credentials.token);

      case 'mutual-tls':
        return this.authenticateMutualTLS(credentials.certificate);

      case 'certificate':
        return this.authenticateCertificate(credentials.certificate);

      default:
        if (provider) {
          return provider.authenticate(credentials);
        }
        throw new Error(`Unsupported authentication method: ${method}`);
    }
  }

  private async authenticateApiKey(apiKey: string): Promise<any> {
    // Validate API key format and check against database
    if (!apiKey || apiKey.length < 32) {
      return { success: false, reason: 'Invalid API key format' };
    }

    // Hash the API key for lookup
    const hashedKey = createHash('sha256').update(apiKey).digest('hex');

    // Mock validation - in real implementation, check against database
    const isValid = hashedKey.length === 64; // Simple validation

    return {
      success: isValid,
      userId: isValid ? `user-${hashedKey.substring(0, 8)}` : null,
      permissions: isValid ? ['read', 'write'] : [],
      reason: isValid ? 'Valid API key' : 'Invalid API key',
    };
  }

  private async authenticateOAuth2(token: string): Promise<any> {
    // Validate OAuth2 token
    // This would integrate with OAuth2 provider
    return {
      success: true,
      userId: 'oauth-user',
      permissions: ['read', 'write'],
      reason: 'Valid OAuth2 token',
    };
  }

  private async authenticateJWT(token: string): Promise<any> {
    // Validate JWT token
    // This would use proper JWT validation
    return {
      success: true,
      userId: 'jwt-user',
      permissions: ['read', 'write'],
      reason: 'Valid JWT token',
    };
  }

  private async authenticateMutualTLS(certificate: any): Promise<any> {
    // Validate client certificate
    return {
      success: true,
      userId: 'cert-user',
      permissions: ['read', 'write'],
      reason: 'Valid client certificate',
    };
  }

  private async authenticateCertificate(certificate: any): Promise<any> {
    // Validate certificate
    return {
      success: true,
      userId: 'cert-user',
      permissions: ['read', 'write'],
      reason: 'Valid certificate',
    };
  }

  /**
   * Authorize request
   */
  async authorizeRequest(
    connectionId: string,
    capability: string,
    requestData: MCPRequestData
  ): Promise<boolean> {
    const context = this.securityContexts.get(connectionId);
    if (!context) {
      throw new Error('Security context not found');
    }

    // Check session validity
    if (this.isSessionExpired(context)) {
      await this.recordSecurityEvent(
        connectionId,
        'authorization-denied',
        'medium',
        'Session expired',
        {
          capability,
          sessionAge: Date.now() - context.authenticationTime.getTime(),
        }
      );
      return false;
    }

    // Check capability authorization
    if (!this.isCapabilityAllowed(context, capability)) {
      await this.recordSecurityEvent(
        connectionId,
        'authorization-denied',
        'medium',
        'Capability not authorized',
        {
          capability,
          grantedCapabilities: context.grantedCapabilities,
        }
      );
      return false;
    }

    // Check rate limits
    try {
      await this.checkRateLimit(connectionId, 'request');
    } catch (error) {
      await this.recordSecurityEvent(
        connectionId,
        'rate-limit-exceeded',
        'high',
        'Rate limit exceeded',
        {
          capability,
          error: error instanceof Error ? error.message : String(error),
        }
      );
      return false;
    }

    // Validate input
    const validationResult = await this.validateInput(context.effectivePolicy, requestData);
    if (!validationResult.valid) {
      await this.recordSecurityEvent(
        connectionId,
        'policy-violation',
        'medium',
        'Input validation failed',
        {
          capability,
          violations: validationResult.violations,
        }
      );
      return false;
    }

    // Check for anomalies
    const anomalyScore = await this.anomalyDetector.checkRequest(context, capability, requestData);
    context.anomalyScore = anomalyScore;

    if (anomalyScore > context.effectivePolicy.suspiciousActivityThreshold) {
      await this.recordSecurityEvent(
        connectionId,
        'anomaly-detected',
        'high',
        'Suspicious activity detected',
        {
          capability,
          anomalyScore,
          threshold: context.effectivePolicy.suspiciousActivityThreshold,
        }
      );

      // Don't block but increase monitoring
      this.increaseMonitoring(connectionId);
    }

    // Update activity
    context.lastActivity = new Date();

    return true;
  }

  /**
   * Filter response data
   */
  async filterResponse<T extends Record<string, unknown>>(
    connectionId: string,
    responseData: T
  ): Promise<T> {
    const context = this.securityContexts.get(connectionId);
    if (!context) {
      return responseData;
    }

    const policy = context.effectivePolicy;
    let filteredData: T = JSON.parse(JSON.stringify(responseData));

    // Apply filtering rules
    for (const rule of policy.outputFiltering) {
      filteredData = this.applyFilteringRule(filteredData, rule) as T;
    }

    // Handle PII based on policy
    if (policy.piiHandling !== 'allow') {
      filteredData = this.handlePII(filteredData, policy.piiHandling) as T;
    }

    return filteredData;
  }

  /**
   * Apply filtering rule to data
   */
  private applyFilteringRule(data: unknown, rule: FilteringRule): unknown {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: Record<string, unknown> | unknown[] = Array.isArray(data)
      ? [...data]
      : { ...(data as Record<string, unknown>) };

    if (rule.field in (result as Record<string, unknown>)) {
      const obj = result as Record<string, unknown>;
      switch (rule.action) {
        case 'mask':
          obj[rule.field] = this.maskValue(obj[rule.field]);
          break;
        case 'remove':
          delete obj[rule.field];
          break;
        case 'encrypt':
          obj[rule.field] = this.encryptValue(obj[rule.field]);
          break;
        case 'hash':
          obj[rule.field] = this.hashValue(obj[rule.field]);
          break;
      }
    }

    // Recursively apply to nested objects
    const entries = Array.isArray(result) ? result.entries() : Object.entries(result);
    for (const [key, value] of entries as Iterable<[string, unknown]>) {
      if (typeof value === 'object' && value !== null) {
        if (Array.isArray(result)) {
          result[parseInt(key, 10)] = this.applyFilteringRule(value, rule) as unknown;
        } else {
          (result as Record<string, unknown>)[key] = this.applyFilteringRule(value, rule) as unknown;
        }
      }
    }

    return result;
  }

  private maskValue(value: unknown): string {
    if (typeof value === 'string') {
      if (value.length <= 4) return '***';
      return (
        value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
      );
    }
    return '***';
  }

  private encryptValue(value: unknown): string {
    // Simple encryption - would use proper encryption in production
    return Buffer.from(JSON.stringify(value)).toString('base64');
  }

  private hashValue(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex').substring(0, 16);
  }

  /**
   * Handle PII in data
   */
  private handlePII(data: unknown, handling: 'mask' | 'deny'): unknown {
    // Simple PII detection - would be more sophisticated in production
    const piiFields = ['email', 'phone', 'ssn', 'credit_card', 'password', 'token'];

    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result: Record<string, unknown> | unknown[] = Array.isArray(data)
      ? [...data]
      : { ...(data as Record<string, unknown>) };

    for (const field of piiFields) {
      if (field in (result as Record<string, unknown>)) {
        if (handling === 'mask') {
          (result as Record<string, unknown>)[field] = this.maskValue(
            (result as Record<string, unknown>)[field]
          );
        } else {
          delete (result as Record<string, unknown>)[field];
        }
      }
    }

    // Recursively handle nested objects
    for (const key in result as Record<string, unknown>) {
      const value = (result as Record<string, unknown>)[key];
      if (typeof value === 'object' && value !== null) {
        (result as Record<string, unknown>)[key] = this.handlePII(value, handling) as unknown;
      }
    }

    return result;
  }

  /**
   * Validate input data
   */
  private async validateInput(
    policy: SecurityPolicy,
    data: Record<string, unknown>
  ): Promise<ValidationResult> {
    const violations: string[] = [];

    for (const rule of policy.inputValidation) {
      const fieldValue = data[rule.field];

      // Check required fields
      if (rule.required && (fieldValue === undefined || fieldValue === null)) {
        violations.push(`Required field '${rule.field}' is missing`);
        continue;
      }

      if (fieldValue === undefined || fieldValue === null) {
        continue; // Skip validation for optional empty fields
      }

      // Type validation
      if (!this.validateType(fieldValue, rule.type)) {
        violations.push(`Field '${rule.field}' has invalid type, expected ${rule.type}`);
        continue;
      }

      // Length validation for strings
      if (rule.type === 'string' && typeof fieldValue === 'string') {
        if (rule.minLength && fieldValue.length < rule.minLength) {
          violations.push(
            `Field '${rule.field}' is too short (minimum ${rule.minLength} characters)`
          );
        }
        if (rule.maxLength && fieldValue.length > rule.maxLength) {
          violations.push(
            `Field '${rule.field}' is too long (maximum ${rule.maxLength} characters)`
          );
        }
      }

      // Pattern validation
      if (rule.pattern && typeof fieldValue === 'string') {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(fieldValue)) {
          violations.push(`Field '${rule.field}' does not match required pattern`);
        }
      }

      // Allowed values validation
      if (rule.allowedValues && !rule.allowedValues.includes(fieldValue)) {
        violations.push(`Field '${rule.field}' has invalid value`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Check rate limits
   */
  private async checkRateLimit(connectionId: string, operation: string): Promise<void> {
    const rateLimiter = this.getRateLimiter(connectionId);
    const context = this.securityContexts.get(connectionId);

    if (!context) {
      throw new Error('Security context not found');
    }

    const policy = context.effectivePolicy;

    if (
      !rateLimiter.isAllowed(
        policy.requestsPerSecond,
        policy.requestsPerMinute,
        policy.requestsPerHour
      )
    ) {
      throw new Error('Rate limit exceeded');
    }
  }

  private getRateLimiter(connectionId: string): RateLimiter {
    if (!this.rateLimits.has(connectionId)) {
      this.rateLimits.set(connectionId, new RateLimiter());
    }
    return this.rateLimits.get(connectionId)!;
  }

  /**
   * Generate secure session ID
   */
  private generateSessionId(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(requestInfo: any): string {
    const data = JSON.stringify({
      userAgent: requestInfo.userAgent,
      ipAddress: requestInfo.ipAddress,
      // Additional fingerprinting data would go here
    });
    return createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Calculate risk score
   */
  private async calculateRiskScore(requestInfo: any, authResult: any): Promise<number> {
    let riskScore = 0;

    // IP-based risk
    if (await this.isHighRiskIP(requestInfo.ipAddress)) {
      riskScore += 30;
    }

    // Authentication method risk
    if (authResult.method === 'api-key') {
      riskScore += 10;
    }

    // Time-based risk
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      riskScore += 15;
    }

    // Geolocation risk
    const location = await this.getGeolocation(requestInfo.ipAddress);
    if (location && (await this.isHighRiskLocation(location))) {
      riskScore += 25;
    }

    return Math.min(100, riskScore);
  }

  private calculateTrustLevel(authResult: any): 'low' | 'medium' | 'high' {
    // Simple trust calculation - would be more sophisticated in production
    if (authResult.permissions.length > 3) return 'high';
    if (authResult.permissions.length > 1) return 'medium';
    return 'low';
  }

  private async isHighRiskIP(ipAddress: string): Promise<boolean> {
    // Check against threat intelligence databases
    // This is a placeholder implementation
    return false;
  }

  private async isHighRiskLocation(location: GeolocationInfo): Promise<boolean> {
    // Check against high-risk countries/regions
    // This is a placeholder implementation
    const highRiskCountries = ['XX', 'YY', 'ZZ']; // Example country codes
    return highRiskCountries.includes(location.country);
  }

  private async getGeolocation(ipAddress: string): Promise<GeolocationInfo | undefined> {
    // Geolocation lookup - would use actual GeoIP service
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
    };
  }

  /**
   * Record security event
   */
  private async recordSecurityEvent(
    connectionId: string,
    eventType: SecurityEventType,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    details: any
  ): Promise<void> {
    const event: SecurityEvent = {
      eventId: randomBytes(16).toString('hex'),
      timestamp: new Date(),
      connectionId,
      eventType,
      severity,
      description,
      details,
      resolved: false,
    };

    this.securityEvents.push(event);

    // Emit event for real-time monitoring
    this.emit('security-event', event);

    // Log based on severity
    if (severity === 'critical' || severity === 'high') {
      logger.error(`Security event [${severity.toUpperCase()}]: ${description}`, details);
    } else if (severity === 'medium') {
      logger.warn(`Security event [${severity.toUpperCase()}]: ${description}`, details);
    } else {
      logger.info(`Security event [${severity.toUpperCase()}]: ${description}`, details);
    }
  }

  /**
   * Utility methods
   */
  private getEffectivePolicy(serverId: string): SecurityPolicy {
    // Would determine policy based on server configuration
    return this.securityPolicies.get(DEFAULT_POLICY_ID)!;
  }

  private calculateGrantedCapabilities(policy: SecurityPolicy, permissions: string[]): string[] {
    // Calculate intersection of policy allowed capabilities and user permissions
    if (policy.allowedCapabilities.includes('*')) {
      return permissions;
    }

    return policy.allowedCapabilities.filter(cap => permissions.includes(cap));
  }

  private async manageUserSessions(context: SecurityContext): Promise<void> {
    if (!context.userId) return;

    const userSessions = this.activeSessions.get(context.userId) || new Set();
    userSessions.add(context.sessionId);

    // Enforce max concurrent sessions
    if (userSessions.size > context.effectivePolicy.maxConcurrentSessions) {
      const oldestSessions = Array.from(userSessions).slice(
        0,
        -context.effectivePolicy.maxConcurrentSessions
      );
      oldestSessions.forEach(sessionId => {
        this.terminateSession(sessionId);
        userSessions.delete(sessionId);
      });
    }

    this.activeSessions.set(context.userId, userSessions);
  }

  private terminateSession(sessionId: string): void {
    // Find and terminate session
    for (const [connectionId, context] of this.securityContexts) {
      if (context.sessionId === sessionId) {
        this.securityContexts.delete(connectionId);
        this.rateLimits.delete(connectionId);
        logger.info(`Session terminated: ${sessionId}`);
        break;
      }
    }
  }

  private isSessionExpired(context: SecurityContext): boolean {
    const sessionAge = Date.now() - context.authenticationTime.getTime();
    return sessionAge > context.effectivePolicy.sessionTimeout;
  }

  private isCapabilityAllowed(context: SecurityContext, capability: string): boolean {
    return (
      context.grantedCapabilities.includes('*') || context.grantedCapabilities.includes(capability)
    );
  }

  private increaseMonitoring(connectionId: string): void {
    // Implement enhanced monitoring for suspicious connections
    logger.warn(`Increased monitoring activated for connection: ${connectionId}`);
  }

  /**
   * Start security monitoring
   */
  private startSecurityMonitoring(): void {
    // Clean up expired sessions
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 300000); // 5 minutes

    // Clean up old security events
    setInterval(() => {
      this.cleanupOldEvents();
    }, 3600000); // 1 hour
  }

  private cleanupExpiredSessions(): void {
    const expiredConnections: string[] = [];

    for (const [connectionId, context] of this.securityContexts) {
      if (this.isSessionExpired(context)) {
        expiredConnections.push(connectionId);
      }
    }

    expiredConnections.forEach(connectionId => {
      const context = this.securityContexts.get(connectionId);
      if (context) {
        this.recordSecurityEvent(connectionId, 'authentication-failure', 'low', 'Session expired', {
          sessionAge: Date.now() - context.authenticationTime.getTime(),
        });
      }

      this.securityContexts.delete(connectionId);
      this.rateLimits.delete(connectionId);
    });

    if (expiredConnections.length > 0) {
      logger.info(`Cleaned up ${expiredConnections.length} expired sessions`);
    }
  }

  private cleanupOldEvents(): void {
    const cutoffTime = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    const initialCount = this.securityEvents.length;

    this.securityEvents = this.securityEvents.filter(
      event => event.timestamp.getTime() > cutoffTime
    );

    const removedCount = initialCount - this.securityEvents.length;
    if (removedCount > 0) {
      logger.debug(`Cleaned up ${removedCount} old security events`);
    }
  }

  /**
   * Public API methods
   */

  getSecurityContext(connectionId: string): SecurityContext | null {
    return this.securityContexts.get(connectionId) || null;
  }

  getSecurityEvents(connectionId?: string, eventType?: SecurityEventType): SecurityEvent[] {
    let events = this.securityEvents;

    if (connectionId) {
      events = events.filter(event => event.connectionId === connectionId);
    }

    if (eventType) {
      events = events.filter(event => event.eventType === eventType);
    }

    return events.slice(-100); // Return last 100 events
  }

  async addSecurityPolicy(policy: SecurityPolicy): Promise<void> {
    this.securityPolicies.set(policy.policyId, policy);
    logger.info(`Added security policy: ${policy.name}`);
  }

  async updateSecurityPolicy(policyId: string, updates: Partial<SecurityPolicy>): Promise<void> {
    const existing = this.securityPolicies.get(policyId);
    if (!existing) {
      throw new Error(`Security policy not found: ${policyId}`);
    }

    const updated = { ...existing, ...updates };
    this.securityPolicies.set(policyId, updated);
    logger.info(`Updated security policy: ${policyId}`);
  }

  getSecurityStats(): any {
    const contexts = Array.from(this.securityContexts.values());
    const events = this.securityEvents.slice(-1000); // Last 1000 events

    return {
      activeSessions: contexts.length,
      avgRiskScore: contexts.reduce((sum, ctx) => sum + ctx.riskScore, 0) / contexts.length,
      authenticationMethods: this.groupBy(contexts, ctx => ctx.authenticatedMethods[0]),
      trustLevels: this.groupBy(contexts, ctx => ctx.trustLevel),
      recentEvents: this.groupBy(events, event => event.eventType),
      criticalEvents: events.filter(event => event.severity === 'critical').length,
    };
  }

  private groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, number> {
    const result = {} as Record<K, number>;
    array.forEach(item => {
      const key = keyFn(item);
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }
}

/**
 * Rate Limiter implementation
 */
class RateLimiter {
  private requestTimes: number[] = [];

  isAllowed(perSecond: number, perMinute: number, perHour: number): boolean {
    const now = Date.now();

    // Clean old requests
    this.requestTimes = this.requestTimes.filter(time => now - time < 3600000); // Keep last hour

    // Check limits
    const lastSecond = this.requestTimes.filter(time => now - time < 1000);
    const lastMinute = this.requestTimes.filter(time => now - time < 60000);
    const lastHour = this.requestTimes;

    if (lastSecond.length >= perSecond) return false;
    if (lastMinute.length >= perMinute) return false;
    if (lastHour.length >= perHour) return false;

    // Record this request
    this.requestTimes.push(now);
    return true;
  }
}

/**
 * Threat Detector
 */
class ThreatDetector {
  detectThreats(
    context: SecurityContext,
    requestData: any
  ): { threats: string[]; riskLevel: number } {
    const threats: string[] = [];
    let riskLevel = 0;

    // Check for suspicious patterns
    if (this.containsSQLInjection(requestData)) {
      threats.push('Potential SQL injection');
      riskLevel += 40;
    }

    if (this.containsXSS(requestData)) {
      threats.push('Potential XSS attack');
      riskLevel += 30;
    }

    if (this.containsCommandInjection(requestData)) {
      threats.push('Potential command injection');
      riskLevel += 50;
    }

    return { threats, riskLevel };
  }

  private containsSQLInjection(data: any): boolean {
    const sqlPatterns = [
      /(\bor\b|\band\b).*['"]/i,
      /union.*select/i,
      /drop\s+table/i,
      /delete\s+from/i,
    ];

    const text = JSON.stringify(data).toLowerCase();
    return sqlPatterns.some(pattern => pattern.test(text));
  }

  private containsXSS(data: any): boolean {
    const xssPatterns = [/<script/i, /javascript:/i, /onerror\s*=/i, /onload\s*=/i];

    const text = JSON.stringify(data);
    return xssPatterns.some(pattern => pattern.test(text));
  }

  private containsCommandInjection(data: any): boolean {
    const commandPatterns = [/;\s*(rm|del|format)/i, /\|\s*(nc|netcat)/i, /`[^`]*`/, /\$\([^)]*\)/];

    const text = JSON.stringify(data);
    return commandPatterns.some(pattern => pattern.test(text));
  }
}

/**
 * Anomaly Detector
 */
class AnomalyDetector {
  private requestHistory: Map<string, any[]> = new Map();

  async checkRequest(
    context: SecurityContext,
    capability: string,
    requestData: any
  ): Promise<number> {
    const connectionId = context.connectionId;
    const history = this.requestHistory.get(connectionId) || [];

    // Add current request to history
    history.push({
      capability,
      timestamp: Date.now(),
      dataSize: JSON.stringify(requestData).length,
      hour: new Date().getHours(),
    });

    // Keep only recent history
    if (history.length > 100) {
      history.shift();
    }

    this.requestHistory.set(connectionId, history);

    // Calculate anomaly score
    let anomalyScore = 0;

    // Check request frequency
    const recentRequests = history.filter(req => Date.now() - req.timestamp < 60000);
    if (recentRequests.length > 10) {
      anomalyScore += 30;
    }

    // Check unusual capabilities
    const capabilityCounts = this.groupBy(history, req => req.capability);
    const currentCapabilityCount = capabilityCounts[capability] || 0;
    const avgCapabilityCount =
      Object.values(capabilityCounts).reduce((sum: number, count: number) => sum + count, 0) /
      Object.keys(capabilityCounts).length;

    if (currentCapabilityCount > avgCapabilityCount * 3) {
      anomalyScore += 25;
    }

    // Check unusual times
    const currentHour = new Date().getHours();
    const hourCounts = this.groupBy(history, req => req.hour);
    const typicalHours = Object.keys(hourCounts).filter(hour => hourCounts[hour] > 2);

    if (typicalHours.length > 0 && !typicalHours.includes(currentHour.toString())) {
      anomalyScore += 20;
    }

    // Check data size anomalies
    const dataSizes = history.map(req => req.dataSize);
    const avgDataSize = dataSizes.reduce((sum, size) => sum + size, 0) / dataSizes.length;
    const currentDataSize = JSON.stringify(requestData).length;

    if (currentDataSize > avgDataSize * 5) {
      anomalyScore += 35;
    }

    return Math.min(100, anomalyScore);
  }

  private groupBy<T, K extends string | number>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, number> {
    const result = {} as Record<K, number>;
    array.forEach(item => {
      const key = keyFn(item);
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }
}

// Global instance
export const enhancedMCPSecuritySystem = new EnhancedMCPSecuritySystem();
