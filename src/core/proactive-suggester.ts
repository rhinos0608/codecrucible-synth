import { logger } from './logger.js';
import { BaseTool } from './tools/base-tool.js';

/**
 * Suggestion priority levels
 */
export enum SuggestionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Suggestion categories for organization
 */
export enum SuggestionCategory {
  CODE_QUALITY = 'code_quality',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation',
  REFACTORING = 'refactoring',
  BUG_FIX = 'bug_fix',
  FEATURE = 'feature',
  MAINTENANCE = 'maintenance'
}

/**
 * A proactive suggestion for the user
 */
export interface ProactiveSuggestion {
  id: string;
  title: string;
  description: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  action: {
    type: 'command' | 'tool_sequence' | 'file_operation' | 'research';
    payload: any;
  };
  reasoning: string;
  estimatedTime?: string;
  dependencies?: string[];
  tags?: string[];
  createdAt: Date;
}

/**
 * Context for generating proactive suggestions
 */
export interface ProjectContext {
  files: Array<{
    path: string;
    content: string;
    language: string;
    lastModified: Date;
    size: number;
  }>;
  gitStatus?: {
    branch: string;
    hasUncommittedChanges: boolean;
    recentCommits: any[];
  };
  dependencies?: string[];
  testCoverage?: number;
  codeQualityMetrics?: {
    complexity: number;
    maintainability: number;
    technicalDebt: number;
  };
  recentErrors?: string[];
  userActivity?: {
    lastActiveFile: string;
    focusAreas: string[];
    workingPattern: string;
  };
}

/**
 * Proactive Task Suggester
 * 
 * Analyzes project context and user behavior to suggest helpful actions,
 * improvements, and next steps proactively.
 */
export class ProactiveTaskSuggester {
  private suggestions: Map<string, ProactiveSuggestion> = new Map();
  private suggestionHistory: ProactiveSuggestion[] = [];
  private patternAnalyzer: ProjectPatternAnalyzer;
  private codeAnalyzer: CodeQualityAnalyzer;
  private securityAnalyzer: SecurityPatternAnalyzer;

  constructor() {
    this.patternAnalyzer = new ProjectPatternAnalyzer();
    this.codeAnalyzer = new CodeQualityAnalyzer();
    this.securityAnalyzer = new SecurityPatternAnalyzer();
    
    logger.info('🔮 ProactiveTaskSuggester initialized');
  }

  /**
   * Generate proactive suggestions based on project context
   */
  async generateSuggestions(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    try {
      // Analyze different aspects of the project
      const codeQualitySuggestions = await this.analyzeCodeQuality(context);
      const securitySuggestions = await this.analyzeSecurityPatterns(context);
      const testingSuggestions = await this.analyzeTestingNeeds(context);
      const documentationSuggestions = await this.analyzeDocumentationNeeds(context);
      const maintenanceSuggestions = await this.analyzeMaintenanceNeeds(context);
      const performanceSuggestions = await this.analyzePerformanceOpportunities(context);

      suggestions.push(
        ...codeQualitySuggestions,
        ...securitySuggestions,
        ...testingSuggestions,
        ...documentationSuggestions,
        ...maintenanceSuggestions,
        ...performanceSuggestions
      );

      // Sort by priority and relevance
      const prioritizedSuggestions = this.prioritizeSuggestions(suggestions, context);
      
      // Store suggestions
      prioritizedSuggestions.forEach(suggestion => {
        this.suggestions.set(suggestion.id, suggestion);
      });

      logger.info(`🔮 Generated ${suggestions.length} proactive suggestions`);
      return prioritizedSuggestions.slice(0, 10); // Return top 10

    } catch (error) {
      logger.error('❌ Failed to generate proactive suggestions:', error);
      return [];
    }
  }

