/**
 * Frontend OpenAI client for internal proxy API
 * Following AI_INSTRUCTIONS.md patterns for dev mode integration
 */

export interface OpenAIRequestOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface OpenAIResponse {
  result: string;
  model: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call the internal OpenAI proxy API
 * Provides unlimited GPT-4/3.5 generations in development mode
 */
export async function callOpenAIProxy({
  prompt,
  model = "gpt-4",
  temperature = 0.7,
  max_tokens = 1024
}: OpenAIRequestOptions): Promise<OpenAIResponse> {
  try {
    const response = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, temperature, max_tokens })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`OpenAI Proxy Error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('OpenAI Proxy Client Error:', error);
    throw error;
  }
}

/**
 * Example usage hook for React components
 */
export function useOpenAIGeneration() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async (options: OpenAIRequestOptions): Promise<OpenAIResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await callOpenAIProxy(options);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { generate, isLoading, error };
}

// React import for the hook
import { useState } from 'react';