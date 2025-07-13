// Feature Access Control System - AI_INSTRUCTIONS.md Security Patterns
import { z } from 'zod';
import { logger } from './logger';

// Input validation schema following AI_INSTRUCTIONS.md
const featureAccessSchema = z.object({
  userTier: z.enum(['free', 'pro', 'team', 'enterprise']),
  feature: z.string().min(1),
  userId: z.string().optional()
});

// Feature matrix defining tier-based access control
export const FEATURE_MATRIX = {
  'unlimited_generations': ['pro', 'team', 'enterprise'],
  'synthesis_engine': ['pro', 'team', 'enterprise'],
  'analytics_dashboard': ['pro', 'team', 'enterprise'],
  'analytics_advanced': ['pro', 'team', 'enterprise'],
  'voice_recommendations': ['pro', 'team', 'enterprise'],
  'code_export': ['pro', 'team', 'enterprise'],
  'custom_voices': ['pro', 'team', 'enterprise'],
  'voice_profiles': ['pro', 'team', 'enterprise'],
  'project_folders': ['pro', 'team', 'enterprise'],
  'ai_project_context': ['pro', 'team', 'enterprise'],
  'team_collaboration': ['team', 'enterprise'],
  'shared_profiles': ['team', 'enterprise'],
  'team_management': ['team', 'enterprise'],
  'priority_support': ['team', 'enterprise'],
  'custom_ai_training': ['enterprise'],
  'sso_integration': ['enterprise'],
  'api_access': ['enterprise'],
  'compliance_features': ['enterprise'],
  // Voice selection limits
  'voice_combinations_unlimited': ['pro', 'team', 'enterprise'],
  'advanced_voice_selection': ['pro', 'team', 'enterprise'],
  // Analytics features
  'extended_analytics': ['pro', 'team', 'enterprise'],
  'team_analytics': ['team', 'enterprise'],
  // Generation limits
  'unlimited_daily_generations': ['pro', 'team', 'enterprise'],
} as const;

export type FeatureName = keyof typeof FEATURE_MATRIX;
export type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

// Tier hierarchy for upgrade recommendations
const TIER_HIERARCHY: Record<SubscriptionTier, number> = {
  'free': 0,
  'pro': 1,
  'team': 2,
  'enterprise': 3
};

/**
 * Check if user has access to a specific feature
 * @param userTier - User's current subscription tier
 * @param feature - Feature to check access for
 * @returns boolean indicating access
 */
export const hasFeatureAccess = (userTier: string, feature: string): boolean => {
  try {
    const validation = featureAccessSchema.parse({ userTier, feature });
    const allowedTiers = FEATURE_MATRIX[feature as FeatureName];
    
    if (!allowedTiers) {
      logger.warn('Unknown feature access check', { feature, userTier });
      return false;
    }
    
    return allowedTiers.includes(validation.userTier);
  } catch (error) {
    logger.error('Feature access validation failed', error as Error, { userTier, feature });
    return false;
  }
};

/**
 * Get minimum tier required for a feature
 * @param feature - Feature name
 * @returns minimum subscription tier
 */
export const getMinimumTier = (feature: string): SubscriptionTier => {
  const allowedTiers = FEATURE_MATRIX[feature as FeatureName];
  if (!allowedTiers || allowedTiers.length === 0) {
    return 'enterprise'; // Default to highest tier for unknown features
  }
  
  // Find the lowest tier that has access
  return allowedTiers.reduce((minTier, tier) => {
    return TIER_HIERARCHY[tier as SubscriptionTier] < TIER_HIERARCHY[minTier as SubscriptionTier] 
      ? tier as SubscriptionTier 
      : minTier as SubscriptionTier;
  }, allowedTiers[0] as SubscriptionTier);
};

/**
 * Get required feature for an API route
 * @param path - API route path
 * @returns feature name or null
 */
export const getRequiredFeature = (path: string): string | null => {
  const routeFeatureMap: Record<string, string> = {
    '/api/sessions/synthesize': 'synthesis_engine',
    '/api/analytics': 'analytics_dashboard',
    '/api/voice-profiles': 'voice_profiles',
    '/api/project-folders': 'project_folders',
    '/api/teams': 'team_collaboration',
    '/api/export': 'code_export',
    '/api/recommendations': 'voice_recommendations'
  };
  
  // Check for exact matches first
  if (routeFeatureMap[path]) {
    return routeFeatureMap[path];
  }
  
  // Check for pattern matches
  if (path.includes('/synthesis')) return 'synthesis_engine';
  if (path.includes('/analytics')) return 'analytics_dashboard';
  if (path.includes('/teams')) return 'team_collaboration';
  if (path.includes('/export')) return 'code_export';
  
  return null;
};

/**
 * Generate upgrade URL for a specific feature
 * @param feature - Feature requiring upgrade
 * @param tier - Optional target tier
 * @returns upgrade URL
 */
export const getUpgradeUrl = (feature: string, tier?: string): string => {
  const requiredTier = tier || getMinimumTier(feature);
  return `/subscribe?plan=${requiredTier}&feature=${encodeURIComponent(feature)}`;
};

/**
 * Check voice combination limits based on tier
 * @param userTier - User's subscription tier
 * @param voiceCount - Number of voices selected
 * @returns boolean indicating if selection is allowed
 */
export const checkVoiceCombinationLimit = (userTier: string, voiceCount: number): boolean => {
  if (userTier === 'free') {
    return voiceCount <= 2; // Free tier limited to 2 voices
  }
  return true; // Paid tiers have unlimited voice combinations
};

/**
 * Get daily generation limit for tier
 * @param userTier - User's subscription tier
 * @returns daily limit (-1 for unlimited)
 */
export const getDailyGenerationLimit = (userTier: string): number => {
  switch (userTier) {
    case 'free':
      return 3;
    case 'pro':
    case 'team':
    case 'enterprise':
      return -1; // Unlimited
    default:
      return 0; // Unknown tier, no access
  }
};

export default {
  hasFeatureAccess,
  getMinimumTier,
  getRequiredFeature,
  getUpgradeUrl,
  checkVoiceCombinationLimit,
  getDailyGenerationLimit,
  FEATURE_MATRIX
};