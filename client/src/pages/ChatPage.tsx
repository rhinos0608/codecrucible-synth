import { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Send, Brain, User, Bot, Sparkles } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatSession, ChatMessage, Solution } from "@shared/schema";

interface ChatPageProps {
  chatSessionId?: string;
  solution?: Solution;
}

export function ChatPage() {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/chat/:sessionId");
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const chatSessionId = params?.sessionId;

  // Fetch chat session details
  const { data: chatSession, isLoading: sessionLoading } = useQuery({
    queryKey: ['/api/chat/sessions', chatSessionId],
    enabled: !!chatSessionId,
  });

  // Fetch chat messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: ['/api/chat/sessions', chatSessionId, 'messages'],
    enabled: !!chatSessionId,
  });

  // Send message mutation - Integrated user message and AI response
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/chat/sessions/${chatSessionId}/messages`, {
        method: 'POST',
        body: { content, messageType: 'user' }
      });
    },
    onSuccess: () => {
      setMessage("");
      setIsTyping(false);
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions', chatSessionId, 'messages'] });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
      setIsTyping(false);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    setIsTyping(true);
    sendMessageMutation.mutate(message.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  if (!chatSessionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Invalid Chat Session</h2>
          <Button onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Card>
      </div>
    );
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 animate-spin" />
          <span>Loading chat session...</span>
        </div>
      </div>
    );
  }

  const voiceName = chatSession?.selectedVoice || "AI Assistant";
  const voiceIcon = getVoiceIcon(voiceName);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/dashboard")}
              className="text-gray-600 dark:text-gray-400"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              {voiceIcon}
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-gray-100">
                  Chat with {voiceName}
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Technical discussion and code assistance
                </p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            AI-Powered
          </Badge>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-6">
          <div className="space-y-6">
            {/* Welcome Message */}
            {messages.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  {voiceIcon}
                </div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Start your conversation with {voiceName}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                  Ask questions about implementation details, improvements, or technical decisions.
                </p>
              </div>
            )}

            {/* Message List */}
            {messages.map((message: ChatMessage) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                
                <div
                  className={`max-w-[70%] rounded-lg px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>
                  <div className="text-xs opacity-70 mt-2">
                    {new Date(message.createdAt).toLocaleTimeString()}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about implementation details, improvements, or technical questions..."
                className="pr-12"
                disabled={sendMessageMutation.isPending || isTyping}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || sendMessageMutation.isPending || isTyping}
              size="icon"
              className="shrink-0"
            >
              {sendMessageMutation.isPending ? (
                <Brain className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

function getVoiceIcon(voiceName: string) {
  // Map voice names to appropriate icons following CodingPhilosophy.md consciousness principles
  const iconMap: Record<string, JSX.Element> = {
    'Explorer': <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
    'Analyzer': <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
    'Developer': <Bot className="w-5 h-5 text-green-600 dark:text-green-400" />,
    'Maintainer': <Bot className="w-5 h-5 text-orange-600 dark:text-orange-400" />,
    'Implementor': <Bot className="w-5 h-5 text-red-600 dark:text-red-400" />,
    'Performance Engineer': <Sparkles className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />,
    'UI/UX Engineer': <Bot className="w-5 h-5 text-pink-600 dark:text-pink-400" />,
    'Security Engineer': <Bot className="w-5 h-5 text-gray-600 dark:text-gray-400" />,
    'Systems Architect': <Brain className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />,
  };

  return iconMap[voiceName] || <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
}