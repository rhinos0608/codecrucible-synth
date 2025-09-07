import { Agent, fetch } from 'undici';

export class OllamaHttpClient {
  private readonly baseUrl: string;
  private readonly agent: Agent;

  public constructor(baseUrl: string, maxConnections = 10) {
    this.baseUrl = baseUrl;

    this.agent = new Agent({ keepAliveTimeout: 60_000, connections: maxConnections });

    this.agent = new Agent({
      keepAliveTimeout: 60_000,
      connections: maxConnections,
    });

  }

  public async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = (await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      dispatcher: this.agent,
      signal,
    })) as unknown as Response;

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return (await response.json()) as T;
  }

  public async post(path: string, body: unknown, signal?: AbortSignal): Promise<Response> {
    const response = (await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      dispatcher: this.agent,
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
      signal,

    })) as unknown as Response;
    return response;

    });
    return response as unknown as Response;

  }
}
