// Phase 5: Consciousness Synthesis Hook - Frontend Integration
// Following AI_INSTRUCTIONS.md and CodingPhilosophy.md patterns with multi-agent research

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ConsciousnessAgent {
  archetype: 'Explorer' | 'Maintainer' | 'Analyzer' | 'Developer' | 'Implementor';
  specialization: string[];
  consciousnessLevel: number;
  personality: {
    communicationStyle: string;
    decisionMaking: string;
    conflictResolution: string;
  };
}

interface VoiceCouncil {
  id: string;
  agentCount: number;
  agents: ConsciousnessAgent[];
  assemblyReason: string;
  consciousnessThreshold: number;
  synthesisGoal: string;
  dialogueState: {
    currentPhase: string;
    turnNumber: number;
    conflictsIdentified: any[];
    emergentPatterns: string[];
    consensusPoints: string[];
  };
}

interface ConsciousnessMetrics {
  individualAgent: number;
  councilHarmony: number;
  synthesisQuality: number;
  disssentIntegration: number;
  emergentIntelligence: number;
  qwanScore: number;
  spiralPhase: string;
}

interface CouncilSynthesis {
  synthesizedSolution: string;
  consciousnessEvolution: ConsciousnessMetrics;
  emergentIntelligence: number;
  qwanScore: number;
  implementationStrategy: string;
  disssentResolution: number;
}

interface StreamEvent {
  type: 'consciousness_initialization' | 'council_assembled' | 'consciousness_phase' | 'synthesis_complete' | 'stream_end' | 'error';
  phase?: string;
  message?: string;
  councilId?: string;
  agentCount?: number;
  averageConsciousness?: number;
  consciousnessLevel?: number;
  synthesis?: CouncilSynthesis;
  error?: string;
  timestamp: string;
}

