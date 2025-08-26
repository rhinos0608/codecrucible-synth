/**
 * HTTPS Enforcement and Security Headers Middleware
 * Implements comprehensive security headers and HTTPS redirection
 */

import { logger } from '../logging/logger.js';

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: {
    enabled: boolean;
    directives: Record<string, string[]>;
    reportOnly?: boolean;
    reportUri?: string;
  };
  hsts?: {
    enabled: boolean;
    maxAge: number;
    includeSubDomains: boolean;
    preload: boolean;
  };
  frameOptions?: {
    enabled: boolean;
    policy: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM';
    uri?: string;
  };
  contentTypeOptions?: {
    enabled: boolean;
  };
  referrerPolicy?: {
    enabled: boolean;
    policy:
      | 'no-referrer'
      | 'no-referrer-when-downgrade'
      | 'origin'
      | 'origin-when-cross-origin'
      | 'same-origin'
      | 'strict-origin'
      | 'strict-origin-when-cross-origin'
      | 'unsafe-url';
  };
  permissionsPolicy?: {
    enabled: boolean;
    directives: Record<string, string[]>;
  };
  crossOriginEmbedderPolicy?: {
    enabled: boolean;
    policy: 'unsafe-none' | 'require-corp';
  };
  crossOriginOpenerPolicy?: {
    enabled: boolean;
    policy: 'unsafe-none' | 'same-origin-allow-popups' | 'same-origin';
  };
  crossOriginResourcePolicy?: {
    enabled: boolean;
    policy: 'same-site' | 'same-origin' | 'cross-origin';
  };
}

export interface HttpsConfig {
  enforceHttps: boolean;
  redirectHttps: boolean;
  httpsPort: number;
  trustProxy: boolean;
  excludePaths: string[];
  headers: SecurityHeadersConfig;
}

export class HttpsEnforcer {
  private config: HttpsConfig;

