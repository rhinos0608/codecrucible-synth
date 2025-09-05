/**
 * Contextual Tool Filter
 *
 * Intelligent tool filtering that reduces prompt bloat and security risks
 * while maintaining AI's ability to choose appropriate tools for the task.
 *
 * Strategy: Analyze request context and provide relevant tool subsets
 * instead of ALL tools, improving performance and security.
 */

import { logger } from '../logging/unified-logger.js';
import { ToolRegistryKey, ToolCategory, TypedToolIdentifiers, TYPED_TOOL_CATALOG } from './typed-tool-identifiers.js';

export interface ToolFilterContext {
  prompt: string;
  userId?: string;
  sessionId?: string;
  riskLevel?: 'low' | 'medium' | 'high';
  previousTools?: string[];
  fileContext?: {
    workingDirectory?: string;
    recentFiles?: string[];
    projectType?: string;
  };
}

export interface FilterResult {
  tools: any[];
  reasoning: string;
  categories: string[];
  confidence: number;
}

/**
 * Generate contextual tool categories using typed identifiers
 */
function generateToolCategories(): Record<ToolCategory, {
  keywords: string[];
  tools: ToolRegistryKey[];
  priority: number;
  alwaysInclude?: boolean;
}> {
  return {
    // Always available core tools - essential for most operations
    core: {
      keywords: ['file', 'read', 'write', 'list', 'basic', 'essential'],
      tools: TypedToolIdentifiers.getCoreTools().map(t => t.registryKey),
      priority: 10,
      alwaysInclude: true,
    },

    // File operations - broader file management
    filesystem: {
      keywords: [
        'file', 'directory', 'folder', 'path', 'create', 'delete', 'modify', 
        'edit', 'copy', 'move', 'rename', 'permissions', 'exists'
      ],
      tools: TypedToolIdentifiers.getToolsByCategory('filesystem').map(t => t.registryKey),
      priority: 9,
    },

    // Development and coding
    development: {
      keywords: [
        'code', 'function', 'class', 'debug', 'build', 'compile', 'test', 
        'deploy', 'package', 'dependency', 'npm', 'install', 'run',
        'javascript', 'typescript', 'python', 'java', 'rust', 'go'
      ],
      tools: TypedToolIdentifiers.getToolsByCategory('development').map(t => t.registryKey),
      priority: 8,
    },

    // Version control operations
    versionControl: {
      keywords: [
        'git', 'commit', 'push', 'pull', 'branch', 'merge', 'clone', 
        'repository', 'repo', 'version', 'history', 'diff'
      ],
      tools: TypedToolIdentifiers.getToolsByCategory('versionControl').map(t => t.registryKey),
      priority: 7,
    },

    // System and command execution  
    system: {
      keywords: [
        'command', 'execute', 'run', 'shell', 'bash', 'terminal', 'process',
        'install', 'configure', 'setup', 'system', 'environment'
      ],
      tools: TypedToolIdentifiers.getToolsByCategory('system').map(t => t.registryKey),
      priority: 6,
    },

    // External services and integrations
    external: {
      keywords: [
        'smithery', 'external', 'service', 'api', 'integration', 'registry',
        'discover', 'connect', 'status', 'refresh'
      ],
      tools: TypedToolIdentifiers.getToolsByCategory('external').map(t => t.registryKey),
      priority: 5,
    }
  };
}

const TOOL_CATEGORIES = generateToolCategories();

/**
 * Contextual tool filter that intelligently selects relevant tools
 */
export class ContextualToolFilter {
  private readonly MAX_TOOLS = 8; // Optimal for performance and context size
  private readonly MIN_TOOLS = 3; // Always include at least core tools
  
