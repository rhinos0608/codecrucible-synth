import { Agent } from 'undici';

export class OllamaHttpClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.agent = new Agent({ keepAliveTimeout: 60_000, connections: 100 });
  }

  public async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      dispatcher: this.agent,
      signal,
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  public async post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      dispatcher: this.agent,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
    });
    return response;
  }
}
