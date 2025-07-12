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

  // Start individual voice stream with enhanced error handling
  const startVoiceStream = useCallback((voiceId: string, sessionId: number, type: 'perspective' | 'role') => {
    // Close existing stream if any
    if (streamRefs.current[voiceId]) {
      streamRefs.current[voiceId].close();
      delete streamRefs.current[voiceId];
    }

    console.log(`Starting voice stream for ${voiceId} (${type}) on session ${sessionId}`);

    // Create new EventSource for streaming with proper error handling
    // Note: EventSource doesn't support withCredentials in all browsers, cookies are sent automatically
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
        console.log(`Received ${data.type} from ${voiceId}:`, data.content?.substring(0, 30) || data.message || '(no content)');
        
        if (data.type === 'connected') {
          console.log(`Voice ${voiceId} connected successfully`);
          setVoices(prev => prev.map(voice => 
            voice.id === voiceId 
              ? { ...voice, isTyping: true, content: '', isComplete: false }
              : voice
          ));
        } else if (data.type === 'error') {
          console.error(`Voice ${voiceId} streaming error:`, data.error);
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
        } else if (data.type === 'chunk') {
          // Append new content with ChatGPT-style typing effect
          setVoices(prev => prev.map(voice => 
            voice.id === voiceId 
              ? { ...voice, content: voice.content + data.content }
              : voice
          ));
        } else if (data.type === 'complete') {
          console.log(`Voice ${voiceId} completed generation`);
          
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
            const updatedVoices = currentVoices.map(v => 
              v.id === voiceId ? { ...v, isTyping: false, isComplete: true } : v
            );
            const allComplete = updatedVoices.every(v => v.isComplete);
            
            if (allComplete) {
              console.log('All voices completed - streaming finished');
              setIsStreaming(false);
              onComplete?.(sessionId);
            }
            return updatedVoices;
          });
        } else if (data.type === 'error') {
          console.error(`Voice ${voiceId} encountered error:`, data.error);
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
        console.error('Failed to parse streaming data for', voiceId, ':', error);
        // Handle malformed data by closing the stream
        eventSource.close();
        delete streamRefs.current[voiceId];
        setVoices(prev => prev.map(voice => 
          voice.id === voiceId 
            ? { 
                ...voice, 
                isTyping: false, 
                isComplete: true, 
                error: 'Data parsing failed' 
              }
            : voice
        ));
      }
    };

    eventSource.onerror = (error) => {
      console.error('EventSource error for voice:', voiceId, {
        error,
        readyState: eventSource.readyState,
        url: eventSource.url
      });
      
      // Detailed error handling for different states
      let errorMessage = 'Connection failed';
      if (eventSource.readyState === EventSource.CONNECTING) {
        errorMessage = 'Connection in progress...';
        console.log('EventSource still connecting for', voiceId);
        return; // Don't close if still connecting
      } else if (eventSource.readyState === EventSource.CLOSED) {
        errorMessage = 'Connection closed - authentication issue';
        console.error('EventSource closed for', voiceId, '- likely 401 Unauthorized');
      }
      
      setVoices(prev => prev.map(voice => 
        voice.id === voiceId 
          ? { 
              ...voice, 
              isTyping: false, 
              isComplete: true, 
              error: errorMessage
            }
          : voice
      ));
      
      if (eventSource.readyState === EventSource.CLOSED) {
        delete streamRefs.current[voiceId];
      }
    };

    eventSource.onopen = () => {
      console.log(`EventSource opened successfully for voice ${voiceId}`);
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