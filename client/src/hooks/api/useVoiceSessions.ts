import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { VoiceSession, InsertVoiceSession } from "@shared/schema";

export function useVoiceSessions(limit = 10) {
  return useInfiniteQuery({
    queryKey: ["/api/sessions"],
    queryFn: ({ pageParam = 0 }) => {
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: pageParam.toString(),
      });
      return fetch(`/api/sessions?${queryParams}`, {
        credentials: "include",
      }).then(res => res.json());
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.length === limit ? pages.length * limit : undefined;
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useVoiceSession(id: number) {
  return useQuery({
    queryKey: ["/api/sessions", id],
    enabled: !!id,
    staleTime: 30000,
  });
}

export function useCreateVoiceSession() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (session: InsertVoiceSession) => {
      const response = await apiRequest("POST", "/api/sessions", session);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Session Created",
        description: "Your voice session has been created successfully.",
      });
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create voice session.",
        variant: "destructive",
      });
    },
  });
}

export function useSessionSolutions(sessionId: number) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "solutions"],
    enabled: !!sessionId,
    staleTime: 60000, // 1 minute
  });
}

export function useSynthesizeSolutions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ sessionId }: { sessionId: number }) => {
      const response = await apiRequest("POST", `/api/sessions/${sessionId}/synthesize`, {});
      return response.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", variables.sessionId] });
      toast({
        title: "Synthesis Complete",
        description: "Solutions have been synthesized successfully.",
      });
      return data;
    },
    onError: (error: Error) => {
      toast({
        title: "Synthesis Failed",
        description: error.message || "Failed to synthesize solutions.",
        variant: "destructive",
      });
    },
  });
}