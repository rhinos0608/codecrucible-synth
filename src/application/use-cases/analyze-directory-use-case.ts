/**
 * Analyze Directory Use Case - Application Layer
 * 
 * Handles directory analysis operations following clean architecture principles.
 * Contains application logic for analyzing entire directories and project structures.
 */

import { performance } from 'perf_hooks';
import { readdirSync, statSync, readFileSync, existsSync } from 'fs';
import { join, extname, relative, basename } from 'path';
import { IAnalyzeDirectoryUseCase, AnalysisRequest, AnalysisResponse } from '../../domain/interfaces/use-cases.js';
import { IWorkflowOrchestrator, WorkflowRequest } from '../../domain/interfaces/workflow-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';

interface FileInfo {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  type: 'source' | 'test' | 'config' | 'documentation' | 'other';
  lines: number;
}

interface DirectoryStructure {
  totalFiles: number;
  totalLines: number;
  filesByType: Record<string, number>;
  filesByExtension: Record<string, number>;
  largestFiles: FileInfo[];
  dependencies: string[];
}

export class AnalyzeDirectoryUseCase implements IAnalyzeDirectoryUseCase {
  constructor(private orchestrator: IWorkflowOrchestrator) {}

  async execute(request: AnalysisRequest): Promise<AnalysisResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.directoryPath) {
        throw new Error('Directory path is required');
      }

      if (!existsSync(request.directoryPath)) {
        throw new Error(`Directory not found: ${request.directoryPath}`);
      }

      const stats = statSync(request.directoryPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${request.directoryPath}`);
      }

      // Scan directory structure
      const directoryStructure = await this.scanDirectory(
        request.directoryPath,
        request.options?.depth || 3
      );

      // Build analysis prompt with directory insights
      const analysisPrompt = this.buildDirectoryAnalysisPrompt(
        directoryStructure,
        request.directoryPath,
        request.options
      );

      // Execute analysis through orchestrator
      const workflowRequest: WorkflowRequest = {
        id: `analyze-directory-${Date.now()}`,
        type: 'analysis',
        payload: {
          prompt: analysisPrompt,
          directoryPath: request.directoryPath,
          structure: directoryStructure,
          options: request.options
        },
        context: {
          sessionId: `directory-analysis-${Date.now()}`,
          workingDirectory: request.directoryPath,
          permissions: ['read', 'analyze', 'traverse'],
          securityLevel: 'medium' as const
        }
      };

      const workflowResponse = await this.orchestrator.processRequest(workflowRequest);
      
      if (!workflowResponse.success) {
        throw new Error(workflowResponse.error?.message || 'Directory analysis failed');
      }

      // Parse and structure the analysis result
      const analysisResult = this.parseDirectoryAnalysisResult(
        workflowResponse.result,
        directoryStructure
      );
      
      const metadata = {
        duration: performance.now() - startTime,
        linesAnalyzed: directoryStructure.totalLines,
        filesAnalyzed: directoryStructure.totalFiles
      };

      return {
        success: true,
        analysis: analysisResult,
        metadata
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Directory analysis failed:', error);
      
      return {
        success: false,
        analysis: {
          summary: 'Directory analysis failed',
          insights: [],
          recommendations: ['Check directory path and permissions']
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

  private async scanDirectory(directoryPath: string, maxDepth: number): Promise<DirectoryStructure> {
    const files: FileInfo[] = [];
    const dependencies = new Set<string>();
    
    const scanRecursive = (currentPath: string, currentDepth: number) => {
      if (currentDepth > maxDepth) return;

      try {
        const entries = readdirSync(currentPath);
        
        for (const entry of entries) {
          const fullPath = join(currentPath, entry);
          const stats = statSync(fullPath);
          
          // Skip hidden files and common ignore patterns
          if (this.shouldSkipFile(entry, fullPath)) {
            continue;
          }

          if (stats.isDirectory()) {
            scanRecursive(fullPath, currentDepth + 1);
          } else if (stats.isFile()) {
            const fileInfo = this.analyzeFile(fullPath, directoryPath);
            files.push(fileInfo);
            
            // Extract dependencies if it's a config file
            if (fileInfo.type === 'config') {
              this.extractDependencies(fullPath).forEach(dep => dependencies.add(dep));
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan directory ${currentPath}:`, error);
      }
    };

    scanRecursive(directoryPath, 0);

    // Calculate statistics
    const totalFiles = files.length;
    const totalLines = files.reduce((sum, file) => sum + file.lines, 0);
    
    const filesByType: Record<string, number> = {};
    const filesByExtension: Record<string, number> = {};
    
    files.forEach(file => {
      filesByType[file.type] = (filesByType[file.type] || 0) + 1;
      filesByExtension[file.extension] = (filesByExtension[file.extension] || 0) + 1;
    });

    // Get largest files (top 10)
    const largestFiles = files
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 10);

    return {
      totalFiles,
      totalLines,
      filesByType,
      filesByExtension,
      largestFiles,
      dependencies: Array.from(dependencies)
    };
  }

  private shouldSkipFile(entry: string, fullPath: string): boolean {
    const skipPatterns = [
      /^\./, // Hidden files
      /node_modules/,
      /dist/,
      /build/,
      /coverage/,
      /\.git/,
      /\.vscode/,
      /\.idea/,
      /temp/,
      /tmp/,
      /cache/,
      /logs?/,
      /\.log$/,
      /\.lock$/
    ];

    return skipPatterns.some(pattern => pattern.test(entry) || pattern.test(fullPath));
  }

  private analyzeFile(filePath: string, rootPath: string): FileInfo {
    const stats = statSync(filePath);
    const extension = extname(filePath);
    const relativePath = relative(rootPath, filePath);
    
    let lines = 0;
    try {
      const content = readFileSync(filePath, 'utf-8');
      lines = content.split('\n').length;
    } catch (error) {
      // Skip binary or unreadable files
    }

    return {
      path: filePath,
      relativePath,
      size: stats.size,
      extension,
      type: this.determineFileType(filePath),
      lines
    };
  }

  private determineFileType(filePath: string): FileInfo['type'] {
    const fileName = basename(filePath).toLowerCase();
    const extension = extname(filePath).toLowerCase();

    // Test files
    if (fileName.includes('test') || fileName.includes('spec') || 
        filePath.includes('/tests/') || filePath.includes('/__tests__/')) {
      return 'test';
    }

    // Configuration files
    const configFiles = [
      'package.json', 'tsconfig.json', 'webpack.config.js', 'rollup.config.js',
      'babel.config.js', 'jest.config.js', 'eslint.config.js', '.eslintrc',
      'prettier.config.js', '.prettierrc', 'docker-compose.yml', 'dockerfile',
      'makefile', 'cmake', '.env', '.gitignore', '.gitattributes'
    ];
    const configExtensions = ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.config'];
    
    if (configFiles.some(config => fileName.includes(config.toLowerCase())) ||
        configExtensions.includes(extension)) {
      return 'config';
    }

    // Documentation files
    const docExtensions = ['.md', '.txt', '.rst', '.adoc'];
    if (docExtensions.includes(extension) || fileName.includes('readme') || 
        fileName.includes('changelog') || fileName.includes('license')) {
      return 'documentation';
    }

    // Source code files
    const sourceExtensions = [
      '.ts', '.js', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs',
      '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.html',
      '.css', '.scss', '.sass', '.less', '.vue', '.svelte'
    ];
    
    if (sourceExtensions.includes(extension)) {
      return 'source';
    }

    return 'other';
  }

  private extractDependencies(filePath: string): string[] {
    const dependencies: string[] = [];
    
    try {
      const content = readFileSync(filePath, 'utf-8');
      const fileName = basename(filePath).toLowerCase();

      if (fileName === 'package.json') {
        const packageJson = JSON.parse(content);
        if (packageJson.dependencies) {
          dependencies.push(...Object.keys(packageJson.dependencies));
        }
        if (packageJson.devDependencies) {
          dependencies.push(...Object.keys(packageJson.devDependencies));
        }
      } else if (fileName === 'requirements.txt') {
        const lines = content.split('\n');
        lines.forEach(line => {
          const match = line.trim().match(/^([a-zA-Z0-9_-]+)/);
          if (match) {
            dependencies.push(match[1]);
          }
        });
      } else if (fileName === 'cargo.toml') {
        // Simple regex for Rust dependencies
        const matches = content.match(/^\s*([a-zA-Z0-9_-]+)\s*=/gm);
        if (matches) {
          matches.forEach(match => {
            const dep = match.replace(/\s*=.*/, '').trim();
            if (dep !== '[dependencies]' && dep !== '[dev-dependencies]') {
              dependencies.push(dep);
            }
          });
        }
      }
    } catch (error) {
      // Ignore errors in dependency extraction
    }

    return dependencies;
  }

  private buildDirectoryAnalysisPrompt(
    structure: DirectoryStructure,
    directoryPath: string,
    options?: AnalysisRequest['options']
  ): string {
    const dirName = basename(directoryPath);
    
    let prompt = `Please analyze the following project directory "${dirName}":\n\n`;
    
    prompt += `**Project Structure Overview**:\n`;
    prompt += `- Total Files: ${structure.totalFiles}\n`;
    prompt += `- Total Lines of Code: ${structure.totalLines.toLocaleString()}\n`;
    prompt += `- File Types:\n`;
    
    Object.entries(structure.filesByType).forEach(([type, count]) => {
      prompt += `  - ${type}: ${count} files\n`;
    });
    
    prompt += `- Main Languages/Extensions:\n`;
    Object.entries(structure.filesByExtension)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([ext, count]) => {
        prompt += `  - ${ext || '(no extension)'}: ${count} files\n`;
      });

    if (structure.dependencies.length > 0) {
      prompt += `- Dependencies (${structure.dependencies.length}):\n`;
      structure.dependencies.slice(0, 10).forEach(dep => {
        prompt += `  - ${dep}\n`;
      });
      if (structure.dependencies.length > 10) {
        prompt += `  - ... and ${structure.dependencies.length - 10} more\n`;
      }
    }

    if (structure.largestFiles.length > 0) {
      prompt += `- Largest Files (by lines):\n`;
      structure.largestFiles.slice(0, 5).forEach(file => {
        prompt += `  - ${file.relativePath}: ${file.lines} lines\n`;
      });
    }

    prompt += `\n**Analysis Requirements**:\n`;
    prompt += `1. **Project Overview**: Identify the project type, purpose, and main technologies\n`;
    prompt += `2. **Architecture Assessment**: Evaluate the project structure and organization\n`;
    prompt += `3. **Code Quality Analysis**: Assess maintainability, scalability, and best practices\n`;
    prompt += `4. **Dependency Analysis**: Review external dependencies and their appropriateness\n`;
    prompt += `5. **Recommendations**: Suggest improvements for structure, performance, or maintainability\n`;

    if (options?.focusAreas && options.focusAreas.length > 0) {
      prompt += `6. **Focus Areas**: Pay special attention to: ${options.focusAreas.join(', ')}\n`;
    }

    if (options?.includeTests) {
      prompt += `7. **Testing Strategy**: Evaluate current testing approach and suggest improvements\n`;
    }

    prompt += `\nProvide a comprehensive analysis with actionable insights and recommendations.`;

    return prompt;
  }

  private parseDirectoryAnalysisResult(
    result: any,
    structure: DirectoryStructure
  ): AnalysisResponse['analysis'] {
    // If result is already structured, use it
    if (result && typeof result === 'object' && result.analysis) {
      return {
        ...result.analysis,
        structure: this.buildStructureSummary(structure)
      };
    }

    // If result is a string, parse it into structured format
    const resultText = typeof result === 'string' ? result : String(result);
    
    return {
      summary: this.extractSection(resultText, 'Project Overview') || 
               this.extractSection(resultText, 'Summary') ||
               'Directory analysis completed successfully',
      insights: this.extractListItems(resultText, 'Key Insights') || 
                this.extractListItems(resultText, 'Insights') || 
                this.extractListItems(resultText, 'Architecture Assessment') ||
                ['Project structure and dependencies analyzed'],
      recommendations: this.extractListItems(resultText, 'Recommendations') || 
                      ['Review the analysis for potential improvements'],
      codeQuality: this.extractCodeQuality(resultText, structure),
      structure: this.buildStructureSummary(structure)
    };
  }

  private buildStructureSummary(structure: DirectoryStructure): AnalysisResponse['analysis']['structure'] {
    return {
      files: structure.totalFiles,
      classes: this.estimateClasses(structure),
      functions: this.estimateFunctions(structure),
      dependencies: structure.dependencies
    };
  }

  private estimateClasses(structure: DirectoryStructure): number {
    // Rough estimation based on file types and extensions
    const sourceFiles = structure.filesByType.source || 0;
    const javaFiles = structure.filesByExtension['.java'] || 0;
    const tsFiles = structure.filesByExtension['.ts'] || 0;
    const jsFiles = structure.filesByExtension['.js'] || 0;
    
    return Math.round((javaFiles * 0.8) + (tsFiles * 0.6) + (jsFiles * 0.4));
  }

  private estimateFunctions(structure: DirectoryStructure): number {
    // Rough estimation based on lines of code and file types
    const sourceLines = structure.totalLines;
    const sourceFiles = structure.filesByType.source || 0;
    
    // Estimate ~1 function per 20 lines of source code
    return Math.round((sourceLines * 0.8) / 20);
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

  private extractCodeQuality(
    text: string, 
    structure: DirectoryStructure
  ): AnalysisResponse['analysis']['codeQuality'] | undefined {
    const qualitySection = this.extractSection(text, 'Code Quality');
    
    // Calculate a basic quality score based on project metrics
    let score = 70; // Base score
    
    // Adjust based on structure
    if (structure.filesByType.test > 0) score += 10; // Has tests
    if (structure.filesByType.documentation > 0) score += 5; // Has documentation
    if (structure.totalLines > 10000) score -= 5; // Large codebase penalty
    if (structure.dependencies.length > 50) score -= 5; // Many dependencies penalty
    
    score = Math.max(0, Math.min(100, score));
    
    return {
      score,
      issues: this.extractListItems(text, 'Issues') || 
              this.extractListItems(text, 'Problems') || [],
      suggestions: this.extractListItems(text, 'Suggestions') || 
                   this.extractListItems(text, 'Recommendations') || []
    };
  }
}