  /**
   * Filter tools based on request context
   */
  filterTools(allTools: any[], context: ToolFilterContext): FilterResult {
    const startTime = Date.now();
    
    // Analyze the request to determine relevant categories
    const analysis = this.analyzeRequest(context);
    
    // Select tools based on analysis
    const selectedTools = this.selectRelevantTools(allTools, analysis);
    
    // Build result
    const result: FilterResult = {
      tools: selectedTools,
      reasoning: this.buildReasoning(analysis, selectedTools.length, allTools.length),
      categories: analysis.categories,
      confidence: analysis.confidence,
    };

    const duration = Date.now() - startTime;
    logger.info('🎯 Contextual tool filtering completed', {
      originalToolCount: allTools.length,
      filteredToolCount: selectedTools.length,
      categories: analysis.categories,
      confidence: analysis.confidence.toFixed(2),
      processingTime: `${duration}ms`,
      reasoning: result.reasoning,
    });

    return result;
  }

  /**
   * Analyze the request to determine intent and relevant categories
   */
  private analyzeRequest(context: ToolFilterContext) {
    const { prompt, riskLevel, previousTools, fileContext } = context;
    const words = prompt.toLowerCase().split(/\s+/);
    
    const categoryScores = new Map<string, number>();
    const detectedKeywords: string[] = [];

    // Score categories based on keyword matches
    for (const [categoryName, category] of Object.entries(TOOL_CATEGORIES)) {
      let score = 0;
      
      for (const keyword of category.keywords) {
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (keywordRegex.test(prompt)) {
          score += 1;
          detectedKeywords.push(keyword);
        }
        
        // Partial matches get lower scores
        for (const word of words) {
          if (word.includes(keyword) || keyword.includes(word)) {
            score += 0.3;
          }
        }
      }

      // Apply priority weighting
      score *= category.priority / 10;
      
      // Boost for always-include categories
      if (category.alwaysInclude) {
        score += 10;
      }
      
      categoryScores.set(categoryName, score);
    }

    // Context boosts
    if (fileContext) {
      // Boost filesystem tools if we have file context
      categoryScores.set('filesystem', (categoryScores.get('filesystem') || 0) + 2);
      categoryScores.set('core', (categoryScores.get('core') || 0) + 1);
      
      // Boost development tools for code projects
      if (fileContext.projectType === 'javascript' || fileContext.projectType === 'typescript') {
        categoryScores.set('development', (categoryScores.get('development') || 0) + 3);
      }
    }

    // Previous tool usage patterns
    if (previousTools && previousTools.length > 0) {
      for (const [categoryName, category] of Object.entries(TOOL_CATEGORIES)) {
        const overlap = category.tools.filter(tool => 
          previousTools.some(prevTool => prevTool.includes(tool) || tool.includes(prevTool))
        ).length;
        
        if (overlap > 0) {
          categoryScores.set(categoryName, (categoryScores.get(categoryName) || 0) + overlap * 1.5);
        }
      }
    }

    // Risk level adjustments
    if (riskLevel === 'high') {
      // Reduce system tools for high-risk operations
      categoryScores.set('system', (categoryScores.get('system') || 0) * 0.5);
    } else if (riskLevel === 'low') {
      // Allow more tools for low-risk operations
      for (const [category, score] of categoryScores.entries()) {
        categoryScores.set(category, score * 1.2);
      }
    }

    // Select top categories
    const sortedCategories = Array.from(categoryScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4); // Max 4 categories to keep tool count manageable

    const selectedCategories = sortedCategories
      .filter(([, score]) => score > 0.5)
      .map(([category]) => category);

    // Calculate confidence based on score distribution
    const totalScore = Array.from(categoryScores.values()).reduce((sum, score) => sum + score, 0);
    const topScore = sortedCategories[0]?.[1] || 0;
    const confidence = totalScore > 0 ? Math.min(topScore / totalScore * 2, 1.0) : 0.5;

    return {
      categories: selectedCategories,
      categoryScores,
      detectedKeywords: [...new Set(detectedKeywords)],
      confidence,
    };
  }

