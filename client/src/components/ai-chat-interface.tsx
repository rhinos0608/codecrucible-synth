import { useState, useEffect, useRef } from "react";
import { Send, Bot, User, ArrowLeft, Brain, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Solution, ChatSession, ChatMessage } from "@shared/schema";
import { CODE_PERSPECTIVES, DEVELOPMENT_ROLES } from "@/types/voices";

interface AiChatInterfaceProps {
  isOpen: boolean;
  onClose: () => void;
  solution: Solution;
  sessionId: number;
}

// Chat message component for rendering individual messages
function ChatMessageComponent({ message }: { message: ChatMessage }) {
  const isUser = message.messageType === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start space-x-2 max-w-[80%] ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500' : 'bg-gray-600'
        }`}>
          {isUser ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
        </div>
        <div className={`rounded-lg p-3 ${
          isUser 
            ? 'bg-blue-500 text-white' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
        }`}>
          {message.messageType === 'assistant' && (
            <div className="text-xs opacity-75 mb-1">
              {message.voiceType && getVoiceDisplayName(message.voiceType)}
            </div>
          )}
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
          <div className="text-xs opacity-50 mt-1">
            {new Date(message.createdAt).toLocaleTimeString()}
          </div>
        </div>
      </div>
    </div>
  );
}

// Map voice combination to display name following AI_INSTRUCTIONS.md patterns
const getVoiceDisplayName = (voiceCombination: string | undefined): string => {
  if (!voiceCombination) return 'AI Assistant';
  
  // Handle colon-separated format (e.g., "perspective:seeker" -> "Explorer")
  if (voiceCombination.includes(':')) {
    const [type, voiceId] = voiceCombination.split(':');
    if (type === 'perspective') {
      const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceId);
      if (perspective) return perspective.name;
    }
    if (type === 'role') {
      const role = DEVELOPMENT_ROLES.find(r => r.id === voiceId);
      if (role) return role.name;
    }
  }
  
  // Handle perspective-prefixed voices
  if (voiceCombination.startsWith('perspective-')) {
    const perspectiveId = voiceCombination.replace('perspective-', '');
    const perspective = CODE_PERSPECTIVES.find(p => p.id === perspectiveId);
    if (perspective) return perspective.name;
  }
  
  // Handle role-prefixed voices
  if (voiceCombination.startsWith('role-')) {
    const roleId = voiceCombination.replace('role-', '');
    const role = DEVELOPMENT_ROLES.find(r => r.id === roleId);
    if (role) return role.name;
  }
  
  // Direct ID mapping
  const perspective = CODE_PERSPECTIVES.find(p => p.id === voiceCombination);
  if (perspective) return perspective.name;
  
  const role = DEVELOPMENT_ROLES.find(r => r.id === voiceCombination);
  if (role) return role.name;
  
  return voiceCombination;
};

export function AiChatInterface({ isOpen, onClose, solution, sessionId }: AiChatInterfaceProps) {
  const [message, setMessage] = useState("");
  const [chatSessionId, setChatSessionId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const voiceName = getVoiceDisplayName(solution.voiceCombination || solution.voiceEngine || solution.voiceName);

  // Create chat session when modal opens - Following AI_INSTRUCTIONS.md security patterns
  const createChatSessionMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/chat/sessions', {
        method: 'POST',
        body: {
          selectedVoice: solution.voiceCombination || solution.voiceEngine || solution.voiceName,
          contextData: {
            originalCode: solution.code,
            explanation: solution.explanation,
            confidence: solution.confidence,
            strengths: solution.strengths || [],
            considerations: solution.considerations || []
          },
          sessionId: sessionId,
          solutionId: solution.id
        }
      });
    },
    onSuccess: (data: ChatSession) => {
      setChatSessionId(data.id);
      console.log('💬 Chat session created:', data.id, 'for voice:', voiceName);
    },
    onError: (error) => {
      console.error('❌ Failed to create chat session:', error);
      toast({
        title: "Chat Error",
        description: "Failed to start chat session. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Get chat messages for the session
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/chat/sessions', chatSessionId, 'messages'],
    enabled: !!chatSessionId,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time feel
  });

  // Send message mutation - CodingPhilosophy.md consciousness principles for AI interaction
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!chatSessionId) throw new Error('No chat session');
      
      return apiRequest(`/api/chat/sessions/${chatSessionId}/messages`, {
        method: 'POST',
        body: {
          content,
          messageType: 'user'
        }
      });
    },
    onSuccess: (data) => {
      console.log('✅ Message sent and AI response received');
      setMessage("");
      // Invalidate messages cache to get the new AI response
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions', chatSessionId, 'messages'] });
    },
    onError: (error) => {
      console.error('❌ Failed to send message:', error);
      toast({
        title: "Message Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create chat session when modal opens
  useEffect(() => {
    if (isOpen && !chatSessionId) {
      createChatSessionMutation.mutate();
    }
  }, [isOpen, chatSessionId]);

  const handleSendMessage = async () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    
    console.log('📤 Sending message to', voiceName + ':', message.substring(0, 50) + '...');
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <Brain className="w-6 h-6 text-blue-500" />
              <div>
                <h3 className="text-lg font-semibold">Chat with {voiceName}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Technical discussion specialist</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {solution.confidence}% Confidence
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-gray-500 dark:text-gray-400">
            Continue your technical conversation with this AI specialist. Ask questions, request improvements, or discuss implementation details.
          </DialogDescription>
        </DialogHeader>

        {/* Original solution context */}
        <Card className="p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="text-sm">
            <div className="font-medium text-blue-800 dark:text-blue-200 mb-1">Original Solution Context:</div>
            <div className="text-blue-700 dark:text-blue-300 text-xs line-clamp-2">{solution.explanation}</div>
          </div>
        </Card>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
          {createChatSessionMutation.isPending ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Starting chat session...</span>
            </div>
          ) : messagesLoading && messages.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-gray-600">Loading conversation...</span>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <Bot className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">Start your conversation with {voiceName}</p>
              <p className="text-sm text-gray-500">Ask about implementation details, improvements, or any technical questions.</p>
            </div>
          ) : (
            <div>
              {messages.map((msg: ChatMessage) => (
                <ChatMessageComponent key={msg.id} message={msg} />
              ))}
              {sendMessageMutation.isPending && (
                <div className="flex justify-start mb-4">
                  <div className="flex items-start space-x-2 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center space-x-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{voiceName} is thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message input */}
        <div className="flex items-center space-x-2 pt-3">
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Ask ${voiceName} about implementation details, improvements, or technical questions...`}
            disabled={sendMessageMutation.isPending || !chatSessionId}
            className="flex-1"
          />
          <Button 
            onClick={handleSendMessage}
            disabled={!message.trim() || sendMessageMutation.isPending || !chatSessionId}
            size="sm"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Help text */}
        <div className="pt-2">
          <p className="text-xs text-gray-500">
            💡 You can ask for code improvements, discuss architecture decisions, or get help with specific implementation challenges.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}