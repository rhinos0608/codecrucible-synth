/**
 * Analyze Codebase Use Case
 * Application Layer - Clean codebase analysis orchestration
 *
 * Handles: Code analysis with proper input/output transformation
 * Imports: Domain services only (follows ARCHITECTURE.md)
 */

import { IModelSelectionService } from '../../domain/services/model-selection-service.js';
import { IVoiceOrchestrationService } from '../../domain/services/voice-orchestration-service.js';
import { ProcessingRequest } from '../../domain/entities/request.js';

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

/**
 * Use Case: Analyze codebase structure, quality, and patterns
 * Orchestrates domain services for comprehensive code analysis
 */
export class AnalyzeCodebaseUseCase {
  constructor(
    private modelSelectionService: IModelSelectionService,
    private voiceOrchestrationService: IVoiceOrchestrationService
  ) {}

  async execute(input: CodebaseAnalysisInput): Promise<CodebaseAnalysisOutput> {
    const startTime = Date.now();

    // Input validation and transformation
    const request = this.transformToProcessingRequest(input);

    // Domain orchestration - Select appropriate voices for analysis type
    const voiceSelection = await this.selectAnalysisVoices(input.analysisType);
    const selectedModel = await this.modelSelectionService.selectOptimalModel(request);

    // Gather codebase information (this would interface with infrastructure later)
    const codebaseInfo = await this.gatherCodebaseInformation(input);

    // Generate analysis from selected voices
    const analysisResponses = await this.generateAnalysisResponses(
      voiceSelection,
      selectedModel,
      request,
      codebaseInfo
    );

    // Synthesize multi-voice analysis if multiple voices used
    const synthesizedAnalysis =
      voiceSelection.length > 1
        ? await this.synthesizeAnalysisResponses(analysisResponses)
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

    return ProcessingRequest.create(
      analysisPrompt,
      'code-analysis' as any,
      'medium',
      {
        ...input.context,
        codebasePath: input.codebasePath,
        analysisType: input.analysisType,
        includeFiles: input.includeFiles,
        excludePatterns: input.excludePatterns,
        focusAreas: input.focusAreas,
      } as any,
      {
        // No extra constraints for now
      }
    );
  }

  private async selectAnalysisVoices(analysisType: string): Promise<string[]> {
    const voiceMap: Record<string, string[]> = {
      structure: ['architect', 'analyzer'],
      quality: ['maintainer', 'analyzer', 'guardian'],
      security: ['security', 'guardian'],
      performance: ['optimizer', 'analyzer'],
      comprehensive: ['architect', 'maintainer', 'security', 'analyzer', 'guardian'],
    };

    return voiceMap[analysisType] || ['analyzer'];
  }

  private async gatherCodebaseInformation(input: CodebaseAnalysisInput): Promise<any> {
    // This is a placeholder - in full implementation, this would interface
    // with infrastructure adapters to scan the actual codebase
    return {
      structure: `Analyzing codebase at: ${input.codebasePath}`,
      files: input.includeFiles || [],
      excludes: input.excludePatterns || [],
      metrics: {
        totalFiles: 100, // Placeholder
        totalLines: 5000, // Placeholder
        languages: { typescript: 60, javascript: 30, json: 10 },
        complexity: 3.2,
        dependencies: 25,
      },
    };
  }

  private async generateAnalysisResponses(
    voices: string[],
    model: any,
    request: ProcessingRequest,
    codebaseInfo: any
  ): Promise<any[]> {
    const responses = [];

    for (const voiceId of voices) {
      try {
        const enhancedRequest = ProcessingRequest.create(
          this.buildVoiceSpecificPrompt(request.prompt, voiceId, codebaseInfo),
          request.type as any,
          'medium',
          request.context,
          { ...request.constraints, mustIncludeVoices: [voiceId] }
        );

        const response = await model.generateResponse(enhancedRequest, { id: voiceId });

        responses.push({
          voiceId,
          content: response.content,
          confidence: response.confidence || 0.8,
          analysisType: this.getVoiceAnalysisType(voiceId),
        });
      } catch (error) {
        console.warn(`Voice ${voiceId} failed analysis:`, error);
      }
    }

    return responses;
  }

