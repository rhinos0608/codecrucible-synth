import { ReactNode, createContext, useContext, useState } from "react";
import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  subscriptionTier: 'free' | 'pro' | 'team' | 'enterprise';
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isUnauthenticated: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Simplified auth implementation without useToast to prevent infinite loops
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  const isAuthenticated = !!user && !error;
  const isUnauthenticated = !user && !isLoading && !!error;

  const auth = {
    user: user as AuthUser | null,
    isLoading,
    isAuthenticated,
    isUnauthenticated,
    refetch,
  };

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}