import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Crown, Sparkles, Users, AlertCircle } from "lucide-react";

export function SubscriptionStatus() {
  const { data: subscriptionInfo, isLoading } = useQuery({
    queryKey: ["/api/subscription/info"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-2 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscriptionInfo) {
    return null;
  }

  const { tier, usage, teamInfo } = subscriptionInfo;
  const isUnlimited = usage.limit === -1;
  const usagePercent = isUnlimited ? 0 : (usage.used / usage.limit) * 100;
  const isNearLimit = !isUnlimited && usagePercent >= 80;

  const getTierIcon = () => {
    switch (tier.name) {
      case "pro":
        return <Crown className="h-5 w-5" />;
      case "team":
        return <Users className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getTierColor = () => {
    switch (tier.name) {
      case "pro":
        return "bg-purple-500 text-white";
      case "team":
        return "bg-blue-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle>Subscription Status</CardTitle>
            <Badge className={getTierColor()}>
              <span className="flex items-center gap-1">
                {getTierIcon()}
                {tier.name.toUpperCase()}
              </span>
            </Badge>
          </div>
          {tier.name === "free" && (
            <Link href="/pricing">
              <Button size="sm" variant="outline">
                Upgrade
              </Button>
            </Link>
          )}
        </div>
        <CardDescription>
          {teamInfo ? `Team: ${teamInfo.team.name}` : "Personal account"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Daily Usage</span>
            <span className="text-sm font-medium">
              {isUnlimited ? (
                "Unlimited"
              ) : (
                <>
                  {usage.used} / {usage.limit} generations
                </>
              )}
            </span>
          </div>
          {!isUnlimited && (
            <>
              <Progress value={usagePercent} className="h-2" />
              {isNearLimit && (
                <div className="flex items-center gap-1 mt-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Approaching daily limit</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pt-2 border-t">
          <h4 className="text-sm font-medium mb-2">Plan Features</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {tier.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {tier.name === "free" && (
          <div className="pt-2 border-t">
            <Link href="/pricing">
              <Button className="w-full" size="sm">
                <Crown className="h-4 w-4 mr-2" />
                Upgrade to Pro
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}