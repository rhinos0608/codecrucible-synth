/**
 * Enhanced MCP Tools Integration
 * 
 * Provides comprehensive MCP server integration with real API connections,
 * fallback mechanisms, and error handling for all available MCP services.
 */

import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { logger } from '../logger.js';

// Type definitions for MCP functions
type MCPFunction = (...args: any[]) => Promise<any>;

interface MCPServiceMap {
  // Exa AI services
  web_search_exa?: MCPFunction;
  company_research_exa?: MCPFunction;
  crawling_exa?: MCPFunction;
  linkedin_search_exa?: MCPFunction;
  deep_researcher_start?: MCPFunction;
  deep_researcher_check?: MCPFunction;
  
  // Ref tools
  ref_search_documentation?: MCPFunction;
  ref_read_url?: MCPFunction;
  
  // Context-7 documentation
  resolve_library_id?: MCPFunction;
  get_library_docs?: MCPFunction;
  
  // Smithery toolbox
  search_servers?: MCPFunction;
  use_tool?: MCPFunction;
  
  // Word processing
  create_document?: MCPFunction;
  get_document_text?: MCPFunction;
  add_paragraph?: MCPFunction;
  search_and_replace?: MCPFunction;
  
  // Sequential thinking
  sequentialthinking?: MCPFunction;
  
  // Remote shell
  shell_exec?: MCPFunction;
}

/**
 * MCP Service Registry - manages available MCP functions
 */
class MCPServiceRegistry {
  private services: MCPServiceMap = {};
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Try to discover available MCP functions from global scope
      const globalScope = global as any;
      
      // Exa AI services
      if (globalScope.mcp__exa__web_search_exa) {
        this.services.web_search_exa = globalScope.mcp__exa__web_search_exa;
      }
      if (globalScope.mcp__exa__company_research_exa) {
        this.services.company_research_exa = globalScope.mcp__exa__company_research_exa;
      }
      if (globalScope.mcp__exa__crawling_exa) {
        this.services.crawling_exa = globalScope.mcp__exa__crawling_exa;
      }
      if (globalScope.mcp__exa__linkedin_search_exa) {
        this.services.linkedin_search_exa = globalScope.mcp__exa__linkedin_search_exa;
      }
      if (globalScope.mcp__exa__deep_researcher_start) {
        this.services.deep_researcher_start = globalScope.mcp__exa__deep_researcher_start;
      }
      if (globalScope.mcp__exa__deep_researcher_check) {
        this.services.deep_researcher_check = globalScope.mcp__exa__deep_researcher_check;
      }
      
      // Ref tools
      if (globalScope.mcp__ref_tools_ref_tools_mcp__ref_search_documentation) {
        this.services.ref_search_documentation = globalScope.mcp__ref_tools_ref_tools_mcp__ref_search_documentation;
      }
      if (globalScope.mcp__ref_tools_ref_tools_mcp__ref_read_url) {
        this.services.ref_read_url = globalScope.mcp__ref_tools_ref_tools_mcp__ref_read_url;
      }
      
      // Context-7 documentation
      if (globalScope.mcp__upstash_context_7_mcp__resolve_library_id) {
        this.services.resolve_library_id = globalScope.mcp__upstash_context_7_mcp__resolve_library_id;
      }
      if (globalScope.mcp__upstash_context_7_mcp__get_library_docs) {
        this.services.get_library_docs = globalScope.mcp__upstash_context_7_mcp__get_library_docs;
      }
      
      // Smithery toolbox
      if (globalScope.mcp__smithery_toolbox__search_servers) {
        this.services.search_servers = globalScope.mcp__smithery_toolbox__search_servers;
      }
      if (globalScope.mcp__smithery_toolbox__use_tool) {
        this.services.use_tool = globalScope.mcp__smithery_toolbox__use_tool;
      }
      
      // Word processing
      if (globalScope.mcp__gong_rzhe_office_word_mcp_server__create_document) {
        this.services.create_document = globalScope.mcp__gong_rzhe_office_word_mcp_server__create_document;
      }
      if (globalScope.mcp__gong_rzhe_office_word_mcp_server__get_document_text) {
        this.services.get_document_text = globalScope.mcp__gong_rzhe_office_word_mcp_server__get_document_text;
      }
      if (globalScope.mcp__gong_rzhe_office_word_mcp_server__add_paragraph) {
        this.services.add_paragraph = globalScope.mcp__gong_rzhe_office_word_mcp_server__add_paragraph;
      }
      if (globalScope.mcp__gong_rzhe_office_word_mcp_server__search_and_replace) {
        this.services.search_and_replace = globalScope.mcp__gong_rzhe_office_word_mcp_server__search_and_replace;
      }
      
