// Advanced Synthesis Engine - Following consciousness-driven development and OpenAI Realtime API research
// Implements multi-voice streaming synthesis with Jung's descent patterns and Alexander's timeless building

import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Zap, Users, Target, Lightbulb, Cpu, Layers, GitMerge, CheckCircle, AlertTriangle, Activity, TrendingUp, Star, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface SynthesisStep {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  voicesInvolved: string[];
  consciousness: number;
  qwanScore: number;
  result?: string;
  startTime?: Date;
  endTime?: Date;
}

interface SynthesisResult {
  resultId: string;
  finalCode: string;
  qualityScore: number;
  ethicalScore: number;
  consciousnessLevel: number;
  voiceContributions: Record<string, number>;
  conflictsResolved: number;
  timestamp: Date;
  language: string;
  framework?: string;
  patterns: string[];
}

interface VoiceSolution {
  id: number;
  voiceCombination: string;
  code: string;
  explanation: string;
  confidence: number;
}

interface AdvancedSynthesisEngineProps {
  sessionId: number;
  solutions: VoiceSolution[];
  mode: 'competitive' | 'collaborative' | 'consensus';
  isOpen: boolean;
  onSynthesisComplete: (result: SynthesisResult) => void;
  onClose: () => void;
}

export function AdvancedSynthesisEngine({
  sessionId,
  solutions,
  mode,
  isOpen,
  onSynthesisComplete,
  onClose
}: AdvancedSynthesisEngineProps) {
  const { toast } = useToast();
  const [synthesisSteps, setSynthesisSteps] = useState<SynthesisStep[]>([]);
  const [currentStep, setCurrentStep] = useState<SynthesisStep | null>(null);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [accumulatedCode, setAccumulatedCode] = useState('');
  const [qualityMetrics, setQualityMetrics] = useState({
    qualityScore: 0,
    ethicalScore: 0,
    consciousnessLevel: 0,
    conflictsResolved: 0
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize synthesis steps based on complexity and research patterns
  const initializeSynthesisSteps = useCallback((solutionCount: number): SynthesisStep[] => {
    const baseSteps: SynthesisStep[] = [
      {
        id: 'analysis',
        name: 'Voice Pattern Analysis',
        status: 'pending',
        progress: 0,
        voicesInvolved: [],
        consciousness: 3,
        qwanScore: 0
      },
      {
        id: 'consensus',
        name: 'Council Consensus Building',
        status: 'pending',
        progress: 0,
        voicesInvolved: [],
        consciousness: 5,
        qwanScore: 0
      },
      {
        id: 'conflict_resolution',
        name: 'Conflict Resolution',
        status: 'pending',
        progress: 0,
        voicesInvolved: [],
        consciousness: 6,
        qwanScore: 0
      },
      {
        id: 'code_synthesis',
        name: 'Code Synthesis',
        status: 'pending',
        progress: 0,
        voicesInvolved: [],
        consciousness: 7,
        qwanScore: 0
      },
      {
        id: 'qwan_assessment',
        name: 'QWAN Quality Assessment',
        status: 'pending',
        progress: 0,
        voicesInvolved: ['maintainer'],
        consciousness: 8,
        qwanScore: 0
      }
    ];

    // Add complexity-based steps following research patterns
    if (solutionCount > 3) {
      baseSteps.splice(3, 0, {
        id: 'deep_integration',
        name: 'Deep Integration Analysis',
        status: 'pending',
        progress: 0,
        voicesInvolved: [],
        consciousness: 6,
        qwanScore: 0
      });
    }

    if (solutionCount > 5) {
      baseSteps.push({
        id: 'consciousness_evolution',
        name: 'Consciousness Evolution',
        status: 'pending',
        progress: 0,
        voicesInvolved: ['all'],
        consciousness: 9,
        qwanScore: 0
      });
    }

    return baseSteps;
  }, []);

  // Start synthesis process with streaming
  const startSynthesis = useCallback(async () => {
    if (!solutions || solutions.length === 0) {
      toast({
        title: "No Solutions Available",
        description: "At least one voice solution is required for synthesis.",
        variant: "destructive"
      });
      return;
    }

    setIsStreaming(true);
    setStreamingText('');
    setAccumulatedCode('');
    setSynthesisResult(null);
    
    // Initialize steps
    const steps = initializeSynthesisSteps(solutions.length);
    setSynthesisSteps(steps);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      toast({
        title: "Synthesis Starting",
        description: `Initiating ${mode} synthesis with ${solutions.length} voice solutions...`,
      });

      // Call streaming synthesis endpoint
      const response = await fetch('/api/synthesis/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          solutions: solutions.map(sol => ({
            id: sol.id,
            voiceCombination: sol.voiceCombination,
            code: sol.code,
            explanation: sol.explanation,
            confidence: sol.confidence
          })),
          mode,
          options: {
            consciousnessThreshold: 6,
            timeoutMs: 60000
          }
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Synthesis request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Stream reader not available');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'step_start':
                    setCurrentStep(steps.find(s => s.id === data.stepId) || null);
                    setSynthesisSteps(prev => prev.map(step => 
                      step.id === data.stepId 
                        ? { ...step, status: 'processing', startTime: new Date() }
                        : step
                    ));
                    setStreamingText(data.message || `Starting ${data.stepId}...`);
                    break;

                  case 'step_progress':
                    setSynthesisSteps(prev => prev.map(step => 
                      step.id === data.stepId 
                        ? { ...step, progress: data.progress }
                        : step
                    ));
                    break;

                  case 'step_complete':
                    setSynthesisSteps(prev => prev.map(step => 
                      step.id === data.stepId 
                        ? { 
                            ...step, 
                            status: 'completed', 
                            progress: 100,
                            result: data.result,
                            qwanScore: data.qwanScore || 0,
                            endTime: new Date()
                          }
                        : step
                    ));
                    setStreamingText(data.result || `Completed ${data.stepId}`);
                    break;

                  case 'code_chunk':
                    setAccumulatedCode(prev => prev + (data.content || ''));
                    break;

                  case 'synthesis_complete':
                    const result: SynthesisResult = {
                      resultId: data.result.resultId,
                      finalCode: data.result.finalCode,
                      qualityScore: data.result.qualityScore,
                      ethicalScore: data.result.ethicalScore,
                      consciousnessLevel: data.result.consciousnessLevel,
                      voiceContributions: data.result.voiceContributions,
                      conflictsResolved: data.result.conflictsResolved,
                      timestamp: new Date(),
                      language: data.result.language || 'javascript',
                      framework: data.result.framework,
                      patterns: data.result.patterns || []
                    };
                    setSynthesisResult(result);
                    onSynthesisComplete(result);
                    break;
                    
                  case 'error':
                    throw new Error(data.message);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        setIsStreaming(false);
        setCurrentStep(null);
      }

    } catch (error) {
      console.error('Synthesis error:', error);
      setIsStreaming(false);
      setCurrentStep(null);
      
      if (error instanceof Error && error.name !== 'AbortError') {
        toast({
          title: "Synthesis Failed",
          description: error.message || "An error occurred during synthesis",
          variant: "destructive"
        });
      }
    }
  }, [sessionId, solutions, mode, initializeSynthesisSteps, onSynthesisComplete, toast]);

  // Cancel synthesis
  const cancelSynthesis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setCurrentStep(null);
    toast({
      title: "Synthesis Cancelled",
      description: "The synthesis process has been stopped.",
    });
  }, [toast]);

  // Auto-start synthesis when component opens
  useEffect(() => {
    if (isOpen && solutions.length > 0 && !isStreaming && !synthesisResult) {
      startSynthesis();
    }
  }, [isOpen, solutions.length, isStreaming, synthesisResult, startSynthesis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Advanced Synthesis Engine</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Consciousness-driven multi-voice synthesis • {mode} mode • {solutions.length} voices
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isStreaming && (
                <Button onClick={cancelSynthesis} variant="outline" size="sm">
                  Cancel
                </Button>
              )}
              <Button onClick={onClose} variant="outline" size="sm">
                Close
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6 overflow-y-auto">
          {/* Synthesis Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Voice Count</span>
                </div>
                <div className="text-2xl font-bold">{solutions.length}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Unique perspectives
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Synthesis Mode</span>
                </div>
                <div className="text-lg font-bold capitalize">{mode}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Integration strategy
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Consciousness</span>
                </div>
                <div className="text-2xl font-bold">
                  {currentStep?.consciousness || 0}/10
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Current level
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Synthesis Steps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Synthesis Process
            </h3>

            {synthesisSteps.map((step, index) => (
              <Card key={step.id} className={`transition-all ${
                currentStep?.id === step.id ? 'ring-2 ring-blue-500' : ''
              } ${step.status === 'completed' ? 'bg-green-50 dark:bg-green-900/20' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        step.status === 'completed' ? 'bg-green-500' :
                        step.status === 'processing' ? 'bg-blue-500' :
                        step.status === 'error' ? 'bg-red-500' : 'bg-gray-300'
                      }`}>
                        {step.status === 'completed' ? (
                          <CheckCircle className="w-4 h-4 text-white" />
                        ) : step.status === 'processing' ? (
                          <Activity className="w-4 h-4 text-white animate-pulse" />
                        ) : step.status === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-white" />
                        ) : (
                          <span className="text-sm font-bold text-gray-600">{index + 1}</span>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium">{step.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                          <span>Consciousness: {step.consciousness}/10</span>
                          {step.qwanScore > 0 && (
                            <>
                              <span>•</span>
                              <span>QWAN: {step.qwanScore}%</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <Badge variant={
                      step.status === 'completed' ? 'default' :
                      step.status === 'processing' ? 'secondary' :
                      step.status === 'error' ? 'destructive' : 'outline'
                    }>
                      {step.status}
                    </Badge>
                  </div>

                  {step.status === 'processing' && (
                    <div className="space-y-2">
                      <Progress value={step.progress} className="h-2" />
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {step.progress}% complete
                      </div>
                    </div>
                  )}

                  {step.result && (
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                      {step.result}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Streaming Text */}
          {isStreaming && streamingText && (
            <Card className="border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                  <span className="font-medium">Live Synthesis</span>
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {streamingText}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Accumulated Code Preview */}
          {accumulatedCode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Generated Code Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-50 dark:bg-gray-800 p-4 rounded text-sm overflow-x-auto max-h-60">
                  <code>{accumulatedCode}</code>
                </pre>
              </CardContent>
            </Card>
          )}

          {/* Final Results */}
          {synthesisResult && (
            <Card className="border-green-500/20 bg-green-50 dark:bg-green-900/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Star className="w-5 h-5 text-green-500" />
                  Synthesis Complete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quality Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {synthesisResult.qualityScore}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Quality Score
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {synthesisResult.ethicalScore}%
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Ethical Score
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      {synthesisResult.consciousnessLevel}/10
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Consciousness
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {synthesisResult.conflictsResolved}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      Conflicts Resolved
                    </div>
                  </div>
                </div>

                {/* Voice Contributions */}
                <div>
                  <h4 className="font-medium mb-2">Voice Contributions</h4>
                  <div className="space-y-2">
                    {Object.entries(synthesisResult.voiceContributions).map(([voice, contribution]) => (
                      <div key={voice} className="flex items-center gap-2">
                        <span className="text-sm font-medium min-w-24">{voice}</span>
                        <Progress value={contribution} className="flex-1 h-2" />
                        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-12">
                          {Math.round(contribution)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Technical Details */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{synthesisResult.language}</Badge>
                  {synthesisResult.framework && (
                    <Badge variant="outline">{synthesisResult.framework}</Badge>
                  )}
                  {synthesisResult.patterns.map(pattern => (
                    <Badge key={pattern} variant="secondary">{pattern}</Badge>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    onClick={() => onSynthesisComplete(synthesisResult)}
                    className="flex-1"
                  >
                    <GitMerge className="w-4 h-4 mr-2" />
                    Use This Solution
                  </Button>
                  <Button 
                    onClick={startSynthesis}
                    variant="outline"
                  >
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Resynthesize
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!isStreaming && !synthesisResult && synthesisSteps.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Brain className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium mb-2">Ready for Synthesis</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Click start to begin consciousness-driven synthesis of {solutions.length} voice solutions
                </p>
                <Button onClick={startSynthesis}>
                  <Zap className="w-4 h-4 mr-2" />
                  Start Synthesis
                </Button>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}