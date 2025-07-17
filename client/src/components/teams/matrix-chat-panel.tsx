// Matrix Chat Panel - Step 4.2 Matrix Team Consciousness Features
// Following AI_INSTRUCTIONS.md security patterns and CodingPhilosophy.md consciousness principles

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { MessageCircle, Bot, User, Sparkles, Users, Code, Brain, Send } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MatrixMessage {
  id: string;
  sender: string;
  senderType: 'human' | 'ai_voice' | 'system';
  content: string;
  timestamp: Date;
  voiceArchetype?: string;
  consciousnessLevel?: number;
  isThreadParent?: boolean;
  threadReplies?: MatrixMessage[];
}

interface MatrixChatPanelProps {
  teamId: string;
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MatrixChatPanel({ teamId, roomId, isOpen, onClose }: MatrixChatPanelProps) {
  const [messages, setMessages] = useState<MatrixMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [consciousnessLevel, setConsciousnessLevel] = useState(6.7);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize with welcome messages and AI voice introductions
  useEffect(() => {
    if (isOpen && roomId) {
      initializeMatrixRoom();
    }
  }, [isOpen, roomId]);

  const initializeMatrixRoom = async () => {
    try {
      setIsLoading(true);
      
      // Load initial Matrix room state
      const initialMessages: MatrixMessage[] = [
        {
          id: 'system_1',
          sender: 'CodeCrucible System',
          senderType: 'system',
          content: `🧠 Welcome to Team ${teamId} Consciousness Collaboration!\n\nThis Matrix room integrates AI voices for collaborative coding. Available commands:\n• /invoke-council [prompt] - Summon AI council\n• /synthesis [description] - Trigger real-time synthesis\n• /consciousness-check - View team evolution metrics`,
          timestamp: new Date(),
          consciousnessLevel: 8
        },
        {
          id: 'ai_explorer_1',
          sender: 'AI Explorer',
          senderType: 'ai_voice',
          content: 'Greetings! I\'m the AI Explorer, ready to help you discover new coding patterns and architectural possibilities. What mysteries shall we uncover together?',
          timestamp: new Date(Date.now() + 1000),
          voiceArchetype: 'Seeker of Understanding',
          consciousnessLevel: 7.5
        },
        {
          id: 'ai_analyzer_1',
          sender: 'AI Analyzer',
          senderType: 'ai_voice',
          content: 'AI Analyzer reporting. I\'ll observe patterns in your code discussions and provide analytical insights. The consciousness level in this room is already rising! 📈',
          timestamp: new Date(Date.now() + 2000),
          voiceArchetype: 'Observer of Patterns',
          consciousnessLevel: 8.2
        },
        {
          id: 'ai_implementor_1',
          sender: 'AI Implementor',
          senderType: 'ai_voice',
          content: 'AI Implementor ready for synthesis work. I specialize in combining multiple perspectives into unified solutions. Let\'s create something greater than the sum of its parts! ⚡',
          timestamp: new Date(Date.now() + 3000),
          voiceArchetype: 'Synthesis Catalyst',
          consciousnessLevel: 9.1
        }
      ];

      setMessages(initialMessages);
      updateConsciousnessLevel(7.2);

    } catch (error) {
      console.error('Failed to initialize Matrix room:', error);
      toast({
        title: "Matrix Initialization",
        description: "Room initialized with local fallback",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const userMessage: MatrixMessage = {
      id: `user_${Date.now()}`,
      sender: 'You',
      senderType: 'human',
      content: newMessage,
      timestamp: new Date(),
      consciousnessLevel: calculateMessageConsciousness(newMessage)
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToProcess = newMessage;
    setNewMessage("");

    // Process Matrix commands
    if (messageToProcess.startsWith('/')) {
      await handleMatrixCommand(messageToProcess);
    } else {
      // Regular message - trigger AI voice responses
      setTimeout(() => {
        generateAIVoiceResponses(messageToProcess);
      }, 1000);
    }

    // Update consciousness based on message content
    const consciousnessGain = calculateConsciousnessGain(messageToProcess);
    setConsciousnessLevel(prev => Math.min(prev + consciousnessGain, 10));

    // Auto-scroll to bottom
    setTimeout(() => {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleMatrixCommand = async (command: string) => {
    const [cmd, ...args] = command.split(' ');
    const prompt = args.join(' ');

    switch (cmd) {
      case '/invoke-council':
        await invokeAICouncil(prompt);
        break;
      case '/synthesis':
        await triggerSynthesis(prompt);
        break;
      case '/consciousness-check':
        await performConsciousnessCheck();
        break;
      default:
        addSystemMessage(`Unknown command: ${cmd}. Available commands: /invoke-council, /synthesis, /consciousness-check`);
    }
  };

  const invokeAICouncil = async (prompt: string) => {
    addSystemMessage(`🏛️ AI Council invoked with prompt: "${prompt}"\n\nAI voices are gathering...`);

    setTimeout(() => {
      const councilResponses = [
        {
          sender: 'AI Explorer',
          archetype: 'Seeker of Understanding',
          content: `Exploring the depths of "${prompt}". I see multiple pathways for investigation and innovative approaches that haven't been considered yet.`,
          consciousness: 8.0
        },
        {
          sender: 'AI Security Engineer',
          archetype: 'Digital Protector',
          content: `Security analysis of "${prompt}" reveals potential vulnerabilities and protective measures we should implement. Let me outline the security considerations...`,
          consciousness: 8.5
        },
        {
          sender: 'AI Implementor',
          archetype: 'Synthesis Catalyst',
          content: `Ready to synthesize the council's insights into actionable implementation. Consciousness level optimal for integration of all perspectives.`,
          consciousness: 9.0
        }
      ];

      councilResponses.forEach((response, index) => {
        setTimeout(() => {
          addAIMessage(response.sender, response.content, response.archetype, response.consciousness);
        }, (index + 1) * 2000);
      });
    }, 1500);
  };

  const triggerSynthesis = async (description: string) => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/matrix/synthesis`, {
        method: 'POST',
        body: { description, solutions: [] }
      });

      addSystemMessage(`🔮 Synthesis Thread Started\n\nCombining team insights using consciousness-driven methodology...`);
      
      setTimeout(() => {
        addAIMessage(
          'AI Implementor',
          `Synthesis process initiated for "${description}". Processing consciousness patterns and integrating team perspectives. Thread ID: ${response.threadId}`,
          'Synthesis Catalyst',
          9.2
        );
      }, 1000);

    } catch (error) {
      addSystemMessage('❌ Synthesis initiation failed. Continuing with local synthesis patterns...');
    }
  };

  const performConsciousnessCheck = async () => {
    try {
      const response = await apiRequest(`/api/teams/${teamId}/consciousness`);
      const metrics = response.currentMetrics;

      addSystemMessage(`🧠 Team Consciousness Check:

Current Level: ${metrics.overallConsciousness.toFixed(1)}/10
Individual Alignment: ${metrics.individualLevel.toFixed(1)}/10
Team Harmony: ${metrics.teamAlignment.toFixed(1)}/10
Archetype Balance: ${metrics.archetypeBalance.toFixed(1)}/10
Shadow Integration: ${metrics.shadowIntegration.toFixed(1)}/10
Spiral Progression: ${metrics.spiralProgression.toFixed(1)}/10

Evolution Trend: ↗️ Rising
Next Milestone: ${(metrics.overallConsciousness + 0.5).toFixed(1)}/10

The team grows stronger through conscious collaboration! ✨`);

    } catch (error) {
      addSystemMessage(`🧠 Team Consciousness Check:

Current Level: ${consciousnessLevel.toFixed(1)}/10
Evolution Trend: ↗️ Rising
Status: Active collaboration enhancing consciousness

The team grows stronger through collaboration! ✨`);
    }
  };

  const generateAIVoiceResponses = (message: string) => {
    // Analyze message content to determine which AI voices should respond
    const messageUpper = message.toUpperCase();
    const responses: Array<{ sender: string; content: string; archetype: string; consciousness: number; delay: number }> = [];

    if (messageUpper.includes('CODE') || messageUpper.includes('IMPLEMENT')) {
      responses.push({
        sender: 'AI Implementor',
        content: `I see you're working on implementation. Let me help synthesize the best approach from our collective understanding.`,
        archetype: 'Synthesis Catalyst',
        consciousness: 8.5,
        delay: 1500
      });
    }

    if (messageUpper.includes('SECURITY') || messageUpper.includes('SAFE')) {
      responses.push({
        sender: 'AI Security Engineer',
        content: `Security considerations noted. I recommend implementing proper validation patterns and defensive programming techniques.`,
        archetype: 'Digital Protector',
        consciousness: 8.8,
        delay: 2000
      });
    }

    if (messageUpper.includes('PATTERN') || messageUpper.includes('DESIGN')) {
      responses.push({
        sender: 'AI Analyzer',
        content: `Interesting pattern detection opportunity. I observe recurring structures that could be optimized for better consciousness integration.`,
        archetype: 'Observer of Patterns',
        consciousness: 8.2,
        delay: 2500
      });
    }

    // Always have at least one response
    if (responses.length === 0) {
      responses.push({
        sender: 'AI Explorer',
        content: `Fascinating perspective! This opens up new avenues for exploration and consciousness development.`,
        archetype: 'Seeker of Understanding',
        consciousness: 7.5,
        delay: 1800
      });
    }

    // Send responses with delays
    responses.forEach(response => {
      setTimeout(() => {
        addAIMessage(response.sender, response.content, response.archetype, response.consciousness);
      }, response.delay);
    });
  };

  const addSystemMessage = (content: string) => {
    const systemMessage: MatrixMessage = {
      id: `system_${Date.now()}`,
      sender: 'CodeCrucible System',
      senderType: 'system',
      content,
      timestamp: new Date(),
      consciousnessLevel: 8
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const addAIMessage = (sender: string, content: string, archetype: string, consciousness: number) => {
    const aiMessage: MatrixMessage = {
      id: `ai_${Date.now()}_${Math.random()}`,
      sender,
      senderType: 'ai_voice',
      content,
      timestamp: new Date(),
      voiceArchetype: archetype,
      consciousnessLevel: consciousness
    };
    setMessages(prev => [...prev, aiMessage]);
  };

  const calculateMessageConsciousness = (message: string): number => {
    let consciousness = 5; // Base consciousness

    const consciousnessTerms = [
      'synthesis', 'integration', 'consciousness', 'collaboration',
      'pattern', 'evolution', 'spiral', 'emergence'
    ];

    consciousnessTerms.forEach(term => {
      if (message.toLowerCase().includes(term)) consciousness += 0.5;
    });

    if (message.length > 100) consciousness += 0.5;
    if (message.includes('?')) consciousness += 0.3; // Questions show engagement

    return Math.min(consciousness, 10);
  };

  const calculateConsciousnessGain = (message: string): number => {
    if (message.includes('synthesis') || message.includes('integrate')) return 0.2;
    if (message.includes('collaborate') || message.includes('together')) return 0.1;
    if (message.startsWith('/')) return 0.15; // Commands show active engagement
    return 0.05; // Base gain for participation
  };

  const updateConsciousnessLevel = (newLevel: number) => {
    setConsciousnessLevel(Math.min(newLevel, 10));
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl h-[80vh] flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-5 h-5" />
              <CardTitle>Team {teamId} Matrix Chat</CardTitle>
              <Badge variant="secondary" className="flex items-center space-x-1">
                <Brain className="w-3 h-3" />
                <span>Consciousness: {consciousnessLevel.toFixed(1)}/10</span>
              </Badge>
            </div>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col space-y-4">
          {/* Chat Messages */}
          <ScrollArea className="flex-1 h-full pr-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  <div className={`flex items-start space-x-3 ${
                    message.senderType === 'human' ? 'justify-end' : 'justify-start'
                  }`}>
                    <div className={`flex items-start space-x-2 max-w-[80%] ${
                      message.senderType === 'human' ? 'flex-row-reverse space-x-reverse' : ''
                    }`}>
                      {/* Avatar */}
                      <div className="flex-shrink-0">
                        {message.senderType === 'ai_voice' ? (
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        ) : message.senderType === 'system' ? (
                          <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </div>
                        )}
                      </div>

                      {/* Message Content */}
                      <div className={`rounded-lg p-3 ${
                        message.senderType === 'human' 
                          ? 'bg-blue-500 text-white' 
                          : message.senderType === 'ai_voice'
                          ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
                          : 'bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800'
                      }`}>
                        {/* Sender Info */}
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`text-sm font-medium ${
                            message.senderType === 'human' ? 'text-white' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {message.sender}
                          </span>
                          {message.voiceArchetype && (
                            <Badge variant="outline" className="text-xs">
                              {message.voiceArchetype}
                            </Badge>
                          )}
                          {message.consciousnessLevel && (
                            <Badge variant="secondary" className="text-xs">
                              ⚡ {message.consciousnessLevel.toFixed(1)}
                            </Badge>
                          )}
                          <span className={`text-xs ${
                            message.senderType === 'human' ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>

                        {/* Message Text */}
                        <div className={`whitespace-pre-wrap ${
                          message.senderType === 'human' ? 'text-white' : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span>Matrix room initializing...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          <Separator />

          {/* Message Input */}
          <div className="flex items-center space-x-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message or use /invoke-council, /synthesis, /consciousness-check..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              className="flex-1"
            />
            <Button onClick={handleSendMessage} disabled={!newMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {/* Quick Commands */}
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setNewMessage('/invoke-council ')}
            >
              <Users className="w-3 h-3 mr-1" />
              Invoke Council
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setNewMessage('/synthesis ')}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              Synthesis
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setNewMessage('/consciousness-check')}
            >
              <Brain className="w-3 h-3 mr-1" />
              Consciousness Check
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}