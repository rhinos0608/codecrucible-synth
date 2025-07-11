import { logger } from "../../logger";

export interface SecurityLogEntry {
  userId?: string;
  ipAddress: string;
  referrer?: string;
  timestamp: Date;
  errorType: 'quota_exceeded' | 'plan_spoofing' | 'unauthorized_access' | 'header_tampering' | 'rate_limit_violation' | 'invalid_subscription';
  planState: {
    currentPlan: string;
    quotaUsed: number;
    quotaLimit: number;
    subscriptionStatus: string;
  };
  browserFingerprint?: string;
  userAgent?: string;
  requestDetails?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Central security event logging utility following AI_INSTRUCTIONS.md patterns
 * Logs security violations and abuse attempts with comprehensive context
 */
export function logSecurityEvent(details: SecurityLogEntry): void {
  const logLevel = details.severity === 'critical' ? 'error' : 
                  details.severity === 'high' ? 'warn' : 'info';
  
  // Create structured log entry
  const logContext = {
    securityEvent: true,
    userId: details.userId,
    ipAddress: details.ipAddress,
    referrer: details.referrer,
    errorType: details.errorType,
    planState: details.planState,
    browserFingerprint: details.browserFingerprint,
    userAgent: details.userAgent,
    requestDetails: details.requestDetails,
    severity: details.severity,
    timestamp: details.timestamp.toISOString()
  };

  const message = `Security Event: ${details.errorType} - User ${details.userId || 'unknown'} from ${details.ipAddress}`;

  // Log with appropriate level
  switch (logLevel) {
    case 'error':
      logger.error(message, undefined, logContext);
      break;
    case 'warn':
      logger.warn(message, logContext);
      break;
    default:
      logger.info(message, logContext);
  }

  // Additional alerting for critical events
  if (details.severity === 'critical') {
    // Could integrate with external monitoring systems here
    console.error('CRITICAL SECURITY EVENT:', logContext);
  }
}

/**
 * Analyzes request patterns to detect potential abuse
 */
export function detectAbusePatterns(
  userId: string,
  ipAddress: string,
  recentRequests: Array<{ timestamp: Date; success: boolean }>
): { isAbuse: boolean; reason?: string } {
  const now = new Date();
  const lastHour = recentRequests.filter(
    req => now.getTime() - req.timestamp.getTime() < 60 * 60 * 1000
  );

  // Check for excessive failed requests
  const failedRequests = lastHour.filter(req => !req.success);
  if (failedRequests.length > 10) {
    return {
      isAbuse: true,
      reason: 'excessive_failed_requests'
    };
  }

  // Check for rapid-fire requests (possible bot behavior)
  if (lastHour.length > 30) {
    const intervals = lastHour
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
      .slice(1)
      .map((req, i) => req.timestamp.getTime() - lastHour[i].timestamp.getTime());
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    
    if (avgInterval < 2000) { // Less than 2 seconds between requests
      return {
        isAbuse: true,
        reason: 'rapid_fire_requests'
      };
    }
  }

  return { isAbuse: false };
}

/**
 * Validates subscription data integrity
 */
export function validateSubscriptionIntegrity(subscription: any): boolean {
  if (!subscription) return false;
  
  const requiredFields = ['tier', 'status', 'subscriptionStartDate'];
  return requiredFields.every(field => subscription[field] !== undefined);
}