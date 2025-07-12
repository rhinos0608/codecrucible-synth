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

  // Start ChatGPT-style streaming generation - Fixed implementation
  const startStreaming = useCallback(async (
    prompt: string, 
    selectedVoices: { perspectives: string[]; roles: string[] }
  ) => {
    if (!user || !prompt.trim() || isStreaming) return;

    console.log('🚀 Starting live streaming generation:', {
      prompt: prompt.substring(0, 50) + '...',
      perspectives: selectedVoices.perspectives,
      roles: selectedVoices.roles,
      voiceCount: selectedVoices.perspectives.length + selectedVoices.roles.length
    });

    setIsStreaming(true);
    const initializedVoices = initializeVoices(selectedVoices);
    const sessionId = Date.now();
    setCurrentSessionId(sessionId);

    try {
      // Connect to the streaming endpoint using EventSource directly
      const eventSource = new EventSource(`/api/sessions/stream`, {
        withCredentials: true
      });

      // Send the streaming request via POST to trigger generation
      fetch('/api/sessions/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt,
          selectedVoices,
          sessionId
        })
      }).catch(error => {
        console.error('Failed to initiate streaming:', error);
        onError?.('Failed to start streaming');
        setIsStreaming(false);
      });

      // Handle streaming messages
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 Streaming data received:', data.type, data.voiceId);
          
          if (data.type === 'voice_content') {
            // Update specific voice content
            setVoices(prev => prev.map(voice => 
              voice.id === data.voiceId 
                ? { 
                    ...voice, 
                    content: voice.content + (data.content || ''),
                    isTyping: true,
                    isComplete: false
                  }
                : voice
            ));
          } else if (data.type === 'voice_complete') {
            // Mark voice as complete
            setVoices(prev => prev.map(voice => 
              voice.id === data.voiceId 
                ? { 
                    ...voice, 
                    isTyping: false,
                    isComplete: true,
                    confidence: data.confidence || 85
                  }
                : voice
            ));
          } else if (data.type === 'session_complete') {
            // All voices completed
            console.log('✅ All voices completed streaming');
            setIsStreaming(false);
            onComplete?.(sessionId);
            eventSource.close();
          }
        } catch (parseError) {
          console.error('Failed to parse streaming data:', parseError);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Streaming connection error:', error);
        setIsStreaming(false);
        onError?.('Streaming connection failed');
        eventSource.close();
      };

      eventSource.onopen = () => {
        console.log('✅ Streaming connection opened successfully');
      };

      // Store eventSource for cleanup
      streamRefs.current['main'] = eventSource;

    } catch (error) {
      console.error('❌ Failed to start streaming:', error);
      onError?.('Failed to start streaming generation');
      setIsStreaming(false);
    }
  }, [user, onError, isStreaming, initializeVoices, onComplete]);

  // Enhanced stop streaming method
  const stopStreaming = useCallback(() => {
    console.log('🛑 Stopping all streaming connections');
    
    // Close all active streams
    Object.values(streamRefs.current).forEach(stream => {
      if (stream && typeof stream.close === 'function') {
        stream.close();
      }
    });
    
    streamRefs.current = {};
    setIsStreaming(false);
    setVoices(prev => prev.map(voice => ({ 
      ...voice, 
      isTyping: false,
      isComplete: voice.content.length > 0 
    })));
  }, []);

  // Reset all voices and clear session
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