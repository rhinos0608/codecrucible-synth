import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  messages: ChatMessage[];
  context?: string;
}

interface ChatResponse {
  response: string;
  context: string;
  timestamp: string;
}

export function useAiChat() {
  return useMutation({
    mutationFn: async (options: ChatOptions): Promise<ChatResponse> => {
      console.log('🧠 AI Chat Request:', options);
      
      const response = await apiRequest('/api/ai/chat', {
        method: 'POST',
        body: {
          messages: options.messages,
          context: options.context || 'file_assistance'
        }
      });
      
      console.log('✅ AI Chat Response:', response);
      return response;
    },
    onError: (error) => {
      console.error('❌ AI Chat Error:', error);
    }
  });
}