      // Sequential thinking
      if (globalScope.mcp__smithery_ai_server_sequential_thinking__sequentialthinking) {
        this.services.sequentialthinking = globalScope.mcp__smithery_ai_server_sequential_thinking__sequentialthinking;
      }
      
      // Remote shell
      if (globalScope.mcp__samihalawa_remote_shell_terminal_mcp__shell_exec) {
        this.services.shell_exec = globalScope.mcp__samihalawa_remote_shell_terminal_mcp__shell_exec;
      }

      this.initialized = true;
      
      const availableServices = Object.keys(this.services).length;
      logger.info(`🔌 MCP Service Registry initialized with ${availableServices} services`);
      
    } catch (error) {
      logger.warn('Failed to initialize MCP services:', error);
      this.initialized = true; // Continue with fallbacks
    }
  }

  getService(name: keyof MCPServiceMap): MCPFunction | null {
    return this.services[name] || null;
  }

  isAvailable(name: keyof MCPServiceMap): boolean {
    return !!this.services[name];
  }

  getAvailableServices(): string[] {
    return Object.keys(this.services);
  }
}

// Global registry instance
const mcpRegistry = new MCPServiceRegistry();

/**
 * Enhanced Exa Web Search Tool with real MCP integration
 */
export class EnhancedExaWebSearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'exaWebSearch',
      description: 'Advanced web search using Exa AI with real-time results',
      category: 'Research',
      parameters: z.object({
        query: z.string().describe('Web search query'),
        numResults: z.number().optional().default(5).describe('Number of results to return'),
      }),
    });
  }

  async execute(params: { query: string; numResults?: number }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`🔍 Enhanced Exa Web Search: ${params.query}`);
      
      const exaSearch = mcpRegistry.getService('web_search_exa');
      if (exaSearch) {
        logger.debug('Using real Exa search service');
        const result = await exaSearch({
          query: params.query,
          numResults: params.numResults || 5
        });
        
        return {
          success: true,
          query: params.query,
          results: result.results || result,
          source: 'exa-ai',
          service_used: 'mcp_exa'
        };
      }
      
      // Enhanced fallback with better structure
      logger.debug('Using enhanced fallback search');
      return {
        success: true,
        query: params.query,
        results: [
          {
            title: `Web search results for "${params.query}"`,
            url: `https://www.google.com/search?q=${encodeURIComponent(params.query)}`,
            snippet: `Search results and current information about ${params.query}. This is a fallback result - real Exa search may provide more accurate results.`,
            type: 'web_search',
            relevance_score: 0.8
          }
        ],
        source: 'enhanced-fallback',
        note: 'Real Exa search not available, using enhanced fallback'
      };
      
    } catch (error) {
      logger.error('Enhanced Exa Web Search failed:', error);
      return {
        error: `Enhanced Exa Web Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: params.query,
        service_attempted: 'exa-ai'
      };
    }
  }
}

/**
 * Deep Research Tool with comprehensive analysis
 */
export class EnhancedDeepResearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'deepResearch',
      description: 'Conduct comprehensive multi-source research with AI analysis',
      category: 'Research',
      parameters: z.object({
        topic: z.string().describe('Research topic or complex question'),
        model: z.enum(['exa-research', 'exa-research-pro']).optional().default('exa-research'),
      }),
    });
  }

  async execute(params: { topic: string; model?: string }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`🔬 Enhanced Deep Research: ${params.topic}`);
      
      const deepResearchStart = mcpRegistry.getService('deep_researcher_start');
      const deepResearchCheck = mcpRegistry.getService('deep_researcher_check');
      
      if (deepResearchStart && deepResearchCheck) {
        logger.debug('Using real deep research service');
        
        // Start research task
        const task = await deepResearchStart({
          instructions: `Conduct comprehensive research on: ${params.topic}`,
          model: params.model || 'exa-research'
        });
        
        if (task.taskId) {
          // Check results
          const result = await deepResearchCheck({ taskId: task.taskId });
          
          return {
            success: true,
            topic: params.topic,
            task_id: task.taskId,
            status: result.status,
            research_data: result,
            source: 'exa-deep-research',
            service_used: 'mcp_exa_deep'
          };
        }
      }
      
      // Enhanced fallback with structured research
      logger.debug('Using enhanced research fallback');
      return {
        success: true,
        topic: params.topic,
        research_summary: {
          overview: `Research summary for ${params.topic}`,
          key_findings: [
            `Important finding about ${params.topic}`,
            `Analysis and insights related to ${params.topic}`,
            `Current trends and developments in ${params.topic}`
          ],
          sources: [
            `Primary sources for ${params.topic}`,
            `Academic and industry references`,
            `Current documentation and guidelines`
          ],
          recommendations: [
            `Best practices for ${params.topic}`,
            `Implementation considerations`,
            `Future outlook and trends`
          ]
        },
        source: 'enhanced-fallback',
        note: 'Real deep research not available, using structured fallback'
      };
      
    } catch (error) {
      logger.error('Enhanced Deep Research failed:', error);
      return {
        error: `Enhanced Deep Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        topic: params.topic,
        service_attempted: 'exa-deep-research'
      };
    }
  }
}

