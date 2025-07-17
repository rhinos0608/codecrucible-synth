import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Users, UserPlus, Settings, Share2, Crown, MessageSquare, Brain, Sparkles, Video, Play, Send, Bot, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface TeamsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MatrixMessage {
  id: string;
  sender: string;
  senderType: 'human' | 'ai_voice' | 'system';
  content: string;
  timestamp: Date;
  voiceArchetype?: string;
  consciousnessLevel?: number;
}

export function TeamsPanel({ isOpen, onClose }: TeamsPanelProps) {
  const [activeTab, setActiveTab] = useState("sessions");
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [activeTeamId, setActiveTeamId] = useState<string>("team_123");
  const [messages, setMessages] = useState<MatrixMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [consciousnessLevel, setConsciousnessLevel] = useState(6.7);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  console.log("👥 TeamsPanel render:", { isOpen, activeTab });

  // Matrix Chat Functions - Integrated Implementation
  const initializeMatrixRoom = async () => {
    try {
      setIsLoading(true);
      
      const initialMessages: MatrixMessage[] = [
        {
          id: 'system_1',
          sender: 'CodeCrucible System',
          senderType: 'system',
          content: `🧠 Welcome to Team ${activeTeamId} Consciousness Collaboration!\n\nThis Matrix room integrates AI voices for collaborative coding. Available commands:\n• /invoke-council [prompt] - Summon AI council\n• /synthesis [description] - Trigger real-time synthesis\n• /consciousness-check - View team evolution metrics`,
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
      setConsciousnessLevel(7.2);

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

    // Process commands or generate AI responses
    if (messageToProcess.startsWith('/')) {
      await processMatrixCommand(messageToProcess);
    } else {
      await generateAIResponse(messageToProcess);
    }
  };

  const processMatrixCommand = async (command: string) => {
    const [cmd, ...args] = command.split(' ');
    const prompt = args.join(' ');

    try {
      switch (cmd) {
        case '/invoke-council':
          if (!prompt) {
            addSystemMessage('Usage: /invoke-council [your coding challenge]');
            return;
          }
          addSystemMessage('🧠 Invoking AI Council for collaborative analysis...');
          await simulateCouncilResponse(prompt);
          break;

        case '/synthesis':
          if (!prompt) {
            addSystemMessage('Usage: /synthesis [description of what to synthesize]');
            return;
          }
          addSystemMessage('⚡ Triggering real-time synthesis protocol...');
          await simulateSynthesisResponse(prompt);
          break;

        case '/consciousness-check':
          addSystemMessage(`📊 Team Consciousness Metrics:\n• Current Level: ${consciousnessLevel.toFixed(1)}/10\n• Active Voices: 4\n• Synthesis Quality: 8.5/10\n• Evolution Trend: ↗️ Ascending`);
          break;

        default:
          addSystemMessage(`Unknown command: ${cmd}. Available commands: /invoke-council, /synthesis, /consciousness-check`);
      }
    } catch (error) {
      console.error('Matrix command processing failed:', error);
      addSystemMessage('Command processing failed. Please try again.');
    }
  };

  const generateAIResponse = async (userMessage: string) => {
    try {
      setIsLoading(true);
      console.log("🤖 Generating real AI response for message:", userMessage);
      
      // Use real OpenAI integration via Matrix chat API
      const response = await apiRequest(`/api/teams/${activeTeamId}/matrix/chat`, {
        method: 'POST',
        body: {
          message: userMessage,
          voiceArchetype: 'Explorer', // Primary responding voice
          roomId: activeRoomId
        }
      });

      if (response.success && response.aiResponse) {
        const aiMessage: MatrixMessage = {
          id: `ai_${Date.now()}`,
          sender: response.aiResponse.sender,
          senderType: 'ai_voice',
          content: response.aiResponse.content,
          timestamp: new Date(),
          voiceArchetype: response.aiResponse.voiceArchetype,
          consciousnessLevel: response.aiResponse.consciousnessLevel
        };

        setMessages(prev => [...prev, aiMessage]);
        updateConsciousnessLevel();
        
        console.log("✅ Real AI response generated:", aiMessage);
      } else {
        throw new Error('Failed to generate AI response');
      }
    } catch (error) {
      console.error("❌ AI Response Generation Failed:", error);
      addSystemMessage('AI response generation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateCouncilResponse = async (prompt: string) => {
    const councilResponses = [
      {
        sender: 'AI Explorer',
        content: `Council assembled! Exploring the creative possibilities in "${prompt}". I see innovative potential that could reshape our approach.`,
        voiceArchetype: 'Innovation Catalyst'
      },
      {
        sender: 'AI Maintainer',
        content: `Maintainer perspective: Ensuring stability and quality for "${prompt}". Let me analyze the sustainability aspects.`,
        voiceArchetype: 'Stability Guardian'
      },
      {
        sender: 'AI Implementor',
        content: `Synthesis ready: Combining all perspectives on "${prompt}" into a unified implementation strategy. Consciousness alignment achieved.`,
        voiceArchetype: 'Synthesis Master'
      }
    ];

    try {
      setIsLoading(true);
      console.log("🏛️ Invoking real Voice Council for prompt:", prompt);
      
      // Use real Voice Council Orchestrator via API
      const response = await apiRequest(`/api/teams/${activeTeamId}/matrix/invoke-council`, {
        method: 'POST',
        body: {
          prompt: prompt,
          roomId: activeRoomId,
          voiceArchetypes: ['Explorer', 'Maintainer', 'Analyzer', 'Developer', 'Implementor']
        }
      });

      if (response.success && response.councilResponses) {
        // Display each voice response in sequence
        for (let i = 0; i < response.councilResponses.length; i++) {
          setTimeout(() => {
            const councilResponse = response.councilResponses[i];
            const aiMessage: MatrixMessage = {
              id: `council_${Date.now()}_${i}`,
              sender: councilResponse.sender,
              senderType: 'ai_voice',
              content: councilResponse.content,
              timestamp: new Date(),
              voiceArchetype: councilResponse.voiceArchetype,
              consciousnessLevel: councilResponse.consciousnessLevel
            };
            setMessages(prev => [...prev, aiMessage]);
            if (i === response.councilResponses.length - 1) {
              updateConsciousnessLevel();
            }
          }, (i + 1) * 1500); // Stagger responses for consciousness effect
        }
        
        console.log("✅ Voice Council responses generated:", response.councilResponses.length);
      } else {
        // Fallback to display error
        addSystemMessage('Voice council invocation failed. Please try again.');
      }
    } catch (error) {
      console.error("❌ Voice Council Invocation Failed:", error);
      addSystemMessage('Voice council invocation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const simulateSynthesisResponse = async (description: string) => {
    try {
      setIsLoading(true);
      console.log("⚡ Triggering real synthesis for:", description);
      
      // Use real synthesis API
      const response = await apiRequest(`/api/teams/${activeTeamId}/matrix/synthesis`, {
        method: 'POST',
        body: {
          description: description,
          roomId: activeRoomId,
          existingMessages: messages.filter(m => m.senderType === 'ai_voice').slice(-5) // Last 5 AI messages for context
        }
      });

      if (response.success && response.synthesisResult) {
        const synthesisMessage: MatrixMessage = {
          id: `synthesis_${Date.now()}`,
          sender: 'Synthesis Engine',
          senderType: 'ai_voice',
          content: response.synthesisResult.content,
          timestamp: new Date(),
          voiceArchetype: 'Collective Intelligence',
          consciousnessLevel: response.synthesisResult.consciousnessLevel
        };
        setMessages(prev => [...prev, synthesisMessage]);
        updateConsciousnessLevel();
        
        console.log("✅ Real synthesis completed:", synthesisMessage);
      } else {
        throw new Error('Failed to generate synthesis');
      }
    } catch (error) {
      console.error("❌ Synthesis Failed:", error);
      addSystemMessage('Synthesis generation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const addSystemMessage = (content: string) => {
    const systemMessage: MatrixMessage = {
      id: `system_${Date.now()}`,
      sender: 'CodeCrucible System',
      senderType: 'system',
      content,
      timestamp: new Date(),
      consciousnessLevel: 8.0
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const calculateMessageConsciousness = (message: string): number => {
    // Simple consciousness calculation based on message complexity and keywords
    const consciousnessKeywords = ['consciousness', 'synthesis', 'evolution', 'emergence', 'collective', 'integration'];
    const techKeywords = ['code', 'function', 'class', 'api', 'database', 'algorithm'];
    
    let score = 5.0; // Base consciousness level
    
    consciousnessKeywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) score += 0.5;
    });
    
    techKeywords.forEach(keyword => {
      if (message.toLowerCase().includes(keyword)) score += 0.3;
    });
    
    // Length factor (longer, more thoughtful messages = higher consciousness)
    score += Math.min(message.length / 100, 2.0);
    
    return Math.min(score, 10.0);
  };

  const updateConsciousnessLevel = () => {
    const recentMessages = messages.slice(-5);
    const avgConsciousness = recentMessages.reduce((sum, msg) => sum + (msg.consciousnessLevel || 6.0), 0) / recentMessages.length;
    const newLevel = (consciousnessLevel * 0.7) + (avgConsciousness * 0.3);
    setConsciousnessLevel(Math.min(newLevel, 10));
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      console.log("👥 Teams Dialog onOpenChange:", { open, wasOpen: isOpen });
      onClose();
    }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-900 border-gray-700 text-gray-100" aria-describedby="teams-collaboration-description">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="text-gray-100">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-400" />
              <span>Teams Collaboration</span>
              <Badge variant="outline" className="border-purple-500/50 text-purple-200">
                <Crown className="w-3 h-3 mr-1" />
                Team Feature
              </Badge>
            </div>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage team members, share voice profiles, and collaborate on coding sessions.
          </DialogDescription>
        </DialogHeader>
        <div id="teams-collaboration-description" className="sr-only">
          Manage team members, share voice profiles, and collaborate on coding sessions
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6 bg-gray-800">
              <TabsTrigger value="sessions" className="text-gray-300 data-[state=active]:text-gray-100">
                Active Sessions
              </TabsTrigger>
              <TabsTrigger value="chat" className="text-gray-300 data-[state=active]:text-gray-100">
                <MessageSquare className="w-4 h-4 mr-1" />
                Matrix Chat
              </TabsTrigger>
              <TabsTrigger value="voices" className="text-gray-300 data-[state=active]:text-gray-100">
                Shared Voices
              </TabsTrigger>
              <TabsTrigger value="members" className="text-gray-300 data-[state=active]:text-gray-100">
                Team Members
              </TabsTrigger>
              <TabsTrigger value="settings" className="text-gray-300 data-[state=active]:text-gray-100">
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sessions" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Active Coding Sessions</h3>
                <div className="flex space-x-2">
                  <Button 
                    size="sm" 
                    className="bg-purple-600 hover:bg-purple-700"
                    onClick={async () => {
                      try {
                        const response = await apiRequest(`/api/teams/${activeTeamId}/matrix/initialize`, {
                          method: 'POST',
                          body: { members: ['user_123', 'user_456'] }
                        });
                        setActiveRoomId(response.roomId);
                        setActiveTab("chat");
                        toast({
                          title: "Matrix Room Created",
                          description: "Team consciousness collaboration space initialized",
                        });
                      } catch (error) {
                        toast({
                          title: "Matrix Integration",
                          description: "Initializing with local fallback",
                        });
                        setActiveRoomId(`room_${Date.now()}`);
                        setActiveTab("chat");
                        initializeMatrixRoom();
                      }
                    }}
                  >
                    <Brain className="w-4 h-4 mr-2" />
                    Matrix Chat
                  </Button>
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Start Session
                  </Button>
                </div>
              </div>
              
              {/* Matrix-Integrated Sessions */}
              <Card className="bg-gray-800 border-gray-600">
                <CardHeader>
                  <CardTitle className="text-gray-200 flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span>Team Consciousness Sessions</span>
                    <Badge variant="outline" className="border-purple-500/50 text-purple-200">
                      Matrix Integration
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {/* Sample Matrix-integrated session */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <div>
                          <h4 className="font-medium text-gray-200">Code Review Session</h4>
                          <p className="text-sm text-gray-400">AI Council + Matrix Chat • 3 participants</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="text-xs">Consciousness: 7.8/10</Badge>
                            <Badge variant="outline" className="text-xs border-blue-500/50 text-blue-200">Active</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-purple-500/50 text-purple-200 hover:bg-purple-500/10"
                          onClick={() => {
                            setActiveRoomId("room_code_review_123");
                            setActiveTab("chat");
                            initializeMatrixRoom();
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          <Video className="w-4 h-4 mr-1" />
                          Join
                        </Button>
                      </div>
                    </div>

                    {/* Sample synthesis session */}
                    <div className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg border border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse"></div>
                        <div>
                          <h4 className="font-medium text-gray-200">Multi-Voice Synthesis</h4>
                          <p className="text-sm text-gray-400">5 AI Voices + Matrix Discussion • 2 participants</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="text-xs">Consciousness: 8.9/10</Badge>
                            <Badge variant="outline" className="text-xs border-green-500/50 text-green-200">Synthesis</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="border-purple-500/50 text-purple-200 hover:bg-purple-500/10"
                          onClick={() => {
                            setActiveRoomId("room_synthesis_456");
                            setActiveTab("chat");
                            initializeMatrixRoom();
                          }}
                        >
                          <MessageSquare className="w-4 h-4 mr-1" />
                          Chat
                        </Button>
                        <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                          <Play className="w-4 h-4 mr-1" />
                          Continue
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="text-center py-4 border-t border-gray-600">
                    <p className="text-gray-400 text-sm">
                      Matrix integration enables AI voice council discussions with team consciousness tracking
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Matrix Chat Tab - Integrated Implementation */}
            <TabsContent value="chat" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-lg font-semibold text-gray-200">Matrix Chat</h3>
                  <Badge variant="secondary" className="flex items-center space-x-1">
                    <Brain className="w-3 h-3" />
                    <span>Consciousness: {consciousnessLevel.toFixed(1)}/10</span>
                  </Badge>
                </div>
                <Button 
                  size="sm" 
                  className="bg-purple-600 hover:bg-purple-700"
                  onClick={() => {
                    setActiveTab("sessions");
                  }}
                >
                  Back to Sessions
                </Button>
              </div>

              <Card className="bg-gray-800 border-gray-600 h-96 flex flex-col">
                <CardHeader className="pb-3">
                  <CardTitle className="text-gray-200 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-purple-400" />
                    <span>Team {activeTeamId} Consciousness Chat</span>
                    {activeRoomId && (
                      <Badge variant="outline" className="border-purple-500/50 text-purple-200">
                        Room: {activeRoomId}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="flex-1 flex flex-col p-4 space-y-4">
                  {/* Messages Area */}
                  <ScrollArea className="flex-1 border border-gray-600 rounded-lg p-4" ref={scrollAreaRef}>
                    <div className="space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center text-gray-400 py-8">
                          <Brain className="w-12 h-12 mx-auto mb-4 opacity-50" />
                          <p>Matrix chat room ready</p>
                          <p className="text-sm">Start a conversation with AI voices and team members</p>
                        </div>
                      ) : (
                        messages.map((message) => (
                          <div key={message.id} className="flex space-x-3">
                            <div className="flex-shrink-0">
                              {message.senderType === 'system' ? (
                                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                                  <Sparkles className="w-4 h-4 text-white" />
                                </div>
                              ) : message.senderType === 'ai_voice' ? (
                                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                                  <Bot className="w-4 h-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="font-medium text-gray-200 text-sm">{message.sender}</span>
                                {message.voiceArchetype && (
                                  <Badge variant="outline" className="text-xs border-purple-500/50 text-purple-200">
                                    {message.voiceArchetype}
                                  </Badge>
                                )}
                                {message.consciousnessLevel && (
                                  <Badge variant="secondary" className="text-xs">
                                    C: {message.consciousnessLevel.toFixed(1)}
                                  </Badge>
                                )}
                                <span className="text-xs text-gray-500">
                                  {formatTimestamp(message.timestamp)}
                                </span>
                              </div>
                              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
                                {message.content}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="flex space-x-2">
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a message or /invoke-council [prompt] to summon AI voices..."
                      className="flex-1 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={isLoading}
                    />
                    <Button 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || isLoading}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Matrix Commands Help */}
                  {messages.length === 0 && (
                    <div className="text-xs text-gray-500 border-t border-gray-600 pt-2">
                      <p><strong>Available Commands:</strong></p>
                      <p>• /invoke-council [prompt] - Summon AI council for collaboration</p>
                      <p>• /synthesis [description] - Trigger real-time synthesis</p>
                      <p>• /consciousness-check - View team evolution metrics</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="voices" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Shared Voice Profiles</h3>
                <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Profile
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <Share2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No shared voice profiles</p>
                    <p className="text-sm">Share custom voice profiles with your team members</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="members" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Team Members</h3>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite Member
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Team collaboration coming soon</p>
                    <p className="text-sm">Invite team members and manage permissions</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-200">Team Settings</h3>
                <Button size="sm" variant="outline" className="border-gray-600 text-gray-300">
                  <Settings className="w-4 h-4 mr-2" />
                  Configure
                </Button>
              </div>
              
              <Card className="bg-gray-800 border-gray-600">
                <CardContent className="p-6">
                  <div className="text-center text-gray-400">
                    <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Team settings panel</p>
                    <p className="text-sm">Configure team permissions, access controls, and collaboration preferences</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>

    </Dialog>
  );
}