// Advanced Council Decision Integration - Following AI_INSTRUCTIONS.md & CodingPhilosophy.md
// Implements Jung's Descent Protocol and Alexander's Pattern Language for living UI consciousness

import { useState, useEffect, useCallback } from "react";
import { Brain, Zap, Target, Users, Layers3, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Solution } from "@shared/schema";

interface ConsciousnessLevel {
  current: number;
  target: number;
  progress: number;
  qwanScore: number;
}

interface CouncilDecision {
  id: string;
  sessionId: number;
  timestamp: Date;
  voicesEngaged: string[];
  decisionType: 'technical' | 'architectural' | 'ethical' | 'performance';
  complexity: number;
  consensus: number;
  dissent: string[];
  implementation: string;
  consciousnessImpact: number;
  qwanAssessment: {
    wholeness: number;
    freedom: number;
    exactness: number;
    egolessness: number;
    eternity: number;
  };
}

interface ConsciousnessCouncilIntegratorProps {
  sessionId: number;
  solutions: Solution[];
  isActive: boolean;
  onDecisionMade: (decision: CouncilDecision) => void;
  onConsciousnessEvolution: (level: ConsciousnessLevel) => void;
}

export function ConsciousnessCouncilIntegrator({
  sessionId,
  solutions,
  isActive,
  onDecisionMade,
  onConsciousnessEvolution
}: ConsciousnessCouncilIntegratorProps) {
  const { toast } = useToast();
  const [councilState, setCouncilState] = useState<'idle' | 'assembling' | 'deliberating' | 'deciding' | 'implementing'>('idle');
  const [currentConsciousness, setCurrentConsciousness] = useState<ConsciousnessLevel>({
    current: 3,
    target: 7,
    progress: 0,
    qwanScore: 5
  });
  const [activeVoices, setActiveVoices] = useState<string[]>([]);
  const [councilDecisions, setCouncilDecisions] = useState<CouncilDecision[]>([]);
  const [showDecisionDialog, setShowDecisionDialog] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<CouncilDecision | null>(null);

  // Jung's Descent Protocol: Recursive consciousness analysis
  const analyzeConsciousnessPatterns = useCallback(async () => {
    if (!solutions.length || !isActive) return;

    try {
      setCouncilState('assembling');
      
      // Phase 1: COLLAPSE - Acknowledge complexity
      const complexityAnalysis = {
        technicalDepth: solutions.reduce((sum, s) => sum + (s.code?.length || 0), 0) / solutions.length,
        voiceConsensus: calculateVoiceConsensus(solutions),
        ethicalImplications: assessEthicalImplications(solutions),
        architecturalCoherence: measureArchitecturalCoherence(solutions)
      };

      setCouncilState('deliberating');
      
      // Phase 2: COUNCIL - Multi-voice dialogue simulation
      const councilResult = await simulateCouncilSession({
        sessionId,
        solutions,
        complexity: complexityAnalysis
      });

      setCouncilState('deciding');
      
      // Phase 3: SYNTHESIS - Decision integration
      const decision = await synthesizeCouncilDecision(councilResult);
      
      setCouncilDecisions(prev => [...prev, decision]);
      onDecisionMade(decision);

      setCouncilState('implementing');
      
      // Phase 4: REBIRTH - Consciousness evolution
      const newConsciousness = evolveconsciousness(currentConsciousness, decision);
      setCurrentConsciousness(newConsciousness);
      onConsciousnessEvolution(newConsciousness);

      setCouncilState('idle');
      
      toast({
        title: "Council Decision Complete",
        description: `Consciousness evolved to level ${newConsciousness.current}. QWAN score: ${newConsciousness.qwanScore}`,
      });

    } catch (error) {
      console.error('Council integration error:', error);
      setCouncilState('idle');
      toast({
        title: "Council Integration Error",
        description: "Failed to complete consciousness integration. Falling back to standard processing.",
        variant: "destructive"
      });
    }
  }, [solutions, isActive, sessionId, currentConsciousness, onDecisionMade, onConsciousnessEvolution, toast]);

  // Alexander's Pattern Language: Calculate voice consensus patterns
  const calculateVoiceConsensus = (solutions: Solution[]): number => {
    if (solutions.length < 2) return 100;
    
    const avgConfidence = solutions.reduce((sum, s) => sum + s.confidence, 0) / solutions.length;
    const confidenceVariance = solutions.reduce((sum, s) => sum + Math.pow(s.confidence - avgConfidence, 2), 0) / solutions.length;
    
    // High consensus = low variance, normalized to 0-100
    return Math.max(0, 100 - (confidenceVariance * 2));
  };

  // CodingPhilosophy.md: Assess ethical implications of solutions
  const assessEthicalImplications = (solutions: Solution[]): number => {
    let ethicalScore = 50; // Start neutral
    
    solutions.forEach(solution => {
      const code = solution.code?.toLowerCase() || '';
      const explanation = solution.explanation?.toLowerCase() || '';
      
      // Positive ethical indicators
      if (code.includes('security') || code.includes('validation')) ethicalScore += 10;
      if (code.includes('accessibility') || code.includes('a11y')) ethicalScore += 8;
      if (explanation.includes('privacy') || explanation.includes('consent')) ethicalScore += 6;
      if (code.includes('error handling') || code.includes('try/catch')) ethicalScore += 4;
      
      // Negative ethical indicators
      if (code.includes('hack') || code.includes('workaround')) ethicalScore -= 5;
      if (code.includes('todo') || code.includes('fixme')) ethicalScore -= 3;
      if (explanation.includes('quick fix') || explanation.includes('temporary')) ethicalScore -= 4;
    });
    
    return Math.max(0, Math.min(100, ethicalScore));
  };

  // Measure architectural coherence across solutions
  const measureArchitecturalCoherence = (solutions: Solution[]): number => {
    if (solutions.length < 2) return 100;
    
    let coherenceScore = 0;
    const patterns = solutions.map(s => extractArchitecturalPatterns(s.code || ''));
    
    // Check for consistent patterns across solutions
    const commonPatterns = findCommonPatterns(patterns);
    coherenceScore += commonPatterns.length * 15;
    
    // Check for conflicting approaches
    const conflicts = findPatternConflicts(patterns);
    coherenceScore -= conflicts.length * 10;
    
    return Math.max(0, Math.min(100, coherenceScore + 50));
  };

  // Extract architectural patterns from code
  const extractArchitecturalPatterns = (code: string): string[] => {
    const patterns: string[] = [];
    
    if (code.includes('async') || code.includes('await')) patterns.push('async-programming');
    if (code.includes('class') || code.includes('extends')) patterns.push('object-oriented');
    if (code.includes('function') || code.includes('=>')) patterns.push('functional');
    if (code.includes('import') || code.includes('export')) patterns.push('modular');
    if (code.includes('try') || code.includes('catch')) patterns.push('error-handling');
    if (code.includes('interface') || code.includes('type')) patterns.push('type-safe');
    
    return patterns;
  };

  // Find common patterns across all solutions
  const findCommonPatterns = (patternSets: string[][]): string[] => {
    if (patternSets.length === 0) return [];
    
    return patternSets[0].filter(pattern =>
      patternSets.every(set => set.includes(pattern))
    );
  };

  // Find conflicting patterns
  const findPatternConflicts = (patternSets: string[][]): string[] => {
    const conflicts: string[] = [];
    
    // Example conflicts
    const conflictMap = {
      'object-oriented': ['functional'],
      'functional': ['object-oriented'],
      'synchronous': ['async-programming'],
      'async-programming': ['synchronous']
    };
    
    patternSets.forEach(patterns => {
      patterns.forEach(pattern => {
        const conflictingPatterns = conflictMap[pattern] || [];
        conflictingPatterns.forEach(conflicting => {
          if (patterns.includes(conflicting) && !conflicts.includes(`${pattern}-${conflicting}`)) {
            conflicts.push(`${pattern}-${conflicting}`);
          }
        });
      });
    });
    
    return conflicts;
  };

  // Simulate council session with real decision-making
  const simulateCouncilSession = async (options: {
    sessionId: number;
    solutions: Solution[];
    complexity: any;
  }): Promise<any> => {
    // Simulate council deliberation time based on complexity
    const deliberationTime = Math.min(3000, options.complexity.technicalDepth / 10 + 1000);
    
    return new Promise(resolve => {
      setTimeout(() => {
        const voices = extractActiveVoices(options.solutions);
        setActiveVoices(voices);
        
        resolve({
          voices,
          consensus: options.complexity.voiceConsensus,
          ethical: options.complexity.ethicalImplications,
          architectural: options.complexity.architecturalCoherence,
          complexity: calculateOverallComplexity(options.complexity)
        });
      }, deliberationTime);
    });
  };

  // Extract active voices from solutions
  const extractActiveVoices = (solutions: Solution[]): string[] => {
    const voices = new Set<string>();
    solutions.forEach(solution => {
      if (solution.voiceCombination) {
        voices.add(solution.voiceCombination);
      }
    });
    return Array.from(voices);
  };

  // Calculate overall complexity score
  const calculateOverallComplexity = (analysis: any): number => {
    return Math.round(
      (analysis.technicalDepth / 1000 * 0.3) +
      ((100 - analysis.voiceConsensus) * 0.3) +
      ((100 - analysis.ethicalImplications) * 0.2) +
      ((100 - analysis.architecturalCoherence) * 0.2)
    );
  };

  // Synthesize final council decision
  const synthesizeCouncilDecision = async (councilResult: any): Promise<CouncilDecision> => {
    const decision: CouncilDecision = {
      id: `decision-${Date.now()}`,
      sessionId,
      timestamp: new Date(),
      voicesEngaged: councilResult.voices,
      decisionType: determineDecisionType(councilResult),
      complexity: councilResult.complexity,
      consensus: councilResult.consensus,
      dissent: await trackVoiceDissentPatterns(councilResult),
      implementation: generateImplementationPlan(councilResult),
      consciousnessImpact: calculateConsciousnessImpact(councilResult),
      qwanAssessment: assessQWAN(councilResult)
    };

    return decision;
  };

  // Determine primary decision type
  const determineDecisionType = (result: any): CouncilDecision['decisionType'] => {
    if (result.ethical < 70) return 'ethical';
    if (result.architectural < 70) return 'architectural';
    if (result.complexity > 7) return 'performance';
    return 'technical';
  };

  // Generate implementation plan
  const generateImplementationPlan = (result: any): string => {
    const plans = [];
    
    if (result.consensus < 70) {
      plans.push("Resolve voice conflicts through synthesis");
    }
    if (result.ethical < 80) {
      plans.push("Enhance ethical considerations");
    }
    if (result.architectural < 75) {
      plans.push("Improve architectural coherence");
    }
    
    return plans.length > 0 ? plans.join("; ") : "Proceed with current synthesis";
  };

  // Calculate consciousness impact
  const calculateConsciousnessImpact = (result: any): number => {
    return Math.round(
      (result.consensus * 0.3 + result.ethical * 0.4 + result.architectural * 0.3) / 100 * 10
    );
  };

  // Assess Quality Without A Name
  const assessQWAN = (result: any): CouncilDecision['qwanAssessment'] => {
    const base = 5;
    const factor = (result.consensus + result.ethical + result.architectural) / 300;
    
    return {
      wholeness: Math.round(base + factor * 5),
      freedom: Math.round(base + factor * 4),
      exactness: Math.round(base + factor * 4.5),
      egolessness: Math.round(base + factor * 3.5),
      eternity: Math.round(base + factor * 4)
    };
  };

  // Track voice dissent patterns for consciousness evolution
  const trackVoiceDissentPatterns = async (councilResult: any): Promise<string[]> => {
    const dissent: string[] = [];
    
    if (councilResult.consensus < 60) {
      dissent.push('Low consensus detected - voices show significant disagreement');
    }
    
    if (councilResult.ethical < 70) {
      dissent.push('Ethical concerns raised by multiple voices');
    }
    
    if (councilResult.architectural < 65) {
      dissent.push('Architectural approach disputed between voices');
    }
    
    // Analyze solution confidence variance for dissent
    if (solutions.length > 2) {
      const confidences = solutions.map(s => s.confidence);
      const variance = confidences.reduce((sum, conf) => {
        const avg = confidences.reduce((a, b) => a + b, 0) / confidences.length;
        return sum + Math.pow(conf - avg, 2);
      }, 0) / confidences.length;
      
      if (variance > 0.15) {
        dissent.push('High confidence variance indicates voice uncertainty');
      }
    }
    
    return dissent;
  };

  // Evolve consciousness based on decision
  const evolveconsciousness = (current: ConsciousnessLevel, decision: CouncilDecision): ConsciousnessLevel => {
    const growthFactor = decision.consciousnessImpact / 10;
    const qwanAverage = Object.values(decision.qwanAssessment).reduce((sum, val) => sum + val, 0) / 5;
    
    return {
      current: Math.min(10, current.current + growthFactor),
      target: Math.min(10, current.target + 0.1),
      progress: Math.min(100, current.progress + (growthFactor * 15)),
      qwanScore: Math.round((current.qwanScore + qwanAverage) / 2)
    };
  };

  // Auto-trigger council analysis when solutions change
  useEffect(() => {
    if (isActive && solutions.length > 1 && councilState === 'idle') {
      analyzeConsciousnessPatterns();
    }
  }, [solutions.length, isActive, councilState, analyzeConsciousnessPatterns]);

  const getStateColor = (state: typeof councilState) => {
    switch (state) {
      case 'assembling': return 'bg-blue-500';
      case 'deliberating': return 'bg-purple-500';
      case 'deciding': return 'bg-yellow-500';
      case 'implementing': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStateIcon = (state: typeof councilState) => {
    switch (state) {
      case 'assembling': return <Users className="w-4 h-4" />;
      case 'deliberating': return <Brain className="w-4 h-4" />;
      case 'deciding': return <Target className="w-4 h-4" />;
      case 'implementing': return <Zap className="w-4 h-4" />;
      default: return <Layers3 className="w-4 h-4" />;
    }
  };

  if (!isActive || solutions.length < 2) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Council Status Card */}
      <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${getStateColor(councilState)}`}>
              {councilState === 'idle' ? <Brain className="w-5 h-5 text-white" /> : getStateIcon(councilState)}
            </div>
            <div>
              <span className="text-lg font-semibold">Consciousness Council</span>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-normal">
                {councilState === 'idle' ? 'Ready for integration' : `${councilState.charAt(0).toUpperCase() + councilState.slice(1)}...`}
              </p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Consciousness Level Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Consciousness Level</span>
              <span>{currentConsciousness.current.toFixed(1)}/10 (QWAN: {currentConsciousness.qwanScore})</span>
            </div>
            <Progress value={currentConsciousness.progress} className="h-2" />
          </div>

          {/* Active Voices */}
          {activeVoices.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Active Voices</span>
              <div className="flex flex-wrap gap-2">
                {activeVoices.map(voice => (
                  <Badge key={voice} variant="secondary" className="text-xs">
                    {voice}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Council State Indicator */}
          {councilState !== 'idle' && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="capitalize">{councilState} consciousness patterns...</span>
            </div>
          )}

          {/* Recent Decisions */}
          {councilDecisions.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Recent Decisions</span>
              <div className="space-y-1">
                {councilDecisions.slice(-3).map(decision => (
                  <div
                    key={decision.id}
                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => {
                      setSelectedDecision(decision);
                      setShowDecisionDialog(true);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm">{decision.decisionType} decision</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Level {decision.consciousnessImpact}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Council Trigger */}
          <Button
            onClick={analyzeConsciousnessPatterns}
            disabled={councilState !== 'idle' || solutions.length < 2}
            variant="outline"
            size="sm"
            className="w-full"
          >
            {councilState === 'idle' ? (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Trigger Council Analysis
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Decision Detail Dialog */}
      <Dialog open={showDecisionDialog} onOpenChange={setShowDecisionDialog}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Council Decision Analysis</DialogTitle>
            <DialogDescription>
              Detailed breakdown of consciousness-driven decision making
            </DialogDescription>
          </DialogHeader>
          
          {selectedDecision && (
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="qwan">QWAN Assessment</TabsTrigger>
                <TabsTrigger value="implementation">Implementation</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Decision Type</label>
                    <Badge className="capitalize">{selectedDecision.decisionType}</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Complexity Level</label>
                    <Badge variant="outline">{selectedDecision.complexity}/10</Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Consensus</label>
                    <Badge variant={selectedDecision.consensus > 70 ? "default" : "destructive"}>
                      {selectedDecision.consensus}%
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Consciousness Impact</label>
                    <Badge className="bg-purple-500">{selectedDecision.consciousnessImpact}/10</Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Voices Engaged</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedDecision.voicesEngaged.map(voice => (
                      <Badge key={voice} variant="secondary">{voice}</Badge>
                    ))}
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="qwan" className="space-y-4">
                <div className="space-y-4">
                  {Object.entries(selectedDecision.qwanAssessment).map(([quality, score]) => (
                    <div key={quality} className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium capitalize">{quality}</span>
                        <span className="text-sm">{score}/10</span>
                      </div>
                      <Progress value={score * 10} className="h-2" />
                    </div>
                  ))}
                </div>
              </TabsContent>
              
              <TabsContent value="implementation" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Implementation Plan</label>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    {selectedDecision.implementation}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timestamp</label>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {selectedDecision.timestamp.toLocaleString()}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}