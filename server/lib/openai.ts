import { isDevModeFeatureEnabled, logDevModeBypass } from './dev-mode';
import { logger } from '../logger';

export interface OpenAIRequest {
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
 * Internal OpenAI proxy utility for unlimited GPT-4/3.5 generations in development
 * Following AI_INSTRUCTIONS.md patterns for dev mode and security
 */
export async function callOpenAI({
  prompt,
  model = "gpt-4",
  temperature = 0.7,
  max_tokens = 1024
}: OpenAIRequest): Promise<OpenAIResponse> {
  try {
    // Dev mode fallback: Return mock data if no API key in development
    if (isDevModeFeatureEnabled('mockOpenAI') && !process.env.OPENAI_API_KEY) {
      logDevModeBypass('openai_mock_response', {
        model,
        promptLength: prompt.length,
        reason: 'no_api_key_in_dev'
      });

      return {
        result: `[DEV-GEN 🔧] Mock response for: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}" — Keep building, this is just mock data in development mode.`,
        model: `${model}-mock`,
        usage: {
          prompt_tokens: Math.ceil(prompt.length / 4),
          completion_tokens: 50,
          total_tokens: Math.ceil(prompt.length / 4) + 50
        }
      };
    }

    // Validate API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    // Make request to OpenAI API
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature,
        max_tokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('OpenAI API Error', new Error(data?.error?.message || 'Unknown API error'), {
        status: response.status,
        model,
        promptLength: prompt.length,
        errorCode: data?.error?.code
      });
      throw new Error(data?.error?.message || "OpenAI API Error");
    }

    const result = data.choices?.[0]?.message?.content;
    if (!result) {
      logger.warn('No content returned from OpenAI', {
        model,
        promptLength: prompt.length,
        choices: data.choices?.length || 0
      });
      throw new Error("No content returned from OpenAI");
    }

    // Log successful API usage in dev mode
    if (isDevModeFeatureEnabled('extendedLogging')) {
      logDevModeBypass('openai_api_success', {
        model,
        promptLength: prompt.length,
        responseLength: result.length,
        tokensUsed: data.usage?.total_tokens || 0
      });
    }

    return {
      result,
      model,
      usage: data.usage
    };

  } catch (error) {
    logger.error('OpenAI proxy error', error as Error, {
      model,
      promptLength: prompt.length,
      hasApiKey: !!process.env.OPENAI_API_KEY
    });
    throw error;
  }
}

/**
 * Validate OpenAI request parameters
 */
export function validateOpenAIRequest(req: any): OpenAIRequest {
  const { prompt, model, temperature, max_tokens } = req;

  if (!prompt || typeof prompt !== "string") {
    throw new Error("Missing or invalid prompt");
  }

  if (prompt.trim().length === 0) {
    throw new Error("Prompt cannot be empty");
  }

  if (prompt.length > 15000) {
    throw new Error("Prompt exceeds maximum length of 15000 characters");
  }

  if (model && typeof model !== "string") {
    throw new Error("Model must be a string");
  }

  if (temperature !== undefined && (typeof temperature !== "number" || temperature < 0 || temperature > 2)) {
    throw new Error("Temperature must be a number between 0 and 2");
  }

  if (max_tokens !== undefined && (typeof max_tokens !== "number" || max_tokens < 1 || max_tokens > 4000)) {
    throw new Error("Max tokens must be a number between 1 and 4000");
  }

  return {
    prompt: prompt.trim(),
    model: model || "gpt-4",
    temperature: temperature ?? 0.7,
    max_tokens: max_tokens ?? 1024
  };
}