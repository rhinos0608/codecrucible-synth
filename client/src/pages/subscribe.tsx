import { useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Crown, Users, BarChart } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

export default function Subscribe() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();

  // Extract plan from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const selectedPlan = urlParams.get('plan') || 'team';

  // Validate plan parameter following AI_INSTRUCTIONS.md patterns
  const validPlans = ['pro', 'team', 'enterprise'];
  const plan = validPlans.includes(selectedPlan) ? selectedPlan : 'team';

  const planDetails = {
    pro: {
      name: 'Pro',
      price: '$19',
      icon: <Crown className="w-8 h-8" />,
      features: ['Unlimited code generations', 'Advanced synthesis', 'Analytics dashboard']
    },
    team: {
      name: 'Team', 
      price: '$49',
      icon: <Users className="w-8 h-8" />,
      features: ['Everything in Pro', 'Team collaboration', 'Shared profiles']
    },
    enterprise: {
      name: 'Enterprise',
      price: '$99',
      icon: <BarChart className="w-8 h-8" />,
      features: ['Everything in Team', 'Custom AI training', 'On-premise deployment']
    }
  };

  const checkoutMutation = useMutation({
    mutationFn: async (tier: string) => {
      const response = await apiRequest("POST", "/api/subscription/checkout", { tier });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast({
          title: "Error",
          description: "Unable to create checkout session. Please try again.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Checkout Error",
        description: error.message || "Failed to start checkout process",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to subscribe to a plan.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 1500);
      return;
    }
  }, [isAuthenticated, toast]);

  const handleSubscribe = () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }

    // For enterprise, redirect to contact (since it's not in the checkout system yet)
    if (plan === 'enterprise') {
      toast({
        title: "Enterprise Plan",
        description: "Please contact our sales team for Enterprise pricing and setup.",
      });
      setLocation("/");
      return;
    }

    checkoutMutation.mutate(plan);
  };

  const currentPlan = planDetails[plan as keyof typeof planDetails];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-gray-700 bg-gray-800">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white">
              {currentPlan.icon}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-100">
            Subscribe to {currentPlan.name}
          </CardTitle>
          <div className="text-3xl font-bold text-blue-400 mt-2">
            {currentPlan.price}<span className="text-sm font-normal text-gray-400">/month</span>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-200">Included Features:</h3>
            <ul className="space-y-2">
              {currentPlan.features.map((feature, index) => (
                <li key={index} className="flex items-center space-x-2 text-gray-300">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <Button 
              onClick={handleSubscribe}
              disabled={checkoutMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3"
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Starting Checkout...
                </>
              ) : (
                `Subscribe to ${currentPlan.name}`
              )}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => setLocation("/")}
              className="w-full border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Back to Dashboard
            </Button>
          </div>

          <div className="text-center text-xs text-gray-400">
            Secure checkout powered by Stripe. Cancel anytime.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}