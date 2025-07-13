import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Check, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAuthContext } from "@/components/auth/AuthProvider";

export default function SubscriptionSuccess() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading } = useAuthContext();
  
  // Extract tier from URL parameters - Enhanced error handling following AI_INSTRUCTIONS.md
  let tier = 'pro';
  let tierDisplay = 'Pro';
  
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tierParam = urlParams.get('tier');
    if (tierParam && ['pro', 'team', 'enterprise'].includes(tierParam.toLowerCase())) {
      tier = tierParam.toLowerCase();
      tierDisplay = tier.charAt(0).toUpperCase() + tier.slice(1);
    }
  } catch (error) {
    console.error('Error parsing URL parameters:', error);
    // Use defaults if URL parsing fails
  }

  useEffect(() => {
    // Only show toast when not loading to avoid premature display
    if (!isLoading) {
      toast({
        title: "Subscription Activated",
        description: `Your Arkane Technologies ${tierDisplay} subscription has been successfully activated! Welcome to unlimited AI generation.`,
      });
    }
  }, [toast, tierDisplay, isLoading]);

  const handleContinue = () => {
    setLocation("/");
  };

  // Show loading state while authentication is being verified
  // This prevents 404 redirects during the brief auth verification period
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-muted-foreground">Processing your subscription...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-600 dark:text-green-400">
            Subscription Activated!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your Arkane Technologies {tierDisplay} subscription has been successfully activated. You now have access to unlimited AI code generation and premium features.
          </p>
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Your {tierDisplay} Features:</h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Unlimited AI code generations</li>
              <li>• Multiple voice combinations</li>
              <li>• Advanced synthesis engine</li>
              <li>• Analytics dashboard</li>
              {tier === 'team' && <li>• Team collaboration features</li>}
              {tier === 'enterprise' && <li>• Custom AI training & SSO</li>}
            </ul>
          </div>
          <Button onClick={handleContinue} className="w-full">
            Continue to Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}