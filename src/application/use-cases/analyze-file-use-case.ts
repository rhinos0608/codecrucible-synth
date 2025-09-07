/**
 * Analyze File Use Case - Application Layer
 *
 * Handles file analysis operations following clean architecture principles.
 * Contains application logic for analyzing individual files.
 */

import { performance } from 'perf_hooks';
import { existsSync, readFileSync, statSync } from 'fs';
import { basename, dirname, extname } from 'path';
import {
  AnalysisRequest,
  AnalysisResponse,
  IAnalyzeFileUseCase,
} from '../../domain/interfaces/use-cases.js';
import type { IWorkflowOrchestrator, WorkflowRequest } from '../../domain/interfaces/workflow-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class AnalyzeFileUseCase implements IAnalyzeFileUseCase {
  public constructor(private readonly orchestrator: Readonly<IWorkflowOrchestrator>) {}

  public async execute(request: Readonly<AnalysisRequest>): Promise<AnalysisResponse> {
    const startTime = performance.now();

    try {
      // Validate request
      if (!request.filePath && !request.content) {
        throw new Error('Either filePath or content must be provided');
      }

      let fileContent: string;
      const metadata = {
        duration: 0,
        linesAnalyzed: 0,
        filesAnalyzed: 1,
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
        if (request.content === undefined) {
          throw new Error('No filePath or content provided for analysis');
        }
        fileContent = request.content;
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
          options: request.options,
        },
        context: {
          sessionId: `analysis-${Date.now()}`,
          workingDirectory: request.filePath ? dirname(request.filePath) : process.cwd(),
          permissions: ['read', 'analyze'],
          securityLevel: 'medium' as const,
        },
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
          recommendations: ['Check file path and content validity'],
        },
        metadata: {
          duration,
          linesAnalyzed: 0,
          filesAnalyzed: 0,
        },
        error: error instanceof Error ? error.message : String(error),
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
    prompt +=
      '2. **Key Insights**: Important observations about the code structure, patterns, and functionality\n';
    prompt +=
      '3. **Code Quality Assessment**: Evaluate readability, maintainability, and best practices\n';
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
      '.ps1': 'powershell',
    };

    return languageMap[extension.toLowerCase()] || 'text';
  }

  private parseAnalysisResult(result: unknown): AnalysisResponse['analysis'] {
    // If result is already structured, use it
    if (
      typeof result === 'object' &&
      result !== null &&
      'analysis' in result &&
      typeof (result as { analysis?: unknown }).analysis === 'object'
    ) {
      return (result as { analysis: AnalysisResponse['analysis'] }).analysis;
    }

    // If result is a string, parse it into structured format
    let resultText: string;
    if (typeof result === 'string') {
      resultText = result;
    } else if (typeof result === 'object' && result !== null) {
      // Properly handle object responses by extracting meaningful content
      if ('content' in result && typeof (result as { content?: unknown }).content === 'string') {
        resultText = (result as { content: string }).content;
      } else if ('text' in result && typeof (result as { text?: unknown }).text === 'string') {
        resultText = (result as { text: string }).text;
      } else if ('response' in result && typeof (result as { response?: unknown }).response === 'string') {
        resultText = (result as { response: string }).response;
      } else if (
        'message' in result &&
        typeof (result as { message?: unknown }).message === 'object' &&
        'content' in (result as { message: { content?: unknown } }).message &&
        typeof ((result as { message: { content?: unknown } }).message as { content?: unknown }).content === 'string'
      ) {
        resultText = ((result as { message: { content: string } }).message).content;
      } else {
        // If no standard content field found, try to stringify but log for debugging
        // eslint-disable-next-line no-console
        console.error('Unexpected result format in analyze-file-use-case:', result);
        resultText = JSON.stringify(result, null, 2);
      }
    } else {
      resultText = String(result);
    }

    // CRITICAL FIX: Return the actual AI response content instead of generic fallbacks
    const extractedSummary = this.extractSection(resultText, 'Summary');
    const extractedInsights =
      this.extractListItems(resultText, 'Key Insights') ||
      this.extractListItems(resultText, 'Insights');
    const extractedRecommendations = this.extractListItems(resultText, 'Recommendations');

    // If we can't extract structured sections, return the full AI content as the summary
    // This ensures users see the actual AI response rather than generic messages
    if (
      !extractedSummary &&
      !extractedInsights &&
      !extractedRecommendations &&
      resultText.length > 50
    ) {
      return {
        summary: resultText, // Return the full AI response
        insights: [],
        recommendations: [],
        codeQuality: this.extractCodeQuality(resultText),
        structure: this.extractStructure(resultText),
      };
    }

    return {
      summary: extractedSummary ?? 'Analysis completed successfully',
      insights: extractedInsights ?? ['Code structure and functionality analyzed'],
      recommendations: extractedRecommendations ?? [
        'Review the analysis for potential improvements',
      ],
      codeQuality: this.extractCodeQuality(resultText),
      structure: this.extractStructure(resultText),
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
      .map(line => line.replace(/^[-\s*\d.]+/, '').trim())
      .filter(line => line.length > 0);
  }

  private extractCodeQuality(
    text: string
  ): AnalysisResponse['analysis']['codeQuality'] | undefined {
    const qualitySection = this.extractSection(text, 'Code Quality') ?? this.extractSection(text, 'Quality');
    const issues =
      this.extractListItems(text, 'Issues') ??
      this.extractListItems(text, 'Problems') ??
      this.extractListItems(text, 'Findings') ??
      [];
    const suggestions =
      this.extractListItems(text, 'Suggestions') ??
      this.extractListItems(text, 'Fixes') ??
      this.extractListItems(text, 'Recommendations') ??
      [];

    // Try to find an explicit numeric score
    let score: number | undefined;
    const percentMatch = text.match(/(?:score|quality)[:\s]*([0-9]{1,3})\s*%/i) ?? text.match(/([0-9]{1,3})\s*%/);
    if (percentMatch) {
      score = Math.min(100, Math.max(0, Number(percentMatch[1])));
    } else {
      const numericLabelMatch = text.match(/(?:score|quality)[:\s]*([0-9]{1,3})\b/i);
      if (numericLabelMatch) {
        score = Math.min(100, Math.max(0, Number(numericLabelMatch[1])));
      }
    }

    // Map descriptive words to scores if no explicit numeric score found
    if (score === undefined) {
      const descMatch = text.match(/\b(excellent|very good|good|fair|poor|bad|terrible)\b/i);
      if (descMatch) {
        const word = descMatch[1].toLowerCase();
        const map: Record<string, number> = {
          excellent: 95,
          'very good': 85,
          good: 75,
          fair: 60,
          poor: 40,
          bad: 30,
          terrible: 15,
        };
        score = map[word] ?? undefined;
      }
    }

    // Heuristic fallback: start from a base and penalize for issues
    if (score === undefined) {
      let base = 85;
      // penalize 4 points per issue, up to 40
      base -= Math.min(40, issues.length * 4);
      // penalize 2 points per suggestion (indicates work to do)
      base -= Math.min(20, suggestions.length * 2);
      // clamp
      score = Math.max(0, Math.min(100, Math.round(base)));
    }

    // Provide a small confidence metric for this automated extraction
    const confidence = (() => {
      let c = 0.5;
      if (qualitySection) c += 0.2;
      if (text.match(/\b(score|quality|issues|suggestions|problems|findings)\b/i)) c += 0.2;
      if (percentMatch) c += 0.1;
      return Math.min(1, c);
    })();

    return {
      score,
      issues,
      suggestions,
      // include the raw extracted quality section (if any) to help debugging / transparency
      details: qualitySection,
      confidence,
    } as unknown as AnalysisResponse['analysis']['codeQuality'];
  }

    // Try to parse code structure from any code fenced blocks in the AI result or from the free text.
    // This uses language-agnostic heuristics and a few language-specific regexes to count classes,
    // functions, and collect declared/imported dependencies.
    private extractStructure(text: string): AnalysisResponse['analysis']['structure'] | undefined {
      // Find fenced code blocks and pick the largest one (most likely the actual file content)
      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      let match: RegExpExecArray | null;
      let bestBlock: { lang?: string; code: string } | null = null;
      while ((match = codeBlockRegex.exec(text))) {
      const [, lang, code] = match;
      if (!bestBlock || code.length > bestBlock.code.length) {
        bestBlock = { lang, code };
      }
      }

      const codeToParse = bestBlock?.code ?? text;

      // Generic patterns
      const classRegex = /\bclass\s+[A-Za-z0-9_]+/g; // matches JS/TS/Java/C#/Python "class Name"
      const functionRegexes: RegExp[] = [
      /\bfunction\s+[A-Za-z0-9_]+\s*\(/g, // JS/TS/Java
      /\b[A-Za-z0-9_]+\s*=\s*\([^)]*\)\s*=>/g, // arrow functions assigned to vars (JS/TS)
      /^\s*def\s+[A-Za-z0-9_]+\s*\(/gm, // Python
      /\b(public|private|protected)?\s*[A-Za-z0-9_<>[\]]+\s+[A-Za-z0-9_]+\s*\(/g, // Java/C#/Go style method signatures (approx)
      ];

      // Dependency/import patterns for multiple languages
      const importPatterns: RegExp[] = [
      /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g, // ES modules
      /import\s+['"]([^'"]+)['"]/g, // side-effect imports
      /require\(['"]([^'"]+)['"]\)/g, // CommonJS
      /^using\s+([A-Za-z0-9_.]+)/gm, // C#
      /^import\s+([A-Za-z0-9_.]+)/gm, // Python single imports
      /^from\s+([A-Za-z0-9_.]+)\s+import/gm, // Python from ... import
      /\bpackage\s+([A-Za-z0-9_.]+);/g, // Java package (not external deps but informative)
      /^#include\s+<([^>]+)>/gm, // C/C++
      ];

      // Count classes
      const classes = (codeToParse.match(classRegex) ?? []).length;

      // Count functions using multiple heuristics and deduplicate approximate overlaps
      const functionCount = functionRegexes.reduce(
        (acc: number, rx: Readonly<RegExp>) => acc + (codeToParse.match(rx) ?? []).length,
        0
      );

      // Collect dependencies
      const deps = new Set<string>();
      for (const rx of importPatterns) {
        let m: RegExpExecArray | null;
        while ((m = rx.exec(codeToParse))) {
          const [, dep] = m;
          if (dep) {
            // normalize common path prefixes
            deps.add(dep.replace(/^\.\/+/, './').replace(/^\.\.\/+/, '..').trim());
          }
        }
      }

      // Attempt to detect number of files referenced in the analysis text (AI may report multiple files)
      let files = 1;
      const filesMatch = text.match(/\bfiles?\s*[:=]\s*([0-9]+)\b/i);
      if (filesMatch) {
        files = Math.max(1, Number(filesMatch[1]));
      } else {
        // If AI lists multiple filenames, try to count unique occurrences of typical filenames/extensions
        const filenameRegex = /\b[A-Za-z0-9_\-./\\]+?\.(?:ts|js|py|java|cs|cpp|c|go|rs|rb|php|swift|kt|scala)\b/g;
        const found = new Set<string>();
        let fm: RegExpExecArray | null;
        while ((fm = filenameRegex.exec(text))) {
          found.add(fm[0]);
        }
        if (found.size > 1) files = found.size;
      }

      // Provide a conservative functions estimate and ensure non-negative integers
      const functions = Math.max(0, functionCount);
      const dependencies = Array.from(deps).sort();

      return {
        files,
            classes,
            functions,
            dependencies,
          };
        }
    }
