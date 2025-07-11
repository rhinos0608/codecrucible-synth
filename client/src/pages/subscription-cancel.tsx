import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { XCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";

export default function SubscriptionCancel() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const handleRetry = () => {
    setLocation("/pricing");
  };

  const handleContinue = () => {
    setLocation("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
            Subscription Cancelled
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Your subscription process was cancelled. No charges have been made to your account.
          </p>
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-semibold mb-2">Still interested in upgrading?</h3>
            <p className="text-sm text-muted-foreground">
              You can upgrade your subscription at any time from the pricing page. 
              All your preferences and settings will be preserved.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRetry} className="flex-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Pricing
            </Button>
            <Button onClick={handleContinue} className="flex-1">
              Continue to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}