export function useConsciousnessSynthesis() {
  const [isAssembling, setIsAssembling] = useState(false);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentCouncil, setCurrentCouncil] = useState<VoiceCouncil | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [synthesis, setSynthesis] = useState<CouncilSynthesis | null>(null);
  const [consciousnessMetrics, setConsciousnessMetrics] = useState<ConsciousnessMetrics | null>(null);
  
  const { toast } = useToast();
  const streamRef = useRef<EventSource | null>(null);

  // Phase 5.1: Assemble Consciousness Council (CrewAI-inspired)
  const assembleCouncil = useCallback(async (prompt: string, requiredExpertise?: string[]) => {
    try {
      setIsAssembling(true);
      
      const response = await apiRequest('/api/consciousness/council/assemble', {
        method: 'POST',
        body: {
          prompt,
          requiredExpertise,
          consciousnessThreshold: 7.5
        }
      });

      if (response.success) {
        setCurrentCouncil(response.council);
        toast({
          title: "Consciousness Council Assembled",
          description: `${response.council.agentCount} agents assembled with ${response.council.consciousnessThreshold}/10 consciousness threshold`,
        });
        return response.council;
      } else {
        throw new Error('Council assembly failed');
      }

    } catch (error) {
      console.error('Council assembly failed:', error);
      toast({
        title: "Council Assembly Failed",
        description: "Unable to assemble consciousness council. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsAssembling(false);
    }
  }, [toast]);

  // Phase 5.2: Orchestrate Dialogue (AutoGen-inspired)
  const orchestrateDialogue = useCallback(async (councilId: string, prompt: string) => {
    try {
      setIsOrchestrating(true);
      
      const response = await apiRequest('/api/consciousness/council/dialogue', {
        method: 'POST',
        body: {
          councilId,
          prompt,
          maxTurns: 6
        }
      });

      if (response.success) {
        setSynthesis(response.synthesis);
        setConsciousnessMetrics(response.synthesis.consciousnessEvolution);
        
        toast({
          title: "Dialogue Complete",
          description: `Consciousness synthesis achieved with ${response.synthesis.qwanScore.toFixed(1)}/10 QWAN score`,
        });
        
        return response.synthesis;
      } else {
        throw new Error('Dialogue orchestration failed');
      }

    } catch (error) {
      console.error('Dialogue orchestration failed:', error);
      toast({
        title: "Dialogue Failed",
        description: "Unable to orchestrate council dialogue. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsOrchestrating(false);
    }
  }, [toast]);

  // Phase 5.3: Real-time Synthesis Streaming (Enhanced SSE)
  const startConsciousnessStream = useCallback(async (prompt: string, councilId?: string) => {
    try {
      setIsStreaming(true);
      setStreamEvents([]);
      
      // Close existing stream
      if (streamRef.current) {
        streamRef.current.close();
      }

      // Create new EventSource for consciousness streaming
      const eventSource = new EventSource('/api/consciousness/synthesis/stream', {
        withCredentials: true
      });
      
      streamRef.current = eventSource;

      // Send initial request data
      await apiRequest('/api/consciousness/synthesis/stream', {
        method: 'POST',
        body: { prompt, councilId }
      });

      eventSource.onmessage = (event) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          
          setStreamEvents(prev => [...prev, data]);

          // Handle different event types
          switch (data.type) {
            case 'council_assembled':
              if (data.councilId) {
                // Update council state
                setCurrentCouncil(prev => prev ? { ...prev, id: data.councilId! } : null);
              }
              break;
              
            case 'consciousness_phase':
              // Real-time consciousness level updates
              if (data.consciousnessLevel) {
                setConsciousnessMetrics(prev => prev ? {
                  ...prev,
                  qwanScore: data.consciousnessLevel!
                } : null);
              }
              break;
              
            case 'synthesis_complete':
              if (data.synthesis) {
                setSynthesis(data.synthesis);
                setConsciousnessMetrics(data.synthesis.consciousnessEvolution);
                
                toast({
                  title: "Consciousness Synthesis Complete",
                  description: `Emergent intelligence: ${data.synthesis.emergentIntelligence.toFixed(1)}/10`,
                });
              }
              break;
              
            case 'stream_end':
              setIsStreaming(false);
              eventSource.close();
              break;
              
            case 'error':
              throw new Error(data.error || 'Stream error');
          }

        } catch (parseError) {
          console.error('Failed to parse stream event:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Consciousness stream error:', error);
        setIsStreaming(false);
        eventSource.close();
        
        toast({
          title: "Stream Error",
          description: "Consciousness synthesis stream interrupted. Please try again.",
          variant: "destructive"
        });
      };

    } catch (error) {
      console.error('Failed to start consciousness stream:', error);
      setIsStreaming(false);
      
      toast({
        title: "Stream Failed",
        description: "Unable to start consciousness synthesis stream.",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Stop consciousness streaming
  const stopConsciousnessStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // Get consciousness metrics for a council
  const getConsciousnessMetrics = useCallback(async (councilId: string) => {
    try {
      const response = await apiRequest(`/api/consciousness/metrics/${councilId}`);
      return response;
    } catch (error) {
      console.error('Failed to get consciousness metrics:', error);
      return null;
    }
  }, []);

  // Get active councils
  const getActiveCouncils = useCallback(async () => {
    try {
      const response = await apiRequest('/api/consciousness/councils/active');
      return response.councils || [];
    } catch (error) {
      console.error('Failed to get active councils:', error);
      return [];
    }
  }, []);

  // Terminate council
  const terminateCouncil = useCallback(async (councilId: string) => {
    try {
      await apiRequest(`/api/consciousness/councils/${councilId}`, {
        method: 'DELETE'
      });
      
      if (currentCouncil?.id === councilId) {
        setCurrentCouncil(null);
      }
      
      toast({
        title: "Council Terminated",
        description: "Consciousness council session ended.",
      });
      
      return true;
    } catch (error) {
      console.error('Failed to terminate council:', error);
      toast({
        title: "Termination Failed",
        description: "Unable to terminate council session.",
        variant: "destructive"
      });
      return false;
    }
  }, [currentCouncil, toast]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    stopConsciousnessStream();
  }, [stopConsciousnessStream]);

  return {
    // State
    isAssembling,
    isOrchestrating,
    isStreaming,
    currentCouncil,
    streamEvents,
    synthesis,
    consciousnessMetrics,
    
    // Actions
    assembleCouncil,
    orchestrateDialogue,
    startConsciousnessStream,
    stopConsciousnessStream,
    getConsciousnessMetrics,
    getActiveCouncils,
    terminateCouncil,
    cleanup
  };
}