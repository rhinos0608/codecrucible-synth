import { logger } from '../infrastructure/logging/logger.js';
import { toError, toErrorOrUndefined } from '../utils/type-guards.js';
import axios, { AxiosError } from 'axios';

export interface ExaSearchConfig {
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  timeout: number;
  maxResults: number;
}

export interface ExaSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
  author?: string;
}

export interface ExaSearchResponse {
  query: string;
  results: ExaSearchResult[];
  totalResults: number;
  searchTime: number;
}

/**
 * Exa Search MCP Tool Integration
 *
 * Provides advanced web search capabilities with high-quality,
 * developer-focused search results using Exa's neural search API.
 */
export class ExaSearchTool {
  private config: ExaSearchConfig;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(config: ExaSearchConfig) {
    this.config = {
      ...config,
      baseUrl: config.baseUrl || 'https://api.exa.ai',
      timeout: config.timeout || 30000,
      maxResults: config.maxResults || 10,
    };
  }

  /**
   * Perform neural web search with Exa API
   */
  public async search(
    query: string,
    options: {
      numResults?: number;
      includeDomains?: string[];
      excludeDomains?: string[];
      startCrawlDate?: string;
      endCrawlDate?: string;
      startPublishedDate?: string;
      endPublishedDate?: string;
      useAutoprompt?: boolean;
      type?: 'neural' | 'keyword';
      category?: string;
      includeText?: boolean;
    } = {}
  ): Promise<ExaSearchResponse> {
    if (!this.config.enabled) {
      throw new Error('Exa Search is not enabled');
    }

    if (!this.config.apiKey) {
      throw new Error('Exa Search API key not configured');
    }

    await this.enforceRateLimit();

    const startTime = Date.now();

    try {
      const searchParams = {
        query,
        numResults: Math.min(options.numResults || this.config.maxResults, 100),
        includeDomains: options.includeDomains,
        excludeDomains: options.excludeDomains,
        startCrawlDate: options.startCrawlDate,
        endCrawlDate: options.endCrawlDate,
        startPublishedDate: options.startPublishedDate,
        endPublishedDate: options.endPublishedDate,
        useAutoprompt: options.useAutoprompt ?? true,
        type: options.type || 'neural',
        category: options.category,
        includeText: options.includeText ?? true,
      };

      // Remove undefined values
      Object.keys(searchParams).forEach(
        key =>
          searchParams[key as keyof typeof searchParams] === undefined &&
          delete searchParams[key as keyof typeof searchParams]
      );

      const response = await axios.post<{
        results: ExaSearchResult[];
      }>(`${this.config.baseUrl}/search`, searchParams, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.config.timeout,
      });

      const searchTime = Date.now() - startTime;

      return {
        query,
        totalResults: response.data.results?.length || 0,
        results: await this.processSearchResults(response.data.results),
        searchTime,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        logger.error('Exa search failed:', toError(error.message));
      } else {
        logger.error('Exa search failed:', toErrorOrUndefined(error));
      }

      if (axios.isAxiosError(error) && error.response?.status === 401) {
        throw new Error('Exa Search API authentication failed. Check your API key.');
      } else if (axios.isAxiosError(error) && error.response?.status === 429) {
        throw new Error('Exa Search API rate limit exceeded. Please try again later.');
      } else if ((error as AxiosError).code === 'ECONNABORTED') {
        throw new Error('Exa Search request timed out. Try with a simpler query.');
      } else {
        if (error instanceof Error) {
          throw new Error(`Exa Search failed: ${error.message}`);
        } else {
          throw new Error('Exa Search failed: Unknown error');
        }
      }
    }
  }

  /**
   * Search for coding-related content with developer-optimized settings
   */
  public async searchCode(
    query: string,
    language?: string,
    options: {
      includeGitHub?: boolean;
      includeStackOverflow?: boolean;
      includeDocumentation?: boolean;
      recentOnly?: boolean;
    } = {}
  ): Promise<ExaSearchResponse> {
    let enhancedQuery = query;

    if (language) {
      enhancedQuery += ` ${language} programming`;
    }

    const searchOptions: {
      numResults: number;
      useAutoprompt: boolean;
      type: 'neural' | 'keyword';
      includeText: boolean;
      includeDomains?: string[];
      startPublishedDate?: string;
    } = {
      numResults: 15,
      useAutoprompt: true,
      type: 'neural',
      includeText: true,
    };

    // Configure domains based on options
    const includeDomains = [];
    if (options.includeGitHub !== false) {
      includeDomains.push('github.com');
    }
    if (options.includeStackOverflow !== false) {
      includeDomains.push('stackoverflow.com', 'stackexchange.com');
    }
    if (options.includeDocumentation !== false) {
      includeDomains.push('docs.python.org', 'developer.mozilla.org', 'reactjs.org', 'nodejs.org');
    }

    if (includeDomains.length > 0) {
      searchOptions.includeDomains = includeDomains;
    }

    // Recent content filter
    if (options.recentOnly) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      const [datePart] = oneYearAgo.toISOString().split('T');
      searchOptions.startPublishedDate = datePart;
    }

    return this.search(enhancedQuery, searchOptions);
  }

  /**
   * Find similar content to a given URL or text
   */
  public async findSimilar(
    input: string,
    options: {
      isUrl?: boolean;
      numResults?: number;
      category?: string;
    } = {}
  ): Promise<ExaSearchResponse> {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('Exa Search not properly configured');
    }

    await this.enforceRateLimit();

    const startTime = Date.now();

    try {
      const requestBody: {
        numResults: number;
        category?: string;
        url?: string;
        text?: string;
      } = {
        numResults: options.numResults || 10,
        category: options.category,
      };

      if (options.isUrl) {
        requestBody.url = input;
      } else {
        requestBody.text = input;
      }

      const response = await axios.post<{
        results: ExaSearchResult[];
      }>(`${this.config.baseUrl}/findSimilar`, requestBody, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.config.timeout,
      });

      const searchTime = Date.now() - startTime;

      const results = await this.processSearchResults(response.data.results || []);
      const totalResults: number = response.data.results?.length || 0;

      return {
        query: input,
        results,
        totalResults,
        searchTime,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Exa findSimilar failed', toError(error.message));
        throw new Error(`Exa findSimilar failed: ${error.message}`);
      } else {
        logger.error('Exa findSimilar failed', toErrorOrUndefined(error));
        throw new Error('Exa findSimilar failed: Unknown error');
      }
    }
  }

  /**
   * Get content from a specific URL with Exa's content extraction
   */
  public async getContent(
    urls: string | readonly string[],
    options: Readonly<{
      text?: boolean;
      highlights?: boolean;
      summary?: boolean;
    }> = {}
  ): Promise<Record<string, unknown>> {
    if (!this.config.enabled || !this.config.apiKey) {
      throw new Error('Exa Search not properly configured');
    }

    await this.enforceRateLimit();

    try {
      const requestBody = {
        ids: Array.isArray(urls) ? urls : [urls],
        contents: {
          text: options.text ?? true,
          highlights: options.highlights ?? false,
          summary: options.summary ?? false,
        },
      };

      const response = await axios.post(`${this.config.baseUrl}/contents`, requestBody, {
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.config.timeout,
      });

      return response.data as Record<string, unknown>;
    } catch (error: unknown) {
      if (error instanceof Error) {
        logger.error('Exa getContent failed', toError(error.message));
        throw new Error(`Exa getContent failed: ${error.message}`);
      } else {
        logger.error('Exa getContent failed', toErrorOrUndefined(error));
        throw new Error('Exa getContent failed: Unknown error');
      }
    }
  }

  /**
   * Search with auto-categorization for better results
   */
  public async smartSearch(
    query: string,
    context: 'development' | 'research' | 'troubleshooting' | 'learning' = 'development'
  ): Promise<ExaSearchResponse> {
    const contextConfigs = {
      development: {
        includeDomains: ['github.com', 'stackoverflow.com', 'developer.mozilla.org'],
        useAutoprompt: true,
        type: 'neural' as const,
        numResults: 12,
      },
      research: {
        useAutoprompt: true,
        type: 'neural' as const,
        numResults: 20,
        includeText: true,
      },
      troubleshooting: {
        includeDomains: ['stackoverflow.com', 'github.com', 'reddit.com'],
        useAutoprompt: false,
        type: 'keyword' as const,
        numResults: 15,
      },
      learning: {
        includeDomains: ['developer.mozilla.org', 'docs.python.org', 'reactjs.org', 'nodejs.org'],
        useAutoprompt: true,
        type: 'neural' as const,
        numResults: 10,
      },
    };

    const config = contextConfigs[context];
    return this.search(query, config);
  }

  /**
   * Process and normalize search results
   */
  private async processSearchResults(results: ExaSearchResult[]): Promise<ExaSearchResult[]> {
    const processedResults = await Promise.all(
      results.map(async (result: ExaSearchResult) => ({
        title: result.title || 'Untitled',
        url: result.url || '',
        content: await this.cleanContent(result.content || ''),
        score: result.score || 0,
        publishedDate: result.publishedDate,
        author: result.author,
      }))
    );
    return processedResults;
  }

  /**
   * Clean and truncate content for better readability using configurable limits
   */
  private async cleanContent(content: string): Promise<string> {
    if (!content) return '';

    // Remove excessive whitespace
    let cleaned = content.replace(/\s+/g, ' ').trim();

    // Use configurable truncation instead of hard-coded 1000 chars
    try {
      const { outputConfig } = await import('../utils/output-config.js');
      cleaned = outputConfig.truncateForContext(cleaned, 'searchContent');
    } catch (error) {
      // Fallback to original behavior if config loading fails
      if (cleaned.length > 1000) {
        cleaned = `${cleaned.substring(0, 1000)}...`;
      }
    }

    return cleaned;
  }

  /**
   * Rate limiting to respect API limits
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 100; // 100ms between requests

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;
  }

  /**
   * Get usage statistics
   */
  public getUsageStats(): {
    requestCount: number;
    isEnabled: boolean;
    hasApiKey: boolean;
    lastRequestTime: number;
  } {
    return {
      requestCount: this.requestCount,
      isEnabled: this.config.enabled,
      hasApiKey: !!this.config.apiKey,
      lastRequestTime: this.lastRequestTime,
    };
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.config.apiKey) {
      return false;
    }

    try {
      await this.search('test query', { numResults: 1 });
      return true;
    } catch (error) {
      logger.warn('Exa Search connection test failed', { error: toErrorOrUndefined(error) });
      return false;
    }
  }
}
