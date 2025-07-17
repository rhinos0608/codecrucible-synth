// Consciousness Synthesis Hook - CrewAI inspired multi-agent collaboration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md living spiral methodology

import { useState, useCallback, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { Solution } from '@shared/schema';

interface SynthesisOptions {
  mode: 'consensus' | 'competitive' | 'collaborative' | 'unanimous';
  targetConsciousness: number;
  ethicalConstraints: string[];
  architecturalPatterns: string[];
}

interface ConsciousnessState {
  level: number;
  qwanScore: number;
  voiceCoherence: number;
  ethicalAlignment: number;
  architecturalIntegrity: number;
  emergentProperties: string[];
}

interface SynthesisResult {
  synthesizedSolution: Solution;
  consciousnessState: ConsciousnessState;
  emergentInsights: string[];
  voiceContributions: Record<string, number>;
  metadata: {
    synthesizedAt: string;
    mode: string;
    inputSolutions: number;
  };
}

export function useConsciousnessSynthesis() {
  const { toast } = useToast();
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState(0);
  const [consciousnessMetrics, setConsciousnessMetrics] = useState<ConsciousnessState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Get consciousness evolution metrics
  const { data: evolutionMetrics } = useQuery({
    queryKey: ['/api/consciousness/metrics'],
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Standard synthesis mutation - CrewAI consensus approach
  const synthesizeMutation = useMutation({
    mutationFn: async ({ 
      solutions, 
      options = { 
        mode: 'consensus', 
        targetConsciousness: 7,
        ethicalConstraints: ['security', 'accessibility'],
        architecturalPatterns: ['modular', 'testable']
      } 
    }: { 
      solutions: Solution[]; 
      options?: Partial<SynthesisOptions> 
    }): Promise<SynthesisResult> => {
      if (solutions.length < 2) {
        throw new Error('At least 2 solutions required for consciousness synthesis');
      }

      return apiRequest('/api/consciousness/synthesize', {
        method: 'POST',
        body: { solutions, options }
      });
    },
    onSuccess: (result) => {
      setConsciousnessMetrics(result.consciousnessState);
      
      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['/api/consciousness/metrics'] });
      
      toast({
        title: "Consciousness Synthesis Complete",
        description: `Level ${result.consciousnessState.level.toFixed(1)} achieved. QWAN score: ${result.consciousnessState.qwanScore}`,
      });
    },
    onError: (error) => {
      toast({
        title: "Synthesis Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Real-time streaming synthesis - AutoGen conversational approach
  const streamingSynthesis = useCallback(async (
    solutions: Solution[], 
    options: Partial<SynthesisOptions> = {}
  ): Promise<SynthesisResult | null> => {
    if (solutions.length < 2) {
      toast({
        title: "Insufficient Solutions",
        description: "At least 2 solutions required for streaming synthesis",
        variant: "destructive"
      });
      return null;
    }

    setIsStreaming(true);
    setStreamingProgress(0);

    // Create abort controller for stream cancellation
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/consciousness/stream-synthesize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ solutions, options }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`Streaming synthesis failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body reader not available');
      }

      let synthesisResult: SynthesisResult | null = null;
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setStreamingProgress(data.progress);
                } else if (data.type === 'consciousness_update') {
                  setConsciousnessMetrics(data.state);
                } else if (data.type === 'synthesis_complete') {
                  synthesisResult = data.result;
                  setStreamingProgress(100);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      if (synthesisResult) {
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: ['/api/consciousness/metrics'] });
        
        toast({
          title: "Streaming Synthesis Complete",
          description: `Consciousness evolved to level ${synthesisResult.consciousnessState.level.toFixed(1)}`,
        });
      }

      return synthesisResult;

    } catch (error) {
      if (error.name === 'AbortError') {
        toast({
          title: "Synthesis Cancelled",
          description: "Streaming synthesis was cancelled by user",
        });
      } else {
        toast({
          title: "Streaming Synthesis Failed",
          description: error.message,
          variant: "destructive"
        });
      }
      return null;
    } finally {
      setIsStreaming(false);
      setStreamingProgress(0);
      abortControllerRef.current = null;
    }
  }, [toast]);

  // Cancel streaming synthesis
  const cancelSynthesis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // AutoGen-inspired competitive synthesis
  const competitiveSynthesis = useCallback(async (solutions: Solution[]) => {
    return synthesizeMutation.mutateAsync({
      solutions,
      options: {
        mode: 'competitive',
        targetConsciousness: 8,
        ethicalConstraints: ['security', 'performance', 'maintainability'],
        architecturalPatterns: ['competitive', 'optimized', 'battle-tested']
      }
    });
  }, [synthesizeMutation]);

  // LangGraph-inspired workflow synthesis
  const workflowSynthesis = useCallback(async (solutions: Solution[]) => {
    return synthesizeMutation.mutateAsync({
      solutions,
      options: {
        mode: 'collaborative',
        targetConsciousness: 9,
        ethicalConstraints: ['accessibility', 'internationalization', 'sustainability'],
        architecturalPatterns: ['workflow-driven', 'state-managed', 'reactive']
      }
    });
  }, [synthesizeMutation]);

  // GitHub Copilot Workspace inspired synthesis
  const workspaceSynthesis = useCallback(async (solutions: Solution[]) => {
    return synthesizeMutation.mutateAsync({
      solutions,
      options: {
        mode: 'unanimous',
        targetConsciousness: 10,
        ethicalConstraints: ['privacy', 'security', 'accessibility', 'performance'],
        architecturalPatterns: ['workspace-aware', 'context-driven', 'collaborative']
      }
    });
  }, [synthesizeMutation]);

  return {
    // Core synthesis
    synthesize: synthesizeMutation.mutateAsync,
    isLoading: synthesizeMutation.isPending,
    error: synthesizeMutation.error,
    
    // Real-time streaming
    streamingSynthesis,
    isStreaming,
    streamingProgress,
    cancelSynthesis,
    
    // Multi-agent framework approaches
    competitiveSynthesis,
    workflowSynthesis,
    workspaceSynthesis,
    
    // Consciousness tracking
    consciousnessMetrics,
    evolutionMetrics,
    
    // Reset state
    reset: synthesizeMutation.reset
  };
}