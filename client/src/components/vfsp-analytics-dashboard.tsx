import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Zap, TrendingUp, TrendingDown, Eye, Calendar } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { FeatureGate } from '@/components/FeatureGate';
import { apiRequest } from '@/lib/queryClient';

// VFSP Analytics Interfaces - Following AI_INSTRUCTIONS.md patterns
interface VFSPAnalytics {
  volatilityIndex: number;
  forecastModel: ProductivityForecast;
  symbolicPatterns: SymbolicInsight[];
  evolutionTracking: VoiceEvolution[];
  insights: ActionableInsight[];
  recommendations: VoiceRecommendation[];
}

interface ProductivityForecast {
  nextWeekPrediction: number;
  nextMonthPrediction: number;
  confidenceLevel: number;
  trendDirection: 'increasing' | 'stable' | 'decreasing';
  seasonalPatterns: SeasonalPattern[];
}

interface SymbolicInsight {
  pattern: string;
  significance: number;
  frequency: number;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

interface VoiceEvolution {
  voiceCombination: string;
  effectivenessProgression: number[];
  usageProgression: number[];
  timepoints: string[];
  maturityLevel: 'emerging' | 'developing' | 'mature' | 'optimized';
}

interface ActionableInsight {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'productivity' | 'quality' | 'efficiency' | 'learning';
  actionRequired: string;
}

interface SeasonalPattern {
  period: string;
  intensity: number;
  description: string;
}

interface VoiceRecommendation {
  voices: string[];
  confidence: number;
  reasoning: string;
  expectedImprovement: number;
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export function VFSPAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Fetch REAL VFSP analytics data - NO mock data allowed
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['/api/analytics/vfsp', timeRange],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/analytics/vfsp?range=${timeRange}`);
      return response.json();
    }
  });

  const getVolatilityColor = (index: number) => {
    if (index < 30) return "text-green-600";
    if (index < 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getVolatilityDescription = (index: number) => {
    if (index < 30) return "Stable and consistent coding patterns";
    if (index < 60) return "Moderate variation in approach";
    return "High volatility - exploring diverse methodologies";
  };

  // Following AI_INSTRUCTIONS.md - Only use real analytics data
  if (!analytics) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Loading real analytics data...</p>
      </div>
    );
  }

  const data = analytics;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Brain className="w-8 h-8 animate-pulse mx-auto mb-2" />
          <p>Analyzing patterns...</p>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate feature="analytics_dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-500" />
              VFSP Analytics
            </h2>
            <p className="text-muted-foreground">
              Volatility, Forecast, Symbolic Patterning - Advanced coding intelligence
            </p>
          </div>
          <div className="flex gap-2">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <Badge
                key={range}
                variant={timeRange === range ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setTimeRange(range)}
              >
                {range}
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="patterns">Patterns</TabsTrigger>
            <TabsTrigger value="evolution">Evolution</TabsTrigger>
            <TabsTrigger value="forecast">Forecast</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Volatility Index */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Volatility Index
                </CardTitle>
                <CardDescription>
                  Measures consistency in your coding approach and methodology
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-3xl font-bold">
                    <span className={getVolatilityColor(data.volatilityIndex)}>
                      {data.volatilityIndex}
                    </span>
                    <span className="text-lg text-muted-foreground">/100</span>
                  </div>
                  <Badge variant={data.volatilityIndex < 30 ? "default" : data.volatilityIndex < 60 ? "secondary" : "destructive"}>
                    {data.volatilityIndex < 30 ? "Stable" : data.volatilityIndex < 60 ? "Moderate" : "High"}
                  </Badge>
                </div>
                <Progress value={data.volatilityIndex} className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  {getVolatilityDescription(data.volatilityIndex)}
                </p>
              </CardContent>
            </Card>

            {/* Productivity Forecast */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Next Week Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {data.forecastModel.nextWeekPrediction}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Predicted productivity increase
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Monthly Outlook
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {data.forecastModel.nextMonthPrediction}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Long-term productivity projection
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Actionable Insights</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.insights.map((insight) => (
                  <div key={insight.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {insight.title}
                          <Badge variant={insight.priority === 'high' ? 'destructive' : insight.priority === 'medium' ? 'default' : 'secondary'}>
                            {insight.priority}
                          </Badge>
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {insight.description}
                        </p>
                        <p className="text-sm font-medium mt-2 text-blue-600">
                          Action: {insight.actionRequired}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patterns" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-purple-500" />
                  Symbolic Patterns Analysis
                </CardTitle>
                <CardDescription>
                  Recurring voice combinations and their effectiveness patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.symbolicPatterns.map((pattern, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">{pattern.pattern}</h4>
                        <div className="flex gap-2">
                          <Badge variant={pattern.impact === 'high' ? 'default' : pattern.impact === 'medium' ? 'secondary' : 'outline'}>
                            {pattern.impact} impact
                          </Badge>
                          <Badge variant="outline">
                            {pattern.frequency} uses
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-muted-foreground">Significance:</span>
                        <Progress value={pattern.significance} className="flex-1 max-w-32" />
                        <span className="text-sm font-medium">{pattern.significance}%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {pattern.description}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Seasonal Patterns */}
            <Card>
              <CardHeader>
                <CardTitle>Seasonal Productivity Patterns</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.forecastModel.seasonalPatterns}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="intensity" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evolution" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Voice Combination Evolution</CardTitle>
                <CardDescription>
                  Track how your voice combinations mature and improve over time
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {data.evolutionTracking.map((evolution, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold">{evolution.voiceCombination}</h4>
                        <Badge variant={
                          evolution.maturityLevel === 'optimized' ? 'default' :
                          evolution.maturityLevel === 'mature' ? 'secondary' :
                          evolution.maturityLevel === 'developing' ? 'outline' : 'destructive'
                        }>
                          {evolution.maturityLevel}
                        </Badge>
                      </div>
                      
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={evolution.timepoints.map((point, idx) => ({
                          timepoint: point,
                          effectiveness: evolution.effectivenessProgression[idx],
                          usage: evolution.usageProgression[idx]
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="timepoint" />
                          <YAxis />
                          <Tooltip />
                          <Line type="monotone" dataKey="effectiveness" stroke="#8884d8" name="Effectiveness %" />
                          <Line type="monotone" dataKey="usage" stroke="#82ca9d" name="Usage Count" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            {/* AI Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  AI Voice Recommendations
                </CardTitle>
                <CardDescription>
                  Intelligent suggestions based on your patterns and goals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.recommendations.map((rec, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-2">
                          {rec.voices.map((voice, idx) => (
                            <Badge key={idx} variant="outline">
                              {voice}
                            </Badge>
                          ))}
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-green-600">
                            +{rec.expectedImprovement}%
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {rec.confidence}% confidence
                          </div>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {rec.reasoning}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Forecast Model Details */}
            <Card>
              <CardHeader>
                <CardTitle>Forecast Model Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Confidence Level</div>
                    <div className="text-2xl font-bold">{data.forecastModel.confidenceLevel}%</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Trend Direction</div>
                    <div className="flex items-center gap-1">
                      {data.forecastModel.trendDirection === 'increasing' ? (
                        <TrendingUp className="w-4 h-4 text-green-500" />
                      ) : data.forecastModel.trendDirection === 'decreasing' ? (
                        <TrendingDown className="w-4 h-4 text-red-500" />
                      ) : (
                        <div className="w-4 h-4 bg-gray-400 rounded-full" />
                      )}
                      <span className="capitalize">{data.forecastModel.trendDirection}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  );
}

export default VFSPAnalyticsDashboard;