#!/usr/bin/env node

import picocolors from 'picocolors';
import wrapAnsi from 'wrap-ansi';
import cliTable3 from 'cli-table3';
import boxen from 'boxen';
import figures from 'figures';
import logSymbols from 'log-symbols';
import * as figlet from 'figlet';
import { ProjectIndex } from './enhanced-startup-indexer.js';

export interface FormattedSection {
  title: string;
  content: string;
  type:
    | 'header'
    | 'info'
    | 'warning'
    | 'error'
    | 'success'
    | 'table'
    | 'list'
    | 'code'
    | 'markdown';
  priority: number;
}

export interface AnalysisResponse {
  summary: string;
  sections: FormattedSection[];
  recommendations: string[];
  actionItems: string[];
  metadata: {
    confidence: number;
    processingTime: number;
    dataQuality: 'high' | 'medium' | 'low';
    completeness: number;
  };
}

export class StructuredResponseFormatter {
  private maxWidth: number;
  private useColors: boolean;

  constructor(options: { maxWidth?: number; useColors?: boolean } = {}) {
    this.maxWidth = options.maxWidth || Math.min(process.stdout.columns || 120, 120);
    this.useColors = options.useColors !== false;
  }

  formatProjectAnalysis(projectIndex: ProjectIndex): AnalysisResponse {
    const startTime = Date.now();

    const sections: FormattedSection[] = [
      this.createProjectOverviewSection(projectIndex),
      this.createArchitectureSection(projectIndex),
      this.createQualityMetricsSection(projectIndex),
      this.createDocumentationSection(projectIndex),
      this.createDependencyAnalysisSection(projectIndex),
      this.createRecommendationsSection(projectIndex),
    ];

    const summary = this.generateProjectSummary(projectIndex);
    const recommendations = this.generateRecommendations(projectIndex);
    const actionItems = this.generateActionItems(projectIndex);

    const processingTime = Date.now() - startTime;

    return {
      summary,
      sections: sections.filter(s => s.content.trim().length > 0),
      recommendations,
      actionItems,
      metadata: {
        confidence: this.calculateConfidence(projectIndex),
        processingTime,
        dataQuality: this.assessDataQuality(projectIndex),
        completeness: this.calculateCompleteness(projectIndex),
      },
    };
  }

  formatCodeAnalysis(code: string, language: string): AnalysisResponse {
    const startTime = Date.now();

    const sections: FormattedSection[] = [
      this.createCodeOverviewSection(code, language),
      this.createCodeQualitySection(code),
      this.createCodePatternsSection(code),
      this.createCodeSuggestionsSection(code),
    ];

    const summary = this.generateCodeSummary(code, language);
    const recommendations = this.generateCodeRecommendations(code, language);
    const actionItems = this.generateCodeActionItems();

    const processingTime = Date.now() - startTime;

    return {
      summary,
      sections,
      recommendations,
      actionItems,
      metadata: {
        confidence: 0.85,
        processingTime,
        dataQuality: 'high',
        completeness: 0.9,
      },
    };
  }

  renderResponse(response: AnalysisResponse): string {
    const output: string[] = [];

    // Header with title
    output.push(this.renderHeader('CodeCrucible Analysis'));
    output.push('');

    // Summary box
    output.push(this.renderSummaryBox(response.summary, response.metadata));
    output.push('');

    // Main sections
    for (const section of response.sections.sort((a, b) => b.priority - a.priority)) {
      output.push(this.renderSection(section));
      output.push('');
    }

    // Recommendations
    if (response.recommendations.length > 0) {
      output.push(this.renderRecommendations(response.recommendations));
      output.push('');
    }

    // Action items
    if (response.actionItems.length > 0) {
      output.push(this.renderActionItems(response.actionItems));
      output.push('');
    }

    // Footer
    output.push(this.renderFooter());

    return output.join('\n');
  }

