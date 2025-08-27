/**
 * Analyze File Use Case - Application Layer
 * 
 * Handles file analysis operations following clean architecture principles.
 * Contains application logic for analyzing individual files.
 */

import { performance } from 'perf_hooks';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, basename } from 'path';
import { IAnalyzeFileUseCase, AnalysisRequest, AnalysisResponse } from '../../domain/interfaces/use-cases.js';
import { IWorkflowOrchestrator, WorkflowRequest } from '../../domain/interfaces/workflow-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class AnalyzeFileUseCase implements IAnalyzeFileUseCase {
  constructor(private orchestrator: IWorkflowOrchestrator) {}

  async execute(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.filePath && !request.content) {
        throw new Error('Either filePath or content must be provided');
      }

      let fileContent: string;
      let metadata = {
        duration: 0,
        linesAnalyzed: 0,
        filesAnalyzed: 1
      };

      // Read file content if path provided
      if (request.filePath) {
        if (!existsSync(request.filePath)) {
          throw new Error(`File not found: ${request.filePath}`);
        }

        const stats = statSync(request.filePath);
        if (!stats.isFile()) {
          throw new Error(`Path is not a file: ${request.filePath}`);
        }

        fileContent = readFileSync(request.filePath, 'utf-8');
      } else {
        fileContent = request.content!;
      }

      metadata.linesAnalyzed = fileContent.split('\n').length;

      // Prepare analysis prompt
      const analysisPrompt = this.buildAnalysisPrompt(
        fileContent,
        request.filePath,
        request.options
      );

      // Execute analysis through orchestrator
      const workflowRequest: WorkflowRequest = {
        id: `analyze-file-${Date.now()}`,
        type: 'analysis',
        payload: {
          prompt: analysisPrompt,
          content: fileContent,
          filePath: request.filePath,
          options: request.options
        },
        context: {
          sessionId: `analysis-${Date.now()}`,
          workingDirectory: request.filePath ? 
            require('path').dirname(request.filePath) : process.cwd(),
          permissions: ['read', 'analyze'],
          securityLevel: 'medium' as const
        }
      };

      const workflowResponse = await this.orchestrator.processRequest(workflowRequest);
      
      if (!workflowResponse.success) {
        throw new Error(workflowResponse.error?.message || 'Analysis failed');
      }

      // Parse and structure the analysis result
      const analysisResult = this.parseAnalysisResult(workflowResponse.result);
      
      metadata.duration = performance.now() - startTime;

      return {
        success: true,
        analysis: analysisResult,
        metadata,
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('File analysis failed:', error);
      
      return {
        success: false,
        analysis: {
          summary: 'Analysis failed',
          insights: [],
          recommendations: ['Check file path and content validity']
        },
        metadata: {
          duration,
          linesAnalyzed: 0,
          filesAnalyzed: 0
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private buildAnalysisPrompt(
    content: string, 
    filePath?: string, 
    options?: AnalysisRequest['options']
  ): string {
    const fileName = filePath ? basename(filePath) : 'file';
    const fileExtension = filePath ? extname(filePath) : '';
    const language = this.detectLanguage(fileExtension);

    let prompt = `Please analyze the following ${language} file`;
    if (filePath) {
      prompt += ` (${fileName})`;
    }
    prompt += `:\n\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;

    prompt += 'Provide a comprehensive analysis including:\n';
    prompt += '1. **Summary**: Brief overview of what this file does\n';
    prompt += '2. **Key Insights**: Important observations about the code structure, patterns, and functionality\n';
    prompt += '3. **Code Quality Assessment**: Evaluate readability, maintainability, and best practices\n';
    prompt += '4. **Recommendations**: Specific suggestions for improvements\n';
    
    if (options?.focusAreas && options.focusAreas.length > 0) {
      prompt += `5. **Focus Areas**: Pay special attention to: ${options.focusAreas.join(', ')}\n`;
    }

    if (options?.includeTests) {
      prompt += '6. **Testing Recommendations**: Suggest test cases and testing strategies\n';
    }

    prompt += '\nFormat your response as a structured analysis with clear sections.';
    
    return prompt;
  }

  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.js': 'javascript', 
      '.jsx': 'jsx',
      '.tsx': 'tsx',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.sass': 'sass',
      '.less': 'less',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.xml': 'xml',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'bash',
      '.ps1': 'powershell'
    };

    return languageMap[extension.toLowerCase()] || 'text';
  }

  private parseAnalysisResult(result: any): AnalysisResponse['analysis'] {
    // If result is already structured, use it
    if (result && typeof result === 'object' && result.analysis) {
      return result.analysis;
    }

    // If result is a string, parse it into structured format
    const resultText = typeof result === 'string' ? result : String(result);
    
    return {
      summary: this.extractSection(resultText, 'Summary') || 
               'Analysis completed successfully',
      insights: this.extractListItems(resultText, 'Key Insights') || 
                this.extractListItems(resultText, 'Insights') || 
                ['Code structure and functionality analyzed'],
      recommendations: this.extractListItems(resultText, 'Recommendations') || 
                      ['Review the analysis for potential improvements'],
      codeQuality: this.extractCodeQuality(resultText),
      structure: this.extractStructure(resultText)
    };
  }

  private extractSection(text: string, sectionName: string): string | undefined {
    const regex = new RegExp(`\\*\\*${sectionName}\\*\\*:?\\s*([\\s\\S]*?)(?=\\n\\*\\*|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : undefined;
  }

  private extractListItems(text: string, sectionName: string): string[] | undefined {
    const sectionText = this.extractSection(text, sectionName);
    if (!sectionText) return undefined;

    return sectionText
      .split('\n')
      .map(line => line.replace(/^[\s\-\*\d\.]+/, '').trim())
      .filter(line => line.length > 0);
  }

  private extractCodeQuality(text: string): AnalysisResponse['analysis']['codeQuality'] | undefined {
    const qualitySection = this.extractSection(text, 'Code Quality');
    if (!qualitySection) return undefined;

    return {
      score: 75, // Default score - could be improved with more sophisticated parsing
      issues: this.extractListItems(text, 'Issues') || [],
      suggestions: this.extractListItems(text, 'Suggestions') || []
    };
  }

  private extractStructure(text: string): AnalysisResponse['analysis']['structure'] | undefined {
    // This could be enhanced with actual code parsing
    return {
      files: 1,
      classes: 0,
      functions: 0,
      dependencies: []
    };
  }
}