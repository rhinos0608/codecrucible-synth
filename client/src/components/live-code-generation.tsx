import { useState, useEffect, useRef } from 'react';
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Pause, RotateCcw, CheckCircle, Code2, Brain } from "lucide-react";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

interface LiveCodeGenerationProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  selectedVoices: {
    perspectives: string[];
    roles: string[];
  };
  onComplete: (sessionId: number) => void;
}

interface VoiceStream {
  id: string;
  name: string;
  color: string;
  type: 'perspective' | 'role';
  content: string;
  isTyping: boolean;
  isComplete: boolean;
  confidence: number;
}

// Following CodingPhilosophy.md: Voice color mapping for consciousness visualization
const getVoiceConfig = (voiceId: string, type: 'perspective' | 'role') => {
  const configs = {
    // Code Analysis Engines (Perspectives) - following rebranding
    seeker: { name: 'Explorer', color: 'from-blue-500 to-cyan-500', icon: '🔍' },
    steward: { name: 'Maintainer', color: 'from-green-500 to-emerald-500', icon: '🛡️' },
    witness: { name: 'Analyzer', color: 'from-purple-500 to-violet-500', icon: '👁️' },
    nurturer: { name: 'Developer', color: 'from-pink-500 to-rose-500', icon: '🌱' },
    decider: { name: 'Implementor', color: 'from-orange-500 to-amber-500', icon: '⚡' },
    
    // Code Specialization Engines (Roles) - following rebranding
    guardian: { name: 'Security Engineer', color: 'from-red-500 to-rose-500', icon: '🔒' },
    architect: { name: 'Systems Architect', color: 'from-indigo-500 to-blue-500', icon: '🏗️' },
    designer: { name: 'UI/UX Engineer', color: 'from-teal-500 to-cyan-500', icon: '🎨' },
    optimizer: { name: 'Performance Engineer', color: 'from-yellow-500 to-orange-500', icon: '⚡' }
  };
  
  return configs[voiceId] || { name: voiceId, color: 'from-gray-500 to-slate-500', icon: '🤖' };
};

