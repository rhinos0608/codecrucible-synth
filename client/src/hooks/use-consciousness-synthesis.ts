// Consciousness Synthesis Hook - Multi-Agent Framework Integration
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { Solution } from '@shared/schema';

interface ConsciousnessState {
  level: number;
  qwanScore: number;
  coherence: number;
  alignment: number;
  evolution: number;
}

interface SynthesisResult {
  synthesizedSolution: Solution;
  consciousnessState: ConsciousnessState;
  emergentInsights: string[];
  voiceContributions: Map<string, number>;
  metadata: {
    synthesizedAt: string;
    mode: string;
    inputSolutions: number;
  };
}

interface ConsciousnessSynthesisHook {
  synthesizeConsciousness: (
    solutions: Solution[],
    mode?: 'consensus' | 'competitive' | 'collaborative' | 'unanimous'
  ) => Promise<SynthesisResult | null>;
  streamingSynthesis: (
    solutions: Solution[],
    mode?: string,
    onProgress?: (event: any) => void
  ) => Promise<any>;
  isLoading: boolean;
  error: string | null;
}

export function useConsciousnessSynthesis(): ConsciousnessSynthesisHook {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const synthesizeConsciousness = useCallback(async (
    solutions: Solution[],
    mode: 'consensus' | 'competitive' | 'collaborative' | 'unanimous' = 'consensus'
  ): Promise<SynthesisResult | null> => {
    
    if (!solutions || solutions.length < 2) {
      toast({
        title: "Insufficient Solutions",
        description: "At least 2 solutions are required for consciousness synthesis.",
        variant: "destructive"
      });
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/consciousness/synthesize', {
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
            ethicalConstraints: ['security', 'accessibility', 'maintainability'],
            architecturalPatterns: ['modular', 'testable', 'scalable']
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Consciousness synthesis failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      toast({
        title: "Consciousness Synthesis Complete",
        description: `Successfully synthesized ${solutions.length} voice solutions with consciousness level ${result.consciousnessState?.level || 'N/A'}.`,
      });

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      toast({
        title: "Synthesis Error",
        description: errorMessage,
        variant: "destructive"
      });

      return null;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const streamingSynthesis = useCallback(async (
    solutions: Solution[],
    mode: string = 'consensus',
    onProgress?: (event: any) => void
  ): Promise<any> => {
    
    if (!solutions || solutions.length < 2) {
      throw new Error('At least 2 solutions are required for streaming synthesis');
    }

    setIsLoading(true);
    setError(null);

    try {
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
        throw new Error(`Streaming synthesis failed: ${response.status} ${response.statusText}`);
      }

      // Handle Server-Sent Events streaming
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Streaming not supported');
      }

      let result = null;

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
                
                // Call progress callback if provided
                if (onProgress) {
                  onProgress(data);
                }

                // Handle synthesis completion
                if (data.type === 'synthesis_complete') {
                  result = data.result;
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

      return result;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown streaming error occurred';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    synthesizeConsciousness,
    streamingSynthesis,
    isLoading,
    error
  };
}