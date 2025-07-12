import { useState, useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";
import { useToast } from "@/hooks/use-toast";

interface Participant {
  userId: string;
  role: 'initiator' | 'collaborator' | 'observer';
  joinedAt: string;
  isActive: boolean;
  cursor?: { x: number; y: number };
}

interface VoiceAssignment {
  perspective: string;
  role: string;
  assignedTo?: string;
}

interface ChatMessage {
  id: string;
  userId: string;
  message: string;
  timestamp: string;
  type: 'chat' | 'system' | 'voice_assignment';
}

interface CollaborationState {
  participants: Participant[];
  voiceAssignments: VoiceAssignment[];
  chatMessages: ChatMessage[];
  currentPrompt: string;
  isGenerating: boolean;
  synthesisInProgress: boolean;
}

export function useCollaboration(sessionId: string) {
  const { toast } = useToast();
  const [state, setState] = useState<CollaborationState>({
    participants: [],
    voiceAssignments: [],
    chatMessages: [],
    currentPrompt: '',
    isGenerating: false,
    synthesisInProgress: false,
  });

  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'participant_joined':
        setState(prev => ({
          ...prev,
          participants: [...prev.participants.filter(p => p.userId !== message.data.userId), message.data],
        }));
        toast({
          title: "Participant Joined",
          description: `User ${message.data.userId} joined the session`,
        });
        break;

      case 'participant_left':
        setState(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.userId !== message.data.userId),
        }));
        break;

      case 'prompt_updated':
        setState(prev => ({
          ...prev,
          currentPrompt: message.data.prompt,
        }));
        break;

      case 'voice_assigned':
        setState(prev => ({
          ...prev,
          voiceAssignments: message.data.assignments,
        }));
        break;

      case 'voice_generation_start':
        setState(prev => ({
          ...prev,
          isGenerating: true,
        }));
        break;

      case 'voice_output':
        setState(prev => ({
          ...prev,
          isGenerating: false,
        }));
        break;

      case 'chat_message':
        setState(prev => ({
          ...prev,
          chatMessages: [...prev.chatMessages, message.data],
        }));
        break;

      case 'cursor_update':
        setState(prev => ({
          ...prev,
          participants: prev.participants.map(p => 
            p.userId === message.userId 
              ? { ...p, cursor: message.data.position }
              : p
          ),
        }));
        break;

      case 'synthesis_request':
        setState(prev => ({
          ...prev,
          synthesisInProgress: true,
        }));
        break;

      case 'synthesis_complete':
        setState(prev => ({
          ...prev,
          synthesisInProgress: false,
        }));
        toast({
          title: "Synthesis Complete",
          description: "Collaborative synthesis has been completed",
        });
        break;

      case 'session_state':
        setState(prev => ({
          ...prev,
          ...message.data,
        }));
        break;
    }
  }, [toast]);

  const { isConnected, sendMessage } = useWebSocket(sessionId, {
    onMessage: handleMessage,
    onConnect: () => {
      toast({
        title: "Connected",
        description: "Real-time collaboration is now active",
      });
    },
    onDisconnect: () => {
      toast({
        title: "Disconnected",
        description: "Real-time collaboration temporarily unavailable",
        variant: "destructive",
      });
    },
  });

  // Collaboration actions
  const updatePrompt = useCallback((prompt: string) => {
    sendMessage('prompt_update', { prompt });
  }, [sendMessage]);

  const assignVoice = useCallback((assignment: VoiceAssignment) => {
    sendMessage('voice_assignment', { assignment });
  }, [sendMessage]);

  const startGeneration = useCallback((voiceId: string) => {
    sendMessage('voice_generation_start', { voiceId });
  }, [sendMessage]);

  const sendChatMessage = useCallback((message: string) => {
    sendMessage('chat_message', {
      id: Math.random().toString(36),
      message,
      timestamp: new Date().toISOString(),
      type: 'chat',
    });
  }, [sendMessage]);

  const updateCursor = useCallback((position: { x: number; y: number }) => {
    sendMessage('cursor_update', { position });
  }, [sendMessage]);

  const requestSynthesis = useCallback(() => {
    sendMessage('synthesis_request', {});
  }, [sendMessage]);

  return {
    ...state,
    isConnected,
    actions: {
      updatePrompt,
      assignVoice,
      startGeneration,
      sendChatMessage,
      updateCursor,
      requestSynthesis,
    },
  };
}