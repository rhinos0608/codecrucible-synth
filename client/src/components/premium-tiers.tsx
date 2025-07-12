import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Rocket } from "lucide-react";

interface PremiumTiersProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PremiumTiers({ isOpen, onClose }: PremiumTiersProps) {
  const tiers = [
    {
      name: "Pro",
      icon: <Zap className="w-6 h-6" />,
      price: "$19",
      period: "/month",
      description: "Perfect for individual developers",
      features: [
        "Unlimited AI generations",
        "All voice combinations",
        "Advanced synthesis",
        "Priority support",
        "Export to GitHub",
        "Custom voice profiles"
      ],
      color: "from-blue-600 to-cyan-600",
      popular: false
    },
    {
      name: "Team",
      icon: <Crown className="w-6 h-6" />,
      price: "$49",
      period: "/month",
      description: "Ideal for development teams",
      features: [
        "Everything in Pro",
        "Team collaboration",
        "Shared voice profiles",
        "Project templates",
        "Team analytics",
        "Code review workflows",
        "Advanced permissions"
      ],
      color: "from-purple-600 to-pink-600",
      popular: true
    },
    {
      name: "Enterprise",
      icon: <Rocket className="w-6 h-6" />,
      price: "$99",
      period: "/month",
      description: "For large organizations",
      features: [
        "Everything in Team",
        "Custom AI training",
        "On-premise deployment",
        "SSO integration",
        "Dedicated support",
        "Custom integrations",
        "SLA guarantees",
        "Compliance features"
      ],
      color: "from-emerald-600 to-green-600",
      popular: false
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-gray-100">
            Choose Your Premium Plan
          </DialogTitle>
          <p className="text-gray-400 text-center mt-2">
            Unlock the full potential of CodeCrucible with advanced features and unlimited access
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {tiers.map((tier, index) => (
            <Card 
              key={tier.name} 
              className={`relative border-2 ${
                tier.popular 
                  ? 'border-purple-500 bg-gradient-to-b from-purple-900/20 to-pink-900/20' 
                  : 'border-gray-600 bg-gray-800'
              } overflow-hidden`}
            >
              {tier.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-center py-2 text-sm font-medium">
                  Most Popular
                </div>
              )}
              
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="text-center space-y-3">
                  <div className={`inline-flex p-3 rounded-full bg-gradient-to-r ${tier.color} text-white`}>
                    {tier.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-100">{tier.name}</h3>
                  <p className="text-sm text-gray-400">{tier.description}</p>
                </div>

                {/* Pricing */}
                <div className="text-center">
                  <div className="flex items-baseline justify-center">
                    <span className="text-4xl font-bold text-gray-100">{tier.price}</span>
                    <span className="text-gray-400 ml-1">{tier.period}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-3">
                  {tier.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-center space-x-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <Button 
                  className={`w-full bg-gradient-to-r ${tier.color} hover:opacity-90 text-white font-medium py-3`}
                  onClick={() => {
                    // Handle subscription logic here
                    console.log(`Selected ${tier.name} plan`);
                    onClose();
                  }}
                >
                  Get Started with {tier.name}
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Additional Info */}
        <div className="mt-8 text-center space-y-4">
          <div className="flex justify-center space-x-8 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>30-day money-back guarantee</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-400" />
              <span>Instant activation</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 max-w-2xl mx-auto">
            All plans include access to our AI_INSTRUCTIONS.md security framework, 
            ensuring enterprise-grade security and compliance for your code generation workflow.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}