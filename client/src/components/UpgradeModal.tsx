import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Zap, Users, BarChart, Sparkles, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { usePlanGuard } from "@/hooks/usePlanGuard";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  trigger?: 'quota_exceeded' | 'synthesis_blocked' | 'analytics_blocked' | 'manual';
  currentQuota?: number;
  quotaLimit?: number;
}

export default function UpgradeModal({ 
  isOpen, 
  onClose, 
  trigger = 'manual',
  currentQuota = 0,
  quotaLimit = 3
}: UpgradeModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'team' | 'enterprise'>('team');
  const { planTier } = usePlanGuard();

  const getTriggerMessage = () => {
    switch (trigger) {
      case 'quota_exceeded':
        return `You've used ${currentQuota}/${quotaLimit} daily generations. Upgrade for unlimited access.`;
      case 'synthesis_blocked':
        return 'Code synthesis requires a Pro or Team subscription.';
      case 'analytics_blocked':
        return 'Analytics features require a Pro or Team subscription.';
      default:
        return 'Unlock the full power of CodeCrucible with Pro features.';
    }
  };

  const plans = [
    {
      id: 'pro' as const,
      name: 'Pro',
      price: '$19',
      period: '/month',
      description: 'Perfect for individual developers',
      icon: <Zap className="h-6 w-6" />,
      features: [
        'Unlimited code generations',
        'Advanced synthesis engine',
        'Analytics dashboard',
        'Priority voice recommendations',
        'Export generated code',
        'Advanced customization'
      ],
      highlighted: false
    },
    {
      id: 'team' as const,
      name: 'Team',
      price: '$49',
      period: '/month',
      description: 'For teams and organizations',
      icon: <Users className="h-6 w-6" />,
      features: [
        'Everything in Pro',
        'Team collaboration',
        'Shared voice profiles',
        'Advanced analytics',
        'Team management',
        'Priority support'
      ],
      highlighted: true
    },
    {
      id: 'enterprise' as const,
      name: 'Enterprise',
      price: '$99',
      period: '/month',
      description: 'For large organizations',
      icon: <BarChart className="h-6 w-6" />,
      features: [
        'Everything in Team',
        'Custom AI training',
        'On-premise deployment',
        'SSO integration',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantees',
        'Compliance features'
      ],
      highlighted: false
    }
  ];

  const upgradeMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { tier });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        // Redirect directly to Stripe checkout
        window.location.href = data.checkoutUrl;
      } else {
        console.error('No checkout URL received from server');
      }
    },
    onError: (error: any) => {
      console.error('Checkout error:', error);
      // Fallback to subscribe page if direct checkout fails
      window.location.href = `/subscribe?plan=${selectedPlan}`;
    },
  });

  const handleUpgrade = async (planType: 'pro' | 'team' | 'enterprise') => {
    try {
      // Use Stripe checkout for all plans
      upgradeMutation.mutate(planType);
    } catch (error) {
      console.error('Failed to initiate upgrade:', error);
      // Fallback to subscribe page only if Stripe fails
      window.location.href = `/subscribe?plan=${planType}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-yellow-500" />
            Upgrade Your CodeCrucible Experience
          </DialogTitle>
          <DialogDescription>
            {getTriggerMessage()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative cursor-pointer transition-all ${
                selectedPlan === plan.id 
                  ? 'ring-2 ring-blue-500 shadow-lg' 
                  : 'hover:shadow-md'
              } ${plan.highlighted ? 'border-blue-200' : ''}`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.highlighted && (
                <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-blue-500">
                  Most Popular
                </Badge>
              )}
              
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {plan.icon}
                    <CardTitle>{plan.name}</CardTitle>
                  </div>
                  <div className="text-right">
                    <span className="text-3xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Current Plan Status */}
        {planTier !== 'none' && planTier !== 'error' && (
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-muted-foreground">Current Plan:</span>
                <span className="ml-2 font-medium capitalize">{planTier}</span>
              </div>
              {planTier === 'free' && (
                <div className="text-sm text-muted-foreground">
                  {currentQuota}/{quotaLimit} generations used today
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mt-6 pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Maybe Later
          </Button>
          <Button 
            onClick={() => handleUpgrade(selectedPlan)}
            disabled={upgradeMutation.isPending}
            className="px-8"
          >
            {upgradeMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting Checkout...
              </>
            ) : (
              `Upgrade to ${plans.find(p => p.id === selectedPlan)?.name} - ${plans.find(p => p.id === selectedPlan)?.price}/month`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}