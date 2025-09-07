import { OllamaResponse } from './ollama-config.js';

export async function parseResponse(response: Response): Promise<OllamaResponse> {
  const text = await response.text();
  try {
    return JSON.parse(text) as OllamaResponse;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse Ollama response: ${message}`);
  }
}
