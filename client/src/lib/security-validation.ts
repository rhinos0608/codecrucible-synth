// Security validation utilities following AI_INSTRUCTIONS.md patterns
// Comprehensive input validation and sanitization for consciousness-driven AI platform

import { z } from 'zod';

// Following AI_INSTRUCTIONS.md: Core voice selection validation
export const voiceSelectionSchema = z.object({
  perspectives: z.array(z.string().min(1).max(50)).min(1).max(5),
  roles: z.array(z.string().min(1).max(50)).min(0).max(4),
  prompt: z.string().min(1).max(15000),
  context: z.string().max(50000).optional(),
  analysisDepth: z.number().int().min(1).max(5).default(2),
  mergeStrategy: z.enum(['competitive', 'collaborative', 'consensus']).default('competitive'),
  qualityFiltering: z.boolean().default(true)
});

// Following AI_INSTRUCTIONS.md: Custom voice profile validation
export const customVoiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  selectedPerspectives: z.array(z.string()).max(5),
  selectedRoles: z.array(z.string()).max(4),
  avatar: z.string().emoji().optional(),
  personality: z.string().max(200).optional(),
  specialization: z.string().max(100).optional(),
  ethicalStance: z.string().max(200).optional()
});

// Security logging for consciousness development tracking
export const logSecurityEvent = (event: string, details: Record<string, any>) => {
  const sanitizedDetails = {
    timestamp: new Date().toISOString(),
    userId: details.userId?.substring(0, 8) + '...',
    sessionId: details.sessionId,
    feature: details.feature,
    planTier: details.planTier,
    event
  };

  console.info(`[SECURITY] ${event}`, sanitizedDetails);
  
  // Send to tracking endpoint
  fetch('/api/errors/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...sanitizedDetails,
      source: 'security-validation',
      consciousnessLevel: 'security-monitoring'
    })
  }).catch(error => {
    console.error('Failed to track security event:', error);
  });
};

// Rate limiting helpers for consciousness patterns
export const createSecurityLimiter = (windowMs: number, max: number) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();
  
  return (userId: string): boolean => {
    const now = Date.now();
    const userAttempts = attempts.get(userId);
    
    if (!userAttempts || now > userAttempts.resetTime) {
      attempts.set(userId, { count: 1, resetTime: now + windowMs });
      return true;
    }
    
    if (userAttempts.count >= max) {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', { userId, windowMs, max });
      return false;
    }
    
    userAttempts.count++;
    return true;
  };
};

// Input sanitization for consciousness interactions
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML
    .replace(/javascript:/gi, '') // Remove potential JS injection
    .replace(/data:/gi, '') // Remove data URLs
    .substring(0, 15000); // Enforce max length
};

// Validate voice selection with consciousness principles
export const validateVoiceSelection = (selection: any) => {
  try {
    const validated = voiceSelectionSchema.parse(selection);
    
    logSecurityEvent('VOICE_SELECTION_VALIDATED', {
      perspectiveCount: validated.perspectives.length,
      roleCount: validated.roles.length,
      promptLength: validated.prompt.length
    });
    
    return { success: true, data: validated };
  } catch (error) {
    logSecurityEvent('VOICE_SELECTION_VALIDATION_FAILED', { error: error });
    return { success: false, error: 'Invalid voice selection' };
  }
};

// Validate custom voice with ethical constraints
export const validateCustomVoice = (voice: any) => {
  try {
    const validated = customVoiceSchema.parse(voice);
    
    // Additional ethical validation
    const bannedTerms = ['hack', 'exploit', 'illegal', 'harmful'];
    const hasEthicalIssues = bannedTerms.some(term => 
      validated.name.toLowerCase().includes(term) ||
      validated.description?.toLowerCase().includes(term) ||
      validated.personality?.toLowerCase().includes(term)
    );
    
    if (hasEthicalIssues) {
      logSecurityEvent('CUSTOM_VOICE_ETHICAL_VIOLATION', { voiceName: validated.name });
      return { success: false, error: 'Voice profile contains inappropriate content' };
    }
    
    logSecurityEvent('CUSTOM_VOICE_VALIDATED', {
      voiceName: validated.name,
      perspectiveCount: validated.selectedPerspectives.length,
      roleCount: validated.selectedRoles.length
    });
    
    return { success: true, data: validated };
  } catch (error) {
    logSecurityEvent('CUSTOM_VOICE_VALIDATION_FAILED', { error: error });
    return { success: false, error: 'Invalid voice profile' };
  }
};

// Performance monitoring for consciousness operations
export const monitorPerformance = (operation: string) => {
  const startTime = performance.now();
  
  return {
    end: () => {
      const duration = performance.now() - startTime;
      
      if (duration > 200) { // Following AI_INSTRUCTIONS.md: <200ms API responses
        logSecurityEvent('PERFORMANCE_SLOW_OPERATION', {
          operation,
          duration: Math.round(duration),
          threshold: 200
        });
      }
      
      return duration;
    }
  };
};