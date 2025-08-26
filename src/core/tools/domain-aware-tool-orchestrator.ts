// Domain Aware Tool Orchestrator
// Core layer domain-aware tool orchestration

import { EventEmitter } from 'events';

export interface DomainContext {
  domain: string;
  expertise: string[];
  constraints: Record<string, unknown>;
  preferences: Record<string, unknown>;
}

export interface DomainAwareTask {
  id: string;
  domain: string;
  tools: string[];
  parameters: Record<string, unknown>;
  context: DomainContext;
}

export interface OrchestrationResult {
  taskId: string;
  success: boolean;
  results: Map<string, unknown>;
  domainInsights: string[];
  executionTime: number;
}

export interface DomainAwareToolOrchestratorInterface {
  orchestrate(task: DomainAwareTask): Promise<OrchestrationResult>;
  getDomainCapabilities(domain: string): string[];
  optimizeForDomain(domain: string, tools: string[]): string[];
}

export class DomainAwareToolOrchestrator extends EventEmitter implements DomainAwareToolOrchestratorInterface {
  private domainExperts = new Map<string, {
    tools: string[];
    optimization: (tools: string[]) => string[];
    insights: (results: Map<string, unknown>) => string[];
  }>();

  constructor() {
    super();
    this.initializeDomainExperts();
  }

  async orchestrate(task: DomainAwareTask): Promise<OrchestrationResult> {
    const startTime = Date.now();
    const results = new Map<string, unknown>();

    this.emit('orchestration:started', { taskId: task.id, domain: task.domain });

    try {
      const expert = this.domainExperts.get(task.domain);
      if (!expert) {
        throw new Error(`No domain expert available for: ${task.domain}`);
      }

      // Optimize tools for domain
      const optimizedTools = expert.optimization(task.tools);

      // Execute tools in domain-aware manner
      for (const toolName of optimizedTools) {
        try {
          const result = await this.executeDomainAwareTool(toolName, task.parameters, task.context);
          results.set(toolName, result);
          
          this.emit('tool:completed', { taskId: task.id, toolName, result });
        } catch (error) {
          this.emit('tool:error', { taskId: task.id, toolName, error });
        }
      }

      // Generate domain insights
      const domainInsights = expert.insights(results);

      const orchestrationResult: OrchestrationResult = {
        taskId: task.id,
        success: results.size > 0,
        results,
        domainInsights,
        executionTime: Date.now() - startTime
      };

      this.emit('orchestration:completed', { result: orchestrationResult });
      return orchestrationResult;

    } catch (error) {
      const orchestrationResult: OrchestrationResult = {
        taskId: task.id,
        success: false,
        results,
        domainInsights: [`Error in ${task.domain} orchestration: ${(error as Error).message}`],
        executionTime: Date.now() - startTime
      };

      this.emit('orchestration:error', { result: orchestrationResult, error });
      return orchestrationResult;
    }
  }

  getDomainCapabilities(domain: string): string[] {
    const expert = this.domainExperts.get(domain);
    return expert?.tools || [];
  }

  optimizeForDomain(domain: string, tools: string[]): string[] {
    const expert = this.domainExperts.get(domain);
    return expert?.optimization(tools) || tools;
  }

  /**
   * Get domain-appropriate tools for a given prompt
   * Used by request handlers for intelligent tool selection
   */
  getToolsForPrompt(prompt: string, availableTools: any[]): {
    tools: any[];
    analysis: { primaryDomain: string; confidence: number; detectedKeywords?: string[] };
    reasoning: string;
  } {
    // Analyze prompt to determine domain
    const analysis = this.analyzeDomain(prompt);
    
    // Get domain-specific tools
    const domainTools = this.getDomainCapabilities(analysis.primaryDomain);
    
    // Filter available tools to match domain requirements
    const filteredTools = availableTools.filter(tool => {
      const toolName = tool.function?.name || tool.name || '';
      return domainTools.some(domainTool => 
        toolName.toLowerCase().includes(domainTool.toLowerCase()) ||
        domainTool.toLowerCase().includes(toolName.toLowerCase())
      );
    });
    
    // If no domain-specific tools found, return a reasonable subset
    const selectedTools = filteredTools.length > 0 
      ? filteredTools.slice(0, 5)
      : availableTools.slice(0, 3);
    
    const reasoning = `Selected ${selectedTools.length} tools for ${analysis.primaryDomain} domain (confidence: ${analysis.confidence}). ${
      filteredTools.length > 0 
        ? `Found ${filteredTools.length} domain-specific tools.`
        : 'Using general-purpose tools as fallback.'
    }`;
    
    return {
      tools: selectedTools,
      analysis,
      reasoning
    };
  }

