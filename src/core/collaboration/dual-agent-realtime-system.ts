/**
 * Dual-Agent Real-Time Code Review System
 * DeepSeek 8B (Ollama) for fast writing + 20B Model (LM Studio) for thorough auditing
 * Iteration 6: Advanced Agent Collaboration
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { UnifiedModelClient } from '../client.js';
import chalk from 'chalk';

export interface DualAgentConfig {
  writer: {
    platform: 'ollama';
    model: string;
    endpoint: string;
    temperature: number;
    maxTokens: number;
    keepAlive: string;
  };
  auditor: {
    platform: 'lmstudio';
    model: string;
    endpoint: string;
    temperature: number;
    maxTokens: number;
    contextLength: number;
  };
  enableRealTimeAudit: boolean;
  auditInBackground: boolean;
  autoApplyFixes: boolean;
  documentationPath?: string;
}

export interface CodeGenerationResult {
  code: string;
  language: string;
  audit?: AuditResult;
  refinedCode?: string;
  performance: {
    generationTime: number;
    auditTime?: number;
    refinementTime?: number;
    totalTime: number;
  };
}

export interface AuditResult {
  passed: boolean;
  score: number;
  issues: AuditIssue[];
  suggestions: AuditSuggestion[];
  securityWarnings: SecurityWarning[];
  documentationCompliance: DocCompliance;
  confidence: number;
}

export interface AuditIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: 'security' | 'performance' | 'style' | 'logic' | 'documentation';
  line?: number;
  description: string;
  fix?: string;
}

export interface AuditSuggestion {
  priority: 'low' | 'medium' | 'high';
  category: string;
  description: string;
  implementation?: string;
}

export interface SecurityWarning {
  vulnerability: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cwe?: string;
  mitigation: string;
}

export interface DocCompliance {
  follows_standards: boolean;
  missing_documentation: string[];
  inconsistencies: string[];
  score: number;
}

export class DualAgentRealtimeSystem extends EventEmitter {
  private logger: Logger;
  private config: DualAgentConfig;
  private ollamaClient: any;  // Ollama client for writer
  private lmStudioClient: any; // LM Studio client for auditor
  private documentationIndex: Map<string, string> = new Map();
  private projectStandards: any = {};
  private auditHistory: AuditResult[] = [];
  private isWriterReady = false;
  private isAuditorReady = false;

  constructor(config: Partial<DualAgentConfig> = {}) {
    super();
    this.logger = new Logger('DualAgentSystem');
    
    this.config = {
      writer: {
        platform: 'ollama',
        model: 'deepseek-coder:8b',
        endpoint: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 2048,
        keepAlive: '24h',
        ...config.writer
      },
      auditor: {
        platform: 'lmstudio',
        model: 'openai-20b-instruct',
        endpoint: 'http://localhost:1234/v1',
        temperature: 0.2,
        maxTokens: 1024,
        contextLength: 8192,
        ...config.auditor
      },
      enableRealTimeAudit: true,
      auditInBackground: true,
      autoApplyFixes: false,
      ...config
    };

    this.initializeClients();
  }

  /**
   * Initialize both platform clients
   */
  private async initializeClients(): Promise<void> {
    try {
      // Initialize Ollama client for fast writing
      this.logger.info('Initializing Ollama writer client...');
      await this.initializeOllamaWriter();
      
      // Initialize LM Studio client for thorough auditing
      this.logger.info('Initializing LM Studio auditor client...');
      await this.initializeLMStudioAuditor();
      
      // Check platform health
      await this.checkPlatformHealth();
      
      this.logger.info('Dual-agent system initialized successfully');
      this.emit('ready');
      
    } catch (error) {
      this.logger.error('Failed to initialize dual-agent system:', error);
      throw error;
    }
  }

  /**
   * Initialize Ollama writer
   */
  private async initializeOllamaWriter(): Promise<void> {
    try {
      const response = await fetch(`${this.config.writer.endpoint}/api/tags`);
      if (!response.ok) throw new Error('Ollama not available');
      
      const data = await response.json();
      const hasModel = data.models?.some((m: any) => 
        m.name.includes('deepseek') || m.name.includes(this.config.writer.model)
      );
      
      if (!hasModel) {
        this.logger.warn(`Model ${this.config.writer.model} not found in Ollama, pulling...`);
        await this.pullOllamaModel(this.config.writer.model);
      }
      
      this.isWriterReady = true;
      this.logger.info('Ollama writer ready');
      
    } catch (error) {
      this.logger.error('Failed to initialize Ollama writer:', error);
      throw error;
    }
  }

  /**
   * Initialize LM Studio auditor
   */
  private async initializeLMStudioAuditor(): Promise<void> {
    try {
      const response = await fetch(`${this.config.auditor.endpoint}/models`);
      if (!response.ok) {
        this.logger.warn('LM Studio not available - audit features will be disabled');
        this.isAuditorReady = false;
        return;
      }
      
      this.isAuditorReady = true;
      this.logger.info('LM Studio auditor ready');
      
    } catch (error) {
      this.logger.warn('LM Studio not available:', error);
      this.isAuditorReady = false;
    }
  }

  /**
   * Generate code with real-time audit
   */
  async generateWithAudit(prompt: string, context?: any): Promise<CodeGenerationResult> {
    const startTime = Date.now();
    const result: CodeGenerationResult = {
      code: '',
      language: 'typescript',
      performance: {
        generationTime: 0,
        totalTime: 0
      }
    };

    try {
      // Phase 1: Fast code generation with Ollama
      this.logger.info('Starting code generation with DeepSeek...');
      const generationStart = Date.now();
      
      result.code = await this.generateCodeWithOllama(prompt, context);
      result.performance.generationTime = Date.now() - generationStart;
      
      this.emit('code:generated', {
        code: result.code,
        time: result.performance.generationTime
      });

      // Phase 2: Background audit with LM Studio (if available)
      if (this.isAuditorReady && this.config.enableRealTimeAudit) {
        const auditStart = Date.now();
        
        if (this.config.auditInBackground) {
          // Start audit in background
          this.auditInBackground(result.code, prompt, context).then(auditResult => {
            result.audit = auditResult;
            result.performance.auditTime = Date.now() - auditStart;
            this.emit('audit:complete', auditResult);
            
            // Apply fixes if configured
            if (this.config.autoApplyFixes && auditResult.issues.some(i => i.fix)) {
              this.applyAuditFixes(result.code, auditResult).then(refinedCode => {
                result.refinedCode = refinedCode;
                this.emit('code:refined', refinedCode);
              });
            }
          });
        } else {
          // Wait for audit to complete
          result.audit = await this.auditCodeWithLMStudio(result.code, prompt, context);
          result.performance.auditTime = Date.now() - auditStart;
          
          // Apply fixes if needed
          if (this.config.autoApplyFixes && result.audit.issues.some(i => i.fix)) {
            const refinementStart = Date.now();
            result.refinedCode = await this.applyAuditFixes(result.code, result.audit);
            result.performance.refinementTime = Date.now() - refinementStart;
          }
        }
      }

      result.performance.totalTime = Date.now() - startTime;
      return result;

    } catch (error) {
      this.logger.error('Code generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate code using Ollama (DeepSeek 8B)
   */
  private async generateCodeWithOllama(prompt: string, context?: any): Promise<string> {
    const enhancedPrompt = this.buildWriterPrompt(prompt, context);
    
    const response = await fetch(`${this.config.writer.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.writer.model,
        prompt: enhancedPrompt,
        stream: false,
        options: {
          temperature: this.config.writer.temperature,
          num_predict: this.config.writer.maxTokens,
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama generation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return this.extractCodeFromResponse(data.response);
  }

  /**
   * Audit code using LM Studio (20B model)
   */
  private async auditCodeWithLMStudio(
    code: string, 
    originalPrompt: string, 
    context?: any
  ): Promise<AuditResult> {
    const auditPrompt = this.buildAuditorPrompt(code, originalPrompt, context);
    
    const response = await fetch(`${this.config.auditor.endpoint}/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.auditor.model,
        prompt: auditPrompt,
        temperature: this.config.auditor.temperature,
        max_tokens: this.config.auditor.maxTokens,
        top_p: 0.8,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stop: ["###", "END_AUDIT"]
      })
    });

    if (!response.ok) {
      this.logger.warn('LM Studio audit failed, using fallback');
      return this.getFallbackAudit();
    }

    const data = await response.json();
    return this.parseAuditResponse(data.choices[0].text);
  }

  /**
   * Audit code in background
   */
  private async auditInBackground(
    code: string, 
    originalPrompt: string, 
    context?: any
  ): Promise<AuditResult> {
    return new Promise((resolve) => {
      setImmediate(async () => {
        try {
          const audit = await this.auditCodeWithLMStudio(code, originalPrompt, context);
          this.auditHistory.push(audit);
          resolve(audit);
        } catch (error) {
          this.logger.warn('Background audit failed:', error);
          resolve(this.getFallbackAudit());
        }
      });
    });
  }

  /**
   * Apply audit fixes to code
   */
  private async applyAuditFixes(code: string, audit: AuditResult): Promise<string> {
    if (!audit.issues.some(i => i.fix)) {
      return code;
    }

    const fixPrompt = this.buildFixPrompt(code, audit);
    
    // Use Ollama for quick fixes
    const response = await fetch(`${this.config.writer.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.writer.model,
        prompt: fixPrompt,
        stream: false,
        options: {
          temperature: 0.3, // Lower temp for fixes
          num_predict: this.config.writer.maxTokens
        }
      })
    });

    const data = await response.json();
    return this.extractCodeFromResponse(data.response);
  }

  /**
   * Build prompt for writer model
   */
  private buildWriterPrompt(userPrompt: string, context?: any): string {
    let prompt = `You are an expert programmer. Generate clean, efficient, and well-documented code.

User Request: ${userPrompt}`;

    if (context?.language) {
      prompt += `\nLanguage: ${context.language}`;
    }
    if (context?.framework) {
      prompt += `\nFramework: ${context.framework}`;
    }
    if (context?.requirements) {
      prompt += `\nRequirements: ${context.requirements}`;
    }

    prompt += `\n\nProvide complete, production-ready code with proper error handling and documentation.`;
    
    return prompt;
  }

  /**
   * Build prompt for auditor model
   */
  private buildAuditorPrompt(code: string, originalPrompt: string, context?: any): string {
    const prompt = `You are a senior code auditor and security expert. Analyze the following code for quality, security, and compliance.

Original Request: ${originalPrompt}

Code to Audit:
\`\`\`
${code}
\`\`\`

Analyze for:
1. Security vulnerabilities (OWASP Top 10, CWE)
2. Performance issues and bottlenecks
3. Code quality and best practices
4. Documentation completeness
5. Error handling adequacy

${context?.documentationUrl ? `Reference Documentation: ${context.documentationUrl}` : ''}
${context?.standards ? `Project Standards: ${JSON.stringify(context.standards)}` : ''}

Provide a structured audit report with:
- Overall score (0-100)
- Specific issues with severity levels
- Security warnings with CWE references
- Improvement suggestions with priority
- Documentation compliance assessment

Format your response as JSON for parsing.
END_AUDIT`;

    return prompt;
  }

  /**
   * Build prompt for applying fixes
   */
  private buildFixPrompt(code: string, audit: AuditResult): string {
    const criticalIssues = audit.issues
      .filter(i => i.severity === 'critical' || i.severity === 'error')
      .map(i => `- ${i.description}${i.fix ? `: ${i.fix}` : ''}`);

    return `Refactor the following code to address these critical issues:

Issues to Fix:
${criticalIssues.join('\n')}

Original Code:
\`\`\`
${code}
\`\`\`

Provide the complete refactored code with all issues resolved. Maintain the original functionality while fixing the problems.`;
  }

  /**
   * Extract code from model response
   */
  private extractCodeFromResponse(response: string): string {
    // Try to extract code blocks
    const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // Return full response if no code blocks found
    return response.trim();
  }

  /**
   * Parse audit response into structured format
   */
  private parseAuditResponse(response: string): AuditResult {
    try {
      // Try to parse as JSON first
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.normalizeAuditResult(parsed);
      }
    } catch (error) {
      this.logger.warn('Failed to parse audit response as JSON, using text parsing');
    }

    // Fallback to text parsing
    return this.parseAuditText(response);
  }

  /**
   * Parse audit text response
   */
  private parseAuditText(text: string): AuditResult {
    const result: AuditResult = {
      passed: !text.toLowerCase().includes('critical') && !text.toLowerCase().includes('error'),
      score: 75, // Default score
      issues: [],
      suggestions: [],
      securityWarnings: [],
      documentationCompliance: {
        follows_standards: true,
        missing_documentation: [],
        inconsistencies: [],
        score: 80
      },
      confidence: 0.7
    };

    // Extract score if mentioned
    const scoreMatch = text.match(/score[:\s]+(\d+)/i);
    if (scoreMatch) {
      result.score = parseInt(scoreMatch[1]);
    }

    // Extract issues
    const issueMatches = text.matchAll(/(?:issue|problem|error|warning)[:\s]+([^\n]+)/gi);
    for (const match of issueMatches) {
      result.issues.push({
        severity: 'warning',
        type: 'logic',
        description: match[1].trim()
      });
    }

    // Extract security warnings
    const securityMatches = text.matchAll(/(?:security|vulnerability)[:\s]+([^\n]+)/gi);
    for (const match of securityMatches) {
      result.securityWarnings.push({
        vulnerability: match[1].trim(),
        severity: 'medium',
        mitigation: 'Review and fix security issue'
      });
    }

    return result;
  }

  /**
   * Normalize audit result to standard format
   */
  private normalizeAuditResult(parsed: any): AuditResult {
    return {
      passed: parsed.passed ?? true,
      score: parsed.score ?? 75,
      issues: Array.isArray(parsed.issues) ? parsed.issues : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      securityWarnings: Array.isArray(parsed.securityWarnings) ? parsed.securityWarnings : [],
      documentationCompliance: parsed.documentationCompliance ?? {
        follows_standards: true,
        missing_documentation: [],
        inconsistencies: [],
        score: 80
      },
      confidence: parsed.confidence ?? 0.7
    };
  }

  /**
   * Get fallback audit when LM Studio is unavailable
   */
  private getFallbackAudit(): AuditResult {
    return {
      passed: true,
      score: 0,
      issues: [],
      suggestions: [{
        priority: 'low',
        category: 'info',
        description: 'Audit service unavailable - manual review recommended'
      }],
      securityWarnings: [],
      documentationCompliance: {
        follows_standards: false,
        missing_documentation: ['Unable to verify'],
        inconsistencies: [],
        score: 0
      },
      confidence: 0
    };
  }

  /**
   * Pull Ollama model if not available
   */
  private async pullOllamaModel(model: string): Promise<void> {
    this.logger.info(`Pulling model ${model}...`);
    
    const response = await fetch(`${this.config.writer.endpoint}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.statusText}`);
    }

    // Wait for pull to complete
    const reader = response.body?.getReader();
    if (reader) {
      while (true) {
        const { done } = await reader.read();
        if (done) break;
      }
    }

    this.logger.info(`Model ${model} pulled successfully`);
  }

  /**
   * Check platform health
   */
  private async checkPlatformHealth(): Promise<void> {
    const health = {
      ollama: this.isWriterReady,
      lmStudio: this.isAuditorReady
    };

    if (!health.ollama) {
      throw new Error('Ollama not available - please start Ollama service');
    }

    if (!health.lmStudio) {
      this.logger.warn('⚠️  LM Studio unavailable - audit features will be limited');
      console.log(chalk.yellow('⚠️  Running without real-time audit (LM Studio not detected)'));
    } else {
      console.log(chalk.green('✅ Dual-agent system ready (Ollama + LM Studio)'));
    }

    this.emit('health:checked', health);
  }

  /**
   * Stream code generation with live updates
   */
  async *streamGenerateWithAudit(prompt: string, context?: any): AsyncGenerator<any> {
    const startTime = Date.now();
    
    // Stream generation from Ollama
    const response = await fetch(`${this.config.writer.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.writer.model,
        prompt: this.buildWriterPrompt(prompt, context),
        stream: true,
        options: {
          temperature: this.config.writer.temperature,
          num_predict: this.config.writer.maxTokens
        }
      })
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullCode = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line);
              if (data.response) {
                fullCode += data.response;
                yield {
                  type: 'code_chunk',
                  content: data.response,
                  accumulated: fullCode
                };
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    }

    // Start background audit
    if (this.isAuditorReady && this.config.enableRealTimeAudit) {
      this.auditInBackground(fullCode, prompt, context).then(audit => {
        this.emit('stream:audit_complete', audit);
      });
    }

    yield {
      type: 'complete',
      code: fullCode,
      time: Date.now() - startTime
    };
  }

  /**
   * Get system metrics
   */
  getMetrics(): any {
    const recentAudits = this.auditHistory.slice(-10);
    const avgScore = recentAudits.reduce((sum, a) => sum + a.score, 0) / (recentAudits.length || 1);
    
    return {
      writerStatus: this.isWriterReady ? 'ready' : 'offline',
      auditorStatus: this.isAuditorReady ? 'ready' : 'offline',
      auditCount: this.auditHistory.length,
      averageAuditScore: avgScore,
      platforms: {
        ollama: {
          endpoint: this.config.writer.endpoint,
          model: this.config.writer.model,
          status: this.isWriterReady ? 'connected' : 'disconnected'
        },
        lmStudio: {
          endpoint: this.config.auditor.endpoint,
          model: this.config.auditor.model,
          status: this.isAuditorReady ? 'connected' : 'disconnected'
        }
      }
    };
  }

  /**
   * Shutdown system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down dual-agent system');
    this.removeAllListeners();
    this.auditHistory = [];
    this.documentationIndex.clear();
  }
}

export default DualAgentRealtimeSystem;