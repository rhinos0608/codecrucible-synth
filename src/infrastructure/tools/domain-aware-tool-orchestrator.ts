import { createLogger } from '../logging/logger-adapter.js';
import { ResponseNormalizer } from '../../utils/response-normalizer.js';

/**
 * Domain-Aware Tool Orchestrator
 *
 * Intelligent tool selection based on task domains to:
 * 1. Solve Ollama payload size limits (reduce tools from 21 to 3-7)
 * 2. Improve LLM tool selection accuracy with focused toolsets
 * 3. Increase performance with domain-specific optimization
 * 4. Provide contextually relevant tools for better results
 */

export interface ToolDomain {
  name: string;
  description: string;
  keywords: string[];
  tools: string[];
  priority: number;
  maxTools?: number; // Optional limit per domain
}

export interface DomainAnalysis {
  primaryDomain: string;
  confidence: number;
  secondaryDomains: string[];
  detectedKeywords: string[];
  reasoning: string;
}

export class DomainAwareToolOrchestrator {
  private readonly toolDomains: Map<string, ToolDomain>;
  private readonly keywordIndex: Map<string, string[]>; // keyword -> domain names
  private readonly logger = createLogger('ToolOrchestrator');

  constructor() {
    this.toolDomains = new Map();
    this.keywordIndex = new Map();
    this.initializeToolDomains();
    this.buildKeywordIndex();
  }

  /**
   * Define tool domains with their associated tools and keywords
   */
  private initializeToolDomains(): void {
    const domains: ToolDomain[] = [
      {
        name: 'coding',
        description: 'Software development, code analysis, file operations',
        keywords: [
          // File operations
          'read',
          'write',
          'file',
          'directory',
          'folder',
          'create',
          'delete',
          'modify',
          'edit',
          // Code-related
          'code',
          'function',
          'class',
          'variable',
          'debug',
          'error',
          'bug',
          'refactor',
          'implement',
          'build',
          'compile',
          'test',
          'syntax',
          'programming',
          'develop',
          // Languages
          'javascript',
          'typescript',
          'python',
          'java',
          'cpp',
          'rust',
          'go',
          'html',
          'css',
          // Development
          'repository',
          'git',
          'commit',
          'branch',
          'merge',
          'deploy',
          'package',
          'dependency',
        ],
        tools: [
          'filesystem_read_file',
          'filesystem_write_file',
          'filesystem_list_directory',
          'filesystem_file_stats',
          'filesystem_find_files',
          'mcp_execute_command', // For build commands
          'mcp_read_file',
          'mcp_write_file',
        ],
        priority: 1,
        maxTools: 3, // CRITICAL: Ollama performance optimization
      },
      {
        name: 'research',
        description: 'Information gathering, web search, analysis',
        keywords: [
          'research',
          'search',
          'find',
          'discover',
          'investigate',
          'analyze',
          'study',
          'information',
          'data',
          'facts',
          'learn',
          'explore',
          'understand',
          'explain',
          'what is',
          'how to',
          'why',
          'when',
          'where',
          'who',
          'compare',
          'evaluate',
          'documentation',
          'manual',
          'guide',
          'tutorial',
          'help',
          'lookup',
        ],
        tools: [
          'mcp_read_file', // For reading docs/README
          'filesystem_read_file', // For local research
          'mcp_list_directory', // For exploring structure
          'filesystem_find_files', // For finding relevant files
        ],
        priority: 2,
        maxTools: 5,
      },
      {
        name: 'system',
        description: 'System administration, process management, configuration',
        keywords: [
          'system',
          'process',
          'service',
          'daemon',
          'status',
          'monitor',
          'performance',
          'memory',
          'cpu',
          'disk',
          'network',
          'install',
          'configure',
          'setup',
          'environment',
          'path',
          'variable',
          'permission',
          'user',
          'admin',
          'sudo',
          'command',
          'terminal',
          'shell',
          'bash',
          'execute',
          'run',
          'launch',
        ],
        tools: [
          'mcp_execute_command',
          'mcp_remote_execute',
          'mcp_list_directory',
          'filesystem_list_directory',
          'filesystem_file_stats',
        ],
        priority: 3,
        maxTools: 6,
      },
      {
        name: 'planning',
        description: 'Task management, project planning, organization',
        keywords: [
          'plan',
          'task',
          'todo',
          'organize',
          'manage',
          'schedule',
          'priority',
          'workflow',
          'process',
          'project',
          'milestone',
          'deadline',
          'timeline',
          'track',
          'progress',
          'status',
          'complete',
          'finish',
          'done',
          'strategy',
          'approach',
          'methodology',
          'steps',
          'phases',
        ],
        tools: [
          'mcp_plan_request',
          'mcp_get_next_task',
          'mcp_mark_task_done',
          'mcp_read_file', // For reading project docs
        ],
        priority: 4,
        maxTools: 4,
      },
      {
        name: 'mixed',
        description: 'Multi-domain tasks requiring diverse tools',
        keywords: [
          'complex',
          'multiple',
          'various',
          'different',
          'several',
          'both',
          'comprehensive',
          'full',
          'complete',
          'everything',
          'all',
          'analysis and',
          'research and',
          'build and',
          'create and',
        ],
        tools: [
          'filesystem_read_file',
          'filesystem_write_file',
          'mcp_execute_command',
          'mcp_read_file',
          'mcp_plan_request',
          'mcp_list_directory',
        ],
        priority: 5,
        maxTools: 10, // Higher limit for mixed tasks
      },
    ];

    domains.forEach(domain => {
      this.toolDomains.set(domain.name, domain);
    });

    this.logger.info('Domain-aware tool orchestrator initialized', {
      domainCount: domains.length,
      totalKeywords: domains.reduce((sum, d) => sum + d.keywords.length, 0),
    });
  }

