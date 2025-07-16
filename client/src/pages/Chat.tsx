import { useState, useEffect, useRef } from 'react';
import { useRoute } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, MessageCircle, Send, Brain, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuthContext } from '@/components/auth/AuthProvider';
import { Link } from 'wouter';
import { getVoiceDisplayName } from '@/lib/voice-utils';

interface ChatMessage {
  id: number;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  voiceEngine?: string;
}

interface ChatSession {
  id: number;
  selectedVoice: string;
  voiceEngine: string;
  contextData?: {
    originalCode: string;
    explanation: string;
    confidence: number;
  };
  createdAt: string;
}

export function Chat() {
  const [match, params] = useRoute('/chat/:sessionId');
  const sessionId = params?.sessionId ? parseInt(params.sessionId) : null;
  const [message, setMessage] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuthContext();
  const queryClient = useQueryClient();

  // Fetch chat session details
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: [`/api/chat/sessions/${sessionId}`],
    enabled: !!sessionId,
  });

  // Fetch chat messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery({
    queryKey: [`/api/chat/sessions/${sessionId}/messages`],
    enabled: !!sessionId,
  });

  // Send message mutation with enhanced error handling
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!sessionId) {
        throw new Error('No chat session ID provided');
      }
      
      console.log('📤 Sending message to chat session:', {
        sessionId,
        messageLength: content.length,
        timestamp: new Date().toISOString()
      });
      
      return apiRequest(`/api/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: { 
          content,
          messageType: 'user'
        }
      });
    },
    onSuccess: () => {
      console.log('✅ Message sent successfully');
      setMessage('');
      queryClient.invalidateQueries({ queryKey: [`/api/chat/sessions/${sessionId}/messages`] });
    },
    onError: (error) => {
      console.error('❌ Failed to send message:', error);
      toast({
        title: "Failed to send message",
        description: "Please check your connection and try again.",
        variant: "destructive",
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle enter key to send message
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message.trim());
    }
  };

  const copyToClipboard = async (text: string, messageId: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({
        title: "Copied to clipboard",
        description: "Message content copied successfully.",
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy to clipboard.",
        variant: "destructive",
      });
    }
  };

  if (!match || !sessionId) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-6 text-center">
          <h1 className="text-xl font-semibold mb-2">Chat Session Not Found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">The requested chat session could not be found.</p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (sessionLoading || messagesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <Card className="p-6">
          <div className="flex items-center space-x-3">
            <Brain className="w-6 h-6 animate-spin text-blue-600" />
            <span>Loading chat session...</span>
          </div>
        </Card>
      </div>
    );
  }

  const voiceName = session ? getVoiceDisplayName(session.voiceEngine || session.selectedVoice) : 'AI Assistant';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Brain className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900 dark:text-gray-100">Chat with {voiceName}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">AI Technical Discussion</p>
              </div>
            </div>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Active Session
          </Badge>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-4 mb-6">
          {/* Context Card - Show original solution context */}
          {session?.contextData && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Original Solution Context</h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">{session.contextData.explanation}</p>
                    <div className="bg-white dark:bg-gray-800 rounded p-3 border border-blue-200 dark:border-blue-700">
                      <pre className="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">
                        {session.contextData.originalCode}
                      </pre>
                    </div>
                    <Badge variant="secondary" className="mt-2 bg-blue-100 text-blue-800">
                      {session.contextData.confidence}% Confidence
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Chat Messages */}
          {messages.map((msg: ChatMessage) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-2xl ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                        <Brain className="w-4 h-4 text-blue-600" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {msg.role === 'user' ? 'You' : voiceName}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs opacity-75">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className={`h-6 w-6 p-0 ${
                              msg.role === 'user' 
                                ? 'hover:bg-blue-700 text-white' 
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                          >
                            {copiedMessageId === msg.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <pre className={`whitespace-pre-wrap text-sm ${
                        msg.role === 'user' 
                          ? 'text-white' 
                          : 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {msg.content}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}

          {/* Loading indicator */}
          {sendMessageMutation.isPending && (
            <div className="flex justify-start">
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-blue-600 animate-spin" />
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {voiceName} is thinking...
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4">
            <div className="flex space-x-3">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={`Continue discussion with ${voiceName}...`}
                className="flex-1"
                disabled={sendMessageMutation.isPending}
              />
              <Button 
                onClick={handleSendMessage}
                disabled={!message.trim() || sendMessageMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {sendMessageMutation.isPending ? (
                  <Brain className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Press Enter to send • Shift+Enter for new line
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}