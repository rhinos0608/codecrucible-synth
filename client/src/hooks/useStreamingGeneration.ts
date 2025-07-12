// ChatGPT-style streaming generation hook following AI_INSTRUCTIONS.md patterns
import { useState, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

interface VoiceStream {
  id: string;
  name: string;
  content: string;
  isTyping: boolean;
  isComplete: boolean;
  confidence: number;
  error?: string;
}

interface UseStreamingGenerationProps {
  onComplete?: (sessionId: number) => void;
  onError?: (error: string) => void;
}

export function useStreamingGeneration({ onComplete, onError }: UseStreamingGenerationProps = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [voices, setVoices] = useState<VoiceStream[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const streamRefs = useRef<{ [key: string]: EventSource }>({});
  const { user } = useAuth();

  // Initialize voice streams
  const initializeVoices = useCallback((selectedVoices: { perspectives: string[]; roles: string[] }) => {
    const initialVoices: VoiceStream[] = [];
    
    // Voice configuration following CodingPhilosophy.md consciousness principles
    const voiceConfigs = {
      // Code Analysis Engines (Perspectives)
      seeker: { name: 'Explorer', icon: '🔍' },
      steward: { name: 'Maintainer', icon: '🛡️' },
      witness: { name: 'Analyzer', icon: '👁️' },
      nurturer: { name: 'Developer', icon: '🌱' },
      decider: { name: 'Implementor', icon: '⚡' },
      
      // Code Specialization Engines (Roles)
      guardian: { name: 'Security Engineer', icon: '🔒' },
      architect: { name: 'Systems Architect', icon: '🏗️' },
      designer: { name: 'UI/UX Engineer', icon: '🎨' },
      optimizer: { name: 'Performance Engineer', icon: '⚡' }
    };

    // Add perspectives
    selectedVoices.perspectives.forEach(perspectiveId => {
      const config = voiceConfigs[perspectiveId] || { name: perspectiveId, icon: '🤖' };
      initialVoices.push({
        id: perspectiveId,
        name: config.name,
        content: '',
        isTyping: false,
        isComplete: false,
        confidence: 0
      });
    });

    // Add roles
    selectedVoices.roles.forEach(roleId => {
      const config = voiceConfigs[roleId] || { name: roleId, icon: '🤖' };
      initialVoices.push({
        id: roleId,
        name: config.name,
        content: '',
        isTyping: false,
        isComplete: false,
        confidence: 0
      });
    });

    setVoices(initialVoices);
    return initialVoices;
  }, []);

  // Start ChatGPT-style streaming generation
  const startStreaming = useCallback(async (
    prompt: string, 
    selectedVoices: { perspectives: string[]; roles: string[] }
  ) => {
    if (!user || !prompt.trim()) return;

    setIsStreaming(true);
    const initializedVoices = initializeVoices(selectedVoices);

    try {
      // Create streaming session
      const response = await fetch('/api/sessions/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          selectedVoices,
          mode: 'streaming'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create streaming session');
      }

      const { sessionId } = await response.json();
      setCurrentSessionId(sessionId);

      // Start streaming for each voice
      initializedVoices.forEach(voice => {
        startVoiceStream(voice.id, sessionId, selectedVoices.perspectives.includes(voice.id) ? 'perspective' : 'role');
      });

    } catch (error) {
      console.error('Failed to start streaming:', error);
      onError?.('Failed to start streaming generation');
      setIsStreaming(false);
    }
  }, [user, initializeVoices, onError]);

  // Start individual voice stream
  const startVoiceStream = useCallback((voiceId: string, sessionId: number, type: 'perspective' | 'role') => {
    // Close existing stream if any
    if (streamRefs.current[voiceId]) {
      streamRefs.current[voiceId].close();
    }

    // Create new EventSource for streaming
    const eventSource = new EventSource(
      `/api/sessions/${sessionId}/stream/${voiceId}?type=${type}`
    );

    streamRefs.current[voiceId] = eventSource;

    // Update voice as typing
    setVoices(prev => prev.map(voice => 
      voice.id === voiceId 
        ? { ...voice, isTyping: true, content: '', isComplete: false }
        : voice
    ));

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Append new content with ChatGPT-style typing effect
          setVoices(prev => prev.map(voice => 
            voice.id === voiceId 
              ? { ...voice, content: voice.content + data.content }
              : voice
          ));
        } else if (data.type === 'complete') {
          // Mark voice as complete
          setVoices(prev => prev.map(voice => 
            voice.id === voiceId 
              ? { 
                  ...voice, 
                  isTyping: false, 
                  isComplete: true, 
                  confidence: data.confidence || 85 
                }
              : voice
          ));

          // Close this stream
          eventSource.close();
          delete streamRefs.current[voiceId];

          // Check if all voices are complete
          setVoices(currentVoices => {
            const allComplete = currentVoices.every(v => v.id === voiceId ? true : v.isComplete);
            if (allComplete) {
              setIsStreaming(false);
              onComplete?.(sessionId);
            }
            return currentVoices;
          });
        } else if (data.type === 'error') {
          setVoices(prev => prev.map(voice => 
            voice.id === voiceId 
              ? { 
                  ...voice, 
                  isTyping: false, 
                  isComplete: true, 
                  error: data.error 
                }
              : voice
          ));
          eventSource.close();
          delete streamRefs.current[voiceId];
        }
      } catch (error) {
        console.error('Failed to parse streaming data:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('Streaming error for voice:', voiceId, error);
      setVoices(prev => prev.map(voice => 
        voice.id === voiceId 
          ? { 
              ...voice, 
              isTyping: false, 
              isComplete: true, 
              error: 'Connection error' 
            }
          : voice
      ));
      eventSource.close();
      delete streamRefs.current[voiceId];
    };
  }, [onComplete]);

  // Stop all streaming
  const stopStreaming = useCallback(() => {
    Object.values(streamRefs.current).forEach(eventSource => {
      eventSource.close();
    });
    streamRefs.current = {};
    setIsStreaming(false);
    setVoices(prev => prev.map(voice => ({ 
      ...voice, 
      isTyping: false, 
      isComplete: true 
    })));
  }, []);

  // Reset state
  const reset = useCallback(() => {
    stopStreaming();
    setVoices([]);
    setCurrentSessionId(null);
  }, [stopStreaming]);

  return {
    voices,
    isStreaming,
    currentSessionId,
    startStreaming,
    stopStreaming,
    reset
  };
}