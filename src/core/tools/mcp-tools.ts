import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { ExaSearchTool } from '../../mcp-tools/exa-search-tool.js';
import { logger } from '../logger.js';

/**
 * Ref Documentation Search Tool
 * Uses the ref MCP tools available in Claude Code for documentation search
 */
export class RefDocumentationTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      query: z.string().describe('Documentation search query with programming language/framework names'),
      includePrivate: z.boolean().optional().default(false).describe('Include private documentation sources')
    });

    super({
      name: 'refDocSearch',
      description: 'Search programming documentation using ref tools for code-related queries',
      category: 'Research',
      parameters,
      examples: [
        'Search TypeScript React hooks documentation',
        'Find Next.js routing best practices',
        'Look up Jest testing framework API'
      ]
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      logger.info(`🔍 Ref doc search: ${args.query}`);
      
      // Note: In the actual implementation, we would call the ref MCP tools
      // For now, this is a placeholder that shows the integration pattern
      const searchQuery = args.includePrivate ? 
        `${args.query} ref_src=private` : 
        args.query;

      return {
        results: [
          {
            title: `Documentation search for: ${args.query}`,
            description: 'This tool would integrate with ref MCP tools for real documentation search',
            note: 'Integration with ref MCP tools needs to be implemented using Claude Code MCP integration'
          }
        ],
        query: searchQuery,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Ref documentation search failed:', error);
      return { 
        error: `Documentation search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: args.query
      };
    }
  }
}

/**
 * Exa AI Web Search Tool
 * Advanced web search using Exa's neural search capabilities
 */
export class ExaWebSearchTool extends BaseTool {
  private exaSearchTool?: ExaSearchTool;

  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      query: z.string().describe('Web search query for current information and solutions'),
      numResults: z.number().optional().default(5).describe('Number of search results to return (1-10)'),
      searchType: z.enum(['general', 'research', 'documentation', 'code']).optional().default('general').describe('Type of search to perform')
    });

    super({
      name: 'exaWebSearch',
      description: 'Perform advanced web search using Exa AI for current information, documentation, and solutions',
      category: 'Research',
      parameters,
      examples: [
        'Search for latest TypeScript 5.0 features',
        'Find React performance optimization techniques',
        'Look up current Node.js security best practices'
      ]
    });

    // Initialize Exa search if API key is available
    this.initializeExaSearch();
  }

  private initializeExaSearch() {
    try {
      // Check for Exa API key in environment
      const apiKey = process.env.EXA_API_KEY;
      if (apiKey) {
        this.exaSearchTool = new ExaSearchTool({
          enabled: true,
          apiKey,
          baseUrl: 'https://api.exa.ai',
          timeout: 30000,
          maxResults: 10
        });
      }
    } catch (error) {
      logger.warn('Exa search tool initialization failed:', error);
    }
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      logger.info(`🔍 Exa web search: ${args.query}`);
      
      if (!this.exaSearchTool) {
        return {
          error: 'Exa search not available - API key not configured',
          suggestion: 'Set EXA_API_KEY environment variable to enable advanced web search',
          query: args.query
        };
      }

      // Use the Exa search tool
      const results = await this.exaSearchTool.search(args.query, {
        numResults: Math.min(args.numResults, 10),
        category: args.searchType
      });

      return {
        query: args.query,
        searchType: args.searchType,
        results: results.results.map(result => ({
          title: result.title,
          url: result.url,
          content: result.content.substring(0, 500) + (result.content.length > 500 ? '...' : ''),
          score: result.score,
          publishedDate: result.publishedDate
        })),
        totalResults: results.totalResults,
        searchTime: results.searchTime
      };
    } catch (error) {
      logger.error('Exa web search failed:', error);
      return { 
        error: `Web search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: args.query
      };
    }
  }
}

/**
 * Deep Research Tool
 * Uses Exa's deep research capabilities for comprehensive analysis
 */
export class ExaDeepResearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      topic: z.string().describe('Research topic requiring comprehensive analysis'),
      model: z.enum(['exa-research', 'exa-research-pro']).optional().default('exa-research').describe('Research model to use'),
      focusAreas: z.array(z.string()).optional().describe('Specific areas to focus research on')
    });

    super({
      name: 'exaDeepResearch',
      description: 'Perform comprehensive deep research using Exa AI for complex topics requiring thorough analysis',
      category: 'Research',
      parameters,
      examples: [
        'Research current state of React Server Components',
        'Analyze TypeScript performance optimization strategies',
        'Investigate modern testing frameworks comparison'
      ]
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      logger.info(`🧠 Deep research: ${args.topic}`);
      
      // Note: This would integrate with Exa's deep research API
      return {
        topic: args.topic,
        model: args.model,
        status: 'Deep research tool integration pending',
        note: 'This tool would use Exa deep research API for comprehensive analysis',
        focusAreas: args.focusAreas || [],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Deep research failed:', error);
      return { 
        error: `Deep research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        topic: args.topic
      };
    }
  }
}

/**
 * Company Research Tool
 * Uses Exa for researching companies and organizations
 */
export class ExaCompanyResearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      companyName: z.string().describe('Name of the company to research'),
      aspects: z.array(z.enum(['overview', 'technology', 'culture', 'financials', 'news'])).optional().default(['overview']).describe('Aspects to research about the company')
    });

    super({
      name: 'exaCompanyResearch',
      description: 'Research companies and organizations using Exa AI for comprehensive business intelligence',
      category: 'Research',
      parameters,
      examples: [
        'Research Microsoft technology stack',
        'Find information about Google engineering culture',
        'Analyze recent news about OpenAI'
      ]
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      logger.info(`🏢 Company research: ${args.companyName}`);
      
      return {
        companyName: args.companyName,
        aspects: args.aspects,
        status: 'Company research tool integration pending',
        note: 'This tool would use Exa company research API',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Company research failed:', error);
      return { 
        error: `Company research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        company: args.companyName
      };
    }
  }
}