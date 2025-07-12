import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Check, Crown, Users, Sparkles, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useState } from "react";
import StripeCheckout from "@/components/stripe-checkout";

interface SubscriptionTier {
  name: string;
  price: number;
  dailyGenerationLimit: number;
  features: string[];
  maxVoiceCombinations: number;
  allowsAnalytics: boolean;
  allowsTeams: boolean;
}

export default function Pricing() {
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedTier, setSelectedTier] = useState<{ name: string; price: number } | null>(null);
  
  const { data: tiers = [], isLoading: tiersLoading } = useQuery<SubscriptionTier[]>({
    queryKey: ["/api/subscription/tiers"],
  });

  const { data: subscriptionInfo } = useQuery({
    queryKey: ["/api/subscription/info"],
    enabled: isAuthenticated,
  });

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { tier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    },
  });

  const handleUpgrade = (tier: SubscriptionTier) => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to upgrade your subscription.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

    if (tier.name === "free") {
      toast({
        title: "Already Free",
        description: "You're already on the free tier.",
      });
      return;
    }

    // Use direct Stripe checkout redirect
    checkoutMutation.mutate(tier.name);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    setSelectedTier(null);
    toast({
      title: "Subscription Activated",
      description: "Your subscription has been successfully activated!",
    });
    // Redirect to dashboard or refresh page
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  };

  const handleCheckoutCancel = () => {
    setShowCheckout(false);
    setSelectedTier(null);
  };

  const currentTier = subscriptionInfo?.tier?.name || "free";

  const getTierIcon = (tierName: string) => {
    switch (tierName) {
      case "free":
        return <Sparkles className="h-6 w-6" />;
      case "pro":
        return <Crown className="h-6 w-6" />;
      case "team":
        return <Users className="h-6 w-6" />;
      case "enterprise":
        return <Crown className="h-6 w-6 text-purple-500" />;
      default:
        return <Sparkles className="h-6 w-6" />;
    }
  };

  const getTierColor = (tierName: string) => {
    switch (tierName) {
      case "free":
        return "border-gray-300";
      case "pro":
        return "border-purple-500";
      case "team":
        return "border-blue-500 ring-2 ring-blue-200";
      case "enterprise":
        return "border-purple-700";
      default:
        return "";
    }
  };

  const formatPrice = (price: number) => {
    if (price === 0) return "Free";
    return `$${(price / 100).toFixed(0)}/month`;
  };

  if (tiersLoading) {
    return (
      <div className="container max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-4 py-8">
      {/* Following AI_INSTRUCTIONS.md: Back navigation */}
      <div className="mb-6">
        <Button variant="ghost" onClick={() => window.history.back()} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground">
          Following CodingPhilosophy.md: Evolve from single-voice to council-based development
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-8">
        {tiers.map((tier) => (
          <Card 
            key={tier.name} 
            className={`relative ${getTierColor(tier.name)} ${
              currentTier === tier.name ? "ring-2 ring-primary" : ""
            }`}
          >
            {currentTier === tier.name && (
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                Current Plan
              </Badge>
            )}
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                {getTierIcon(tier.name)}
              </div>
              <CardTitle className="text-2xl capitalize">{tier.name}</CardTitle>
              <CardDescription className="text-3xl font-bold mt-2">
                {formatPrice(tier.price)}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Daily Generations</p>
                <p className="text-2xl font-semibold">
                  {tier.dailyGenerationLimit === -1 ? "Unlimited" : tier.dailyGenerationLimit}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Features</p>
                <ul className="space-y-2">
                  {tier.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              {!isAuthenticated ? (
                <Button 
                  className="w-full" 
                  onClick={() => window.location.href = "/api/login"}
                >
                  Sign In to Subscribe
                </Button>
              ) : currentTier === tier.name ? (
                <Button className="w-full" disabled variant="secondary">
                  Current Plan
                </Button>
              ) : tier.name === "free" ? (
                <Button className="w-full" variant="secondary" disabled>
                  {currentTier !== "free" ? "Downgrade" : "Current Plan"}
                </Button>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={() => checkoutMutation.mutate(tier.name)}
                  disabled={checkoutMutation.isPending}
                >
                  {checkoutMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    `Upgrade to ${tier.name.charAt(0).toUpperCase() + tier.name.slice(1)}`
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-1">Can I cancel my subscription anytime?</h3>
            <p className="text-sm text-muted-foreground">
              Yes, you can cancel your subscription at any time. You'll continue to have access 
              to your plan features until the end of your billing period.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">What happens when I reach my daily limit?</h3>
            <p className="text-sm text-muted-foreground">
              Free users will see an upgrade prompt when they reach their daily limit. 
              The limit resets every 24 hours at midnight UTC.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-1">Can I switch between plans?</h3>
            <p className="text-sm text-muted-foreground">
              Yes, you can upgrade your plan at any time. Downgrades take effect at the 
              end of your current billing period.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}