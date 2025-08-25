/**
 * Sequential Dual-Agent Review System
 * Implements automatic sequential code generation and auditing
 * Agent 1 (Writer) generates code → Agent 2 (Auditor) automatically reviews
 * Created: August 21, 2025
 */

import { EventEmitter } from 'events';
import { Logger } from '../logger.js';
import { OllamaProvider } from '../../providers/ollama.js';
import { LMStudioProvider } from '../../providers/lm-studio.js';
import { modelCoordinator } from '../model-selection-coordinator.js';
import chalk from 'chalk';

export interface SequentialAgentConfig {
  writer: {
    provider: 'ollama' | 'lm-studio';
    model?: string; // Auto-selected if not specified
    temperature: number;
    maxTokens: number;
  };
  auditor: {
    provider: 'ollama' | 'lm-studio';
    model?: string; // Auto-selected if not specified
    temperature: number;
    maxTokens: number;
  };
  workflow: {
    autoAudit: boolean; // Automatically trigger audit after write
    applyFixes: boolean; // Apply audit suggestions automatically
    maxIterations: number; // Max refinement iterations
    confidenceThreshold: number; // Min confidence for acceptance
  };
}

export interface SequentialResult {
  originalPrompt: string;
  writerOutput: {
    code: string;
    model: string;
    provider: string;
    duration: number;
    timestamp: Date;
  };
  auditorOutput: {
    review: AuditReview;
    model: string;
    provider: string;
    duration: number;
    timestamp: Date;
  };
  refinedOutput?: {
    code: string;
    iterations: number;
    finalScore: number;
  };
  totalDuration: number;
  accepted: boolean;
}

export interface AuditReview {
  overallScore: number;
  passed: boolean;
  issues: CodeIssue[];
  improvements: Improvement[];
  security: SecurityAssessment;
  quality: QualityMetrics;
  recommendation: 'accept' | 'refine' | 'reject';
}

export interface CodeIssue {
  severity: 'info' | 'warning' | 'error' | 'critical';
  type: string;
  line?: number;
  description: string;
  suggestion?: string;
  autoFixable: boolean;
}

export interface Improvement {
  category: string;
  description: string;
  code?: string;
  impact: 'low' | 'medium' | 'high';
}

export interface SecurityAssessment {
  score: number;
  vulnerabilities: string[];
  recommendations: string[];
}

export interface QualityMetrics {
  readability: number;
  maintainability: number;
  efficiency: number;
  documentation: number;
  testability: number;
}

export class SequentialDualAgentSystem extends EventEmitter {
  private logger: Logger;
  private config: SequentialAgentConfig;
  private writerProvider: OllamaProvider | LMStudioProvider | null = null;
  private auditorProvider: OllamaProvider | LMStudioProvider | null = null;
  private isInitialized = false;
  private executionHistory: SequentialResult[] = [];

  constructor(config?: Partial<SequentialAgentConfig>) {
    super();
    this.logger = new Logger('SequentialDualAgent');

    // Default configuration with intelligent defaults
    this.config = {
      writer: {
        provider: 'lm-studio', // Fast for initial generation
        temperature: 0.7,
        maxTokens: 4096,
        ...config?.writer,
      },
      auditor: {
        provider: 'ollama', // Thorough for review
        temperature: 0.2, // Lower temp for critical analysis
        maxTokens: 2048,
        ...config?.auditor,
      },
      workflow: {
        autoAudit: true, // Always audit automatically
        applyFixes: false, // Manual approval for fixes by default
        maxIterations: 3,
        confidenceThreshold: 0.8,
        ...config?.workflow,
      },
    };
  }

  /**
   * Initialize the sequential dual-agent system
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing Sequential Dual-Agent System...');

    try {
      // Initialize writer provider
      await this.initializeWriter();

      // Initialize auditor provider
      await this.initializeAuditor();

      // Verify both agents are ready
      if (!this.writerProvider || !this.auditorProvider) {
        throw new Error('Failed to initialize one or both agents');
      }

      this.isInitialized = true;
      this.logger.info('✅ Sequential Dual-Agent System ready');
      console.log(chalk.green('✅ Sequential review system initialized'));
      console.log(chalk.cyan(`   Writer: ${this.config.writer.provider}`));
      console.log(chalk.cyan(`   Auditor: ${this.config.auditor.provider}`));

      this.emit('system:ready');
    } catch (error) {
      this.logger.error('Failed to initialize system:', error);
      throw error;
    }
  }

  /**
   * Initialize the writer agent
   */
  private async initializeWriter(): Promise<void> {
    this.logger.info(`Initializing writer (${this.config.writer.provider})...`);

    if (this.config.writer.provider === 'ollama') {
      this.writerProvider = new OllamaProvider({
        endpoint: 'http://localhost:11434',
        timeout: 30000,
      });
    } else {
      this.writerProvider = new LMStudioProvider({
        endpoint: 'http://localhost:1234',
        timeout: 60000, // Increased timeout for code generation
      });
    }

    // Select optimal model for writing
    const selection = await modelCoordinator.selectModel(
      this.config.writer.provider,
      'code_generation',
      []
    );

    this.config.writer.model = selection.model;
    this.logger.info(`Writer model selected: ${selection.model}`);
  }

