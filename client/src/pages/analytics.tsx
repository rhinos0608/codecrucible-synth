import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Brain, Clock, Star, TrendingUp, Users } from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AnalyticsDashboard {
  voiceStats: Array<{
    id: number;
    userId: string;
    voiceType: "perspective" | "role";
    voiceName: string;
    usageCount: number;
    successCount: number;
    avgRating: number | null;
    lastUsed: string;
  }>;
  dailyMetrics: Array<{
    id: number;
    userId: string;
    date: string;
    generationCount: number;
    synthesisCount: number;
    totalGenerationTime: number;
    avgRating: number | null;
  }>;
  recentEvents: Array<{
    id: number;
    userId: string;
    eventType: string;
    eventData: any;
    sessionId: number | null;
    voiceCombination: string[] | null;
    createdAt: string;
  }>;
  summary: {
    totalGenerations: number;
    totalSyntheses: number;
    avgGenerationTime: number;
    mostUsedVoice: string;
    successRate: number;
  };
}

export default function Analytics() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);
  
  const { data: analytics, isLoading } = useQuery<AnalyticsDashboard>({
    queryKey: ["/api/analytics/dashboard"],
    enabled: isAuthenticated
  });
  
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
      </div>
    );
  }
  
  if (!analytics) {
    return (
      <div className="container mx-auto p-8">
        <p className="text-gray-500 dark:text-gray-400">No analytics data available yet.</p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your coding patterns and voice engine usage
        </p>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Generations</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalGenerations}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Code solutions created</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Syntheses</CardTitle>
            <Brain className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.summary.totalSyntheses}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Solutions merged</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Generation Time</CardTitle>
            <Clock className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics.summary.avgGenerationTime / 1000).toFixed(1)}s
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Per generation</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used Engine</CardTitle>
            <Users className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold truncate">{analytics.summary.mostUsedVoice}</div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Favorite voice</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(analytics.summary.successRate * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Generation success</p>
          </CardContent>
        </Card>
      </div>
      
      {/* Voice Usage Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Voice Engine Usage</CardTitle>
          <CardDescription>
            Track which code engines you use most frequently
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.voiceStats.slice(0, 10).map((stat) => {
              const successRate = stat.usageCount > 0 
                ? (stat.successCount / stat.usageCount) * 100 
                : 0;
              
              return (
                <div key={stat.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stat.voiceName}</span>
                      <Badge variant="outline" className="text-xs">
                        {stat.voiceType === "perspective" ? "Analysis" : "Specialization"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500">{stat.usageCount} uses</span>
                      {stat.avgRating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span>{stat.avgRating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Progress value={successRate} className="h-2" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Daily Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Activity</CardTitle>
          <CardDescription>
            Your code generation activity over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {analytics.dailyMetrics.slice(-7).reverse().map((metric) => (
              <div key={metric.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                <span className="text-sm font-medium">
                  {format(new Date(metric.date), "EEEE, MMM d")}
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-purple-600">{metric.generationCount} generations</span>
                  <span className="text-blue-600">{metric.synthesisCount} syntheses</span>
                  {metric.avgRating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      <span>{metric.avgRating.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>
            Your latest interactions with the code engines
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analytics.recentEvents.slice(0, 10).map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="capitalize">
                    {event.eventType.replace(/_/g, " ")}
                  </Badge>
                  {event.voiceCombination && (
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {event.voiceCombination.length} voices used
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">
                  {format(new Date(event.createdAt), "MMM d, h:mm a")}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}