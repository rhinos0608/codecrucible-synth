// Multi-Agent Synthesis Panel - Inspired by CrewAI, AutoGen, LangGraph research
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { useState, useCallback } from 'react';
import { Brain, Zap, Users, ArrowRight, Gauge, Target, Sparkles, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useConsciousnessSynthesis } from '@/hooks/use-consciousness-synthesis';
import type { Solution } from '@shared/schema';

interface MultiAgentSynthesisPanelProps {
  solutions: Solution[];
  isVisible: boolean;
  onClose: () => void;
  onSynthesisComplete: (result: any) => void;
}

export function MultiAgentSynthesisPanel({
  solutions,
  isVisible,
  onClose,
  onSynthesisComplete
}: MultiAgentSynthesisPanelProps) {
  const [selectedMode, setSelectedMode] = useState<'consensus' | 'competitive' | 'collaborative' | 'unanimous'>('consensus');
  const [targetConsciousness, setTargetConsciousness] = useState(7);
  const [selectedApproach, setSelectedApproach] = useState<'standard' | 'streaming' | 'competitive' | 'workflow' | 'workspace'>('standard');

  const {
    synthesize,
    streamingSynthesis,
    competitiveSynthesis,
    workflowSynthesis,
    workspaceSynthesis,
    isLoading,
    isStreaming,
    streamingProgress,
    consciousnessMetrics,
    evolutionMetrics,
    cancelSynthesis
  } = useConsciousnessSynthesis();

  const handleSynthesis = useCallback(async () => {
    if (solutions.length < 2) return;

    const options = {
      mode: selectedMode,
      targetConsciousness,
      ethicalConstraints: ['security', 'accessibility', 'maintainability'],
      architecturalPatterns: ['modular', 'testable', 'scalable']
    };

    try {
      let result;
      
      switch (selectedApproach) {
        case 'streaming':
          result = await streamingSynthesis(solutions, options);
          break;
        case 'competitive':
          result = await competitiveSynthesis(solutions);
          break;
        case 'workflow':
          result = await workflowSynthesis(solutions);
          break;
        case 'workspace':
          result = await workspaceSynthesis(solutions);
          break;
        default:
          result = await synthesize({ solutions, options });
      }

      if (result) {
        onSynthesisComplete(result);
      }
    } catch (error) {
      console.error('Synthesis failed:', error);
    }
  }, [solutions, selectedMode, targetConsciousness, selectedApproach, synthesize, streamingSynthesis, competitiveSynthesis, workflowSynthesis, workspaceSynthesis, onSynthesisComplete]);

  if (!isVisible || solutions.length < 2) return null;

  const getApproachDescription = () => {
    switch (selectedApproach) {
      case 'streaming':
        return 'AutoGen-style conversational synthesis with real-time progress updates';
      case 'competitive':
        return 'CrewAI-inspired competitive agent approach for optimal solutions';
      case 'workflow':
        return 'LangGraph workflow orchestration with state management';
      case 'workspace':
        return 'GitHub Copilot Workspace context-aware collaboration';
      default:
        return 'Standard consciousness synthesis with voice integration';
    }
  };

  const getApproachIcon = () => {
    switch (selectedApproach) {
      case 'streaming':
        return <Zap className="w-4 h-4" />;
      case 'competitive':
        return <Target className="w-4 h-4" />;
      case 'workflow':
        return <GitBranch className="w-4 h-4" />;
      case 'workspace':
        return <Users className="w-4 h-4" />;
      default:
        return <Brain className="w-4 h-4" />;
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader className="border-b border-purple-500/10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Multi-Agent Synthesis</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                Synthesize {solutions.length} solutions using AI framework patterns
              </p>
            </div>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        <Tabs defaultValue="configuration" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configuration">Configuration</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="metrics">Metrics</TabsTrigger>
          </TabsList>

          <TabsContent value="configuration" className="space-y-6">
            {/* Synthesis Approach Selection */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Synthesis Approach</label>
              <Select value={selectedApproach} onValueChange={setSelectedApproach}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Standard Consciousness
                    </div>
                  </SelectItem>
                  <SelectItem value="streaming">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      AutoGen Streaming
                    </div>
                  </SelectItem>
                  <SelectItem value="competitive">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      CrewAI Competitive
                    </div>
                  </SelectItem>
                  <SelectItem value="workflow">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      LangGraph Workflow
                    </div>
                  </SelectItem>
                  <SelectItem value="workspace">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Copilot Workspace
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">{getApproachDescription()}</p>
            </div>

            {/* Synthesis Mode */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Synthesis Mode</label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="consensus">Consensus Building</SelectItem>
                  <SelectItem value="competitive">Competitive Selection</SelectItem>
                  <SelectItem value="collaborative">Collaborative Integration</SelectItem>
                  <SelectItem value="unanimous">Unanimous Agreement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Consciousness Level */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Target Consciousness Level: {targetConsciousness}
              </label>
              <Slider
                value={[targetConsciousness]}
                onValueChange={(value) => setTargetConsciousness(value[0])}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Basic (1)</span>
                <span>Transcendent (10)</span>
              </div>
            </div>

            {/* Solution Preview */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Solutions to Synthesize</label>
              <div className="grid gap-2">
                {solutions.map((solution, index) => (
                  <div key={solution.id} className="flex items-center gap-3 p-3 rounded-lg border bg-white/50 dark:bg-gray-800/50">
                    <Badge variant="secondary" className="text-xs">
                      {solution.voiceCombination}
                    </Badge>
                    <div className="flex-1 text-sm text-gray-600 dark:text-gray-400">
                      {solution.explanation?.substring(0, 80)}...
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {Math.round(solution.confidence * 100)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            {isStreaming && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Real-time Synthesis Progress</h4>
                  <Button variant="outline" size="sm" onClick={cancelSynthesis}>
                    Cancel
                  </Button>
                </div>
                <Progress value={streamingProgress} className="w-full" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {streamingProgress < 25 && "Analyzing voice perspectives..."}
                  {streamingProgress >= 25 && streamingProgress < 50 && "Conducting council session..."}
                  {streamingProgress >= 50 && streamingProgress < 75 && "Resolving conflicts..."}
                  {streamingProgress >= 75 && streamingProgress < 95 && "Integrating solutions..."}
                  {streamingProgress >= 95 && "Evolving consciousness..."}
                </p>
              </div>
            )}

            {consciousnessMetrics && (
              <div className="space-y-4">
                <h4 className="font-medium">Current Consciousness State</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Level</span>
                      <span>{consciousnessMetrics.level.toFixed(1)}/10</span>
                    </div>
                    <Progress value={consciousnessMetrics.level * 10} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>QWAN Score</span>
                      <span>{consciousnessMetrics.qwanScore}/10</span>
                    </div>
                    <Progress value={consciousnessMetrics.qwanScore * 10} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Voice Coherence</span>
                      <span>{consciousnessMetrics.voiceCoherence}/10</span>
                    </div>
                    <Progress value={consciousnessMetrics.voiceCoherence * 10} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Ethical Alignment</span>
                      <span>{consciousnessMetrics.ethicalAlignment.toFixed(1)}/10</span>
                    </div>
                    <Progress value={consciousnessMetrics.ethicalAlignment * 10} />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="metrics" className="space-y-6">
            {evolutionMetrics && (
              <div className="space-y-4">
                <h4 className="font-medium">Consciousness Evolution</h4>
                <div className="grid grid-cols-3 gap-4">
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-purple-600">
                      {evolutionMetrics.averageLevel.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Average Level</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {evolutionMetrics.totalSyntheses}
                    </div>
                    <div className="text-sm text-gray-600">Total Syntheses</div>
                  </Card>
                  <Card className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      +{evolutionMetrics.evolutionTrend.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-600">Evolution Trend</div>
                  </Card>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Synthesis Action Button */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {getApproachIcon()}
            <span>{getApproachDescription()}</span>
          </div>
          <Button
            onClick={handleSynthesis}
            disabled={isLoading || isStreaming || solutions.length < 2}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {isLoading || isStreaming ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Synthesizing...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Begin Synthesis
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}