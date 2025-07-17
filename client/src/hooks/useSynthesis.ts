// Enhanced Synthesis Hook - Following consciousness-driven development and OpenAI Realtime API integration
// Implements multi-voice synthesis with Jung's descent patterns and QWAN assessment

import { useState, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface SynthesisStep {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: string;
  timestamp?: string;
  consciousness?: number;
  qwanScore?: number;
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

export function useSynthesis() {
  const [synthesisSteps, setSynthesisSteps] = useState<SynthesisStep[]>([]);
  const [synthesisResult, setSynthesisResult] = useState<SynthesisResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Initialize synthesis steps following CodingPhilosophy.md consciousness principles
  const initializeSynthesisSteps = useCallback(() => {
    const steps: SynthesisStep[] = [
      {
        id: 1,
        title: "Voice Convergence Analysis",
        description: "Analyzing patterns and synergies across selected AI voices...",
        status: 'pending',
        consciousness: 3
      },
      {
        id: 2,
        title: "Recursive Integration",
        description: "Merging architectural patterns while preserving voice insights...",
        status: 'pending',
        consciousness: 5
      },
      {
        id: 3,
        title: "Security Validation",
        description: "Ensuring synthesis meets AI_INSTRUCTIONS.md security patterns...",
        status: 'pending',
        consciousness: 6
      },
      {
        id: 4,
        title: "Performance Optimization",
        description: "Applying consciousness-driven optimization techniques...",
        status: 'pending',
        consciousness: 7
      },
      {
        id: 5,
        title: "Final Synthesis",
        description: "Creating unified solution using living spiral methodology...",
        status: 'pending',
        consciousness: 8
      }
    ];
    
    setSynthesisSteps(steps);
    return steps;
  }, []);

  // Simulate real-time synthesis progress with actual backend integration
  const updateSynthesisProgress = useCallback((stepId: number, status: SynthesisStep['status'], result?: string) => {
    setSynthesisSteps(prevSteps => 
      prevSteps.map(step => 
        step.id === stepId 
          ? { 
              ...step, 
              status, 
              result,
              timestamp: new Date().toISOString()
            }
          : step
      )
    );
  }, []);

  // Enhanced synthesis function with real-time streaming following OpenAI Realtime API patterns
  const synthesizeSolutions = useCallback(async (
    sessionId: number,
    solutions: VoiceSolution[],
    mode: 'competitive' | 'collaborative' | 'consensus' = 'collaborative'
  ) => {
    if (!solutions || solutions.length === 0) {
      toast({
        title: "No solutions to synthesize",
        description: "Please generate some voice solutions first.",
        variant: "destructive"
      });
      return null;
    }

    setIsStreaming(true);
    setSynthesisResult(null);
    
    // Initialize synthesis steps
    const steps = initializeSynthesisSteps();
    
    try {
      toast({
        title: "Synthesis Starting",
        description: `Initiating ${mode} synthesis with ${solutions.length} voice solutions using consciousness-driven patterns...`,
      });

      // Call consciousness synthesis streaming endpoint following AI_INSTRUCTIONS.md patterns
      const response = await fetch('/api/consciousness/stream-synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          solutions: solutions.map(sol => ({
            id: sol.id,
            sessionId: sol.sessionId,
            voiceCombination: sol.voiceCombination,
            code: sol.code,
            explanation: sol.explanation,
            confidence: sol.confidence,
            timestamp: sol.timestamp
          })),
          options: {
            mode,
            targetConsciousness: 7,
            ethicalConstraints: ['security', 'accessibility'],
            architecturalPatterns: ['modular', 'testable', 'consciousness-driven']
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Synthesis failed: ${response.status} ${response.statusText}`);
      }

      // Handle Server-Sent Events streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming not supported');
      }

      let accumulatedCode = '';
      
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
                    const stepIndex = steps.findIndex(s => s.title.toLowerCase().includes(data.stepId?.toLowerCase()));
                    if (stepIndex >= 0) {
                      updateSynthesisProgress(steps[stepIndex].id, 'processing');
                    }
                    break;

                  case 'step_complete':
                    const completedStepIndex = steps.findIndex(s => s.title.toLowerCase().includes(data.stepId?.toLowerCase()));
                    if (completedStepIndex >= 0) {
                      updateSynthesisProgress(steps[completedStepIndex].id, 'completed', data.result);
                    }
                    break;

                  case 'code_chunk':
                    accumulatedCode += data.content || '';
                    break;

                  case 'synthesis_complete':
                    const result: SynthesisResult = {
                      resultId: data.result.resultId,
                      finalCode: data.result.finalCode || accumulatedCode,
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
                    
                    // Mark all steps as completed
                    steps.forEach(step => {
                      updateSynthesisProgress(step.id, 'completed');
                    });
                    
                    toast({
                      title: "Synthesis Complete",
                      description: `Successfully synthesized ${solutions.length} voice solutions with ${result.qualityScore}% quality score.`,
                    });
                    
                    return result;
                    
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
      }

    } catch (error) {
      console.error('Synthesis error:', error);
      setIsStreaming(false);
      
      // Mark current step as error
      setSynthesisSteps(prevSteps => 
        prevSteps.map(step => 
          step.status === 'processing' 
            ? { ...step, status: 'error', result: error.message }
            : step
        )
      );
      
      toast({
        title: "Synthesis Failed",
        description: error.message || "An error occurred during synthesis",
        variant: "destructive"
      });
      
      return null;
    }
  }, [initializeSynthesisSteps, updateSynthesisProgress, toast]);

  // Enhanced synthesis with QWAN assessment
  const synthesizeWithQWAN = useCallback(async (
    sessionId: number,
    solutions: VoiceSolution[],
    mode: 'competitive' | 'collaborative' | 'consensus' = 'collaborative'
  ) => {
    const result = await synthesizeSolutions(sessionId, solutions, mode);
    
    if (result) {
      // Perform QWAN assessment on synthesized result
      try {
        const qwanResponse = await fetch(`/api/solutions/${result.resultId}/qwan-assessment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (qwanResponse.ok) {
          const qwanData = await qwanResponse.json();
          
          // Update result with QWAN metrics
          const enhancedResult = {
            ...result,
            qwanMetrics: qwanData.metrics,
            timelessQuality: qwanData.timelessQuality,
            qwanRecommendations: qwanData.recommendations
          };
          
          setSynthesisResult(enhancedResult);
          return enhancedResult;
        }
      } catch (qwanError) {
        console.warn('QWAN assessment failed:', qwanError);
        // Enhanced error handling for production
      }
    }
    
    return result;
  }, [synthesizeSolutions]);

  // Voice recommendation integration following CrewAI research patterns
  const getVoiceRecommendations = useCallback(async (
    projectContext: any,
    currentVoices: string[],
    analysisMode: 'adaptive' | 'strategic' | 'experimental' = 'adaptive'
  ) => {
    try {
      const response = await fetch('/api/voices/recommend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectContext,
          currentVoices,
          analysisMode
        })
      });

      if (!response.ok) {
        throw new Error(`Voice recommendation failed: ${response.status}`);
      }

      const data = await response.json();
      return data.recommendations;
      
    } catch (error) {
      console.error('Voice recommendation error:', error);
      toast({
        title: "Recommendation Failed", 
        description: "Failed to get voice recommendations. Please try again.",
        variant: "destructive"
      });
      return [];
    }
  }, [toast]);

  // Reset synthesis state
  const resetSynthesis = useCallback(() => {
    setSynthesisSteps([]);
    setSynthesisResult(null);
    setIsStreaming(false);
  }, []);

  // Calculate synthesis complexity based on solutions
  const calculateSynthesisComplexity = useCallback((solutions: VoiceSolution[]) => {
    if (!solutions || solutions.length === 0) return 0;
    
    let complexity = 0;
    
    // Base complexity from solution count
    complexity += solutions.length * 10;
    
    // Complexity from code length variance
    const codeLengths = solutions.map(s => s.code?.length || 0);
    const avgLength = codeLengths.reduce((sum, len) => sum + len, 0) / codeLengths.length;
    const variance = codeLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) / codeLengths.length;
    complexity += Math.sqrt(variance) / 100;
    
    // Complexity from confidence variance  
    const confidences = solutions.map(s => s.confidence);
    const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
    const confVariance = confidences.reduce((sum, conf) => sum + Math.pow(conf - avgConfidence, 2), 0) / confidences.length;
    complexity += confVariance / 10;
    
    return Math.min(100, Math.max(10, complexity));
  }, []);

  // Synthesis metrics calculation
  const getSynthesisMetrics = useCallback(() => {
    const completedSteps = synthesisSteps.filter(step => step.status === 'completed').length;
    const totalSteps = synthesisSteps.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    const avgConsciousness = synthesisSteps.length > 0 
      ? synthesisSteps.reduce((sum, step) => sum + (step.consciousness || 0), 0) / synthesisSteps.length 
      : 0;
    
    return {
      progress,
      completedSteps,
      totalSteps,
      avgConsciousness,
      isComplete: progress === 100,
      hasErrors: synthesisSteps.some(step => step.status === 'error')
    };
  }, [synthesisSteps]);

  return {
    // State
    synthesisSteps,
    synthesisResult,
    isStreaming,
    
    // Actions
    synthesizeSolutions,
    synthesizeWithQWAN,
    getVoiceRecommendations,
    resetSynthesis,
    initializeSynthesisSteps,
    updateSynthesisProgress,
    
    // Utilities
    calculateSynthesisComplexity,
    getSynthesisMetrics
  };
}