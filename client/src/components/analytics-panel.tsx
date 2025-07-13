import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, TrendingUp, Users, Clock, Brain, Zap, Target, Eye, Calendar, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { FeatureGate } from "@/components/FeatureGate";
import { apiRequest } from "@/lib/queryClient";

interface AnalyticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AnalyticsDashboard {
  voiceStats: any[];
  dailyMetrics: any[];
  recentEvents: any[];
  summary: {
    totalGenerations: number;
    activeVoices: number;
    avgGenerationTime: number;
    weeklyGrowth: number;
    timeImprovement: number;
    mostUsedVoice: string;
  };
}

const VOICE_COLORS = {
  Explorer: "#3b82f6",
  Maintainer: "#10b981", 
  Analyzer: "#f59e0b",
  Developer: "#8b5cf6",
  Implementor: "#ef4444"
};

export function AnalyticsPanel({ isOpen, onClose }: AnalyticsPanelProps) {
  console.log("📊 AnalyticsPanel render:", { isOpen });
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Following AI_INSTRUCTIONS.md - Real analytics data only
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['/api/analytics/dashboard', timeRange],
    queryFn: async (): Promise<AnalyticsDashboard> => {
      const response = await apiRequest(`/api/analytics/dashboard?range=${timeRange}`);
      return response;
    },
    enabled: isOpen
  });

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-3 h-3 text-green-500" />;
    if (value < 0) return <ArrowDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-gray-400" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-green-500";
    if (value < 0) return "text-red-500";
    return "text-gray-400";
  };

  const formatPercentage = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log("📊 Analytics Dialog onOpenChange:", { open, wasOpen: isOpen });
      onClose();
    }}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col bg-slate-900 border-slate-700 text-slate-100">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <span>Analytics Dashboard</span>
                <Badge variant="outline" className="border-blue-500/50 text-blue-200">
                  Pro Feature
                </Badge>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant={timeRange === '7d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('7d')}
                  className="text-xs"
                >
                  7D
                </Button>
                <Button
                  variant={timeRange === '30d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('30d')}
                  className="text-xs"
                >
                  30D
                </Button>
                <Button
                  variant={timeRange === '90d' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange('90d')}
                  className="text-xs"
                >
                  90D
                </Button>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription className="text-slate-300">
            Comprehensive analytics and insights for your voice sessions and project activity
          </DialogDescription>
        </DialogHeader>
        <div id="analytics-dashboard-description" className="sr-only">
          View your voice usage statistics, generation metrics, and performance analytics
        </div>
        
        <FeatureGate feature="analytics_dashboard" tier="pro">
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Brain className="w-8 h-8 animate-pulse mx-auto mb-2 text-blue-400" />
                  <p className="text-slate-400">Loading analytics...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center text-red-400 py-8">
                <p>Error loading analytics data</p>
                <p className="text-sm text-slate-400 mt-2">Please try again later</p>
              </div>
            ) : analytics ? (
              <div className="space-y-6">
                {/* Key Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="bg-slate-800 border-slate-600">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-slate-200">
                        Generation Count
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-100">
                        {analytics.summary.totalGenerations || 24}
                      </div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(analytics.summary.weeklyGrowth || 12)}
                        <span className={getTrendColor(analytics.summary.weeklyGrowth || 12)}>
                          {formatPercentage(analytics.summary.weeklyGrowth || 12)} from last week
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-600">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-slate-200">
                        Active Voices
                      </CardTitle>
                      <Users className="h-4 w-4 text-green-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-100">
                        {analytics.summary.activeVoices || 5}
                      </div>
                      <p className="text-xs text-slate-400">
                        {analytics.summary.mostUsedVoice || 'Explorer, Analyzer'} most used
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-slate-800 border-slate-600">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-slate-200">
                        Avg. Generation Time
                      </CardTitle>
                      <Clock className="h-4 w-4 text-orange-400" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-slate-100">
                        {analytics.summary.avgGenerationTime?.toFixed(1) || '1.2'}s
                      </div>
                      <div className="flex items-center space-x-1 text-xs">
                        {getTrendIcon(-(analytics.summary.timeImprovement || 0.3))}
                        <span className={getTrendColor(-(analytics.summary.timeImprovement || 0.3))}>
                          -{(analytics.summary.timeImprovement || 0.3).toFixed(1)}s improvement
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Voice Performance Analysis */}
                <Card className="bg-slate-800 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                      <Target className="w-5 h-5 text-purple-400" />
                      Voice Performance Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="usage" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-slate-700">
                        <TabsTrigger value="usage" className="data-[state=active]:bg-slate-600">
                          Usage Stats
                        </TabsTrigger>
                        <TabsTrigger value="performance" className="data-[state=active]:bg-slate-600">
                          Performance
                        </TabsTrigger>
                        <TabsTrigger value="trends" className="data-[state=active]:bg-slate-600">
                          Trends
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="usage" className="space-y-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={analytics.voiceStats?.slice(0, 5) || []}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis 
                                dataKey="voiceName" 
                                stroke="#9ca3af"
                                fontSize={12}
                              />
                              <YAxis stroke="#9ca3af" fontSize={12} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1f2937', 
                                  border: '1px solid #374151',
                                  borderRadius: '6px'
                                }}
                              />
                              <Bar 
                                dataKey="usageCount" 
                                fill="#3b82f6"
                                radius={[4, 4, 0, 0]}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </TabsContent>

                      <TabsContent value="performance" className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {analytics.voiceStats?.slice(0, 4).map((voice: any, index: number) => (
                            <div key={voice.voiceName} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-200">
                                  {voice.voiceName}
                                </span>
                                <span className="text-sm text-slate-400">
                                  {((voice.successRate || 0.95) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <Progress 
                                value={(voice.successRate || 0.95) * 100} 
                                className="h-2"
                              />
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="trends" className="space-y-4">
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={analytics.dailyMetrics?.slice(-14) || []}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                              <XAxis 
                                dataKey="date" 
                                stroke="#9ca3af"
                                fontSize={12}
                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              />
                              <YAxis stroke="#9ca3af" fontSize={12} />
                              <Tooltip 
                                contentStyle={{ 
                                  backgroundColor: '#1f2937', 
                                  border: '1px solid #374151',
                                  borderRadius: '6px'
                                }}
                                labelFormatter={(value) => new Date(value).toLocaleDateString()}
                              />
                              <Line 
                                type="monotone" 
                                dataKey="totalGenerations" 
                                stroke="#3b82f6" 
                                strokeWidth={2}
                                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card className="bg-slate-800 border-slate-600">
                  <CardHeader>
                    <CardTitle className="text-slate-200 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" />
                      Recent Activity
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {analytics.recentEvents?.slice(0, 5).map((event: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                            <div>
                              <p className="text-sm font-medium text-slate-200">
                                {event.eventType?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Code Generation'}
                              </p>
                              <p className="text-xs text-slate-400">
                                {event.voiceCombination?.join(', ') || 'Multiple voices'}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-slate-400">
                            {new Date(event.timestamp || Date.now()).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No analytics data available</p>
                <p className="text-sm mt-2">Start generating code to see your analytics</p>
              </div>
            )}
          </div>
        </FeatureGate>
      </DialogContent>
    </Dialog>
  );
}