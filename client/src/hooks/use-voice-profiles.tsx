import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { VoiceProfile, InsertVoiceProfile } from "@shared/schema";

export function useVoiceProfiles() {
  const { toast } = useToast();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["/api/voice-profiles"],
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
      }
    },
  });

  return {
    profiles,
    isLoading,
  };
}

export function useCreateVoiceProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profile: InsertVoiceProfile) => {
      console.log('🔧 Creating voice profile via API:', profile);
      
      try {
        const response = await apiRequest("/api/voice-profiles", {
          method: "POST",
          body: profile
        });
        
        console.log('✅ Voice profile created successfully:', response);
        return response;
      } catch (error) {
        console.error('❌ Voice profile creation API failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      toast({
        title: "Voice Profile Created",
        description: "Your custom voice profile has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('❌ Voice profile creation failed:', { error: error.message, stack: error.stack });
      
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      toast({
        title: "Voice Profile Creation Failed",
        description: `Error: ${error.message || 'Unknown error occurred'}`,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateVoiceProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<InsertVoiceProfile> }) => {
      return apiRequest(`/api/voice-profiles/${id}`, {
        method: "PATCH",
        body: updates
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      toast({
        title: "Profile Updated",
        description: "Voice profile has been updated successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update voice profile. Please try again.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteVoiceProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/voice-profiles/${id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice-profiles"] });
      toast({
        title: "Profile Deleted",
        description: "Voice profile has been deleted successfully.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete voice profile. Please try again.",
        variant: "destructive",
      });
    },
  });
}