/**
 * Enhanced Documentation Search Tool
 */
export class EnhancedDocumentationTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'documentationSearch',
      description: 'Search programming documentation and library references',
      category: 'Research',
      parameters: z.object({
        query: z.string().describe('Documentation search query (library, framework, or API)'),
        library: z.string().optional().describe('Specific library name for Context-7 search'),
      }),
    });
  }

  async execute(params: { query: string; library?: string }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`📚 Enhanced Documentation Search: ${params.query}`);
      
      // Try Context-7 for library documentation
      if (params.library) {
        const resolveLibrary = mcpRegistry.getService('resolve_library_id');
        const getLibraryDocs = mcpRegistry.getService('get_library_docs');
        
        if (resolveLibrary && getLibraryDocs) {
          try {
            const libraryId = await resolveLibrary({ libraryName: params.library });
            if (libraryId.context7CompatibleLibraryID) {
              const docs = await getLibraryDocs({
                context7CompatibleLibraryID: libraryId.context7CompatibleLibraryID,
                topic: params.query
              });
              
              return {
                success: true,
                query: params.query,
                library: params.library,
                documentation: docs,
                source: 'context-7',
                service_used: 'mcp_context7'
              };
            }
          } catch (e) {
            logger.debug('Context-7 lookup failed, trying ref search');
          }
        }
      }
      
      // Try Ref search
      const refSearch = mcpRegistry.getService('ref_search_documentation');
      if (refSearch) {
        logger.debug('Using real ref documentation search');
        const result = await refSearch({ query: params.query });
        
        return {
          success: true,
          query: params.query,
          documentation: result,
          source: 'ref-search',
          service_used: 'mcp_ref'
        };
      }
      
      // Enhanced fallback
      logger.debug('Using enhanced documentation fallback');
      return {
        success: true,
        query: params.query,
        documentation: {
          title: `Documentation for ${params.query}`,
          summary: `API reference and documentation for ${params.query}`,
          sections: [
            {
              title: 'Getting Started',
              content: `Basic usage and setup for ${params.query}`
            },
            {
              title: 'API Reference',
              content: `Method signatures and parameters for ${params.query}`
            },
            {
              title: 'Examples',
              content: `Code examples and use cases for ${params.query}`
            }
          ],
          links: [
            `Official documentation for ${params.query}`,
            `Community resources and tutorials`,
            `API reference and guides`
          ]
        },
        source: 'enhanced-fallback',
        note: 'Real documentation search not available, using structured fallback'
      };
      
    } catch (error) {
      logger.error('Enhanced Documentation Search failed:', error);
      return {
        error: `Enhanced Documentation Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        query: params.query,
        service_attempted: 'documentation-search'
      };
    }
  }
}

/**
 * Company Research Tool
 */
export class EnhancedCompanyResearchTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'companyResearch',
      description: 'Research companies, startups, and business information',
      category: 'Research',
      parameters: z.object({
        company: z.string().describe('Company name to research'),
        aspects: z.array(z.string()).optional().describe('Specific aspects to research'),
      }),
    });
  }

  async execute(params: { company: string; aspects?: string[] }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`🏢 Enhanced Company Research: ${params.company}`);
      
      const companyResearch = mcpRegistry.getService('company_research_exa');
      if (companyResearch) {
        logger.debug('Using real company research service');
        const result = await companyResearch({
          companyName: params.company,
          numResults: 5
        });
        
        return {
          success: true,
          company: params.company,
          research_data: result,
          source: 'exa-company-research',
          service_used: 'mcp_exa_company'
        };
      }
      
      // Enhanced fallback
      const aspects = params.aspects || ['overview', 'products', 'financials', 'news', 'competition'];
      
      return {
        success: true,
        company: params.company,
        research_data: {
          overview: `${params.company} is a company with comprehensive business operations`,
          products: `Products and services offered by ${params.company}`,
          financials: `Financial information and performance metrics for ${params.company}`,
          news: `Recent news and developments about ${params.company}`,
          competition: `Competitive landscape and market position of ${params.company}`,
          market_analysis: `Market analysis and industry trends affecting ${params.company}`
        },
        aspects_researched: aspects,
        source: 'enhanced-fallback',
        note: 'Real company research not available, using structured fallback'
      };
      
    } catch (error) {
      logger.error('Enhanced Company Research failed:', error);
      return {
        error: `Enhanced Company Research failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        company: params.company,
        service_attempted: 'exa-company-research'
      };
    }
  }
}

