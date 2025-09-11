export class OllamaHttpClient {
  private readonly baseUrl: string;
  private readonly defaultHeaders: Record<string, string>;

  public constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      Connection: 'keep-alive',
    };
  }

  public async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.defaultHeaders,
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
      headers: this.defaultHeaders,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Request failed with status ${response.status}: ${errorText}`);
    }

    return response;
  }
}
