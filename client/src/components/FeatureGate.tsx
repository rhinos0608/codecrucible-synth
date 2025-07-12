// Frontend Feature Gate Component - AI_INSTRUCTIONS.md Security Patterns
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlanGuard } from '@/hooks/usePlanGuard';
import { isFrontendDevModeEnabled } from '@/lib/dev-mode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, Crown, Users, Building } from 'lucide-react';

// Feature matrix matching server-side implementation
const FEATURE_MATRIX = {
  'unlimited_generations': ['pro', 'team', 'enterprise'],
  'synthesis_engine': ['pro', 'team', 'enterprise'],
  'analytics_dashboard': ['pro', 'team', 'enterprise'],
  'voice_recommendations': ['pro', 'team', 'enterprise'],
  'code_export': ['pro', 'team', 'enterprise'],
  'custom_voices': ['pro', 'team', 'enterprise'],
  'voice_profiles': ['pro', 'team', 'enterprise'],
  'team_collaboration': ['team', 'enterprise'],
  'shared_profiles': ['team', 'enterprise'],
  'team_management': ['team', 'enterprise'],
  'priority_support': ['team', 'enterprise'],
  'custom_ai_training': ['enterprise'],
  'sso_integration': ['enterprise'],
  'api_access': ['enterprise'],
  'compliance_features': ['enterprise'],
  'voice_combinations_unlimited': ['pro', 'team', 'enterprise'],
  'advanced_voice_selection': ['pro', 'team', 'enterprise'],
  'extended_analytics': ['pro', 'team', 'enterprise'],
  'team_analytics': ['team', 'enterprise'],
  'unlimited_daily_generations': ['pro', 'team', 'enterprise'],
} as const;

type FeatureName = keyof typeof FEATURE_MATRIX;
type SubscriptionTier = 'free' | 'pro' | 'team' | 'enterprise';

interface FeatureGateProps {
  feature: FeatureName;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showUpgrade?: boolean;
  className?: string;
}

/**
 * Check if user has access to a specific feature
 */
const hasFeatureAccess = (userTier: string, feature: FeatureName): boolean => {
  // Dev mode bypass - grant access to all features in development
  if (isFrontendDevModeEnabled()) {
    return true;
  }
  
  const allowedTiers = FEATURE_MATRIX[feature];
  if (!allowedTiers) return false;
  return allowedTiers.includes(userTier as SubscriptionTier);
};

/**
 * Get minimum tier required for a feature
 */
const getMinimumTier = (feature: FeatureName): SubscriptionTier => {
  const allowedTiers = FEATURE_MATRIX[feature];
  if (!allowedTiers || allowedTiers.length === 0) return 'enterprise';
  
  const tierOrder: SubscriptionTier[] = ['pro', 'team', 'enterprise'];
  return tierOrder.find(tier => allowedTiers.includes(tier)) || 'enterprise';
};

/**
 * Get pricing for tier
 */
const getTierPricing = (tier: SubscriptionTier): string => {
  const pricing = {
    'free': '$0',
    'pro': '$19',
    'team': '$49',
    'enterprise': '$99'
  };
  return pricing[tier];
};

/**
 * Get tier icon
 */
const getTierIcon = (tier: SubscriptionTier) => {
  switch (tier) {
    case 'pro':
      return <Crown className="w-4 h-4 text-yellow-500" />;
    case 'team':
      return <Users className="w-4 h-4 text-blue-500" />;
    case 'enterprise':
      return <Building className="w-4 h-4 text-purple-500" />;
    default:
      return <Lock className="w-4 h-4 text-gray-500" />;
  }
};

/**
 * Upgrade prompt component
 */