  /**
   * Analyze prompt to determine primary domain
   */
  private analyzeDomain(prompt: string): { primaryDomain: string; confidence: number; detectedKeywords: string[] } {
    const lowerPrompt = prompt.toLowerCase();
    const domainKeywords = {
      'web_development': ['html', 'css', 'javascript', 'react', 'frontend', 'backend', 'api', 'web'],
      'data_science': ['data', 'model', 'analysis', 'statistics', 'machine learning', 'dataset', 'algorithm'],
      'security': ['security', 'vulnerability', 'authentication', 'encryption', 'audit', 'compliance'],
      'general': ['code', 'function', 'class', 'method', 'variable', 'implementation']
    };
    
    const scores: Record<string, number> = {};
    const detectedKeywords: string[] = [];
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      scores[domain] = 0;
      for (const keyword of keywords) {
        if (lowerPrompt.includes(keyword)) {
          scores[domain]++;
          detectedKeywords.push(keyword);
        }
      }
    }
    
    // Find domain with highest score
    const primaryDomain = Object.entries(scores)
      .reduce((best, [domain, score]) => score > best[1] ? [domain, score] : best, ['general', 0])[0];
    
    const maxScore = Math.max(...Object.values(scores));
    const confidence = Math.min(0.9, 0.3 + (maxScore * 0.1));
    
    return {
      primaryDomain,
      confidence,
      detectedKeywords: detectedKeywords.slice(0, 5) // Limit to top 5
    };
  }

  private initializeDomainExperts() {
    // Web Development Domain
    this.domainExperts.set('web_development', {
      tools: ['html_analyzer', 'css_optimizer', 'js_validator', 'performance_tester'],
      optimization: (tools) => tools.sort((a, b) => {
        const priority = { 'js_validator': 1, 'html_analyzer': 2, 'css_optimizer': 3, 'performance_tester': 4 };
        return (priority[a as keyof typeof priority] || 99) - (priority[b as keyof typeof priority] || 99);
      }),
      insights: (results) => {
        const insights = [];
        if (results.has('performance_tester')) {
          insights.push('Performance optimization opportunities identified');
        }
        if (results.has('js_validator')) {
          insights.push('JavaScript code quality assessed');
        }
        return insights;
      }
    });

    // Data Science Domain
    this.domainExperts.set('data_science', {
      tools: ['data_analyzer', 'model_validator', 'statistical_tester', 'visualization_generator'],
      optimization: (tools) => tools.sort((a, b) => {
        const priority = { 'data_analyzer': 1, 'statistical_tester': 2, 'model_validator': 3, 'visualization_generator': 4 };
        return (priority[a as keyof typeof priority] || 99) - (priority[b as keyof typeof priority] || 99);
      }),
      insights: (results) => {
        const insights = [];
        if (results.has('statistical_tester')) {
          insights.push('Statistical significance validated');
        }
        if (results.has('model_validator')) {
          insights.push('Model performance metrics available');
        }
        return insights;
      }
    });

    // Security Domain
    this.domainExperts.set('security', {
      tools: ['vulnerability_scanner', 'security_auditor', 'penetration_tester', 'compliance_checker'],
      optimization: (tools) => tools.sort((a, b) => {
        const priority = { 'vulnerability_scanner': 1, 'security_auditor': 2, 'compliance_checker': 3, 'penetration_tester': 4 };
        return (priority[a as keyof typeof priority] || 99) - (priority[b as keyof typeof priority] || 99);
      }),
      insights: (results) => {
        const insights = [];
        if (results.has('vulnerability_scanner')) {
          insights.push('Security vulnerabilities assessed');
        }
        if (results.has('compliance_checker')) {
          insights.push('Compliance status evaluated');
        }
        return insights;
      }
    });
  }

  private async executeDomainAwareTool(
    toolName: string, 
    parameters: Record<string, unknown>, 
    context: DomainContext
  ): Promise<unknown> {
    // Mock domain-aware tool execution
    const domainSpecificParameters = {
      ...parameters,
      domain: context.domain,
      expertise: context.expertise,
      constraints: context.constraints
    };

    // Simulate tool execution with domain context
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

    return {
      tool: toolName,
      domain: context.domain,
      result: `Domain-aware result for ${toolName} in ${context.domain}`,
      optimized: true,
      confidence: 0.85 + Math.random() * 0.1
    };
  }
}

export const domainAwareToolOrchestrator = new DomainAwareToolOrchestrator();