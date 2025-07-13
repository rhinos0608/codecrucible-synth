import { useEffect, useState } from "react";
import { useLocation, useRouter } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Sparkles, ArrowRight, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export default function SubscriptionSuccess() {
  const [location] = useLocation();
  const [, navigate] = useRouter();
  const { user, refetch } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);

  // Extract tier from URL parameters
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const tier = urlParams.get('tier') || 'pro';

  useEffect(() => {
    // Refetch user data to get updated subscription status
    const refreshUserData = async () => {
      try {
        await refetch();
        setIsLoading(false);
        
        // Show success toast
        toast({
          title: "🎉 Subscription Activated!",
          description: `Welcome to CodeCrucible ${tier.charAt(0).toUpperCase() + tier.slice(1)}! Your features are now active.`,
          duration: 5000,
        });
      } catch (error) {
        console.error('Error refreshing user data:', error);
        setIsLoading(false);
      }
    };

    // Wait a moment for webhook processing, then refresh
    const timer = setTimeout(refreshUserData, 2000);
    return () => clearTimeout(timer);
  }, [tier, refetch, toast]);

  const handleContinue = () => {
    // Clean up URL and navigate to dashboard
    navigate('/dashboard');
  };

  const getPlanFeatures = (planTier: string) => {
    const features = {
      pro: [
        'Unlimited code generations',
        'Advanced synthesis engine',
        'Analytics dashboard',
        'Smart voice recommendations',
        'Custom voice profiles',
        'Project folders',
        'Real-time code streaming'
      ],
      team: [
        'Everything in Pro',
        'Team collaboration',
        'Shared voice profiles',
        'Advanced analytics',
        'Team management',
        'Priority support'
      ],
      enterprise: [
        'Everything in Team',
        'Custom AI training',
        'On-premise deployment',
        'SSO integration',
        'Dedicated support',
        'Custom integrations'
      ]
    };
    return features[planTier as keyof typeof features] || features.pro;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="mx-auto mb-4"
              >
                <Sparkles className="h-8 w-8 text-blue-500" />
              </motion.div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Activating Your Subscription...
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Please wait while we set up your CodeCrucible features.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="shadow-xl border-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="mx-auto mb-4"
            >
              <div className="relative">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <Crown className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1" />
              </div>
            </motion.div>
            
            <CardTitle className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Welcome to CodeCrucible {tier.charAt(0).toUpperCase() + tier.slice(1)}!
            </CardTitle>
            
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Your subscription has been successfully activated. Start exploring your new features now!
            </p>
            
            <Badge variant="secondary" className="mt-4 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              <Sparkles className="h-3 w-3 mr-1" />
              Payment Successful
            </Badge>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                Your New Features
              </h3>
              <div className="grid gap-2">
                {getPlanFeatures(tier).map((feature, index) => (
                  <motion.div
                    key={feature}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="text-center space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Ready to start creating amazing code with AI voices?
              </p>
              
              <Button 
                onClick={handleContinue}
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
              >
                Start Building
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>

            <div className="text-center text-sm text-gray-500 dark:text-gray-400">
              <p>
                Questions? Contact us at{" "}
                <a href="mailto:support@arkane-technologies.com" className="text-blue-600 hover:underline">
                  support@arkane-technologies.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}