const UpgradePrompt: React.FC<{ 
  feature: FeatureName; 
  className?: string;
}> = ({ feature, className = "" }) => {
  const requiredTier = getMinimumTier(feature);
  const pricing = getTierPricing(requiredTier);
  const icon = getTierIcon(requiredTier);
  
  const featureDisplayNames: Record<FeatureName, string> = {
    'unlimited_generations': 'Unlimited Code Generations',
    'synthesis_engine': 'Advanced Synthesis Engine',
    'analytics_dashboard': 'Analytics Dashboard',
    'voice_recommendations': 'Smart Voice Recommendations',
    'code_export': 'Code Export & GitHub Integration',
    'custom_voices': 'Custom Voice Profiles',
    'voice_profiles': 'Voice Profile Management',
    'team_collaboration': 'Team Collaboration',
    'shared_profiles': 'Shared Voice Profiles',
    'team_management': 'Team Management',
    'priority_support': 'Priority Support',
    'custom_ai_training': 'Custom AI Training',
    'sso_integration': 'SSO Integration',
    'api_access': 'API Access',
    'compliance_features': 'Compliance Features',
    'voice_combinations_unlimited': 'Unlimited Voice Combinations',
    'advanced_voice_selection': 'Advanced Voice Selection',
    'extended_analytics': 'Extended Analytics',
    'team_analytics': 'Team Analytics',
    'unlimited_daily_generations': 'Unlimited Daily Generations',
  };

  const handleUpgrade = () => {
    window.location.href = `/subscribe?plan=${requiredTier}&feature=${encodeURIComponent(feature)}`;
  };

  return (
    <Card className={`border-dashed border-2 border-gray-300 ${className}`}>
      <CardHeader className="text-center pb-4">
        <div className="flex items-center justify-center gap-2 mb-2">
          {icon}
          <Badge variant="secondary" className="capitalize">
            {requiredTier} Feature
          </Badge>
        </div>
        <CardTitle className="text-lg">
          Unlock {featureDisplayNames[feature]}
        </CardTitle>
        <CardDescription>
          This feature requires a {requiredTier} subscription ({pricing}/month)
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button 
          onClick={handleUpgrade}
          className="w-full"
          variant="default"
        >
          Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
        </Button>
      </CardContent>
    </Card>
  );
};

/**
 * Feature gate component that conditionally renders content based on subscription tier
 */
export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  feature, 
  children, 
  fallback, 
  showUpgrade = true,
  className = ""
}) => {
  const { user } = useAuth();
  const { planTier } = usePlanGuard();
  
  // Use planTier from usePlanGuard or fallback to user subscription
  const userTier = planTier !== 'none' && planTier !== 'error' 
    ? planTier 
    : user?.subscriptionTier || 'free';
  
  const hasAccess = hasFeatureAccess(userTier, feature);
  
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showUpgrade) {
      return <UpgradePrompt feature={feature} className={className} />;
    }
    
    return null;
  }
  
  return <>{children}</>;
};

/**
 * Hook for checking feature access in components
 */
export const useFeatureAccess = (feature: FeatureName) => {
  const { user } = useAuth();
  const { planTier } = usePlanGuard();
  
  const userTier = planTier !== 'none' && planTier !== 'error' 
    ? planTier 
    : user?.subscriptionTier || 'free';
  
  const hasAccess = hasFeatureAccess(userTier, feature);
  const requiredTier = getMinimumTier(feature);
  const upgradeUrl = `/subscribe?plan=${requiredTier}&feature=${encodeURIComponent(feature)}`;
  
  return {
    hasAccess,
    requiredTier,
    upgradeUrl,
    currentTier: userTier
  };
};

/**
 * Inline feature lock component for buttons and UI elements
 */
export const FeatureLock: React.FC<{
  feature: FeatureName;
  children: React.ReactNode;
  disabled?: boolean;
}> = ({ feature, children, disabled = false }) => {
  const { hasAccess, upgradeUrl } = useFeatureAccess(feature);
  
  if (!hasAccess) {
    return (
      <div className="relative">
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.location.href = upgradeUrl}
            className="shadow-lg"
          >
            <Lock className="w-3 h-3 mr-1" />
            Upgrade
          </Button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
};

export default FeatureGate;