  private createProjectOverviewSection(projectIndex: ProjectIndex): FormattedSection {
    const table = new cliTable3({
      head: ['Property', 'Value'],
      colWidths: [20, 40],
      style: { head: ['cyan'] },
    });

    table.push(
      ['Name', projectIndex.metadata.name],
      ['Version', projectIndex.metadata.version],
      ['Type', projectIndex.metadata.type],
      ['Files', projectIndex.metadata.totalFiles.toLocaleString()],
      ['Size', this.formatBytes(projectIndex.metadata.totalSize)],
      ['Languages', Object.keys(projectIndex.metadata.languages).length.toString()],
      ['Frameworks', projectIndex.metadata.frameworks.join(', ') || 'None detected']
    );

    return {
      title: 'Project Overview',
      content: table.toString(),
      type: 'table',
      priority: 100,
    };
  }

  private createArchitectureSection(projectIndex: ProjectIndex): FormattedSection {
    const content: string[] = [];

    content.push(picocolors.bold('Architecture Pattern:'));
    content.push(`${figures.arrowRight} ${projectIndex.analysis.patterns.architecturePattern}`);
    content.push('');

    content.push(picocolors.bold('Project Structure:'));
    content.push(`📁 Directories: ${projectIndex.structure.directories.length}`);
    content.push(
      `${figures.pointerSmall} Entry Points: ${projectIndex.structure.entryPoints.length}`
    );
    content.push(`⚙️ Config Files: ${projectIndex.structure.configFiles.length}`);
    content.push(
      `${figures.circleFilled} Test Dirs: ${projectIndex.structure.testDirectories.length}`
    );

    if (projectIndex.structure.mainFiles.length > 0) {
      content.push('');
      content.push(picocolors.bold('Main Files:'));
      projectIndex.structure.mainFiles.slice(0, 5).forEach(file => {
        content.push(`  ${figures.bullet} ${file}`);
      });
    }

    return {
      title: 'Architecture Analysis',
      content: content.join('\n'),
      type: 'info',
      priority: 90,
    };
  }

  private createQualityMetricsSection(projectIndex: ProjectIndex): FormattedSection {
    const metrics = projectIndex.analysis;
    const qualityScore = metrics.patterns.qualityScore;

    const content: string[] = [];

    // Quality score with color coding
    const scoreColor = qualityScore >= 80 ? 'green' : qualityScore >= 60 ? 'yellow' : 'red';
    const scoreIcon =
      qualityScore >= 80
        ? logSymbols.success
        : qualityScore >= 60
          ? logSymbols.warning
          : logSymbols.error;

    content.push(`${scoreIcon} ${picocolors[scoreColor](`Quality Score: ${qualityScore}/100`)}`);
    content.push('');

    // Metrics table
    const table = new cliTable3({
      head: ['Metric', 'Value', 'Status'],
      colWidths: [20, 15, 15],
      style: { head: ['cyan'] },
    });

    const documentationCoverage = Math.round(
      (metrics.coverage.documented / metrics.coverage.total) * 100
    );
    const testCoverage = Math.round((metrics.coverage.tested / metrics.coverage.total) * 100);

    table.push(
      [
        'Documentation',
        `${documentationCoverage}%`,
        this.getStatusIcon(documentationCoverage, 70, 50),
      ],
      ['Test Coverage', `${testCoverage}%`, this.getStatusIcon(testCoverage, 80, 60)],
      [
        'Avg Complexity',
        metrics.complexity.average.toFixed(1),
        this.getStatusIcon(100 - metrics.complexity.average * 2, 70, 50),
      ],
      [
        'External Deps',
        metrics.dependencies.external.length.toString(),
        metrics.dependencies.external.length < 20 ? '✅' : '⚠️',
      ]
    );

    content.push(table.toString());

    if (metrics.complexity.highest.length > 0) {
      content.push('');
      content.push(picocolors.bold('Most Complex Files:'));
      metrics.complexity.highest.slice(0, 3).forEach((item, index) => {
        content.push(`  ${index + 1}. ${item.file} (${item.complexity})`);
      });
    }

    return {
      title: 'Quality Metrics',
      content: content.join('\n'),
      type: qualityScore >= 80 ? 'success' : qualityScore >= 60 ? 'warning' : 'error',
      priority: 85,
    };
  }

