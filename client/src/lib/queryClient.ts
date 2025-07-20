import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    const error = new Error(`${res.status}: ${text}`);
    
    // Add additional error properties for better debugging
    (error as any).status = res.status;
    (error as any).statusText = res.statusText;
    (error as any).url = res.url;
    (error as any).response = text;
    
    // Log specific error types for monitoring
    if (res.status === 404) {
      console.warn(`[API 404] ${res.url}:`, text);
    } else if (res.status >= 500) {
      console.error(`[API Server Error] ${res.status} ${res.url}:`, text);
    } else if (res.status === 401 || res.status === 403) {
      console.warn(`[API Auth Error] ${res.status} ${res.url}:`, text);
    }
    
    throw error;
  }
}

export async function apiRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Promise<any> {
  const method = options?.method || 'GET';
  
  try {
    // Following AI_INSTRUCTIONS.md: Enhanced error handling for network failures
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      credentials: "include",
    });

    await throwIfResNotOk(res);
    return res.json();
  } catch (error) {
    // Following AI_INSTRUCTIONS.md: Proper error handling without fallback data
    const errorMessage = error instanceof Error ? error.message : 'Unknown network error';
    
    // Enhanced error logging for different failure types
    if (errorMessage.includes('Failed to fetch')) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Network fetch failed for ${method} ${url} (handled):`, errorMessage);
      }
      throw new Error(`Network connection failed for ${method} ${url}`);
    } else if (errorMessage.includes('NetworkError')) {
      throw new Error(`Network error for ${method} ${url}: ${errorMessage}`);
    } else if (errorMessage.includes('AbortError')) {
      throw new Error(`Request aborted for ${method} ${url}`);
    }
    
    // Re-throw the original error for other cases
    throw error;
  }
}

// Legacy overload for backward compatibility
export async function apiRequestLegacy(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      // Following AI_INSTRUCTIONS.md: Enhanced error handling for query functions
      const res = await fetch(queryKey.join("/") as string, {
        credentials: "include",
      });

      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        return null;
      }

      await throwIfResNotOk(res);
      return await res.json();
    } catch (error) {
      // Following AI_INSTRUCTIONS.md: Proper error handling without fallback data
      const errorMessage = error instanceof Error ? error.message : 'Unknown query error';
      
      if (errorMessage.includes('Failed to fetch')) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`Query fetch failed for ${queryKey.join("/")} (handled):`, errorMessage);
        }
        throw new Error(`Network connection failed for query ${queryKey.join("/")}`);
      }
      
      // Re-throw the original error
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
