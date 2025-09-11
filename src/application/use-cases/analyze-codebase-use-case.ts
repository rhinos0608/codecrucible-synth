/**
 * Analyze Codebase Use Case
 * Application Layer - Clean codebase analysis orchestration
 *
 * Handles: Code analysis with proper input/output transformation
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import { ProcessingRequest, RequestContext, RequestType } from '../../domain/entities/request.js';

// Local interface for codebase analysis model selection
export interface ICodebaseAnalysisModelSelector {
  selectModel: (analysisType: string) => Promise<AnalysisModel>;
}

// Define a type for the model returned by selectModel
export interface AnalysisModel {
  generateResponse: (
    request: Readonly<ProcessingRequest>,
    options?: Readonly<{ id?: string }>
  ) => Promise<{ content: string; confidence?: number }>;
}

export interface CodebaseAnalysisInput {
  codebasePath: string;
  analysisType: 'structure' | 'quality' | 'security' | 'performance' | 'comprehensive';
  includeFiles?: string[];
  excludePatterns?: string[];
  focusAreas?: string[];
  context?: Record<string, unknown>;
}

export interface CodebaseAnalysisOutput {
  summary: string;
  findings: AnalysisFinding[];
  recommendations: AnalysisRecommendation[];
  metrics: CodebaseMetrics;
  metadata: {
    analysisType: string;
    filesAnalyzed: number;
    processingTime: number;
    voicesUsed: string[];
    confidenceScore: number;
  };
}

export interface AnalysisFinding {
  type: 'issue' | 'opportunity' | 'strength' | 'risk';
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  location?: string;
  impact: string;
}

export interface AnalysisRecommendation {
  priority: 'low' | 'medium' | 'high';
  category: string;
  action: string;
  rationale: string;
  estimatedEffort: 'small' | 'medium' | 'large';
}

export interface CodebaseMetrics {
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  complexity: number;
  testCoverage?: number;
  dependencies: number;
}

interface CodebaseInfo {
  structure: string;
  files: string[];
  excludes?: string[];
  metrics?: CodebaseMetrics;
}

export class AnalyzeCodebaseUseCase {
  public constructor(
    private readonly modelSelectionService: Readonly<ICodebaseAnalysisModelSelector>
  ) {}

  public async execute(input: Readonly<CodebaseAnalysisInput>): Promise<CodebaseAnalysisOutput> {
    const startTime = Date.now();

    // Input validation and transformation
    // Select model (assuming modelSelectionService provides a method for this)
    const selectedModel: AnalysisModel = await this.modelSelectionService.selectModel(
      input.analysisType
    );

    // Gather codebase information
    const codebaseInfo = await this.gatherCodebaseInformation(input);

    // Select analysis voices
    const voiceSelection = this.selectAnalysisVoices(input.analysisType);

    // Build processing request
    const request = this.transformToProcessingRequest(input);

    // Generate analysis from selected voices
    const analysisResponses = await this.generateAnalysisResponses(
      voiceSelection,
      selectedModel,
      request,
      codebaseInfo
    );

    // Synthesize multi-voice analysis if multiple voices used
    const synthesizedAnalysis: {
      voiceId: string;
      content: string;
      confidence: number;
      analysisType: string;
    } =
      voiceSelection.length > 1
        ? this.synthesizeAnalysisResponses(analysisResponses)
        : analysisResponses[0];

    // Transform to structured output
    return this.transformToOutput(
      synthesizedAnalysis,
      input,
      voiceSelection,
      codebaseInfo,
      startTime
    );
  }

  private transformToProcessingRequest(input: CodebaseAnalysisInput): ProcessingRequest {
    const analysisPrompt = this.buildAnalysisPrompt(input);

    // Extend RequestContext to allow additional properties
    type ExtendedRequestContext = RequestContext & {
      codebasePath: string;
      analysisType: string;
      includeFiles?: string[];
      excludePatterns?: string[];
      focusAreas?: string[];
      voiceId?: string;
    };

    return ProcessingRequest.create(
      analysisPrompt,
      'code-analysis' as RequestType,
      'medium',
      {
        ...(input.context as Record<string, unknown>),
        codebasePath: input.codebasePath,
        analysisType: input.analysisType,
        includeFiles: input.includeFiles,
        excludePatterns: input.excludePatterns,
        focusAreas: input.focusAreas,
      } as ExtendedRequestContext,
      {
        // No extra constraints for now
      }
    );
  }

  // Add missing buildAnalysisPrompt method
  private buildAnalysisPrompt(input: CodebaseAnalysisInput): string {
    return `Analyze the following codebase:
  
  Codebase Path: ${input.codebasePath}
  Analysis Type: ${input.analysisType}
  ${input.focusAreas ? `Focus Areas: ${input.focusAreas.join(', ')}` : ''}
  
  Provide a comprehensive analysis including:
  1. Key findings and observations
  2. Issues or opportunities identified
  3. Specific recommendations
  4. Risk assessment
  5. Next steps
  
  Be thorough and specific in your analysis.`;
  }

  private selectAnalysisVoices(analysisType: string): string[] {
    const voiceMap: Record<string, string[]> = {
      structure: ['architect', 'analyzer'],
      quality: ['maintainer', 'analyzer', 'guardian'],
      security: ['security', 'guardian'],
      performance: ['optimizer', 'analyzer'],
      comprehensive: ['architect', 'maintainer', 'security', 'analyzer', 'guardian'],
    };

    return voiceMap[analysisType] ?? ['analyzer'];
  }

  private async gatherCodebaseInformation(
    input: Readonly<CodebaseAnalysisInput>
  ): Promise<CodebaseInfo> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Validate codebase path exists
      await fs.access(input.codebasePath);

      const files: string[] = [];
      const languages: Record<string, number> = {};
      let totalLines = 0;
      let complexity = 0;

      // Recursively scan directory
      const scanDirectory = async (dirPath: string): Promise<void> => {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          const relativePath = path.relative(input.codebasePath, fullPath);

          // Skip excluded patterns
          if (
            input.excludePatterns?.some(
              pattern =>
                new RegExp(pattern).test(relativePath) ||
                relativePath.includes('node_modules') ||
                relativePath.includes('.git') ||
                relativePath.startsWith('.')
            )
          ) {
            continue;
          }

          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile()) {
            // Include only specified files if provided
            if (input.includeFiles && input.includeFiles.length > 0) {
              if (!input.includeFiles.some(pattern => new RegExp(pattern).test(relativePath))) {
                continue;
              }
            }

            // Analyze file
            const fileStats = await this.analyzeFile(fullPath);
            if (fileStats) {
              files.push(relativePath);
              totalLines += fileStats.lines;
              complexity += fileStats.complexity;

              const ext = path.extname(entry.name).toLowerCase();
              const language = this.getLanguageFromExtension(ext);
              languages[language] = (languages[language] || 0) + fileStats.lines;
            }
          }
        }
      };

      await scanDirectory(input.codebasePath);

      // Calculate average complexity
      const avgComplexity = files.length > 0 ? complexity / files.length : 0;

      // Estimate test coverage by looking for test files
      const testCoverage = this.estimateTestCoverage(input.codebasePath, files);

      // Count dependencies
      const dependencies = await this.countDependencies(input.codebasePath);

      return {
        structure: this.generateStructureMap(input.codebasePath, files),
        files,
        excludes: input.excludePatterns ?? [],
        metrics: {
          totalFiles: files.length,
          totalLines,
          languages,
          complexity: Math.round(avgComplexity * 100) / 100,
          testCoverage,
          dependencies,
        },
      };
    } catch (error) {
      console.error('Error gathering codebase information:', error);
      throw new Error(`Failed to analyze codebase at ${input.codebasePath}: ${String(error)}`);
    }
  }

  private async analyzeFile(
    filePath: string
  ): Promise<{ lines: number; complexity: number } | null> {
    const fs = await import('fs/promises');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim()).length;

      // Simple complexity calculation based on control flow keywords
      const complexityKeywords = [
        'if',
        'else',
        'while',
        'for',
        'switch',
        'case',
        'catch',
        'try',
        'forEach',
        'map',
        'filter',
        'reduce',
        '&&',
        '||',
        '?',
      ];

      let complexity = 1; // Base complexity
      for (const keyword of complexityKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = content.match(regex);
        complexity += matches ? matches.length : 0;
      }

      return { lines, complexity };
    } catch (error) {
      console.warn(`Could not analyze file ${filePath}:`, error);
      return null;
    }
  }

  private getLanguageFromExtension(ext: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'TypeScript',
      '.js': 'JavaScript',
      '.tsx': 'TypeScript',
      '.jsx': 'JavaScript',
      '.py': 'Python',
      '.java': 'Java',
      '.cs': 'C#',
      '.cpp': 'C++',
      '.c': 'C',
      '.go': 'Go',
      '.rs': 'Rust',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.swift': 'Swift',
      '.kt': 'Kotlin',
      '.scala': 'Scala',
      '.json': 'JSON',
      '.xml': 'XML',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.md': 'Markdown',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.sass': 'SASS',
      '.less': 'Less',
    };

    return languageMap[ext] || 'Other';
  }

  private estimateTestCoverage(codebasePath: string, files: ReadonlyArray<string>): number {
    const testFiles = files.filter(
      file =>
        file.includes('test') ||
        file.includes('spec') ||
        file.includes('__tests__') ||
        file.endsWith('.test.ts') ||
        file.endsWith('.test.js') ||
        file.endsWith('.spec.ts') ||
        file.endsWith('.spec.js')
    );

    const sourceFiles = files.filter(
      file =>
        !file.includes('test') &&
        !file.includes('spec') &&
        (file.endsWith('.ts') || file.endsWith('.js')) &&
        !file.endsWith('.d.ts')
    );

    if (sourceFiles.length === 0) return 0;

    // Simple estimation: ratio of test files to source files
    const estimatedCoverage = Math.min((testFiles.length / sourceFiles.length) * 100, 100);
    return Math.round(estimatedCoverage * 100) / 100;
  }

  private async countDependencies(codebasePath: string): Promise<number> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      const packageJsonPath = path.join(codebasePath, 'package.json');
      const packageJsonText = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonText) as {
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };

      const dependencies = Object.keys(packageJson.dependencies ?? {});
      const devDependencies = Object.keys(packageJson.devDependencies ?? {});

      return dependencies.length + devDependencies.length;
    } catch (error) {
      // Try other dependency files
      try {
        const files = await fs.readdir(codebasePath);
        if (files.includes('requirements.txt')) {
          const content = await fs.readFile(path.join(codebasePath, 'requirements.txt'), 'utf-8');
          return content.split('\n').filter(line => line.trim() && !line.startsWith('#')).length;
        }
        if (files.includes('pom.xml')) {
          // Basic XML parsing for Maven dependencies
          const content = await fs.readFile(path.join(codebasePath, 'pom.xml'), 'utf-8');
          const dependencyMatches = content.match(/<dependency>/g);
          return dependencyMatches ? dependencyMatches.length : 0;
        }
        if (files.includes('go.mod')) {
          const content = await fs.readFile(path.join(codebasePath, 'go.mod'), 'utf-8');
          const requireMatches = content.match(/^\s+[^\s]+\s+v/gm);
          return requireMatches ? requireMatches.length : 0;
        }
      } catch (nestedError) {
        console.warn('Could not determine dependencies:', nestedError);
      }

      return 0;
    }
  }

  private generateStructureMap(codebasePath: string, files: ReadonlyArray<string>): string {
    // Import path module locally for type safety
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path') as typeof import('path');
    const structure: Record<string, string[]> = {};

    for (const file of files) {
      const dir: string = path.dirname(file);
      if (!Object.prototype.hasOwnProperty.call(structure, dir)) {
        structure[dir] = [];
      }
      structure[dir].push(path.basename(file));
    }

    // Generate tree-like structure
    const lines: string[] = [`Codebase Structure for: ${path.basename(codebasePath)}`];

    const sortedDirs = Object.keys(structure).sort();
    for (const dir of sortedDirs) {
      const depth = dir === '.' ? 0 : dir.split(path.sep).length;
      const indent = '  '.repeat(depth);

      if (dir !== '.') {
        lines.push(`${indent}📁 ${path.basename(dir)}/`);
      }

      const sortedFiles = structure[dir].sort();
      for (const file of sortedFiles.slice(0, 10)) {
        // Limit to first 10 files per dir
        const fileIndent = dir === '.' ? indent : `${indent}  `;
        const icon = this.getFileIcon(file);
        lines.push(`${fileIndent}${icon} ${file}`);
      }

      if (sortedFiles.length > 10) {
        const fileIndent = dir === '.' ? indent : `${indent}  `;
        lines.push(`${fileIndent}... and ${sortedFiles.length - 10} more files`);
      }
    }

    return lines.join('\n');
  }

  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      ts: '📘',
      js: '📜',
      tsx: '📘',
      jsx: '📜',
      json: '📋',
      md: '📖',
      txt: '📄',
      yml: '⚙️',
      yaml: '⚙️',
      xml: '📋',
      html: '🌐',
      css: '🎨',
      scss: '🎨',
      py: '🐍',
      java: '☕',
      go: '🐹',
      rs: '🦀',
    };

    return iconMap[ext || ''] || '📄';
  }

  private async generateAnalysisResponses(
    voices: ReadonlyArray<string>,
    model: Readonly<AnalysisModel>,
    request: Readonly<ProcessingRequest>,
    codebaseInfo: Readonly<CodebaseInfo>
  ): Promise<{ voiceId: string; content: string; confidence: number; analysisType: string }[]> {
    const responses: {
      voiceId: string;
      content: string;
      confidence: number;
      analysisType: string;
    }[] = [];

    // Process voices in parallel for better performance
    const analysisPromises = voices.map(async voiceId => {
      try {
        const enhancedRequest = ProcessingRequest.create(
          this.buildVoiceSpecificPrompt(request.prompt, voiceId, codebaseInfo),
          request.type,
          'medium',
          {
            ...request.context,
            // @ts-expect-error: Extending context for voice-specific analysis
            voiceId,
            codebaseInfo: {
              fileCount: codebaseInfo.metrics?.totalFiles,
              languages: Object.keys(codebaseInfo.metrics?.languages || {}),
              complexity: codebaseInfo.metrics?.complexity,
            },
          },
          request.constraints
        );

        const response = await model.generateResponse(enhancedRequest, { id: voiceId });

        return {
          voiceId,
          content: response.content,
          confidence: response.confidence ?? this.getDefaultConfidence(voiceId),
          analysisType: this.getVoiceAnalysisType(voiceId),
        };
      } catch (error) {
        console.warn(`Voice ${voiceId} failed analysis:`, error);
        return {
          voiceId,
          content: `Analysis failed for ${voiceId} voice: ${error}`,
          confidence: 0.1,
          analysisType: this.getVoiceAnalysisType(voiceId),
        };
      }
    });

    const results = await Promise.allSettled(analysisPromises);

    results.forEach(result => {
      if (result.status === 'fulfilled') {
        responses.push(result.value);
      }
    });

    return responses;
  }

  private getDefaultConfidence(voiceId: string): number {
    const confidenceMap: Record<string, number> = {
      architect: 0.85,
      maintainer: 0.8,
      security: 0.9,
      analyzer: 0.85,
      optimizer: 0.75,
      guardian: 0.8,
    };

    return confidenceMap[voiceId] || 0.75;
  }

  private synthesizeAnalysisResponses(
    responses: ReadonlyArray<{
      voiceId: string;
      content: string;
      confidence: number;
      analysisType: string;
    }>
  ): { voiceId: string; content: string; confidence: number; analysisType: string } {
    if (responses.length === 1) {
      return responses[0];
    }

    // Weighted synthesis based on confidence scores
    const totalWeight = responses.reduce(
      (
        sum: number,
        r: Readonly<{ voiceId: string; content: string; confidence: number; analysisType: string }>
      ) => sum + r.confidence,
      0
    );
    const weightedConfidence = totalWeight / responses.length;

    // Group insights by analysis type
    const groupedAnalysis: Record<string, string[]> = {};
    for (const response of responses) {
      groupedAnalysis[response.analysisType] = groupedAnalysis[response.analysisType] || [];
      groupedAnalysis[response.analysisType].push(
        `**${response.voiceId.toUpperCase()} PERSPECTIVE** (Confidence: ${Math.round(response.confidence * 100)}%)\n${response.content}`
      );
    }

    // Create synthesized content
    const synthesizedSections = Object.entries(groupedAnalysis).map(
      ([type, contents]: [string, string[]]) =>
        `## ${type.toUpperCase()} ANALYSIS\n\n${contents.join('\n\n---\n\n')}`
    );

    const synthesizedContent = `# COMPREHENSIVE CODEBASE ANALYSIS

${synthesizedSections.join('\n\n')}

## SYNTHESIS SUMMARY
This analysis combines insights from ${responses.length} specialized voices: ${responses.map(r => r.voiceId).join(', ')}.
Overall confidence level: ${Math.round(weightedConfidence * 100)}%`;

    return {
      voiceId: 'synthesis',
      content: synthesizedContent,
      confidence: weightedConfidence,
      analysisType: 'comprehensive',
    };
  }

  private buildVoiceSpecificPrompt(
    basePrompt: string,
    voiceId: string,
    codebaseInfo: CodebaseInfo
  ): string {
    const voiceInstructions: Record<string, string> = {
      architect: `As a Software Architect, focus on:
- System architecture and design patterns
- Module dependencies and coupling
- Scalability and extensibility concerns
- Architectural debt and refactoring opportunities
- Design principle adherence (SOLID, DRY, etc.)`,

      maintainer: `As a Code Maintainer, focus on:
- Code readability and documentation quality
- Technical debt identification
- Refactoring opportunities
- Code complexity and maintainability metrics
- Developer experience and onboarding friction`,

      security: `As a Security Expert, focus on:
- Security vulnerabilities and attack vectors
- Authentication and authorization patterns
- Data protection and privacy concerns
- Dependency security risks
- Security best practices compliance`,

      analyzer: `As a Code Quality Analyzer, focus on:
- Code quality metrics and trends
- Performance patterns and anti-patterns
- Test coverage and quality
- Coding standards compliance
- Error handling patterns`,

      optimizer: `As a Performance Optimizer, focus on:
- Performance bottlenecks and optimization opportunities
- Resource usage patterns
- Algorithmic complexity
- Memory and CPU efficiency
- Caching and optimization strategies`,

      guardian: `As a Quality Guardian, focus on:
- Risk assessment and mitigation
- Compliance with coding standards
- Quality gates and checkpoints
- Technical debt impact analysis
- Long-term sustainability concerns`,
    };

    const instruction = voiceInstructions[voiceId] || 'Provide general code analysis';

    return `${basePrompt}

${instruction}

## Codebase Context:
- Total Files: ${codebaseInfo.metrics?.totalFiles ?? 'Unknown'}
- Total Lines: ${codebaseInfo.metrics?.totalLines ?? 'Unknown'}
- Primary Languages: ${Object.keys(codebaseInfo.metrics?.languages ?? {}).join(', ')}
- Average Complexity: ${codebaseInfo.metrics?.complexity ?? 'Unknown'}
- Test Coverage: ${codebaseInfo.metrics?.testCoverage ?? 'Unknown'}%
- Dependencies: ${codebaseInfo.metrics?.dependencies ?? 'Unknown'}

## Directory Structure:
${codebaseInfo.structure}

Provide specific, actionable insights with concrete examples where possible.`;
  }

  private getVoiceAnalysisType(voiceId: string): string {
    const typeMap: Record<string, string> = {
      architect: 'structural',
      maintainer: 'quality',
      security: 'security',
      analyzer: 'metrics',
      optimizer: 'performance',
      guardian: 'compliance',
    };
    return typeMap[voiceId] || 'general';
  }

  private transformToOutput(
    analysis: Readonly<{
      voiceId: string;
      content: string;
      confidence: number;
      analysisType: string;
    }>,
    input: Readonly<CodebaseAnalysisInput>,
    voices: ReadonlyArray<string>,
    codebaseInfo: Readonly<CodebaseInfo>,
    startTime: number
  ): CodebaseAnalysisOutput {
    const findings = this.extractFindings(analysis.content);
    const recommendations = this.extractRecommendations(analysis.content);

    return {
      summary: this.extractSummary(analysis.content),
      findings,
      recommendations,
      metrics: codebaseInfo.metrics || {
        totalFiles: 0,
        totalLines: 0,
        languages: {},
        complexity: 0,
        dependencies: 0,
      },
      metadata: {
        analysisType: input.analysisType,
        filesAnalyzed: codebaseInfo.metrics?.totalFiles || 0,
        processingTime: Date.now() - startTime,
        voicesUsed: Array.from(voices),
        confidenceScore: analysis.confidence,
      },
    };
  }

  private extractSummary(content: string): string {
    // Look for summary sections first
    const summaryMatch = content.match(
      /(?:## SYNTHESIS SUMMARY|# SUMMARY|## SUMMARY)([\s\S]*?)(?:\n## |\n# |$)/i
    );
    if (summaryMatch) {
      return summaryMatch[1].trim().substring(0, 500);
    }

    // Fall back to first meaningful paragraph
    const lines = content
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#') && !line.startsWith('**'))
      .slice(0, 5);

    const summary = lines.join(' ').substring(0, 500);
    return summary + (summary.length >= 500 ? '...' : '');
  }

  private extractFindings(content: string): AnalysisFinding[] {
    const findings: AnalysisFinding[] = [];

    // Enhanced pattern matching for various finding indicators
    const patterns = [
      {
        regex: /(?:issue|problem|concern|vulnerability|risk)[s]?[:\s]([^\n.]+)/gi,
        type: 'issue' as const,
        severity: 'medium' as const,
      },
      {
        regex: /(?:opportunity|improvement|enhancement)[s]?[:\s]([^\n.]+)/gi,
        type: 'opportunity' as const,
        severity: 'low' as const,
      },
      {
        regex: /(?:strength|good|well|excellent)[s]?[:\s]([^\n.]+)/gi,
        type: 'strength' as const,
        severity: 'low' as const,
      },
      {
        regex: /(?:critical|severe|major)[s]?[:\s]([^\n.]+)/gi,
        type: 'risk' as const,
        severity: 'high' as const,
      },
      {
        regex: /(?:security|vulnerability|exploit)[s]?[:\s]([^\n.]+)/gi,
        type: 'risk' as const,
        severity: 'high' as const,
      },
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        findings.push({
          type: pattern.type,
          severity: pattern.severity,
          category: this.categorizeFound(match[1]),
          description: match[1].trim(),
          impact: this.estimateImpact(pattern.type, match[1]),
        });
      }
    });

    // Limit to most relevant findings
    return findings.slice(0, 20);
  }

  private extractRecommendations(content: string): AnalysisRecommendation[] {
    const recommendations: AnalysisRecommendation[] = [];

    // Look for recommendation patterns
    const patterns = [
      /(?:recommend|suggest|should|consider|advise)[s]?[:\s]([^\n.]+)/gi,
      /(?:next steps?|action items?|todo)[:\s]([^\n.]+)/gi,
      /(?:improve|enhance|optimize|refactor)[:\s]([^\n.]+)/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const action = match[1].trim();
        recommendations.push({
          priority: this.estimatePriority(action),
          category: this.categorizeRecommendation(action),
          action,
          rationale: this.generateRationale(action),
          estimatedEffort: this.estimateEffort(action),
        });
      }
    });

    return recommendations.slice(0, 15);
  }

  private categorizeFound(description: string): string {
    const keywords = description.toLowerCase();
    if (keywords.includes('security') || keywords.includes('vulnerability')) return 'security';
    if (keywords.includes('performance') || keywords.includes('slow')) return 'performance';
    if (keywords.includes('complex') || keywords.includes('maintainability'))
      return 'maintainability';
    if (keywords.includes('test') || keywords.includes('coverage')) return 'testing';
    if (keywords.includes('architecture') || keywords.includes('design')) return 'architecture';
    if (keywords.includes('documentation') || keywords.includes('comment')) return 'documentation';
    return 'general';
  }

  private estimateImpact(type: AnalysisFinding['type'], _description: string): string {
    const impactMap = {
      issue: 'May cause bugs or maintenance difficulties',
      opportunity: 'Could improve code quality and developer experience',
      strength: 'Contributes to code quality and maintainability',
      risk: 'Potential for serious problems if not addressed',
    };

    return impactMap[type];
  }

  private estimatePriority(action: string): AnalysisRecommendation['priority'] {
    const keywords = action.toLowerCase();
    if (
      keywords.includes('critical') ||
      keywords.includes('urgent') ||
      keywords.includes('security')
    ) {
      return 'high';
    }
    if (
      keywords.includes('important') ||
      keywords.includes('significant') ||
      keywords.includes('should')
    ) {
      return 'medium';
    }
    return 'low';
  }

  private categorizeRecommendation(action: string): string {
    const keywords = action.toLowerCase();
    if (keywords.includes('refactor') || keywords.includes('restructure')) return 'refactoring';
    if (keywords.includes('test') || keywords.includes('coverage')) return 'testing';
    if (keywords.includes('document') || keywords.includes('comment')) return 'documentation';
    if (keywords.includes('security') || keywords.includes('vulnerability')) return 'security';
    if (keywords.includes('performance') || keywords.includes('optimize')) return 'performance';
    if (keywords.includes('architecture') || keywords.includes('design')) return 'architecture';
    return 'general';
  }

  private generateRationale(action: string): string {
    const category = this.categorizeRecommendation(action);
    const rationales = {
      refactoring: 'Improves code maintainability and reduces technical debt',
      testing: 'Increases confidence in code changes and reduces bugs',
      documentation: 'Improves developer onboarding and code understanding',
      security: 'Reduces security risks and vulnerabilities',
      performance: 'Improves application speed and resource efficiency',
      architecture: 'Improves system scalability and maintainability',
      general: 'Contributes to overall code quality',
    };

    // Ensure category is a valid key of rationales
    return rationales[category as keyof typeof rationales] || rationales.general;
  }

  private estimateEffort(action: string): AnalysisRecommendation['estimatedEffort'] {
    const keywords = action.toLowerCase();
    if (
      keywords.includes('major') ||
      keywords.includes('complete') ||
      keywords.includes('entire')
    ) {
      return 'large';
    }
    if (
      keywords.includes('significant') ||
      keywords.includes('multiple') ||
      keywords.includes('refactor')
    ) {
      return 'medium';
    }
    return 'small';
  }
}
