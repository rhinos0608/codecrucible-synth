import { useEffect, useRef, useState, useCallback } from "react";
import { useAuthContext } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

interface WebSocketMessage {
  type: string;
  sessionId: string;
  userId: string;
  data: any;
  timestamp: string;
}

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export function useWebSocket(sessionId: string, options: UseWebSocketOptions = {}) {
  const { user } = useAuthContext();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const connect = useCallback(() => {
    if (!user || !sessionId || isConnecting) return;

    setIsConnecting(true);
    setLastError(null);

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Send authentication message
        ws.send(JSON.stringify({
          type: 'auth',
          sessionId,
          userId: user.id,
          token: 'auth-token', // Would be actual token in production
        }));

        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          if (message) {
            ws.send(JSON.stringify(message));
          }
        }

        options.onConnect?.();
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          options.onMessage?.(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;
        options.onDisconnect?.();

        // Attempt reconnection after delay
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        setLastError('WebSocket connection failed');
        setIsConnecting(false);
        options.onError?.(error);
        
        toast({
          title: "Connection Error",
          description: "Real-time collaboration temporarily unavailable",
          variant: "destructive",
        });
      };

    } catch (error) {
      setIsConnecting(false);
      setLastError('Failed to create WebSocket connection');
    }
  }, [user, sessionId, isConnecting, options, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    const message: WebSocketMessage = {
      type,
      sessionId,
      userId: user?.id || '',
      data,
      timestamp: new Date().toISOString(),
    };

    if (isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for later
      messageQueueRef.current.push(message);
    }
  }, [isConnected, sessionId, user?.id]);

  useEffect(() => {
    if (user && sessionId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user, sessionId, connect, disconnect]);

  return {
    isConnected,
    isConnecting,
    lastError,
    sendMessage,
    connect,
    disconnect,
  };
}