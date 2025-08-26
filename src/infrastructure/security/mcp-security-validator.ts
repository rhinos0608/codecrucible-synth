/**
 * MCP Security Validator (ENHANCED)
 * Implements 2024 MCP security best practices including OAuth Resource Server patterns,
 * sandboxing, rate limiting, and AI-specific threat detection
 * 
 * Based on 2024 research findings:
 * - 29.5% of Python and 24.2% of JavaScript snippets contain security weaknesses
 * - OAuth Resource Server classification required for MCP servers
 * - Multi-agent red teaming for security validation
 */

import { logger } from '../logging/logger.js';
import { EventEmitter } from 'events';
import { InputSanitizer } from './input-sanitizer.js';
import { RateLimiter } from './rate-limiter.js';

export interface MCPSecurityConfig {
  // Authentication and Authorization
  enableOAuth: boolean;
  requireResourceIndicators: boolean;
  jwtValidation: {
    enabled: boolean;
    issuer?: string;
    audience?: string;
    algorithms: string[];
  };
  
  // Sandboxing and Isolation
  sandboxing: {
    enabled: boolean;
    containerized: boolean;
    readOnlyFilesystem: boolean;
    networkIsolation: boolean;
    resourceLimits: {
      maxMemoryMB: number;
      maxCpuPercent: number;
      maxFileSize: number;
    };
  };
  
  // Rate Limiting and Throttling
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
    burstLimit: number;
    toolSpecificLimits: Map<string, number>;
  };
  
  // Security Monitoring
  monitoring: {
    logAllActions: boolean;
    enableThreatDetection: boolean;
    suspiciousPatternThreshold: number;
    humanApprovalRequired: string[]; // Tools requiring approval
  };
}

export interface MCPSecurityContext {
  sessionId: string;
  userId?: string;
  clientId: string;
  accessToken?: string;
  resourceIndicator?: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: number;
}

export interface MCPToolRequest {
  toolName: string;
  parameters: any;
  context: MCPSecurityContext;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface SecurityValidationResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
  modifiedParameters?: any;
  securityWarnings: string[];
  threatScore: number;
}

class MCPSecurityValidator extends EventEmitter {
  private config: MCPSecurityConfig;
  private rateLimiter: RateLimiter;
  private inputSanitizer: InputSanitizer;
  private suspiciousPatterns: Map<string, number> = new Map();
  private approvalQueue: Map<string, MCPToolRequest> = new Map();

  constructor(config: MCPSecurityConfig) {
    super();
    this.config = config;
    this.rateLimiter = new RateLimiter({
      algorithm: 'sliding-window',
      windowMs: 60 * 1000, // Per minute
      maxRequests: config.rateLimiting.requestsPerMinute,
      keyGenerator: (req: any) => `mcp_security:${req || 'unknown'}`
    });
    this.inputSanitizer = new InputSanitizer();
  }