export function LiveCodeGeneration({ isOpen, onClose, prompt, selectedVoices, onComplete }: LiveCodeGenerationProps) {
  const [voices, setVoices] = useState<VoiceStream[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const streamRefs = useRef<{ [key: string]: EventSource }>({});
  const contentRefs = useRef<{ [key: string]: HTMLDivElement }>({});

  // Initialize voices when modal opens
  useEffect(() => {
    if (isOpen && (selectedVoices.perspectives.length > 0 || selectedVoices.roles.length > 0)) {
      const initialVoices: VoiceStream[] = [];
      
      // Add perspectives
      selectedVoices.perspectives.forEach(perspectiveId => {
        const config = getVoiceConfig(perspectiveId, 'perspective');
        initialVoices.push({
          id: perspectiveId,
          name: config.name,
          color: config.color,
          type: 'perspective',
          content: '',
          isTyping: false,
          isComplete: false,
          confidence: 0
        });
      });
      
      // Add roles
      selectedVoices.roles.forEach(roleId => {
        const config = getVoiceConfig(roleId, 'role');
        initialVoices.push({
          id: roleId,
          name: config.name,
          color: config.color,
          type: 'role',
          content: '',
          isTyping: false,
          isComplete: false,
          confidence: 0
        });
      });
      
      setVoices(initialVoices);
    }
  }, [isOpen, selectedVoices]);

  // Following AI_INSTRUCTIONS.md: Secure streaming generation with authentication
  const startGeneration = async () => {
    if (!prompt.trim() || voices.length === 0) return;
    
    setIsGenerating(true);
    
    try {
      // Create session and start streaming generation
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
        throw new Error('Failed to start generation');
      }
      
      const { sessionId } = await response.json();
      setCurrentSessionId(sessionId);
      
      // Start streaming for each voice
      voices.forEach(voice => {
        startVoiceStream(voice.id, sessionId, voice.type);
      });
      
    } catch (error) {
      console.error('Failed to start generation:', error);
      setIsGenerating(false);
    }
  };

  // Following CodingPhilosophy.md: Real-time consciousness streaming
  const startVoiceStream = (voiceId: string, sessionId: number, type: 'perspective' | 'role') => {
    const eventSource = new EventSource(
      `/api/sessions/${sessionId}/stream/${voiceId}?type=${type}`
    );
    
    streamRefs.current[voiceId] = eventSource;
    
    // Update voice as typing started
    setVoices(prev => prev.map(v => 
      v.id === voiceId ? { ...v, isTyping: true } : v
    ));
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Append new content chunk
          setVoices(prev => prev.map(v => 
            v.id === voiceId 
              ? { ...v, content: v.content + data.content }
              : v
          ));
          
          // Auto-scroll to bottom
          if (contentRefs.current[voiceId]) {
            contentRefs.current[voiceId].scrollTop = contentRefs.current[voiceId].scrollHeight;
          }
        } else if (data.type === 'complete') {
          // Voice completed generation
          setVoices(prev => prev.map(v => 
            v.id === voiceId 
              ? { 
                  ...v, 
                  isTyping: false, 
                  isComplete: true,
                  confidence: data.confidence || 85
                }
              : v
          ));
          
          eventSource.close();
          delete streamRefs.current[voiceId];
          
          // Check if all voices are complete
          setVoices(prev => {
            const allComplete = prev.every(voice => 
              voice.id === voiceId ? true : voice.isComplete
            );
            
            if (allComplete) {
              setIsGenerating(false);
              setTimeout(() => {
                if (sessionId) {
                  onComplete(sessionId);
                  onClose();
                }
              }, 1500); // Brief pause to show completion
            }
            
            return prev;
          });
        } else if (data.type === 'error') {
          console.error(`Voice ${voiceId} error:`, data.error);
          setVoices(prev => prev.map(v => 
            v.id === voiceId 
              ? { ...v, isTyping: false, content: v.content + '\n\n[Generation error occurred]' }
              : v
          ));
          eventSource.close();
          delete streamRefs.current[voiceId];
        }
      } catch (parseError) {
        console.error(`Failed to parse streaming data for voice ${voiceId}:`, parseError, 'Raw data:', event.data);
        setVoices(prev => prev.map(v => 
          v.id === voiceId 
            ? { ...v, isTyping: false, content: v.content + '\n\n[JSON parsing error occurred]' }
            : v
        ));
        eventSource.close();
        delete streamRefs.current[voiceId];
      }
    };
    
    eventSource.onerror = (error) => {
      console.error(`Stream error for voice ${voiceId}:`, error);
      
      // Update voice to show error state
      setVoices(prev => prev.map(v => 
        v.id === voiceId 
          ? { ...v, isTyping: false, content: v.content + '\n\n[Stream connection error]' }
          : v
      ));
      
      try {
        eventSource.close();
      } catch (closeError) {
        console.warn(`Failed to close EventSource for voice ${voiceId}:`, closeError);
      }
      
      delete streamRefs.current[voiceId];
      
      // Check if this was the last active voice and stop generation if needed
      const remainingStreams = Object.keys(streamRefs.current).length;
      if (remainingStreams === 0) {
        setIsGenerating(false);
      }
    };
  };

  // Cleanup streams on unmount
  useEffect(() => {
    return () => {
      Object.values(streamRefs.current).forEach(stream => {
        stream.close();
      });
    };
  }, []);

  // Following AI_INSTRUCTIONS.md: Secure modal cleanup
  const handleClose = () => {
    Object.values(streamRefs.current).forEach(stream => {
      stream.close();
    });
    setIsGenerating(false);
    setVoices([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-7xl h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <Brain className="w-8 h-8 text-blue-400" />
                Voice Council Live Generation
              </h2>
              <p className="text-gray-400 mt-1">
                {voices.length} AI voices generating solutions in real-time
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!isGenerating && voices.every(v => !v.isComplete) && (
                <Button 
                  onClick={startGeneration}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Generation
                </Button>
              )}
              <Button 
                variant="ghost" 
                onClick={handleClose}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </Button>
            </div>
          </div>
        </div>

        {/* Prompt Display */}
        <div className="p-4 bg-gray-800/50 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-1">Request:</div>
          <div className="text-gray-200 font-mono text-sm bg-gray-800 p-3 rounded-lg">
            {prompt}
          </div>
        </div>

        {/* Voice Streams Grid */}
        <div className="p-6 overflow-auto h-full">
          <div className={`grid gap-6 h-full ${voices.length <= 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-2'}`}>
            {voices.map(voice => {
              const config = getVoiceConfig(voice.id, voice.type);
              return (
                <Card key={voice.id} className="bg-gray-800 border-gray-700 flex flex-col h-full">
                  {/* Voice Header */}
                  <div className={`p-4 bg-gradient-to-r ${voice.color} rounded-t-lg`}>
                    <div className="flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <div>
                          <h3 className="font-semibold">{voice.name}</h3>
                          <p className="text-xs opacity-90">
                            {voice.type === 'perspective' ? 'Analysis Engine' : 'Specialization Engine'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {voice.isTyping && <Loader2 className="w-4 h-4 animate-spin" />}
                        {voice.isComplete && <CheckCircle className="w-4 h-4" />}
                        {voice.isComplete && (
                          <Badge variant="secondary" className="bg-white/20 text-white">
                            {voice.confidence}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Code Stream */}
                  <div className="flex-1 p-4">
                    <div 
                      ref={el => { if (el) contentRefs.current[voice.id] = el; }}
                      className="h-full bg-gray-900 rounded-lg p-4 overflow-auto font-mono text-sm text-gray-100"
                      style={{ minHeight: '300px' }}
                    >
                      {voice.content ? (
                        <pre className="whitespace-pre-wrap break-words">
                          {voice.content}
                        </pre>
                      ) : voice.isTyping ? (
                        <div className="flex items-center text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          {voice.name} is analyzing and generating code...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                          <div className="text-center">
                            <Code2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>Waiting to start generation...</p>
                          </div>
                        </div>
                      )}
                      
                      {/* Typing cursor */}
                      {voice.isTyping && (
                        <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}