  private createDocumentationSection(projectIndex: ProjectIndex): FormattedSection {
    const docs = Object.values(projectIndex.documentation);

    if (docs.length === 0) {
      return {
        title: 'Documentation',
        content: `${logSymbols.warning} No documentation files found`,
        type: 'warning',
        priority: 70,
      };
    }

    const content: string[] = [];

    content.push(`${logSymbols.info} Found ${docs.length} documentation file(s)`);
    content.push('');

    // Documentation table
    const table = new cliTable3({
      head: ['File', 'Reading Time', 'Headings', 'Code Blocks'],
      colWidths: [25, 15, 10, 12],
      style: { head: ['cyan'] },
    });

    docs.slice(0, 10).forEach(doc => {
      table.push([
        doc.relativePath,
        doc.readingTime.text,
        doc.headings.length.toString(),
        doc.codeBlocks.length.toString(),
      ]);
    });

    content.push(table.toString());

    // Key documentation files
    const keyDocs = docs.filter(
      doc =>
        doc.relativePath.toLowerCase().includes('readme') ||
        doc.relativePath.toLowerCase().includes('getting-started') ||
        doc.relativePath.toLowerCase().includes('api')
    );

    if (keyDocs.length > 0) {
      content.push('');
      content.push(picocolors.bold('Key Documentation:'));
      keyDocs.forEach(doc => {
        content.push(`  ${figures.bullet} ${doc.title} (${doc.readingTime.text})`);
      });
    }

    return {
      title: 'Documentation Analysis',
      content: content.join('\n'),
      type: 'info',
      priority: 75,
    };
  }

  private createDependencyAnalysisSection(projectIndex: ProjectIndex): FormattedSection {
    const deps = projectIndex.analysis.dependencies;
    const content: string[] = [];

    content.push(`${figures.nodejs} External Dependencies: ${deps.external.length}`);
    content.push(`📁 Internal Modules: ${deps.internal.length}`);

    if (deps.circular.length > 0) {
      content.push(`${logSymbols.warning} Circular Dependencies: ${deps.circular.length}`);
    }

    // Top dependencies
    const packageDeps = Object.entries(projectIndex.metadata.dependencies);
    if (packageDeps.length > 0) {
      content.push('');
      content.push(picocolors.bold('Key Dependencies:'));
      packageDeps.slice(0, 8).forEach(([name, version]) => {
        content.push(`  ${figures.bullet} ${name}@${version}`);
      });

      if (packageDeps.length > 8) {
        content.push(`  ${figures.ellipsis} and ${packageDeps.length - 8} more...`);
      }
    }

    return {
      title: 'Dependencies',
      content: content.join('\n'),
      type: 'info',
      priority: 65,
    };
  }

  private createRecommendationsSection(projectIndex: ProjectIndex): FormattedSection {
    const recommendations = this.generateRecommendations(projectIndex);

    if (recommendations.length === 0) {
      return {
        title: 'Recommendations',
        content: `${logSymbols.success} Project looks well structured!`,
        type: 'success',
        priority: 60,
      };
    }

    const content: string[] = [];

    recommendations.forEach((rec, index) => {
      content.push(`${index + 1}. ${rec}`);
    });

    return {
      title: 'Recommendations',
      content: content.join('\n'),
      type: 'warning',
      priority: 60,
    };
  }