  /**
   * Initialize the auditor agent
   */
  private async initializeAuditor(): Promise<void> {
    this.logger.info(`Initializing auditor (${this.config.auditor.provider})...`);

    if (this.config.auditor.provider === 'ollama') {
      this.auditorProvider = new OllamaProvider({
        endpoint: 'http://localhost:11434',
        timeout: 45000, // Longer timeout for thorough review
      });
    } else {
      this.auditorProvider = new LMStudioProvider({
        endpoint: 'http://localhost:1234',
        timeout: 45000, // Longer timeout for thorough review
      });
    }

    // Select optimal model for auditing
    const selection = await modelCoordinator.selectModel(
      this.config.auditor.provider,
      'code_review',
      []
    );

    this.config.auditor.model = selection.model;
    this.logger.info(`Auditor model selected: ${selection.model}`);
  }

  /**
   * Execute the sequential dual-agent workflow
   * This is the main entry point for automatic sequential review
   */
  async executeSequentialReview(prompt: string, context?: any): Promise<SequentialResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    this.logger.info('Starting sequential dual-agent review...');
    console.log(chalk.blue('\n🔄 Starting Sequential Review Process'));

    const result: SequentialResult = {
      originalPrompt: prompt,
      writerOutput: {
        code: '',
        model: this.config.writer.model || 'unknown',
        provider: this.config.writer.provider,
        duration: 0,
        timestamp: new Date(),
      },
      auditorOutput: {
        review: this.getEmptyReview(),
        model: this.config.auditor.model || 'unknown',
        provider: this.config.auditor.provider,
        duration: 0,
        timestamp: new Date(),
      },
      totalDuration: 0,
      accepted: false,
    };

