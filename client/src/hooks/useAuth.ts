import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  subscriptionTier: 'free' | 'pro' | 'team' | 'enterprise';
}

export function useAuth() {
  const { toast } = useToast();

  const {
    data: user,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: (failureCount, error) => {
      // Don't retry 401 errors
      if (error?.message?.includes('401')) return false;
      return failureCount < 3;
    },
    onError: (error: Error) => {
      if (!error.message.includes('401')) {
        toast({
          title: "Authentication Error",
          description: "Failed to verify authentication status",
          variant: "destructive",
        });
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const isAuthenticated = !!user && !error;
  const isUnauthenticated = !user && !isLoading && !!error;

  return {
    user: user as AuthUser | null,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    error,
    refetch,
  };
}