  /**
   * Build reverse keyword index for fast domain lookup
   */
  private buildKeywordIndex(): void {
    for (const [domainName, domain] of this.toolDomains) {
      domain.keywords.forEach(keyword => {
        const normalizedKeyword = keyword.toLowerCase();
        if (!this.keywordIndex.has(normalizedKeyword)) {
          this.keywordIndex.set(normalizedKeyword, []);
        }
        this.keywordIndex.get(normalizedKeyword)!.push(domainName);
      });
    }

    this.logger.debug('Keyword index built', {
      uniqueKeywords: this.keywordIndex.size,
      avgDomainsPerKeyword:
        Array.from(this.keywordIndex.values()).reduce((sum, domains) => sum + domains.length, 0) /
        this.keywordIndex.size,
    });
  }

  /**
   * Analyze prompt to determine primary and secondary domains
   */
  analyzeDomain(prompt: string): DomainAnalysis {
    const normalizedPrompt = prompt.toLowerCase();
    const words = normalizedPrompt.split(/\s+/);

    const domainScores = new Map<string, number>();
    const detectedKeywords: string[] = [];

    // Score domains based on keyword matches
    for (const word of words) {
      // Check direct keyword matches
      if (this.keywordIndex.has(word)) {
        const domains = this.keywordIndex.get(word)!;
        detectedKeywords.push(word);

        domains.forEach(domain => {
          const currentScore = domainScores.get(domain) || 0;
          domainScores.set(domain, currentScore + 1);
        });
      }

      // Check partial matches for compound keywords
      for (const [keyword, domains] of this.keywordIndex) {
        if (keyword.includes(' ') && normalizedPrompt.includes(keyword)) {
          detectedKeywords.push(keyword);
          domains.forEach(domain => {
            const currentScore = domainScores.get(domain) || 0;
            domainScores.set(domain, currentScore + 2); // Higher weight for phrase matches
          });
        }
      }
    }

    // Apply domain priority weights
    for (const [domain, score] of domainScores) {
      const domainInfo = this.toolDomains.get(domain)!;
      const priorityWeight = 1 / domainInfo.priority; // Lower priority number = higher weight
      domainScores.set(domain, score * priorityWeight);
    }

    // Determine primary and secondary domains
    const sortedDomains = Array.from(domainScores.entries()).sort(
      ([, scoreA], [, scoreB]) => scoreB - scoreA
    );

    const primaryDomain = sortedDomains.length > 0 ? sortedDomains[0][0] : 'mixed';
    const primaryScore = sortedDomains.length > 0 ? sortedDomains[0][1] : 0;
    const secondaryDomains = sortedDomains.slice(1, 3).map(([domain]) => domain);

    // Calculate confidence based on score distribution
    const totalScore = Array.from(domainScores.values()).reduce((sum, score) => sum + score, 0);
    const confidence = totalScore > 0 ? primaryScore / totalScore : 0.5;

    const analysis: DomainAnalysis = {
      primaryDomain,
      confidence: Math.min(confidence, 1.0),
      secondaryDomains,
      detectedKeywords: [...new Set(detectedKeywords)], // Remove duplicates
      reasoning: `Detected ${detectedKeywords.length} keywords, primary domain scored ${primaryScore.toFixed(2)}`,
    };

    this.logger.debug('Domain analysis completed', {
      prompt: `${prompt.substring(0, 100)}...`,
      analysis: {
        primaryDomain: analysis.primaryDomain,
        confidence: analysis.confidence.toFixed(2),
        keywordCount: analysis.detectedKeywords.length,
        secondaryDomains: analysis.secondaryDomains,
      },
    });

    return analysis;
  }