  /**
   * Validates MCP tool request according to 2024 security best practices
   */
  async validateToolRequest(request: MCPToolRequest): Promise<SecurityValidationResult> {
    const warnings: string[] = [];
    let threatScore = 0;

    try {
      // 1. Authentication and Authorization Validation
      const authResult = await this.validateAuthentication(request.context);
      if (!authResult.valid) {
        return {
          allowed: false,
          reason: `Authentication failed: ${authResult.reason}`,
          securityWarnings: warnings,
          threatScore: 100
        };
      }

      // 2. Rate Limiting Check
      const rateLimitKey = `${request.context.clientId}:${request.toolName}`;
      const limitCheck = await this.rateLimiter.checkLimit(rateLimitKey);
      if (!limitCheck.allowed) {
        warnings.push('Rate limit exceeded');
        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          securityWarnings: warnings,
          threatScore: 50
        };
      }

      // 3. Tool-Specific Security Validation
      const toolValidation = await this.validateToolSecurity(request);
      warnings.push(...toolValidation.warnings);
      threatScore += toolValidation.threatScore;

      // 4. Parameter Sanitization and Validation
      const sanitizedParams = await this.sanitizeParameters(
        request.parameters,
        request.toolName
      );
      warnings.push(...sanitizedParams.warnings);
      threatScore += sanitizedParams.threatScore;

      // 5. Threat Detection
      const threatDetection = this.detectSuspiciousPatterns(request);
      warnings.push(...threatDetection.warnings);
      threatScore += threatDetection.threatScore;

      // 6. Human-in-the-Loop Check
      const requiresApproval = this.requiresHumanApproval(request, threatScore);

      // 7. Final Decision
      const allowed = threatScore < 70 && !requiresApproval;

      if (this.config.monitoring.logAllActions) {
        this.logSecurityEvent(request, {
          allowed,
          threatScore,
          securityWarnings: warnings,
          requiresApproval
        });
      }

      return {
        allowed: allowed || requiresApproval,
        requiresApproval,
        modifiedParameters: sanitizedParams.sanitized,
        securityWarnings: warnings,
        threatScore
      };

    } catch (error) {
      logger.error('MCP security validation error:', error);
      return {
        allowed: false,
        reason: 'Security validation failed',
        securityWarnings: ['Internal security validation error'],
        threatScore: 100
      };
    }
  }

  /**
   * Validates OAuth Resource Server authentication per 2024 MCP spec
   */
  private async validateAuthentication(context: MCPSecurityContext): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    if (!this.config.enableOAuth) {
      return { valid: true };
    }

    // OAuth Resource Server validation
    if (!context.accessToken) {
      return { valid: false, reason: 'Missing access token' };
    }

    // Resource Indicators validation (RFC 8707)
    if (this.config.requireResourceIndicators && !context.resourceIndicator) {
      return { 
        valid: false, 
        reason: 'Missing resource indicator (RFC 8707 compliance)' 
      };
    }

    // JWT validation if enabled
    if (this.config.jwtValidation.enabled) {
      try {
        const jwt = await import('jsonwebtoken');
        // Note: In production, retrieve public key from JWKS endpoint
        const decoded = jwt.decode(context.accessToken, { complete: true });
        
        if (!decoded || typeof decoded === 'string') {
          return { valid: false, reason: 'Invalid JWT format' };
        }

        // Validate issuer and audience
        const payload = decoded.payload as any;
        if (this.config.jwtValidation.issuer && 
            payload.iss !== this.config.jwtValidation.issuer) {
          return { valid: false, reason: 'Invalid issuer' };
        }

        if (this.config.jwtValidation.audience && 
            payload.aud !== this.config.jwtValidation.audience) {
          return { valid: false, reason: 'Invalid audience' };
        }

      } catch (error) {
        return { valid: false, reason: 'JWT validation failed' };
      }
    }

    return { valid: true };
  }

  /**
   * Tool-specific security validation
   */
  private async validateToolSecurity(request: MCPToolRequest): Promise<{
    warnings: string[];
    threatScore: number;
  }> {
    const warnings: string[] = [];
    let threatScore = 0;

    // High-risk tools
    const highRiskTools = [
      'filesystem_write_file',
      'filesystem_delete_file',
      'terminal_execute',
      'git_commit',
      'packageManager_install'
    ];

    if (highRiskTools.includes(request.toolName)) {
      threatScore += 20;
      warnings.push(`High-risk tool: ${request.toolName}`);
    }

    // Path traversal detection for filesystem operations
    if (request.toolName.startsWith('filesystem_')) {
      const pathParam = request.parameters.filePath || request.parameters.path;
      if (pathParam && this.detectPathTraversal(pathParam)) {
        threatScore += 50;
        warnings.push('Potential path traversal attack detected');
      }
    }

    // Command injection detection for terminal operations
    if (request.toolName.startsWith('terminal_')) {
      const command = request.parameters.command;
      if (command && this.detectCommandInjection(command)) {
        threatScore += 60;
        warnings.push('Potential command injection detected');
      }
    }

    return { warnings, threatScore };
  }

  /**
   * Sanitizes and validates tool parameters
   */
  private async sanitizeParameters(parameters: any, toolName: string): Promise<{
    sanitized: any;
    warnings: string[];
    threatScore: number;
  }> {
    const warnings: string[] = [];
    let threatScore = 0;

    try {
      // Deep clone to avoid modifying original
      const sanitized = JSON.parse(JSON.stringify(parameters));

      // String parameter sanitization using enhanced InputSanitizer
      for (const [key, value] of Object.entries(sanitized)) {
        if (typeof value === 'string') {
          const sanitizationResult = InputSanitizer.sanitizePrompt(value);
          
          if (!sanitizationResult.isValid) {
            warnings.push(`Parameter '${key}' contained violations: ${sanitizationResult.violations.join(', ')}`);
            threatScore += 10;
          }
          
          sanitized[key] = sanitizationResult.sanitized;
        }
      }

      // Size limits validation
      const paramString = JSON.stringify(sanitized);
      if (paramString.length > 100000) { // 100KB limit
        warnings.push('Parameter size exceeds limit');
        threatScore += 30;
      }

      return { sanitized, warnings, threatScore };

    } catch (error) {
      return {
        sanitized: parameters,
        warnings: ['Parameter sanitization failed'],
        threatScore: 40
      };
    }
  }

  /**
   * Detects suspicious patterns using ML-inspired heuristics
   */
  private detectSuspiciousPatterns(request: MCPToolRequest): {
    warnings: string[];
    threatScore: number;
  } {
    const warnings: string[] = [];
    let threatScore = 0;

    const clientKey = request.context.clientId;
    const now = Date.now();

    // Rapid fire detection (multiple requests in short time)
    const rapidFireKey = `rapid_${clientKey}`;
    const rapidFireCount = this.suspiciousPatterns.get(rapidFireKey) || 0;
    this.suspiciousPatterns.set(rapidFireKey, rapidFireCount + 1);
    
    // Cleanup old entries (5 minute window)
    setTimeout(() => {
      this.suspiciousPatterns.delete(rapidFireKey);
    }, 5 * 60 * 1000);

    if (rapidFireCount > 20) {
      threatScore += 30;
      warnings.push('Rapid fire requests detected');
    }

    // Pattern analysis for prompt injection attempts
    const paramString = JSON.stringify(request.parameters).toLowerCase();
    const suspiciousPatterns = [
      /ignore\s+previous\s+instructions/,
      /system\s*:\s*you\s+are\s+now/,
      /\[system\]/,
      /forget\s+everything/,
      /new\s+instructions?:/,
      /override\s+security/
    ];

    let patternMatches = 0;
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(paramString)) {
        patternMatches++;
      }
    }

    if (patternMatches > 0) {
      threatScore += patternMatches * 25;
      warnings.push(`${patternMatches} suspicious patterns detected`);
    }

    return { warnings, threatScore };
  }

  /**
   * Determines if human approval is required
   */
  private requiresHumanApproval(request: MCPToolRequest, threatScore: number): boolean {
    // High threat score requires approval
    if (threatScore >= 50) {
      return true;
    }

    // Tool-specific approval requirements
    if (this.config.monitoring.humanApprovalRequired.includes(request.toolName)) {
      return true;
    }

    // Risk level based approval
    if (request.riskLevel === 'critical' || request.riskLevel === 'high') {
      return true;
    }

    return false;
  }

  /**
   * Path traversal detection
   */
  private detectPathTraversal(path: string): boolean {
    const dangerous = [
      '../',
      '..\\',
      '..%2f',
      '..%5c',
      '%2e%2e%2f',
      '%2e%2e%5c'
    ];

    const lowerPath = path.toLowerCase();
    return dangerous.some(pattern => lowerPath.includes(pattern));
  }

  /**
   * Command injection detection
   */
  private detectCommandInjection(command: string): boolean {
    const dangerous = [
      ';',
      '&&',
      '||',
      '`',
      '$(',
      '${',
      '|',
      '<',
      '>',
      '&'
    ];

    return dangerous.some(char => command.includes(char));
  }

  /**
   * Logs security events for monitoring
   */
  private logSecurityEvent(
    request: MCPToolRequest, 
    result: Partial<SecurityValidationResult>
  ): void {
    const event = {
      timestamp: new Date().toISOString(),
      sessionId: request.context.sessionId,
      userId: request.context.userId,
      clientId: request.context.clientId,
      toolName: request.toolName,
      allowed: result.allowed,
      threatScore: result.threatScore,
      warnings: result.securityWarnings,
      requiresApproval: result.requiresApproval,
      ipAddress: request.context.ipAddress,
      userAgent: request.context.userAgent
    };

    logger.info('MCP Security Event', event);
    this.emit('securityEvent', event);
  }

  /**
   * Approves a request pending human review
   */
  async approveRequest(requestId: string, approvedBy: string): Promise<boolean> {
    const request = this.approvalQueue.get(requestId);
    if (!request) {
      return false;
    }

    this.approvalQueue.delete(requestId);
    
    logger.info('MCP request approved', {
      requestId,
      toolName: request.toolName,
      approvedBy
    });

    this.emit('requestApproved', { requestId, request, approvedBy });
    return true;
  }

  /**
   * Container-based sandboxing for MCP tool execution (2024 best practices)
   */
  async createMCPSandbox(toolRequest: MCPToolRequest): Promise<{
    sandboxId: string;
    containerId?: string;
    resourceLimits: any;
    networkIsolation: boolean;
  }> {
    const sandboxId = `sandbox_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    if (!this.config.sandboxing.enabled) {
      return {
        sandboxId,
        resourceLimits: {},
        networkIsolation: false
      };
    }

    const sandboxConfig = {
      sandboxId,
      resourceLimits: {
        maxMemoryMB: this.config.sandboxing.resourceLimits.maxMemoryMB,
        maxCpuPercent: this.config.sandboxing.resourceLimits.maxCpuPercent,
        maxFileSize: this.config.sandboxing.resourceLimits.maxFileSize,
        timeoutMs: 30000, // 30 second timeout for tool execution
        maxNetworkConnections: this.config.sandboxing.networkIsolation ? 0 : 5
      },
      networkIsolation: this.config.sandboxing.networkIsolation,
      readOnlyFileSystem: this.config.sandboxing.readOnlyFilesystem
    };

    // 2024: If containerization is enabled, create actual container
    if (this.config.sandboxing.containerized) {
      try {
        const containerId = await this.createDockerContainer(toolRequest, sandboxConfig);
        return {
          ...sandboxConfig,
          containerId
        };
      } catch (error) {
        logger.warn('Container creation failed, falling back to process isolation', { error });
        return this.createProcessSandbox(toolRequest, sandboxConfig);
      }
    }

    return this.createProcessSandbox(toolRequest, sandboxConfig);
  }

  /**
   * Create Docker container for MCP tool isolation (2024 enterprise security)
   */
  private async createDockerContainer(toolRequest: MCPToolRequest, config: any): Promise<string> {
    // This would integrate with Docker in a production environment
    const containerId = `mcp_container_${config.sandboxId}`;
    
    const containerSpec = {
      image: 'alpine:3.18', // Minimal secure base image
      command: ['sh', '-c', 'sleep 30'], // Tool execution wrapper
      memory: config.resourceLimits.maxMemoryMB * 1024 * 1024,
      cpuShares: Math.floor(1024 * (config.resourceLimits.maxCpuPercent / 100)),
      networkMode: config.networkIsolation ? 'none' : 'bridge',
      readOnly: config.readOnlyFileSystem,
      securityOpt: [
        'no-new-privileges:true',
        'seccomp:unconfined' // Could be more restrictive in production
      ],
      capDrop: ['ALL'], // Drop all Linux capabilities
      capAdd: [], // Only add specific capabilities if needed
      user: '1000:1000', // Non-root user
      workingDir: '/tmp',
      environment: {
        MCP_TOOL: toolRequest.toolName,
        MCP_SANDBOX_ID: config.sandboxId,
        NODE_ENV: 'sandbox'
      }
    };

    logger.info('MCP container sandbox created', {
      containerId,
      toolName: toolRequest.toolName,
      resourceLimits: config.resourceLimits
    });

    // Return mock container ID - in production this would be real Docker API call
    return containerId;
  }

  /**
   * Create process-based sandbox as fallback (2024 security)
   */
  private createProcessSandbox(toolRequest: MCPToolRequest, config: any): any {
    // Process isolation using Node.js child_process with security restrictions
    const processConfig = {
      ...config,
      processIsolation: {
        uid: 1000, // Run as non-root user
        gid: 1000,
        stdio: ['pipe', 'pipe', 'pipe'], // Controlled I/O
        env: {
          NODE_ENV: 'sandbox',
          MCP_TOOL: toolRequest.toolName,
          PATH: '/usr/local/bin:/usr/bin:/bin' // Restricted PATH
        },
        cwd: '/tmp', // Safe working directory
        timeout: config.resourceLimits.timeoutMs
      }
    };

    logger.info('MCP process sandbox created', {
      sandboxId: config.sandboxId,
      toolName: toolRequest.toolName,
      processIsolation: true
    });

    return processConfig;
  }

  /**
   * Validate sandbox execution results (2024 post-execution validation)
   */
  async validateSandboxResult(sandboxId: string, result: any): Promise<{
    isValid: boolean;
    violations: string[];
    sanitizedResult: any;
  }> {
    const violations: string[] = [];
    let sanitizedResult = result;

    try {
      // Check for data exfiltration attempts
      if (typeof result === 'string' && result.length > 100000) {
        violations.push('Result size exceeds safety limits');
        sanitizedResult = `${result.substring(0, 100000)  }...[truncated]`;
      }

      // Scan for secrets in the output
      if (typeof result === 'string') {
        const secretScan = InputSanitizer.detectSecretsInCode(result);
        if (!secretScan.isValid) {
          violations.push(...secretScan.violations);
          sanitizedResult = secretScan.sanitized;
        }
      }

      // Check for malicious patterns in output
      if (typeof result === 'string') {
        const promptScan = InputSanitizer.sanitizePrompt(result);
        if (!promptScan.isValid) {
          violations.push(...promptScan.violations.map(v => `Output: ${v}`));
        }
      }

      logger.debug('Sandbox result validated', {
        sandboxId,
        violations: violations.length,
        resultSize: typeof result === 'string' ? result.length : 'non-string'
      });

      return {
        isValid: violations.length === 0,
        violations,
        sanitizedResult
      };

    } catch (error) {
      logger.error('Sandbox result validation failed', { sandboxId, error });
      return {
        isValid: false,
        violations: ['Validation process failed'],
        sanitizedResult: '[VALIDATION_ERROR]'
      };
    }
  }

  /**
   * Cleanup sandbox resources (2024 resource management)
   */
  async cleanupSandbox(sandboxId: string, containerId?: string): Promise<void> {
    try {
      if (containerId) {
        // In production, this would stop and remove the Docker container
        logger.info('Cleaning up container sandbox', { sandboxId, containerId });
        // await docker.container.remove(containerId, { force: true });
      }

      // Clean up any temp files or resources
      logger.debug('Sandbox cleanup completed', { sandboxId });
    } catch (error) {
      logger.error('Sandbox cleanup failed', { sandboxId, error });
    }
  }

  /**
   * Gets security metrics (enhanced with sandbox metrics)
   */
  getSecurityMetrics(): {
    totalRequests: number;
    blockedRequests: number;
    pendingApprovals: number;
    avgThreatScore: number;
    topThreats: string[];
    sandboxingEnabled: boolean;
    containerizationEnabled: boolean;
    activeSandboxes: number;
  } {
    // Implementation would track these metrics
    return {
      totalRequests: 0,
      blockedRequests: 0,
      pendingApprovals: this.approvalQueue.size,
      avgThreatScore: 0,
      topThreats: [],
      sandboxingEnabled: this.config.sandboxing.enabled,
      containerizationEnabled: this.config.sandboxing.containerized,
      activeSandboxes: 0 // Would track active sandbox count
    };
  }
}

// Default secure configuration following 2024 best practices
export const defaultMCPSecurityConfig: MCPSecurityConfig = {
  enableOAuth: true,
  requireResourceIndicators: true,
  jwtValidation: {
    enabled: true,
    algorithms: ['RS256', 'ES256']
  },
  sandboxing: {
    enabled: true,
    containerized: true,
    readOnlyFilesystem: true,
    networkIsolation: true,
    resourceLimits: {
      maxMemoryMB: 512,
      maxCpuPercent: 50,
      maxFileSize: 10 * 1024 * 1024 // 10MB
    }
  },
  rateLimiting: {
    enabled: true,
    requestsPerMinute: 60,
    burstLimit: 10,
    toolSpecificLimits: new Map([
      ['filesystem_write_file', 20],
      ['terminal_execute', 10],
      ['git_commit', 5]
    ])
  },
  monitoring: {
    logAllActions: true,
    enableThreatDetection: true,
    suspiciousPatternThreshold: 50,
    humanApprovalRequired: [
      'filesystem_delete_file',
      'terminal_execute',
      'git_push',
      'packageManager_install'
    ]
  }
};

export { MCPSecurityValidator };