  /**
   * Select relevant tools based on analysis
   */
  private selectRelevantTools(allTools: any[], analysis: any): any[] {
    const selectedToolNames = new Set<string>();
    
    // Always include core tools
    const coreCategory = TOOL_CATEGORIES.core;
    coreCategory.tools.forEach(toolName => selectedToolNames.add(toolName));

    // Add tools from selected categories
    for (const categoryName of analysis.categories) {
      const category = TOOL_CATEGORIES[categoryName as keyof typeof TOOL_CATEGORIES];
      if (category) {
        category.tools.forEach(toolName => selectedToolNames.add(toolName));
      }
    }

    // Filter actual tools based on selected names (include aliases and function names)
    let filteredTools = allTools.filter(tool => {
      const toolName = tool.function?.name || tool.name || '';
      
      return Array.from(selectedToolNames).some(selectedName => {
        // Direct name match
        if (toolName === selectedName || 
            toolName.includes(selectedName) || 
            selectedName.includes(toolName)) {
          return true;
        }
        
        // Check if selectedName is a registry key and match against function name
        const toolDef = TYPED_TOOL_CATALOG[selectedName as keyof typeof TYPED_TOOL_CATALOG];
        if (toolDef) {
          return toolName === toolDef.functionName || 
                 toolName.includes(toolDef.functionName) ||
                 toolDef.functionName.includes(toolName);
        }
        
        // Check aliases - find tool by alias
        const aliasMatch = Object.values(TYPED_TOOL_CATALOG).find(def => 
          def.aliases.some(alias => 
            toolName === alias || 
            toolName.includes(alias) || 
            alias.includes(toolName)
          )
        );
        
        if (aliasMatch) {
          return true;
        }
        
        return false;
      });
    });

    // Apply tool count limits
    if (filteredTools.length > this.MAX_TOOLS) {
      // Keep highest priority tools (core first, then by category priority)
      const priorityOrder = Object.entries(TOOL_CATEGORIES)
        .sort(([, a], [, b]) => b.priority - a.priority)
        .flatMap(([, category]) => category.tools);

      filteredTools = filteredTools
        .sort((a, b) => {
          const aName = a.function?.name || a.name || '';
          const bName = b.function?.name || b.name || '';
          const aPriority = priorityOrder.findIndex(tool => aName.includes(tool) || tool.includes(aName));
          const bPriority = priorityOrder.findIndex(tool => bName.includes(tool) || tool.includes(bName));
          return (aPriority === -1 ? 999 : aPriority) - (bPriority === -1 ? 999 : bPriority);
        })
        .slice(0, this.MAX_TOOLS);
    }

    // Ensure minimum tools (add filesystem basics if needed)
    if (filteredTools.length < this.MIN_TOOLS) {
      const fallbackTools = allTools.filter(tool => {
        const toolName = tool.function?.name || tool.name || '';
        return toolName.includes('filesystem') || toolName.includes('read') || toolName.includes('list');
      });
      
      for (const tool of fallbackTools) {
        if (filteredTools.length >= this.MIN_TOOLS) break;
        if (!filteredTools.some(existing => 
          (existing.function?.name || existing.name) === (tool.function?.name || tool.name)
        )) {
          filteredTools.push(tool);
        }
      }
    }

    return filteredTools;
  }

  /**
   * Build human-readable reasoning for the filtering decision
   */
  private buildReasoning(analysis: any, selectedCount: number, totalCount: number): string {
    const { categories, confidence, detectedKeywords } = analysis;
    
    const categoryText = categories.length > 0 
      ? categories.join(', ') 
      : 'general-purpose';
      
    const keywordText = detectedKeywords.length > 0 
      ? detectedKeywords.slice(0, 3).join(', ')
      : 'none';
      
    return `Selected ${selectedCount}/${totalCount} tools. ` +
           `Categories: ${categoryText}. ` +
           `Keywords: ${keywordText}. ` +
           `Confidence: ${(confidence * 100).toFixed(0)}%`;
  }

  /**
   * Get available tool categories for debugging
   */
  getToolCategories() {
    return Object.entries(TOOL_CATEGORIES).map(([name, category]) => ({
      name,
      keywords: category.keywords.slice(0, 5), // First 5 keywords
      toolCount: category.tools.length,
      priority: category.priority,
      alwaysInclude: category.alwaysInclude || false,
    }));
  }
}

// Export singleton instance
export const contextualToolFilter = new ContextualToolFilter();