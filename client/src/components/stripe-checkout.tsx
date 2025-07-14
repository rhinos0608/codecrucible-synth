import { useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Initialize Stripe following AI_INSTRUCTIONS.md security patterns
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required environment variable: VITE_STRIPE_PUBLIC_KEY');
}

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface StripeCheckoutProps {
  tier: "pro" | "team";
  price: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function CheckoutForm({ tier, price, onSuccess, onCancel }: StripeCheckoutProps) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();

  const handleSubmit = async (event: any) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    // Input validation following AI_INSTRUCTIONS.md patterns
    if (!['pro', 'team'].includes(tier)) {
      toast({
        title: "Invalid Tier",
        description: "Please select a valid subscription tier.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/subscription/success`,
        },
      });

      if (error) {
        // Handle payment error
        console.error('Payment error:', error);
        toast({
          title: "Payment Failed",
          description: error.message || "Payment could not be processed.",
          variant: "destructive",
        });
        if (onCancel) onCancel();
      } else {
        // Payment successful
        toast({
          title: "Payment Successful",
          description: `Welcome to Arkane Technologies ${tier.charAt(0).toUpperCase() + tier.slice(1)}!`,
        });
        if (onSuccess) onSuccess();
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      toast({
        title: "Payment Error",
        description: "An unexpected error occurred during payment processing.",
        variant: "destructive",
      });
      if (onCancel) onCancel();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">
          Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </CardTitle>
        <CardDescription>
          ${(price / 100).toFixed(2)}/month - Secure payment powered by Stripe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement />
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={!stripe}
              className="flex-1"
            >
              {!stripe ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                `Subscribe for $${(price / 100).toFixed(2)}/month`
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function StripeCheckout({ tier, price, onSuccess, onCancel }: StripeCheckoutProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm
        tier={tier}
        price={price}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}