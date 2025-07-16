import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChatSession, InsertChatSession } from "@shared/schema";

// Hook for creating chat sessions from projects
export function useChatSessions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get all chat sessions for the user
  const { data: chatSessions = [], isLoading, error } = useQuery({
    queryKey: ['/api/chat/sessions'],
  });

  // Create a new chat session
  const createChatSessionMutation = useMutation({
    mutationFn: async (data: { 
      projectId: number, 
      selectedVoice: string, 
      initialCode: string, 
      projectName: string 
    }) => {
      // Create the chat session with project context
      const sessionData: InsertChatSession = {
        sessionId: 0, // Will be generated or linked to voice session
        selectedVoice: data.selectedVoice,
        initialSolutionId: null,
        contextData: {
          projectId: data.projectId,
          projectName: data.projectName,
          initialCode: data.initialCode,
          source: 'project'
        }
      };

      const response = await apiRequest('/api/chat/sessions', {
        method: 'POST',
        body: sessionData
      });

      // Update the project with the chat session ID
      await apiRequest(`/api/projects/${data.projectId}`, {
        method: 'PATCH',
        body: {
          chatSessionId: response.id
        }
      });

      return response;
    },
    onSuccess: (chatSession, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      
      console.log('💬 Chat session created successfully:', {
        chatSessionId: chatSession.id,
        selectedVoice: chatSession.selectedVoice,
        projectId: variables.projectId
      });
      
      toast({
        title: "Chat Session Created",
        description: `Started conversation with ${chatSession.selectedVoice}`,
      });

      // Navigate to the chat page immediately
      window.location.href = `/chat/${chatSession.id}`;
    },
    onError: (error) => {
      console.error('❌ Failed to create chat session:', error);
      toast({
        title: "Failed to create chat session",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get specific chat session
  const getChatSession = (chatSessionId: number) => {
    return useQuery({
      queryKey: ['/api/chat/sessions', chatSessionId],
      enabled: !!chatSessionId,
    });
  };

  // Send message to chat session
  const sendMessageMutation = useMutation({
    mutationFn: async ({ chatSessionId, content }: { chatSessionId: number, content: string }) => {
      return apiRequest(`/api/chat/sessions/${chatSessionId}/messages`, {
        method: 'POST',
        body: { content, messageType: 'user' }
      });
    },
    onSuccess: (_, { chatSessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/chat/sessions', chatSessionId, 'messages'] });
    },
    onError: (error) => {
      console.error('❌ Failed to send message:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    chatSessions,
    isLoading,
    error,
    createChatSession: createChatSessionMutation.mutate,
    isCreating: createChatSessionMutation.isPending,
    getChatSession,
    sendMessage: sendMessageMutation.mutate,
    isSending: sendMessageMutation.isPending,
  };
}

// Hook for getting chat messages
export function useChatMessages(chatSessionId: number) {
  return useQuery({
    queryKey: ['/api/chat/sessions', chatSessionId, 'messages'],
    enabled: !!chatSessionId,
  });
}