  private createCodeOverviewSection(code: string, language: string): FormattedSection {
    const lines = code.split('\n').length;
    const chars = code.length;
    const words = code.split(/\s+/).length;

    const table = new cliTable3({
      head: ['Metric', 'Value'],
      colWidths: [15, 15],
      style: { head: ['cyan'] },
    });

    table.push(
      ['Language', language],
      ['Lines', lines.toLocaleString()],
      ['Characters', chars.toLocaleString()],
      ['Words', words.toLocaleString()]
    );

    return {
      title: 'Code Overview',
      content: table.toString(),
      type: 'table',
      priority: 100,
    };
  }

  private createCodeQualitySection(code: string): FormattedSection {
    // Simple code quality metrics
    const lines = code.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim().length > 0).length;
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return (
        trimmed.startsWith('//') ||
        trimmed.startsWith('/*') ||
        trimmed.startsWith('*') ||
        trimmed.startsWith('#')
      );
    }).length;

    const commentRatio = Math.round((commentLines / nonEmptyLines) * 100);
    const avgLineLength = Math.round(
      lines.reduce((sum, line) => sum + line.length, 0) / lines.length
    );

    const content: string[] = [];
    content.push(
      `${figures.info} Comment Ratio: ${commentRatio}% ${this.getStatusIcon(commentRatio, 15, 5)}`
    );
    content.push(
      `📏 Avg Line Length: ${avgLineLength} chars ${this.getStatusIcon(100 - avgLineLength, 50, 30)}`
    );

    return {
      title: 'Code Quality',
      content: content.join('\n'),
      type: 'info',
      priority: 90,
    };
  }

  private createCodePatternsSection(code: string): FormattedSection {
    const patterns: string[] = [];

    // Detect common patterns
    if (code.includes('async') && code.includes('await')) {
      patterns.push('Async/Await pattern detected');
    }
    if (code.includes('class ')) {
      patterns.push('Object-oriented programming');
    }
    if (code.includes('function') || code.includes('=>')) {
      patterns.push('Functional programming elements');
    }
    if (code.includes('try') && code.includes('catch')) {
      patterns.push('Error handling implemented');
    }

    return {
      title: 'Code Patterns',
      content:
        patterns.length > 0
          ? patterns.map(p => `${figures.bullet} ${p}`).join('\n')
          : 'No specific patterns detected',
      type: 'info',
      priority: 80,
    };
  }

  private createCodeSuggestionsSection(code: string): FormattedSection {
    const suggestions = this.generateCodeSuggestions(code);

    return {
      title: 'Suggestions',
      content:
        suggestions.length > 0
          ? suggestions.map(s => `${figures.bullet} ${s}`).join('\n')
          : 'Code looks good!',
      type: suggestions.length > 0 ? 'warning' : 'success',
      priority: 70,
    };
  }

  private renderHeader(title: string): string {
    if (!this.useColors) {
      return `=== ${title} ===`;
    }

    try {
      const asciiTitle = figlet.textSync(title, {
        font: 'Small',
        horizontalLayout: 'fitted',
        width: this.maxWidth - 4,
      });
      return picocolors.cyan(asciiTitle);
    } catch {
      return picocolors.cyan(`🔍 ${title} 🔍`);
    }
  }

  private renderSummaryBox(
    summary: string,
    metadata: { confidence: number; processingTime: number; dataQuality: string }
  ): string {
    const content = [
      summary,
      '',
      `${figures.info} Confidence: ${Math.round(metadata.confidence * 100)}%`,
      `⏱️ Processing: ${metadata.processingTime}ms`,
      `${figures.star} Quality: ${metadata.dataQuality.toUpperCase()}`,
    ].join('\n');

    return boxen(content, {
      padding: 1,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: 'Analysis Summary',
      titleAlignment: 'center',
    });
  }

  private renderSection(section: FormattedSection): string {
    const title = this.useColors
      ? picocolors.bold(picocolors.cyan(`${figures.arrowRight} ${section.title}`))
      : `${section.title}:`;

    const content = wrapAnsi(section.content, this.maxWidth - 2);

    return `${title}\n${content}`;
  }

  private renderRecommendations(recommendations: string[]): string {
    const title = this.useColors
      ? picocolors.bold(picocolors.yellow(`${logSymbols.warning} Recommendations`))
      : 'Recommendations:';

    const content = recommendations.map(rec => `  ${figures.bullet} ${rec}`).join('\n');

    return `${title}\n${content}`;
  }

  private renderActionItems(actionItems: string[]): string {
    const title = this.useColors
      ? picocolors.bold(picocolors.green(`${logSymbols.success} Action Items`))
      : 'Action Items:';

    const content = actionItems.map((item, index) => `  ${index + 1}. ${item}`).join('\n');

    return `${title}\n${content}`;
  }

  private renderFooter(): string {
    const footerText = `Generated by CodeCrucible • ${new Date().toLocaleTimeString()}`;

    return boxen(footerText, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: 0,
      borderStyle: 'single',
      borderColor: 'gray',
      textAlignment: 'center',
    });
  }

  private generateProjectSummary(projectIndex: ProjectIndex): string {
    const { metadata, analysis } = projectIndex;

    return (
      `This ${metadata.type} project "${metadata.name}" contains ${metadata.totalFiles} files across ${Object.keys(metadata.languages).length} languages. ` +
      `Quality score: ${analysis.patterns.qualityScore}/100. ` +
      `Architecture: ${analysis.patterns.architecturePattern}.`
    );
  }

  private generateCodeSummary(code: string, language: string): string {
    const lines = code.split('\n').length;
    return `${language} code snippet with ${lines} lines analyzed for patterns and quality metrics.`;
  }

  private generateRecommendations(projectIndex: ProjectIndex): string[] {
    const recommendations: string[] = [];
    const { analysis } = projectIndex;

    // Documentation recommendations
    const docCoverage = (analysis.coverage.documented / analysis.coverage.total) * 100;
    if (docCoverage < 50) {
      recommendations.push('Add more documentation files (README, API docs, guides)');
    }

    // Test recommendations
    const testCoverage = (analysis.coverage.tested / analysis.coverage.total) * 100;
    if (testCoverage < 60) {
      recommendations.push('Increase test coverage by adding more test files');
    }

    // Complexity recommendations
    if (analysis.complexity.average > 15) {
      recommendations.push(
        'Consider refactoring complex functions to reduce cyclomatic complexity'
      );
    }

    // Dependency recommendations
    if (analysis.dependencies.external.length > 50) {
      recommendations.push('Review dependencies - consider reducing to improve bundle size');
    }

    // Structure recommendations
    if (projectIndex.structure.configFiles.length === 0) {
      recommendations.push('Add configuration files for better project setup');
    }

    return recommendations;
  }

  private generateCodeRecommendations(code: string, language: string): string[] {
    const recommendations: string[] = [];

    // Basic code quality checks
    if (!code.includes('//') && !code.includes('/*') && !code.includes('#')) {
      recommendations.push('Add comments to explain complex logic');
    }

    if (code.split('\n').some(line => line.length > 120)) {
      recommendations.push('Consider breaking long lines for better readability');
    }

    if (language === 'javascript' || language === 'typescript') {
      if (!code.includes('const') && !code.includes('let')) {
        recommendations.push('Use modern variable declarations (const/let instead of var)');
      }
    }

    return recommendations;
  }

  private generateActionItems(projectIndex: ProjectIndex): string[] {
    const actionItems: string[] = [];
    const { analysis } = projectIndex;

    if (analysis.patterns.qualityScore < 70) {
      actionItems.push('Improve overall code quality score');
    }

    if (analysis.coverage.documented === 0) {
      actionItems.push('Create a comprehensive README.md file');
    }

    if (analysis.coverage.tested < analysis.coverage.total * 0.5) {
      actionItems.push('Add unit tests for better coverage');
    }

    if (analysis.complexity.highest.length > 0 && analysis.complexity.highest[0].complexity > 20) {
      actionItems.push(`Refactor ${analysis.complexity.highest[0].file} to reduce complexity`);
    }

    return actionItems;
  }

  private generateCodeActionItems(): string[] {
    return [
      'Review code for potential optimizations',
      'Add comprehensive error handling',
      'Consider adding type annotations (if applicable)',
    ];
  }

  private generateCodeSuggestions(code: string): string[] {
    const suggestions: string[] = [];

    // Generic suggestions based on code analysis
    if (code.length > 1000) {
      suggestions.push('Consider breaking this into smaller functions');
    }

    if (!code.includes('try') && (code.includes('fetch') || code.includes('require'))) {
      suggestions.push('Add error handling for external calls');
    }

    return suggestions;
  }

  private calculateConfidence(projectIndex: ProjectIndex): number {
    let confidence = 0.5; // Base confidence

    // Increase based on file count
    if (projectIndex.metadata.totalFiles > 10) confidence += 0.2;
    if (projectIndex.metadata.totalFiles > 50) confidence += 0.1;

    // Increase based on documentation
    if (Object.keys(projectIndex.documentation).length > 0) confidence += 0.1;

    // Increase based on structure
    if (projectIndex.structure.testDirectories.length > 0) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }

  private assessDataQuality(projectIndex: ProjectIndex): 'high' | 'medium' | 'low' {
    const score = projectIndex.analysis.patterns.qualityScore;
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    return 'low';
  }

  private calculateCompleteness(projectIndex: ProjectIndex): number {
    let completeness = 0;

    // File analysis completeness
    completeness += 0.3;

    // Documentation completeness
    if (Object.keys(projectIndex.documentation).length > 0) completeness += 0.2;

    // Structure analysis completeness
    completeness += 0.2;

    // Dependency analysis completeness
    if (projectIndex.analysis.dependencies.external.length > 0) completeness += 0.15;

    // Quality metrics completeness
    if (projectIndex.analysis.patterns.qualityScore > 0) completeness += 0.15;

    return Math.min(completeness, 1.0);
  }

  private getStatusIcon(value: number, good: number, poor: number): string {
    if (value >= good) return '✅';
    if (value >= poor) return '⚠️';
    return '❌';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Export utility function
export function createStructuredResponse(
  projectIndex?: ProjectIndex,
  code?: string,
  language?: string,
  options?: { maxWidth?: number; useColors?: boolean }
): AnalysisResponse {
  const formatter = new StructuredResponseFormatter(options);

  if (projectIndex) {
    return formatter.formatProjectAnalysis(projectIndex);
  } else if (code && language) {
    return formatter.formatCodeAnalysis(code, language);
  }

  throw new Error('Either projectIndex or code+language must be provided');
}

// Legacy CLI output compatibility
export const cliOutput = {
  outputError: (message: string, exitCode?: any) => {
    console.error(message);
    if (exitCode && typeof exitCode === 'number') {
      process.exit(exitCode);
    }
  },
  configure: (options: { verbose?: boolean; quiet?: boolean; format?: string }) => {
    // Configure output formatting
  },
  outputInfo: (message: string) => {
    console.log(message);
  },
  outputDebug: (message: string) => {
    console.log(message);
  },
  outputProgress: (message: string) => {
    console.log(message);
  },
};

// Response factory for compatibility
export const ResponseFactory = {
  createExecutionResponse: (content: string, metadata: any = {}) => ({
    success: true,
    content,
    timestamp: new Date().toISOString(),
    ...metadata,
  }),

  createSynthesisResponse: (content: string, synthesis: any[] = [], metadata: any = {}) => ({
    success: true,
    content,
    synthesis,
    timestamp: new Date().toISOString(),
    ...metadata,
  }),

  createErrorResponse: (message: string, code?: string) => ({
    success: false,
    error: message,
    code,
    timestamp: new Date().toISOString(),
  }),
};

export class ExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public context: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'ExecutionError';
  }
}

export interface ExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}
