import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Brain, Code, User, Bot, Loader2, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppleStyleButton } from "./AppleStyleButton";
import { cn } from "@/lib/utils";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  voice?: string;
  isCode?: boolean;
}

interface ChatInterfaceProps {
  messages?: Message[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatInterface({ 
  messages = [], 
  onSendMessage = () => {}, 
  isLoading = false,
  placeholder = "Ask anything about your code...",
  className
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn("flex flex-col h-full max-h-[600px] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg modern-card", className)}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
          <Brain className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Ready to help with your code</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Start a conversation with your AI assistant</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={cn(
                "flex gap-3",
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}>
                {message.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                )}
                
                <div className={cn(
                  "max-w-[80%] rounded-xl p-3 break-words",
                  message.role === 'user' 
                    ? "bg-blue-500 text-white" 
                    : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                )}>
                  {message.isCode ? (
                    <SyntaxHighlighter
                      style={oneDark}
                      language="typescript"
                      className="!text-sm !rounded-lg !bg-transparent"
                    >
                      {message.content}
                    </SyntaxHighlighter>
                  ) : (
                    <p className="text-sm leading-relaxed">{message.content}</p>
                  )}
                  
                  <div className={cn(
                    "text-xs mt-2 opacity-70",
                    message.role === 'user' ? "text-blue-100" : "text-gray-500"
                  )}>
                    {message.timestamp.toLocaleTimeString()}
                    {message.voice && ` • ${message.voice}`}
                  </div>
                </div>

                {message.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">AI is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-3 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={placeholder}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm modern-focus"
              style={{ minHeight: '44px', maxHeight: '200px' }}
              disabled={isLoading}
            />
          </div>
          
          <AppleStyleButton
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            loading={isLoading}
            variant="consciousness"
            size="icon"
            className="flex-shrink-0"
          >
            <Send className="w-4 h-4" />
          </AppleStyleButton>
        </div>
      </div>
    </div>
  );
}