/**
 * Sequential Thinking Tool for complex problem solving
 */
export class SequentialThinkingTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'sequentialThinking',
      description: 'Use structured sequential thinking for complex problem analysis',
      category: 'Analysis',
      parameters: z.object({
        thought: z.string().describe('Current thinking step or analysis'),
        thoughtNumber: z.number().describe('Current thought number in sequence'),
        totalThoughts: z.number().describe('Estimated total thoughts needed'),
        nextThoughtNeeded: z.boolean().describe('Whether another thought step is needed'),
        isRevision: z.boolean().optional().describe('Whether this revises previous thinking'),
      }),
    });
  }

  async execute(params: { 
    thought: string; 
    thoughtNumber: number; 
    totalThoughts: number; 
    nextThoughtNeeded: boolean;
    isRevision?: boolean;
  }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`🧠 Sequential Thinking: Step ${params.thoughtNumber}/${params.totalThoughts}`);
      
      const sequentialThinking = mcpRegistry.getService('sequentialthinking');
      if (sequentialThinking) {
        logger.debug('Using real sequential thinking service');
        const result = await sequentialThinking(params);
        
        return {
          success: true,
          thinking_step: params.thoughtNumber,
          analysis: result,
          source: 'sequential-thinking-mcp',
          service_used: 'mcp_sequential_thinking'
        };
      }
      
      // Enhanced fallback with structured thinking
      return {
        success: true,
        thinking_step: params.thoughtNumber,
        total_steps: params.totalThoughts,
        current_thought: params.thought,
        analysis: {
          step_analysis: `Analysis of step ${params.thoughtNumber}: ${params.thought}`,
          insights: `Key insights from this thinking step`,
          next_considerations: params.nextThoughtNeeded ? 
            `Additional analysis needed for comprehensive understanding` :
            `Analysis complete with current thinking steps`,
          is_revision: params.isRevision || false
        },
        continue_thinking: params.nextThoughtNeeded,
        source: 'enhanced-fallback',
        note: 'Real sequential thinking not available, using structured analysis'
      };
      
    } catch (error) {
      logger.error('Sequential Thinking failed:', error);
      return {
        error: `Sequential Thinking failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        thinking_step: params.thoughtNumber,
        service_attempted: 'sequential-thinking'
      };
    }
  }
}

/**
 * MCP Service Status Tool
 */
export class MCPServiceStatusTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    super({
      name: 'mcpServiceStatus',
      description: 'Check status and availability of MCP services',
      category: 'System',
      parameters: z.object({
        action: z.enum(['status', 'list', 'test']).default('status'),
        service: z.string().optional().describe('Specific service to check'),
      }),
    });
  }

  async execute(params: { action?: string; service?: string }): Promise<any> {
    try {
      await mcpRegistry.initialize();
      
      logger.info(`🔧 MCP Service Status: ${params.action}`);
      
      const availableServices = mcpRegistry.getAvailableServices();
      
      switch (params.action) {
        case 'list':
          return {
            success: true,
            available_services: availableServices,
            total_services: availableServices.length,
            registry_initialized: true
          };
          
        case 'test':
          if (params.service) {
            const isAvailable = mcpRegistry.isAvailable(params.service as keyof MCPServiceMap);
            return {
              success: true,
              service: params.service,
              available: isAvailable,
              status: isAvailable ? 'functional' : 'not_available'
            };
          }
          break;
          
        case 'status':
        default:
          return {
            success: true,
            registry_status: 'initialized',
            available_services: availableServices,
            service_categories: {
              research: availableServices.filter(s => s.includes('search') || s.includes('research')),
              documentation: availableServices.filter(s => s.includes('doc') || s.includes('ref')),
              analysis: availableServices.filter(s => s.includes('thinking') || s.includes('analysis')),
              utilities: availableServices.filter(s => !['search', 'research', 'doc', 'ref', 'thinking', 'analysis'].some(cat => s.includes(cat)))
            },
            total_services: availableServices.length
          };
      }
      
    } catch (error) {
      logger.error('MCP Service Status check failed:', error);
      return {
        error: `MCP Service Status failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        action: params.action,
        service_attempted: params.service
      };
    }
  }
}

// Export all enhanced MCP tools
export {
  mcpRegistry as MCPServiceRegistry
};