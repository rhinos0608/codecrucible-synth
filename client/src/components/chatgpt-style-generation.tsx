// ChatGPT-style live generation component following CodingPhilosophy.md consciousness principles
import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Code2, Loader2, CheckCircle, AlertTriangle, Brain, Zap } from "lucide-react";
import { useStreamingGeneration } from "@/hooks/useStreamingGeneration";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatGPTStyleGenerationProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: string;
  selectedVoices: {
    perspectives: string[];
    roles: string[];
  };
  onComplete: (sessionId: number) => void;
}

export function ChatGPTStyleGeneration({ 
  isOpen, 
  onClose, 
  prompt, 
  selectedVoices, 
  onComplete 
}: ChatGPTStyleGenerationProps) {
  const { 
    voices, 
    isStreaming, 
    currentSessionId,
    startStreaming, 
    stopStreaming, 
    reset 
  } = useStreamingGeneration({
    onComplete: (sessionId) => {
      onComplete(sessionId);
      onClose();
    },
    onError: (error) => {
      console.error('Streaming generation error:', error);
    }
  });

  // Navigation guard for active streaming - Following AI_INSTRUCTIONS.md patterns
  useNavigationGuard({
    shouldBlock: isStreaming,
    message: 'Live streaming generation is active. Are you sure you want to stop? All progress will be lost.',
    onBlock: () => {
      console.log('Navigation blocked during streaming generation');
    },
    onConfirm: () => {
      stopStreaming();
      reset();
    }
  });

  // Start streaming when modal opens - Fixed infinite re-render following AI_INSTRUCTIONS.md patterns
  useEffect(() => {
    if (isOpen && prompt && (selectedVoices.perspectives.length > 0 || selectedVoices.roles.length > 0)) {
      startStreaming(prompt, selectedVoices);
    }
    
    return () => {
      if (!isOpen) {
        reset();
      }
    };
  }, [isOpen, prompt, selectedVoices.perspectives.join(','), selectedVoices.roles.join(',')]);

  // Voice color mapping following CodingPhilosophy.md consciousness visualization
  // Voice color mapping following CodingPhilosophy.md consciousness visualization
  const getVoiceColor = (voiceId: string) => {
    const colors = {
      // Code Analysis Engines (Perspectives) - Cool colors for analytical thinking
      seeker: 'from-blue-500 to-cyan-400',      // Explorer - Blue for discovery
      steward: 'from-green-500 to-emerald-400', // Maintainer - Green for stability  
      witness: 'from-purple-500 to-violet-400', // Analyzer - Purple for deep analysis
      nurturer: 'from-pink-500 to-rose-400',    // Developer - Pink for nurturing
      decider: 'from-orange-500 to-amber-400',  // Implementor - Orange for action
      
      // Code Specialization Engines (Roles) - Warm colors for specialized action
      guardian: 'from-red-500 to-rose-400',     // Security Engineer - Red for protection
      architect: 'from-indigo-600 to-blue-400', // Systems Architect - Indigo for structure
      designer: 'from-teal-500 to-cyan-400',    // UI/UX Engineer - Teal for creativity
      optimizer: 'from-yellow-500 to-orange-400' // Performance Engineer - Yellow for speed
    };
    return colors[voiceId] || 'from-gray-500 to-slate-400';
  };

  // Enhanced typing speed simulation per voice personality
  const getTypingSpeed = (voiceId: string) => {
    const speeds = {
      // Perspectives - Different analytical speeds
      seeker: 80,    // Explorer - Fast, experimental
      steward: 60,   // Maintainer - Steady, careful
      witness: 40,   // Analyzer - Slow, thorough
      nurturer: 70,  // Developer - Moderate, thoughtful
      decider: 90,   // Implementor - Very fast, decisive
      
      // Roles - Specialized working speeds
      guardian: 50,  // Security Engineer - Methodical
      architect: 45, // Systems Architect - Deliberate
      designer: 85,  // UI/UX Engineer - Creative bursts
      optimizer: 95  // Performance Engineer - Rapid optimization
    };
    return speeds[voiceId] || 65;
  };

  const getVoiceIcon = (voiceId: string) => {
    const icons = {
      seeker: '🔍', steward: '🛡️', witness: '👁️', 
      nurturer: '🌱', decider: '⚡', guardian: '🔒',
      architect: '🏗️', designer: '🎨', optimizer: '⚡'
    };
    return icons[voiceId] || '🤖';
  };

  const completedVoices = voices.filter(v => v.isComplete).length;
  const totalVoices = voices.length;
  const progress = totalVoices > 0 ? (completedVoices / totalVoices) * 100 : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-gray-100">
            <Brain className="w-6 h-6 text-purple-400" />
            Live Council Generation
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              ChatGPT Style
            </Badge>
          </DialogTitle>
          
          {/* Progress indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm text-gray-400">
              <span>
                {isStreaming ? 'Generating...' : 'Complete'} 
                ({completedVoices}/{totalVoices} voices)
              </span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="bg-gray-800" />
          </div>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {voices.map((voice) => (
              <Card key={voice.id} className="bg-gray-800 border-gray-600 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${getVoiceColor(voice.id)} flex items-center justify-center text-white text-sm font-semibold`}>
                      {getVoiceIcon(voice.id)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-100">{voice.name}</h3>
                      <p className="text-xs text-gray-400 capitalize">{voice.id}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {voice.isTyping && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Typing...
                      </Badge>
                    )}
                    {voice.isComplete && !voice.error && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Complete
                      </Badge>
                    )}
                    {voice.error && (
                      <Badge variant="destructive" className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Error
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Real-time content display with enhanced visual effects */}
                <div className="space-y-3">
                  {voice.content ? (
                    <div className="relative">
                      {/* Voice-specific header with streaming indicator */}
                      {voice.isTyping && (
                        <div className={`absolute -top-2 -right-2 w-3 h-3 rounded-full bg-gradient-to-r ${getVoiceColor(voice.id)} animate-pulse`} />
                      )}
                      
                      {/* Code content with syntax highlighting */}
                      <div className="bg-gray-900 rounded-lg p-3 relative border border-gray-700">
                        <SyntaxHighlighter
                          language="typescript"
                          style={oneDark}
                          className="!bg-transparent !text-sm"
                          customStyle={{ 
                            margin: 0, 
                            padding: 0,
                            background: 'transparent',
                            fontSize: '13px',
                            lineHeight: '1.4'
                          }}
                        >
                          {voice.content}
                        </SyntaxHighlighter>
                        
                        {/* Enhanced typing cursor with voice-specific color */}
                        {voice.isTyping && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className={`inline-block w-2 h-4 bg-gradient-to-r ${getVoiceColor(voice.id)} animate-pulse`} />
                            <span className="text-xs text-gray-400">
                              {voice.name} is thinking...
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Council dialogue bubble - Following CodingPhilosophy.md */}
                      {voice.isTyping && (
                        <div className={`mt-2 p-2 rounded-lg bg-gradient-to-r ${getVoiceColor(voice.id)} bg-opacity-10 border border-gray-600`}>
                          <div className="text-xs text-gray-300">
                            <span className="font-semibold">{voice.name}:</span>
                            <span className="ml-2 italic">
                              {voice.id === 'seeker' && "Exploring innovative approaches..."}
                              {voice.id === 'steward' && "Ensuring code maintainability..."}
                              {voice.id === 'witness' && "Analyzing architecture deeply..."}
                              {voice.id === 'nurturer' && "Focusing on user experience..."}
                              {voice.id === 'decider' && "Making implementation decisions..."}
                              {voice.id === 'guardian' && "Adding security measures..."}
                              {voice.id === 'architect' && "Structuring system design..."}
                              {voice.id === 'designer' && "Crafting beautiful interfaces..."}
                              {voice.id === 'optimizer' && "Optimizing for performance..."}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center text-gray-500 border border-gray-700">
                      {voice.isTyping ? (
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full bg-gradient-to-r ${getVoiceColor(voice.id)} animate-pulse`} />
                          <span>Connecting to {voice.name}...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Code2 className="w-4 h-4" />
                          <span>Ready to stream...</span>
                        </div>
                      )}
                    </div>
                  )}

                  {voice.isComplete && voice.confidence > 0 && (
                    <div className="flex justify-between items-center text-xs text-gray-400">
                      <span>Confidence: {voice.confidence}%</span>
                      <span>{voice.content.length} characters</span>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="flex justify-between items-center pt-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {isStreaming ? 'AI voices are collaborating in real-time...' : 'Generation complete!'}
          </div>
          
          <div className="flex gap-3">
            {isStreaming && (
              <Button variant="outline" onClick={stopStreaming} className="border-gray-600">
                <Zap className="w-4 h-4 mr-2" />
                Stop Generation
              </Button>
            )}
            
            <Button onClick={onClose} className="bg-purple-600 hover:bg-purple-700">
              {isStreaming ? 'Continue in Background' : 'View Solutions'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}