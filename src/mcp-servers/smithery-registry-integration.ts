/**
 * Smithery Registry Integration
 * Connects to Smithery.ai registry to discover and use MCP servers
 */

import { SmitheryRegistry } from '@smithery/registry';
import { logger } from '../core/logger.js';

export interface SmitheryConfig {
  apiKey: string;
  retryConfig?: {
    strategy: 'backoff';
    backoff: {
      initialInterval: number;
      maxInterval: number;
      exponent: number;
      maxElapsedTime: number;
    };
    retryConnectionErrors: boolean;
  };
}

export interface SmitheryServer {
  qualifiedName: string;
  displayName: string;
  description: string;
  homepage: string;
  useCount: number;
  tools: Array<{
    name: string;
    description: string;
    inputSchema: any;
  }>;
}

export class SmitheryRegistryIntegration {
  private registry: SmitheryRegistry;
  private config: SmitheryConfig;
  private cachedServers: Map<string, SmitheryServer> = new Map();

  constructor(config: SmitheryConfig) {
    this.config = config;
    
    // Initialize Smithery registry with bearer authentication
    this.registry = new SmitheryRegistry({
      bearerAuth: config.apiKey,
      retryConfig: config.retryConfig || {
        strategy: 'backoff',
        backoff: {
          initialInterval: 1000,
          maxInterval: 5000,
          exponent: 1.5,
          maxElapsedTime: 30000,
        },
        retryConnectionErrors: true,
      },
    });

    logger.info('Smithery Registry integration initialized');
  }

  /**
   * Search for MCP servers in the Smithery registry
   */
  async searchServers(query: string, limit: number = 10): Promise<SmitheryServer[]> {
    try {
      logger.info(`Searching Smithery registry for: ${query}`);

      const result = await this.registry.servers.list({
        q: query,
      });

      const servers: SmitheryServer[] = [];
      
      // Process first page of results
      for await (const page of result) {
        if (servers.length >= limit) break;
        
        // Check if page has result property
        const pageServers = (page as any).result?.servers || (page as any).servers || [];
        
        for (const server of pageServers) {
          if (servers.length >= limit) break;
          
          const serverDetails: SmitheryServer = {
            qualifiedName: server.qualifiedName,
            displayName: server.displayName,
            description: server.description || 'No description available',
            homepage: server.homepage || '',
            useCount: server.useCount || 0,
            tools: [], // Will be populated by getServerDetails
          };
          
          servers.push(serverDetails);
          this.cachedServers.set(server.qualifiedName, serverDetails);
        }
      }

      logger.info(`Found ${servers.length} servers in Smithery registry`);
      return servers;
    } catch (error) {
      logger.error('Error searching Smithery registry:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about a specific server
   */
  async getServerDetails(qualifiedName: string): Promise<SmitheryServer | null> {
    try {
      // Check cache first
      if (this.cachedServers.has(qualifiedName)) {
        const cached = this.cachedServers.get(qualifiedName)!;
        if (cached.tools.length > 0) {
          return cached;
        }
      }

      logger.info(`Fetching details for server: ${qualifiedName}`);

      const result = await this.registry.servers.get({
        qualifiedName,
      });

      const serverDetails: SmitheryServer = {
        qualifiedName: result.qualifiedName,
        displayName: result.displayName,
        description: (result as any).description || 'No description available',
        homepage: (result as any).homepage || '',
        useCount: (result as any).useCount || 0,
        tools: (result.tools || []).map((tool: any) => ({
          name: tool.name,
          description: tool.description || 'No description available',
          inputSchema: tool.inputSchema || {},
        })),
      };

      this.cachedServers.set(qualifiedName, serverDetails);
      logger.info(`Retrieved details for ${qualifiedName} with ${serverDetails.tools.length} tools`);
      
      return serverDetails;
    } catch (error) {
      logger.error(`Error getting server details for ${qualifiedName}:`, error);
      return null;
    }
  }

  /**
   * Get popular MCP servers from the registry
   */
  async getPopularServers(limit: number = 20): Promise<SmitheryServer[]> {
    return this.searchServers('is:verified', limit);
  }

  /**
   * Get servers by category or owner
   */
  async getServersByOwner(owner: string, limit: number = 10): Promise<SmitheryServer[]> {
    return this.searchServers(`owner:${owner}`, limit);
  }

  /**
   * Search for servers by tag or functionality
   */
  async getServersByTag(tag: string, limit: number = 10): Promise<SmitheryServer[]> {
    return this.searchServers(`tag:${tag}`, limit);
  }

  /**
   * Get all cached servers
   */
  getCachedServers(): SmitheryServer[] {
    return Array.from(this.cachedServers.values());
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cachedServers.clear();
    logger.info('Smithery server cache cleared');
  }

  /**
   * Health check for Smithery registry connection
   */
  async healthCheck(): Promise<{ status: string; serversAvailable: number; error?: string }> {
    try {
      // Try to list a few servers to test connectivity
      const result = await this.registry.servers.list({
        q: 'is:verified',
      });

      let count = 0;
      for await (const page of result) {
        const pageServers = (page as any).result?.servers || (page as any).servers || [];
        count += pageServers.length;
        break; // Just check first page
      }

      return {
        status: 'healthy',
        serversAvailable: count,
      };
    } catch (error) {
      logger.error('Smithery registry health check failed:', error);
      return {
        status: 'error',
        serversAvailable: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}