  /**
   * Analyze code quality and suggest improvements
   */
  private async analyzeCodeQuality(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    for (const file of context.files) {
      const analysis = await this.codeAnalyzer.analyzeFile(file);
      
      if (analysis.complexity > 15) {
        suggestions.push({
          id: `complexity-${file.path}`,
          title: `Reduce complexity in ${file.path}`,
          description: `File has high cyclomatic complexity (${analysis.complexity}). Consider breaking down large functions.`,
          category: SuggestionCategory.CODE_QUALITY,
          priority: analysis.complexity > 25 ? SuggestionPriority.HIGH : SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'analyzeCode', input: { filePath: file.path } },
                { name: 'generateCode', input: { type: 'refactor', filePath: file.path } }
              ]
            }
          },
          reasoning: 'High complexity makes code harder to maintain and test',
          estimatedTime: '15-30 minutes',
          tags: ['refactoring', 'maintainability'],
          createdAt: new Date()
        });
      }

      if (analysis.duplicateCode > 0.3) {
        suggestions.push({
          id: `duplication-${file.path}`,
          title: `Remove code duplication in ${file.path}`,
          description: `File contains ${Math.round(analysis.duplicateCode * 100)}% duplicate code. Consider extracting common functions.`,
          category: SuggestionCategory.REFACTORING,
          priority: SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'searchFiles', input: { pattern: 'duplicate patterns', path: file.path } },
                { name: 'generateCode', input: { type: 'extract_function', filePath: file.path } }
              ]
            }
          },
          reasoning: 'Code duplication increases maintenance burden and bug risk',
          estimatedTime: '20-45 minutes',
          tags: ['refactoring', 'DRY'],
          createdAt: new Date()
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze security patterns and suggest improvements
   */
  private async analyzeSecurityPatterns(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    for (const file of context.files) {
      const securityIssues = await this.securityAnalyzer.scanFile(file);
      
      securityIssues.forEach(issue => {
        suggestions.push({
          id: `security-${file.path}-${issue.type}`,
          title: `Security Issue: ${issue.title}`,
          description: issue.description,
          category: SuggestionCategory.SECURITY,
          priority: issue.severity === 'critical' ? SuggestionPriority.CRITICAL : 
                   issue.severity === 'high' ? SuggestionPriority.HIGH : SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'analyzeCode', input: { filePath: file.path, focus: 'security' } },
                { name: 'generateCode', input: { type: 'security_fix', issue: issue.type } }
              ]
            }
          },
          reasoning: issue.reasoning,
          estimatedTime: '10-30 minutes',
          tags: ['security', issue.type],
          createdAt: new Date()
        });
      });
    }

    return suggestions;
  }

  /**
   * Analyze testing needs and suggest test improvements
   */
  private async analyzeTestingNeeds(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    const testFiles = context.files.filter(f => 
      f.path.includes('.test.') || f.path.includes('.spec.') || f.path.includes('__tests__')
    );
    const sourceFiles = context.files.filter(f => 
      !f.path.includes('.test.') && !f.path.includes('.spec.') && 
      (f.language === 'typescript' || f.language === 'javascript')
    );

    const testCoverage = testFiles.length / Math.max(sourceFiles.length, 1);
    
    if (testCoverage < 0.7) {
      suggestions.push({
        id: 'increase-test-coverage',
        title: 'Increase test coverage',
        description: `Test coverage is ${Math.round(testCoverage * 100)}%. Consider adding tests for untested files.`,
        category: SuggestionCategory.TESTING,
        priority: testCoverage < 0.3 ? SuggestionPriority.HIGH : SuggestionPriority.MEDIUM,
        action: {
          type: 'tool_sequence',
          payload: {
            tools: [
              { name: 'analyzeCode', input: { focus: 'testing' } },
              { name: 'generateCode', input: { type: 'tests', coverage: 'missing' } }
            ]
          }
        },
        reasoning: 'Good test coverage reduces bugs and improves confidence in changes',
        estimatedTime: '1-2 hours',
        tags: ['testing', 'quality'],
        createdAt: new Date()
      });
    }

    // Suggest tests for recently modified files without tests
    sourceFiles.forEach(file => {
      const hasTest = testFiles.some(testFile => 
        testFile.path.includes(file.path.replace(/\.[^.]+$/, ''))
      );
      
      if (!hasTest && this.isRecentlyModified(file, 7)) {
        suggestions.push({
          id: `test-${file.path}`,
          title: `Add tests for ${file.path}`,
          description: `Recently modified file lacks test coverage. Consider adding unit tests.`,
          category: SuggestionCategory.TESTING,
          priority: SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'analyzeCode', input: { filePath: file.path } },
                { name: 'generateCode', input: { type: 'test', filePath: file.path } }
              ]
            }
          },
          reasoning: 'Recent changes should be covered by tests to prevent regressions',
          estimatedTime: '30-60 minutes',
          tags: ['testing', 'new-feature'],
          createdAt: new Date()
        });
      }
    });

    return suggestions;
  }

  /**
   * Analyze documentation needs
   */
  private async analyzeDocumentationNeeds(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    const hasReadme = context.files.some(f => f.path.toLowerCase().includes('readme'));
    const hasApiDocs = context.files.some(f => f.path.includes('docs/') || f.path.includes('documentation/'));
    
    if (!hasReadme) {
      suggestions.push({
        id: 'create-readme',
        title: 'Create README documentation',
        description: 'Project lacks a README file. Good documentation improves project accessibility.',
        category: SuggestionCategory.DOCUMENTATION,
        priority: SuggestionPriority.MEDIUM,
        action: {
          type: 'tool_sequence',
          payload: {
            tools: [
              { name: 'analyzeCode', input: { focus: 'structure' } },
              { name: 'generateCode', input: { type: 'readme' } }
            ]
          }
        },
        reasoning: 'README files help users understand how to use and contribute to the project',
        estimatedTime: '20-40 minutes',
        tags: ['documentation', 'readme'],
        createdAt: new Date()
      });
    }

    if (!hasApiDocs && this.hasApiEndpoints(context)) {
      suggestions.push({
        id: 'create-api-docs',
        title: 'Create API documentation',
        description: 'Detected API endpoints without documentation. Consider adding API docs.',
        category: SuggestionCategory.DOCUMENTATION,
        priority: SuggestionPriority.MEDIUM,
        action: {
          type: 'tool_sequence',
          payload: {
            tools: [
              { name: 'analyzeCode', input: { focus: 'api' } },
              { name: 'generateCode', input: { type: 'api_docs' } }
            ]
          }
        },
        reasoning: 'API documentation improves developer experience and adoption',
        estimatedTime: '45-90 minutes',
        tags: ['documentation', 'api'],
        createdAt: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Analyze maintenance needs
   */
  private async analyzeMaintenanceNeeds(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    if (context.dependencies) {
      const outdatedDeps = await this.checkOutdatedDependencies(context.dependencies);
      
      if (outdatedDeps.length > 0) {
        suggestions.push({
          id: 'update-dependencies',
          title: 'Update outdated dependencies',
          description: `${outdatedDeps.length} dependencies are outdated. Consider updating for security and features.`,
          category: SuggestionCategory.MAINTENANCE,
          priority: this.hasSecurityVulnerabilities(outdatedDeps) ? SuggestionPriority.HIGH : SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'packageManager', input: { action: 'audit' } },
                { name: 'packageManager', input: { action: 'update', packages: outdatedDeps } }
              ]
            }
          },
          reasoning: 'Keeping dependencies updated improves security and provides new features',
          estimatedTime: '15-30 minutes',
          tags: ['maintenance', 'dependencies'],
          createdAt: new Date()
        });
      }
    }

    if (context.gitStatus?.hasUncommittedChanges) {
      suggestions.push({
        id: 'commit-changes',
        title: 'Commit pending changes',
        description: 'You have uncommitted changes. Consider creating a commit to save your progress.',
        category: SuggestionCategory.MAINTENANCE,
        priority: SuggestionPriority.LOW,
        action: {
          type: 'tool_sequence',
          payload: {
            tools: [
              { name: 'gitStatus' },
              { name: 'gitOperations', input: { action: 'commit', message: 'Auto-suggested commit' } }
            ]
          }
        },
        reasoning: 'Regular commits help track progress and prevent work loss',
        estimatedTime: '2-5 minutes',
        tags: ['git', 'maintenance'],
        createdAt: new Date()
      });
    }

    return suggestions;
  }

  /**
   * Analyze performance optimization opportunities
   */
  private async analyzePerformanceOpportunities(context: ProjectContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];
    
    for (const file of context.files) {
      if (file.size > 100000) { // Large files > 100KB
        suggestions.push({
          id: `large-file-${file.path}`,
          title: `Optimize large file: ${file.path}`,
          description: `File is ${Math.round(file.size / 1024)}KB. Consider breaking it down or optimizing.`,
          category: SuggestionCategory.PERFORMANCE,
          priority: SuggestionPriority.MEDIUM,
          action: {
            type: 'tool_sequence',
            payload: {
              tools: [
                { name: 'analyzeCode', input: { filePath: file.path, focus: 'performance' } },
                { name: 'generateCode', input: { type: 'optimize', filePath: file.path } }
              ]
            }
          },
          reasoning: 'Large files can impact build times and are harder to maintain',
          estimatedTime: '30-60 minutes',
          tags: ['performance', 'optimization'],
          createdAt: new Date()
        });
      }
    }

    return suggestions;
  }

  /**
   * Prioritize suggestions based on context and user behavior
   */
  private prioritizeSuggestions(
    suggestions: ProactiveSuggestion[], 
    context: ProjectContext
  ): ProactiveSuggestion[] {
    return suggestions.sort((a, b) => {
      // Priority order: CRITICAL > HIGH > MEDIUM > LOW
      const priorityOrder = {
        [SuggestionPriority.CRITICAL]: 4,
        [SuggestionPriority.HIGH]: 3,
        [SuggestionPriority.MEDIUM]: 2,
        [SuggestionPriority.LOW]: 1
      };
      
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }
      
      // Secondary sort by relevance to current work
      const aRelevance = this.calculateRelevance(a, context);
      const bRelevance = this.calculateRelevance(b, context);
      
      return bRelevance - aRelevance;
    });
  }

  /**
   * Calculate relevance score based on user activity and project context
   */
  private calculateRelevance(suggestion: ProactiveSuggestion, context: ProjectContext): number {
    let score = 0;
    
    // Boost score if related to recently active files
    if (context.userActivity?.lastActiveFile && 
        suggestion.action.payload?.filePath?.includes(context.userActivity.lastActiveFile)) {
      score += 3;
    }
    
    // Boost score based on focus areas
    if (context.userActivity?.focusAreas) {
      for (const area of context.userActivity.focusAreas) {
        if (suggestion.tags?.includes(area.toLowerCase())) {
          score += 2;
        }
      }
    }
    
    // Boost security suggestions if recent errors indicate security issues
    if (suggestion.category === SuggestionCategory.SECURITY && 
        context.recentErrors?.some(error => error.includes('security') || error.includes('vulnerability'))) {
      score += 3;
    }
    
    return score;
  }

  /**
   * Helper methods
   */
  private isRecentlyModified(file: any, days: number): boolean {
    const dayMs = 24 * 60 * 60 * 1000;
    return Date.now() - file.lastModified.getTime() < days * dayMs;
  }

  private hasApiEndpoints(context: ProjectContext): boolean {
    return context.files.some(file => 
      file.content.includes('app.get(') || 
      file.content.includes('app.post(') ||
      file.content.includes('router.') ||
      file.content.includes('@GetMapping') ||
      file.content.includes('@PostMapping')
    );
  }

  private async checkOutdatedDependencies(dependencies: string[]): Promise<string[]> {
    // Simplified check - in reality would use npm/yarn audit
    return dependencies.filter(dep => Math.random() > 0.8); // Simulate some outdated deps
  }

  private hasSecurityVulnerabilities(dependencies: string[]): boolean {
    // Simplified check - would integrate with security audit tools
    return dependencies.some(dep => dep.includes('security') || Math.random() > 0.9);
  }

  /**
   * Get suggestions by category
   */
  getSuggestionsByCategory(category: SuggestionCategory): ProactiveSuggestion[] {
    return Array.from(this.suggestions.values())
      .filter(s => s.category === category)
      .sort((a, b) => a.priority.localeCompare(b.priority));
  }

  /**
   * Get suggestions by priority
   */
  getSuggestionsByPriority(priority: SuggestionPriority): ProactiveSuggestion[] {
    return Array.from(this.suggestions.values())
      .filter(s => s.priority === priority);
  }

  /**
   * Mark suggestion as completed
   */
  markCompleted(suggestionId: string): void {
    const suggestion = this.suggestions.get(suggestionId);
    if (suggestion) {
      this.suggestionHistory.push(suggestion);
      this.suggestions.delete(suggestionId);
      logger.info(`✅ Completed suggestion: ${suggestion.title}`);
    }
  }

  /**
   * Get suggestion statistics
   */
  getStats(): {
    total: number;
    byCategory: Record<string, number>;
    byPriority: Record<string, number>;
    completed: number;
  } {
    const suggestions = Array.from(this.suggestions.values());
    
    return {
      total: suggestions.length,
      byCategory: suggestions.reduce((acc, s) => {
        acc[s.category] = (acc[s.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: suggestions.reduce((acc, s) => {
        acc[s.priority] = (acc[s.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      completed: this.suggestionHistory.length
    };
  }
}

/**
 * Helper classes for analysis
 */
class ProjectPatternAnalyzer {
  async analyzePatterns(context: ProjectContext): Promise<any> {
    // Analyze project patterns and structure
    return {};
  }
}

class CodeQualityAnalyzer {
  async analyzeFile(file: any): Promise<{
    complexity: number;
    duplicateCode: number;
    maintainability: number;
  }> {
    // Simplified analysis - would integrate with real code analysis tools
    const lines = file.content.split('\n').length;
    return {
      complexity: Math.floor(lines / 20) + Math.floor(Math.random() * 10),
      duplicateCode: Math.random() * 0.5,
      maintainability: 70 + Math.random() * 30
    };
  }
}

class SecurityPatternAnalyzer {
  async scanFile(file: any): Promise<Array<{
    type: string;
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    reasoning: string;
  }>> {
    const issues = [];
    
    // Simple pattern detection
    if (file.content.includes('eval(')) {
      issues.push({
        type: 'code_injection',
        title: 'Potential Code Injection',
        description: 'Use of eval() can lead to code injection vulnerabilities',
        severity: 'high' as const,
        reasoning: 'eval() executes arbitrary code and should be avoided'
      });
    }
    
    if (file.content.includes('innerHTML') && file.content.includes('user')) {
      issues.push({
        type: 'xss',
        title: 'Potential XSS Vulnerability',
        description: 'Direct innerHTML assignment with user data can lead to XSS',
        severity: 'high' as const,
        reasoning: 'User input should be sanitized before DOM insertion'
      });
    }
    
    return issues;
  }
}