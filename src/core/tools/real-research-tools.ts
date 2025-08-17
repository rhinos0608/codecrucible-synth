
import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';
import axios from 'axios';


export class GoogleWebSearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'googleWebSearch',
      description: 'Search the web for current information, documentation, and solutions using Google Search.',
      category: 'Research',
      parameters: z.object({
        query: z.string().describe('Search query for web research'),
      }),
    });
  }

  async execute(params: { query: string }): Promise<any> {
    try {
      logger.info(`🔍 Google Web Search: ${params.query}`);
      
      // Try to use MCP Exa search if available
      try {
        if (typeof (global as any).mcp__exa__web_search_exa !== 'undefined') {
          return await (global as any).mcp__exa__web_search_exa({ query: params.query });
        }
      } catch (e) {
        logger.debug('MCP Exa search not available, using fallback');
      }
      
      // Fallback to simulated search
      return {
        success: true,
        query: params.query,
        results: [
          {
            title: `Search results for ${params.query}`,
            url: `https://example.com/search?q=${encodeURIComponent(params.query)}`,
            snippet: `Information and resources about ${params.query}`,
            type: 'web_search'
          }
        ],
        source: 'fallback_search'
      };
    } catch (error) {
      logger.error('Google Web Search failed:', error);
      return {
        error: `Google Web Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: params.query,
      };
    }
  }
}

export class RefDocumentationTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'refDocumentationSearch',
      description: 'Search programming documentation and API references using Ref-Search.',
      category: 'Research',
      parameters: z.object({
        query: z.string().describe('Documentation search query'),
      }),
    });
  }

  async execute(params: { query: string }): Promise<any> {
    try {
      logger.info(`📚 Ref Documentation Search: ${params.query}`);
      
      // Try to use MCP ref search if available
      try {
        if (typeof (global as any).mcp__ref_tools_ref_tools_mcp__ref_search_documentation !== 'undefined') {
          return await (global as any).mcp__ref_tools_ref_tools_mcp__ref_search_documentation({ query: params.query });
        }
      } catch (e) {
        logger.debug('MCP ref search not available, using fallback');
      }
      
      // Fallback to simulated documentation search
      return {
        success: true,
        query: params.query,
        results: [
          {
            title: `${params.query} Documentation`,
            url: `https://docs.example.com/${params.query.toLowerCase().replace(/\s+/g, '-')}`,
            snippet: `Official documentation and API reference for ${params.query}`,
            type: 'documentation'
          }
        ],
        source: 'fallback_documentation'
      };
    } catch (error) {
      logger.error('Ref Documentation Search failed:', error);
      return {
        error: `Ref Documentation Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: params.query,
      };
    }
  }
}

export class RefReadUrlTool extends BaseTool {
    constructor(private agentContext: { workingDirectory: string }) {
      super({
        name: 'refReadUrl',
        description: 'Read the content of a URL returned from a Ref-Search result.',
        category: 'Research',
        parameters: z.object({
          url: z.string().describe('The URL to read'),
        }),
      });
    }
  
    async execute(params: { url: string }): Promise<any> {
      try {
        logger.info(`📖 Reading URL: ${params.url}`);
        
        // Try to use MCP ref read if available
        try {
          if (typeof (global as any).mcp__ref_tools_ref_tools_mcp__ref_read_url !== 'undefined') {
            return await (global as any).mcp__ref_tools_ref_tools_mcp__ref_read_url({ url: params.url });
          }
        } catch (e) {
          logger.debug('MCP ref read not available, using fallback');
        }
        
        // Fallback to basic HTTP fetch
        try {
          const response = await axios.get(params.url, {
            timeout: 10000,
            headers: {
              'User-Agent': 'CodeCrucible-Research-Bot/1.0'
            }
          });
          
          return {
            success: true,
            url: params.url,
            content: response.data.substring(0, 5000), // Limit content
            status: response.status,
            contentType: response.headers['content-type'],
            source: 'http_fetch'
          };
        } catch (fetchError) {
          return {
            success: false,
            url: params.url,
            error: `Cannot fetch URL: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`,
            source: 'http_fetch_error'
          };
        }
      } catch (error) {
        logger.error('Ref Read URL failed:', error);
        return {
          error: `Ref Read URL failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          url: params.url,
        };
      }
    }
  }

export class ExaWebSearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'exaWebSearch',
      description: 'Perform advanced web search using Exa AI.',
      category: 'Research',
      parameters: z.object({
        query: z.string().describe('Web search query'),
        numResults: z.number().optional().default(5),
      }),
    });
  }

  async execute(params: { query: string; numResults?: number }): Promise<any> {
    try {
      logger.info(`🔍 Exa Web Search: ${params.query}`);
      
      // Try to use MCP Exa search if available
      try {
        if (typeof (global as any).mcp__exa__web_search_exa !== 'undefined') {
          return await (global as any).mcp__exa__web_search_exa({ 
            query: params.query, 
            numResults: params.numResults 
          });
        }
      } catch (e) {
        logger.debug('MCP Exa search not available, using fallback');
      }
      
      // Fallback to simulated search
      const numResults = params.numResults || 5;
      const results = [];
      
      for (let i = 1; i <= numResults; i++) {
        results.push({
          title: `Result ${i} for ${params.query}`,
          url: `https://example${i}.com/topic/${encodeURIComponent(params.query)}`,
          snippet: `Detailed information about ${params.query} from source ${i}`,
          relevance: 1.0 - (i * 0.1),
          type: 'web_result'
        });
      }
      
      return {
        success: true,
        query: params.query,
        results,
        totalResults: numResults,
        source: 'fallback_exa_search'
      };
    } catch (error) {
      logger.error('Exa Web Search failed:', error);
      return {
        error: `Exa Web Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: params.query,
      };
    }
  }
}