  constructor(config: Partial<HttpsConfig> = {}) {
    this.config = {
      enforceHttps: true,
      redirectHttps: true,
      httpsPort: 443,
      trustProxy: true,
      excludePaths: ['/health', '/metrics'],
      headers: {
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'"],
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'font-src': ["'self'"],
            'connect-src': ["'self'"],
            'media-src': ["'none'"],
            'object-src': ["'none'"],
            'child-src': ["'none'"],
            'frame-src': ["'none'"],
            'worker-src': ["'none'"],
            'frame-ancestors': ["'none'"],
            'form-action': ["'self'"],
            'upgrade-insecure-requests': [],
          },
          reportOnly: false,
        },
        hsts: {
          enabled: true,
          maxAge: 31536000, // 1 year
          includeSubDomains: true,
          preload: true,
        },
        frameOptions: {
          enabled: true,
          policy: 'DENY',
        },
        contentTypeOptions: {
          enabled: true,
        },
        referrerPolicy: {
          enabled: true,
          policy: 'strict-origin-when-cross-origin',
        },
        permissionsPolicy: {
          enabled: true,
          directives: {
            camera: [],
            microphone: [],
            geolocation: [],
            payment: [],
            usb: [],
            magnetometer: [],
            gyroscope: [],
            accelerometer: [],
          },
        },
        crossOriginEmbedderPolicy: {
          enabled: true,
          policy: 'require-corp',
        },
        crossOriginOpenerPolicy: {
          enabled: true,
          policy: 'same-origin',
        },
        crossOriginResourcePolicy: {
          enabled: true,
          policy: 'same-origin',
        },
      },
      ...config,
    };
  }

  /**
   * Create HTTPS enforcement middleware
   */
  httpsMiddleware() {
    return (req: any, res: any, next: any) => {
      try {
        // Skip enforcement for excluded paths
        if (this.isExcludedPath(req.path)) {
          return next();
        }

        // Check if HTTPS is required
        if (this.config.enforceHttps && !this.isSecureRequest(req)) {
          // Log insecure access attempt
          logger.warn('Insecure HTTP request blocked', {
            path: req.path,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
          });

          if (this.config.redirectHttps) {
            // Redirect to HTTPS
            const httpsUrl = this.buildHttpsUrl(req);

            logger.info('Redirecting to HTTPS', {
              from: req.url,
              to: httpsUrl,
            });

            return res.redirect(301, httpsUrl);
          } else {
            // Block request
            return res.status(403).json({
              error: 'HTTPS required',
              message: 'This endpoint requires a secure connection',
            });
          }
        }

        next();
      } catch (error) {
        logger.error('HTTPS enforcement error', error as Error);
        next(); // Fail open for security middleware
      }
    };
  }

  /**
   * Create security headers middleware
   */
  securityHeadersMiddleware() {
    return (req: any, res: any, next: any) => {
      try {
        this.setSecurityHeaders(res);
        next();
      } catch (error) {
        logger.error('Security headers middleware error', error as Error);
        next(); // Fail open
      }
    };
  }

  /**
   * Set security headers on response
   */
  private setSecurityHeaders(res: any): void {
    const headers = this.config.headers;

    // Content Security Policy
    if (headers.contentSecurityPolicy?.enabled) {
      const csp = this.buildCSPHeader(headers.contentSecurityPolicy);
      const headerName = headers.contentSecurityPolicy.reportOnly
        ? 'Content-Security-Policy-Report-Only'
        : 'Content-Security-Policy';
      res.setHeader(headerName, csp);
    }

    // HTTP Strict Transport Security
    if (headers.hsts?.enabled) {
      const hsts = this.buildHSTSHeader(headers.hsts);
      res.setHeader('Strict-Transport-Security', hsts);
    }

    // X-Frame-Options
    if (headers.frameOptions?.enabled) {
      const frameOptions = this.buildFrameOptionsHeader(headers.frameOptions);
      res.setHeader('X-Frame-Options', frameOptions);
    }

    // X-Content-Type-Options
    if (headers.contentTypeOptions?.enabled) {
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }

    // Referrer Policy
    if (headers.referrerPolicy?.enabled) {
      res.setHeader('Referrer-Policy', headers.referrerPolicy.policy);
    }

    // Permissions Policy
    if (headers.permissionsPolicy?.enabled) {
      const permissionsPolicy = this.buildPermissionsPolicyHeader(headers.permissionsPolicy);
      res.setHeader('Permissions-Policy', permissionsPolicy);
    }

    // Cross-Origin Embedder Policy
    if (headers.crossOriginEmbedderPolicy?.enabled) {
      res.setHeader('Cross-Origin-Embedder-Policy', headers.crossOriginEmbedderPolicy.policy);
    }

    // Cross-Origin Opener Policy
    if (headers.crossOriginOpenerPolicy?.enabled) {
      res.setHeader('Cross-Origin-Opener-Policy', headers.crossOriginOpenerPolicy.policy);
    }

    // Cross-Origin Resource Policy
    if (headers.crossOriginResourcePolicy?.enabled) {
      res.setHeader('Cross-Origin-Resource-Policy', headers.crossOriginResourcePolicy.policy);
    }

    // Additional security headers
    res.setHeader('X-Powered-By', 'CodeCrucible-Synth'); // Custom header instead of default
    res.setHeader('Server', 'CodeCrucible'); // Hide server details
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  }

  /**
   * Check if request is secure
   */
  private isSecureRequest(req: any): boolean {
    // Check if already HTTPS
    if (req.secure) {
      return true;
    }

    // Check for proxy headers if trusting proxy
    if (this.config.trustProxy) {
      // Check X-Forwarded-Proto header
      const proto = req.get('X-Forwarded-Proto');
      if (proto === 'https') {
        return true;
      }

      // Check X-Forwarded-Ssl header
      const ssl = req.get('X-Forwarded-Ssl');
      if (ssl === 'on') {
        return true;
      }

      // Check Front-End-Https header
      const frontEndHttps = req.get('Front-End-Https');
      if (frontEndHttps === 'on') {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if path is excluded from HTTPS enforcement
   */
  private isExcludedPath(path: string): boolean {
    return this.config.excludePaths.some(excludePath => {
      if (excludePath.endsWith('*')) {
        return path.startsWith(excludePath.slice(0, -1));
      }
      return path === excludePath;
    });
  }

  /**
   * Build HTTPS URL for redirect
   */
  private buildHttpsUrl(req: any): string {
    const host = req.get('Host') || 'localhost';
    const hostWithoutPort = host.split(':')[0];

    let httpsHost = hostWithoutPort;
    if (this.config.httpsPort !== 443) {
      httpsHost += `:${this.config.httpsPort}`;
    }

    return `https://${httpsHost}${req.originalUrl}`;
  }

  /**
   * Build Content Security Policy header
   */
  private buildCSPHeader(csp: NonNullable<SecurityHeadersConfig['contentSecurityPolicy']>): string {
    const directives: string[] = [];

    for (const [directive, sources] of Object.entries(csp.directives)) {
      if (sources.length === 0) {
        directives.push(directive);
      } else {
        directives.push(`${directive} ${sources.join(' ')}`);
      }
    }

    let header = directives.join('; ');

    // Add report URI if specified
    if (csp.reportUri) {
      header += `; report-uri ${csp.reportUri}`;
    }

    return header;
  }

  /**
   * Build HSTS header
   */
  private buildHSTSHeader(hsts: NonNullable<SecurityHeadersConfig['hsts']>): string {
    let header = `max-age=${hsts.maxAge}`;

    if (hsts.includeSubDomains) {
      header += '; includeSubDomains';
    }

    if (hsts.preload) {
      header += '; preload';
    }

    return header;
  }

  /**
   * Build Frame Options header
   */
  private buildFrameOptionsHeader(
    frameOptions: NonNullable<SecurityHeadersConfig['frameOptions']>
  ): string {
    if (frameOptions.policy === 'ALLOW-FROM' && frameOptions.uri) {
      return `${frameOptions.policy} ${frameOptions.uri}`;
    }
    return frameOptions.policy;
  }

  /**
   * Build Permissions Policy header
   */
  private buildPermissionsPolicyHeader(
    permissionsPolicy: NonNullable<SecurityHeadersConfig['permissionsPolicy']>
  ): string {
    const directives: string[] = [];

    for (const [feature, allowlist] of Object.entries(permissionsPolicy.directives)) {
      if (allowlist.length === 0) {
        directives.push(`${feature}=()`);
      } else {
        const sources = allowlist
          .map(source => {
            if (source === 'self') return '"self"';
            if (source === '*') return '*';
            return `"${source}"`;
          })
          .join(' ');
        directives.push(`${feature}=(${sources})`);
      }
    }

    return directives.join(', ');
  }

  /**
   * Create CSP violation reporting endpoint
   */
  cspReportingMiddleware() {
    return (req: any, res: any) => {
      try {
        const report = req.body;

        logger.warn('CSP violation reported', {
          violation: {
            documentUri: report['csp-report']?.['document-uri'],
            violatedDirective: report['csp-report']?.['violated-directive'],
            blockedUri: report['csp-report']?.['blocked-uri'],
            originalPolicy: report['csp-report']?.['original-policy'],
          },
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });

        // Store violation for analysis (implement storage as needed)
        this.storeCSPViolation(report);

        res.status(204).end();
      } catch (error) {
        logger.error('CSP reporting error', error as Error);
        res.status(400).json({ error: 'Invalid report format' });
      }
    };
  }

  /**
   * Store CSP violation for analysis
   */
  private storeCSPViolation(report: any): void {
    // In production, store to database or monitoring system
    // For now, just emit an event
    logger.info('CSP violation stored for analysis', {
      timestamp: new Date().toISOString(),
      report: JSON.stringify(report, null, 2),
    });
  }

  /**
   * Create comprehensive security middleware stack
   */
  createSecurityMiddleware() {
    return [this.httpsMiddleware(), this.securityHeadersMiddleware()];
  }

  /**
   * Validate security configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate CSP directives
    if (this.config.headers.contentSecurityPolicy?.enabled) {
      const csp = this.config.headers.contentSecurityPolicy;

      if (!csp.directives['default-src']) {
        errors.push('CSP default-src directive is required');
      }

      // Check for common CSP issues
      if (csp.directives['script-src']?.includes("'unsafe-eval'")) {
        errors.push('CSP script-src should not include unsafe-eval');
      }
    }

    // Validate HSTS configuration
    if (this.config.headers.hsts?.enabled) {
      const hsts = this.config.headers.hsts;

      if (hsts.maxAge < 300) {
        errors.push('HSTS max-age should be at least 300 seconds');
      }
    }

    // Validate HTTPS configuration
    if (this.config.enforceHttps && !this.config.redirectHttps) {
      // This is valid but worth noting
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get security headers for testing
   */
  getSecurityHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    // Mock response object to collect headers
    const mockRes = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    };

    this.setSecurityHeaders(mockRes);
    return headers;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<HttpsConfig>): void {
    this.config = { ...this.config, ...config };

    logger.info('HTTPS enforcer configuration updated', {
      enforceHttps: this.config.enforceHttps,
      redirectHttps: this.config.redirectHttps,
    });
  }

  /**
   * Create development-friendly configuration
   */
  static createDevelopmentConfig(): Partial<HttpsConfig> {
    return {
      enforceHttps: false,
      redirectHttps: false,
      headers: {
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // More permissive for dev
            'style-src': ["'self'", "'unsafe-inline'"],
            'img-src': ["'self'", 'data:', 'https:', 'http:'], // Allow HTTP images in dev
          },
        },
        hsts: {
          enabled: false, // Don't use HSTS in development
          maxAge: 0,
          includeSubDomains: false,
          preload: false,
        },
      },
    };
  }

  /**
   * Create production configuration
   */
  static createProductionConfig(): Partial<HttpsConfig> {
    return {
      enforceHttps: true,
      redirectHttps: true,
      headers: {
        contentSecurityPolicy: {
          enabled: true,
          directives: {
            'default-src': ["'self'"],
            'script-src': ["'self'"],
            'style-src': ["'self'"],
            'img-src': ["'self'", 'data:', 'https:'],
            'connect-src': ["'self'"],
            'font-src': ["'self'"],
            'object-src': ["'none'"],
            'media-src': ["'self'"],
            'frame-src': ["'none'"],
            'child-src': ["'none'"],
            'frame-ancestors': ["'none'"],
            'form-action': ["'self'"],
            'upgrade-insecure-requests': [],
          },
          reportOnly: false,
        },
        hsts: {
          enabled: true,
          maxAge: 63072000, // 2 years
          includeSubDomains: true,
          preload: true,
        },
      },
    };
  }
}