  private async synthesizeAnalysisResponses(responses: any[]): Promise<any> {
    if (responses.length === 1) {
      return responses[0];
    }

    // Create a synthesis request
    const synthesisContent = responses
      .map(r => `## ${r.voiceId.toUpperCase()} ANALYSIS:\n${r.content}`)
      .join('\n\n');

    const synthesisRequest = ProcessingRequest.create(
      this.buildSynthesisPrompt(synthesisContent),
      'analysis-synthesis' as any,
      'medium',
      {},
      { mustIncludeVoices: ['architect'] }
    );

    // For now, return a combined analysis (in full implementation, would synthesize)
    return {
      voiceId: 'synthesis',
      content: synthesisContent,
      confidence: responses.reduce((sum, r) => sum + r.confidence, 0) / responses.length,
      analysisType: 'comprehensive',
    };
  }

  private buildAnalysisPrompt(input: CodebaseAnalysisInput): string {
    return `Analyze the codebase with focus on ${input.analysisType} analysis.

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

  private buildVoiceSpecificPrompt(basePrompt: string, voiceId: string, codebaseInfo: any): string {
    const voiceFocus = {
      architect: 'Focus on system architecture, design patterns, and structural integrity',
      maintainer: 'Focus on code maintainability, readability, and technical debt',
      security: 'Focus on security vulnerabilities, attack surfaces, and security best practices',
      analyzer: 'Focus on code quality metrics, complexity analysis, and performance patterns',
      optimizer: 'Focus on performance bottlenecks, optimization opportunities, and efficiency',
      guardian: 'Focus on quality gates, compliance, and risk assessment',
    };

    const focus = (voiceFocus as any)[voiceId] || 'Provide general analysis';

    return `${basePrompt}

As the ${voiceId} voice, ${focus}.

Codebase Information:
${JSON.stringify(codebaseInfo, null, 2)}`;
  }

  private buildSynthesisPrompt(analysisContent: string): string {
    return `Synthesize the following multi-voice codebase analysis into a unified, comprehensive report:

${analysisContent}

Create a cohesive analysis that:
1. Consolidates key findings
2. Resolves any conflicting recommendations
3. Prioritizes issues and opportunities
4. Provides clear next steps
5. Maintains insights from all perspectives`;
  }

  private getVoiceAnalysisType(voiceId: string): string {
    const typeMap = {
      architect: 'structural',
      maintainer: 'quality',
      security: 'security',
      analyzer: 'metrics',
      optimizer: 'performance',
      guardian: 'compliance',
    };
    return (typeMap as any)[voiceId] || 'general';
  }

  private transformToOutput(
    analysis: any,
    input: CodebaseAnalysisInput,
    voices: string[],
    codebaseInfo: any,
    startTime: number
  ): CodebaseAnalysisOutput {
    // Parse analysis content to extract structured findings
    const findings = this.extractFindings(analysis.content);
    const recommendations = this.extractRecommendations(analysis.content);

    return {
      summary: this.extractSummary(analysis.content),
      findings,
      recommendations,
      metrics: codebaseInfo.metrics,
      metadata: {
        analysisType: input.analysisType,
        filesAnalyzed: codebaseInfo.metrics.totalFiles,
        processingTime: Date.now() - startTime,
        voicesUsed: voices,
        confidenceScore: analysis.confidence,
      },
    };
  }

  private extractSummary(content: string): string {
    // Extract first paragraph as summary (simplified extraction)
    const lines = content.split('\n').filter(line => line.trim());
    return `${lines.slice(0, 3).join(' ').substring(0, 300)  }...`;
  }

  private extractFindings(content: string): AnalysisFinding[] {
    // Simplified finding extraction - in real implementation would use NLP
    return [
      {
        type: 'opportunity',
        severity: 'medium',
        category: 'code-quality',
        description: 'Code structure could be improved',
        impact: 'Better maintainability',
      },
      {
        type: 'issue',
        severity: 'low',
        category: 'performance',
        description: 'Some optimization opportunities identified',
        impact: 'Improved performance',
      },
    ];
  }

  private extractRecommendations(content: string): AnalysisRecommendation[] {
    // Simplified recommendation extraction
    return [
      {
        priority: 'medium',
        category: 'refactoring',
        action: 'Refactor large functions',
        rationale: 'Improve code maintainability',
        estimatedEffort: 'medium',
      },
      {
        priority: 'low',
        category: 'documentation',
        action: 'Add missing documentation',
        rationale: 'Improve code understanding',
        estimatedEffort: 'small',
      },
    ];
  }
}