  /**
   * Get domain-specific tool subset for a given prompt
   */
  getToolsForPrompt(
    prompt: string,
    allAvailableTools: any[]
  ): {
    tools: any[];
    analysis: DomainAnalysis;
    reasoning: string;
  } {
    const analysis = this.analyzeDomain(prompt);

    // Get tools for primary domain
    const primaryDomain = this.toolDomains.get(analysis.primaryDomain);
    if (!primaryDomain) {
      this.logger.warn('Unknown primary domain, using mixed tools', {
        primaryDomain: analysis.primaryDomain,
      });
      return this.getToolsForDomain('mixed', allAvailableTools, analysis);
    }

    // Start with primary domain tools
    let selectedToolNames = new Set(primaryDomain.tools);

    // Add tools from secondary domains if confidence is low or mixed task
    if (analysis.confidence < 0.7 || analysis.secondaryDomains.length > 0) {
      analysis.secondaryDomains.forEach(domainName => {
        const secondaryDomain = this.toolDomains.get(domainName);
        if (secondaryDomain) {
          // Add a few tools from secondary domains
          secondaryDomain.tools.slice(0, 2).forEach(tool => {
            selectedToolNames.add(tool);
          });
        }
      });
    }

    // Apply aggressive domain tool limit (CRITICAL: Ollama 500 error fix)
    const maxTools = primaryDomain.maxTools || 3; // Reduced from 8 to 3 for Ollama performance
    if (selectedToolNames.size > maxTools) {
      // Prioritize primary domain tools
      selectedToolNames = new Set([
        ...primaryDomain.tools.slice(0, maxTools - 1), // More aggressive primary selection
        ...Array.from(selectedToolNames).slice(primaryDomain.tools.length, maxTools),
      ]);
    }

    // Filter available tools to match selected tool names
    const selectedTools = allAvailableTools.filter(tool => {
      const toolName = tool.function?.name || tool.name;
      return selectedToolNames.has(toolName);
    });

    const reasoning =
      `Domain: ${analysis.primaryDomain} (${(analysis.confidence * 100).toFixed(0)}% confidence), ` +
      `selected ${selectedTools.length}/${allAvailableTools.length} tools, ` +
      `keywords: ${analysis.detectedKeywords.slice(0, 3).join(', ')}`;

    this.logger.info('Domain-aware tool selection completed', {
      originalToolCount: allAvailableTools.length,
      selectedToolCount: selectedTools.length,
      primaryDomain: analysis.primaryDomain,
      confidence: analysis.confidence.toFixed(2),
      toolNames: selectedTools.map(t => t.function?.name || t.name),
    });

    return {
      tools: selectedTools,
      analysis,
      reasoning,
    };
  }

  /**
   * Get tools for a specific domain
   */
  private getToolsForDomain(
    domainName: string,
    allAvailableTools: any[],
    analysis: DomainAnalysis
  ): {
    tools: any[];
    analysis: DomainAnalysis;
    reasoning: string;
  } {
    const domain = this.toolDomains.get(domainName) || this.toolDomains.get('mixed')!;

    const selectedTools = allAvailableTools.filter(tool => {
      const toolName = tool.function?.name || tool.name;
      return domain.tools.includes(toolName);
    });

    const reasoning = `Fallback to ${domainName} domain, selected ${selectedTools.length} tools`;

    return { tools: selectedTools, analysis, reasoning };
  }

  /**
   * Get all available domains for debugging/info purposes
   */
  getAvailableDomains(): Array<{ name: string; description: string; toolCount: number }> {
    return Array.from(this.toolDomains.entries()).map(([name, domain]) => ({
      name,
      description: domain.description,
      toolCount: domain.tools.length,
    }));
  }
}