    try {
      // PHASE 1: Writer generates code
      console.log(chalk.yellow('\n📝 Phase 1: Writer Agent Generating Code...'));
      this.emit('phase:writer_start', { prompt });

      const writerStart = Date.now();
      result.writerOutput.code = await this.generateCode(prompt, context);
      result.writerOutput.duration = Date.now() - writerStart;
      result.writerOutput.timestamp = new Date();

      this.emit('phase:writer_complete', {
        code: result.writerOutput.code,
        duration: result.writerOutput.duration,
      });

      console.log(
        chalk.green(`✅ Writer completed in ${(result.writerOutput.duration / 1000).toFixed(2)}s`)
      );

      // PHASE 2: Auditor automatically reviews code
      if (this.config.workflow.autoAudit) {
        console.log(chalk.yellow('\n🔍 Phase 2: Auditor Agent Reviewing Code...'));
        this.emit('phase:auditor_start', { code: result.writerOutput.code });

        const auditorStart = Date.now();
        result.auditorOutput.review = await this.auditCode(
          result.writerOutput.code,
          prompt,
          context
        );
        result.auditorOutput.duration = Date.now() - auditorStart;
        result.auditorOutput.timestamp = new Date();

        this.emit('phase:auditor_complete', {
          review: result.auditorOutput.review,
          duration: result.auditorOutput.duration,
        });

        console.log(
          chalk.green(
            `✅ Auditor completed in ${(result.auditorOutput.duration / 1000).toFixed(2)}s`
          )
        );
        this.displayAuditResults(result.auditorOutput.review);

        // PHASE 3: Optional refinement based on audit
        if (
          this.config.workflow.applyFixes &&
          result.auditorOutput.review.recommendation === 'refine'
        ) {
          console.log(chalk.yellow('\n🔧 Phase 3: Applying Refinements...'));
          result.refinedOutput = await this.refineCode(
            result.writerOutput.code,
            result.auditorOutput.review,
            prompt
          );
          console.log(chalk.green('✅ Refinements applied'));
        }

        // Determine acceptance
        result.accepted =
          result.auditorOutput.review.overallScore >=
          this.config.workflow.confidenceThreshold * 100;
      }

      result.totalDuration = Date.now() - startTime;

      // Store in history
      this.executionHistory.push(result);

      // Final summary
      this.displayFinalSummary(result);

      this.emit('workflow:complete', result);
      return result;
    } catch (error) {
      this.logger.error('Sequential review failed:', error);
      this.emit('workflow:error', error);
      throw error;
    }
  }

  /**
   * Generate code using the writer agent
   */
  private async generateCode(prompt: string, context?: any): Promise<string> {
    if (!this.writerProvider) {
      throw new Error('Writer provider not initialized');
    }

    const enhancedPrompt = this.buildWriterPrompt(prompt, context);

    const response = await this.writerProvider.processRequest({
      prompt: enhancedPrompt,
      temperature: this.config.writer.temperature,
      maxTokens: this.config.writer.maxTokens,
    });

    return this.extractCode(response.content || response);
  }

  /**
   * Audit code using the auditor agent
   */
  private async auditCode(
    code: string,
    originalPrompt: string,
    context?: any
  ): Promise<AuditReview> {
    if (!this.auditorProvider) {
      throw new Error('Auditor provider not initialized');
    }

    const auditPrompt = this.buildAuditorPrompt(code, originalPrompt, context);

    const response = await this.auditorProvider.processRequest({
      prompt: auditPrompt,
      temperature: this.config.auditor.temperature,
      maxTokens: this.config.auditor.maxTokens,
    });

    return this.parseAuditResponse(response.content || response);
  }

  /**
   * Refine code based on audit feedback
   */
  private async refineCode(
    code: string,
    review: AuditReview,
    originalPrompt: string
  ): Promise<any> {
    const criticalIssues = review.issues.filter(
      i => i.severity === 'error' || i.severity === 'critical'
    );

    if (criticalIssues.length === 0) {
      return { code, iterations: 0, finalScore: review.overallScore };
    }

    // Use writer to apply fixes
    const fixPrompt = this.buildRefinementPrompt(code, review, originalPrompt);
    const refinedCode = await this.generateCode(fixPrompt);

    // Re-audit if within iteration limit
    let iterations = 1;
    let finalReview = review;

    if (iterations < this.config.workflow.maxIterations) {
      finalReview = await this.auditCode(refinedCode, originalPrompt);
      iterations++;
    }

    return {
      code: refinedCode,
      iterations,
      finalScore: finalReview.overallScore,
    };
  }

  /**
   * Build enhanced prompt for writer
   */
  private buildWriterPrompt(prompt: string, context?: any): string {
    return `You are an expert programmer. Generate clean, efficient, production-ready code.

Request: ${prompt}

Requirements:
- Write complete, working code
- Include proper error handling
- Add clear comments for complex logic
- Follow best practices and design patterns
- Ensure code is secure and efficient

${context ? `Context: ${JSON.stringify(context)}` : ''}

Generate the code:`;
  }

  /**
   * Build comprehensive audit prompt
   */
  private buildAuditorPrompt(code: string, originalPrompt: string, context?: any): string {
    return `You are a senior code auditor. Review the following code critically and thoroughly.

Original Request: ${originalPrompt}

Code to Review:
\`\`\`
${code}
\`\`\`

Perform a comprehensive audit covering:
1. **Correctness**: Does it fulfill the requirements?
2. **Security**: Any vulnerabilities or risks?
3. **Performance**: Efficiency and optimization issues?
4. **Quality**: Code style, readability, maintainability?
5. **Best Practices**: Design patterns, error handling?

Provide your review in this JSON format:
{
  "overallScore": 0-100,
  "passed": true/false,
  "issues": [
    {
      "severity": "critical/error/warning/info",
      "type": "security/performance/logic/style",
      "description": "...",
      "suggestion": "...",
      "autoFixable": true/false
    }
  ],
  "improvements": [
    {
      "category": "...",
      "description": "...",
      "impact": "high/medium/low"
    }
  ],
  "security": {
    "score": 0-100,
    "vulnerabilities": [],
    "recommendations": []
  },
  "quality": {
    "readability": 0-100,
    "maintainability": 0-100,
    "efficiency": 0-100,
    "documentation": 0-100,
    "testability": 0-100
  },
  "recommendation": "accept/refine/reject"
}`;
  }

  /**
   * Build refinement prompt
   */
  private buildRefinementPrompt(code: string, review: AuditReview, originalPrompt: string): string {
    const issues = review.issues
      .filter(i => i.severity === 'error' || i.severity === 'critical')
      .map(i => `- ${i.description}: ${i.suggestion || 'Fix required'}`);

    return `Refine the following code to address critical issues identified in review.

Original Request: ${originalPrompt}

Issues to Fix:
${issues.join('\n')}

Current Code:
\`\`\`
${code}
\`\`\`

Generate the improved code with all issues resolved:`;
  }

  /**
   * Extract code from response
   */
  private extractCode(response: string | any): string {
    // Handle object responses from providers
    const responseText =
      typeof response === 'string'
        ? response
        : response?.content || response?.text || String(response);

    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Invalid response format: expected string content');
    }

    const codeMatch = responseText.match(/```[\w]*\n?([\s\S]*?)```/);
    return codeMatch ? codeMatch[1].trim() : responseText.trim();
  }

  /**
   * Parse audit response
   */
  private parseAuditResponse(response: string | any): AuditReview {
    // Handle object responses from providers
    const responseText =
      typeof response === 'string'
        ? response
        : response?.content || response?.text || String(response);

    try {
      // Try to parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      this.logger.warn('Failed to parse audit as JSON, using fallback');
    }

    // Fallback parsing
    return this.getEmptyReview();
  }

  /**
   * Get empty review structure
   */
  private getEmptyReview(): AuditReview {
    return {
      overallScore: 0,
      passed: false,
      issues: [],
      improvements: [],
      security: { score: 0, vulnerabilities: [], recommendations: [] },
      quality: {
        readability: 0,
        maintainability: 0,
        efficiency: 0,
        documentation: 0,
        testability: 0,
      },
      recommendation: 'reject',
    };
  }

  /**
   * Display audit results in console
   */
  private displayAuditResults(review: AuditReview): void {
    console.log(chalk.cyan('\n📊 Audit Results:'));
    console.log(chalk.white(`   Overall Score: ${review.overallScore}/100`));
    console.log(
      chalk.white(`   Status: ${review.passed ? chalk.green('PASSED') : chalk.red('FAILED')}`)
    );
    console.log(chalk.white(`   Recommendation: ${review.recommendation.toUpperCase()}`));

    if (review.issues.length > 0) {
      console.log(chalk.yellow('\n   Issues Found:'));
      review.issues.forEach(issue => {
        const color =
          issue.severity === 'critical'
            ? chalk.red
            : issue.severity === 'error'
              ? chalk.magenta
              : issue.severity === 'warning'
                ? chalk.yellow
                : chalk.gray;
        console.log(color(`     - [${issue.severity}] ${issue.description}`));
      });
    }

    if (review.security.vulnerabilities.length > 0) {
      console.log(chalk.red('\n   ⚠️  Security Vulnerabilities:'));
      review.security.vulnerabilities.forEach(v => {
        console.log(chalk.red(`     - ${v}`));
      });
    }
  }

  /**
   * Display final summary
   */
  private displayFinalSummary(result: SequentialResult): void {
    console.log(chalk.blue(`\n${  '='.repeat(60)}`));
    console.log(chalk.blue('📋 Sequential Review Summary'));
    console.log(chalk.blue('='.repeat(60)));

    console.log(chalk.white(`\n⏱️  Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`));
    console.log(chalk.white(`   - Writer: ${(result.writerOutput.duration / 1000).toFixed(2)}s`));
    console.log(chalk.white(`   - Auditor: ${(result.auditorOutput.duration / 1000).toFixed(2)}s`));

    const statusColor = result.accepted ? chalk.green : chalk.yellow;
    console.log(statusColor(`\n✅ Final Status: ${result.accepted ? 'ACCEPTED' : 'NEEDS REVIEW'}`));

    if (result.refinedOutput) {
      console.log(
        chalk.cyan(`\n🔧 Refinements Applied: ${result.refinedOutput.iterations} iteration(s)`)
      );
      console.log(chalk.cyan(`   Final Score: ${result.refinedOutput.finalScore}/100`));
    }
  }

  /**
   * Get system metrics
   */
  getMetrics(): any {
    const recentResults = this.executionHistory.slice(-10);
    const avgWriterTime =
      recentResults.reduce((sum, r) => sum + r.writerOutput.duration, 0) /
      (recentResults.length || 1);
    const avgAuditorTime =
      recentResults.reduce((sum, r) => sum + r.auditorOutput.duration, 0) /
      (recentResults.length || 1);
    const acceptanceRate =
      recentResults.filter(r => r.accepted).length / (recentResults.length || 1);

    return {
      totalExecutions: this.executionHistory.length,
      averageWriterTime: avgWriterTime,
      averageAuditorTime: avgAuditorTime,
      acceptanceRate: acceptanceRate * 100,
      configuration: this.config,
      isInitialized: this.isInitialized,
    };
  }

  /**
   * Shutdown the system
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Sequential Dual-Agent System');
    this.removeAllListeners();
    this.executionHistory = [];
    this.isInitialized = false;
  }
}

// Export singleton instance for easy use
export const sequentialReviewSystem = new SequentialDualAgentSystem();
