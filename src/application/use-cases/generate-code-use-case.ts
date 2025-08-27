/**
 * Generate Code Use Case - Application Layer
 * 
 * Handles code generation operations following clean architecture principles.
 * Contains application logic for generating code based on user prompts and context.
 */

import { performance } from 'perf_hooks';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, extname, join } from 'path';
import { IGenerateCodeUseCase, GenerationRequest, GenerationResponse } from '../../domain/interfaces/use-cases.js';
import { IWorkflowOrchestrator, WorkflowRequest } from '../../domain/interfaces/workflow-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class GenerateCodeUseCase implements IGenerateCodeUseCase {
  constructor(private orchestrator: IWorkflowOrchestrator) {}

  async execute(request: GenerationRequest): Promise<GenerationResponse> {
    const startTime = performance.now();
    
    try {
      // Validate request
      if (!request.prompt) {
        throw new Error('Prompt is required for code generation');
      }

      // Build comprehensive generation prompt
      const generationPrompt = this.buildGenerationPrompt(request);

      // Execute generation through orchestrator
      const workflowRequest: WorkflowRequest = {
        id: `generate-code-${Date.now()}`,
        type: 'prompt',
        payload: {
          prompt: generationPrompt,
          context: request.context,
          options: request.options
        },
        context: {
          sessionId: `generation-${Date.now()}`,
          workingDirectory: process.cwd(),
          permissions: ['read', 'write', 'generate'],
          securityLevel: 'high' as const
        }
      };

      const workflowResponse = await this.orchestrator.processRequest(workflowRequest);
      
      if (!workflowResponse.success) {
        throw new Error(workflowResponse.error?.message || 'Code generation failed');
      }

      // Parse and structure the generation result
      const generatedFiles = this.parseGenerationResult(workflowResponse.result, request);
      
      // Save files if not dry run
      if (!request.options?.dryRun) {
        await this.saveGeneratedFiles(generatedFiles);
      }

      const metadata = {
        duration: performance.now() - startTime,
        tokensGenerated: this.estimateTokens(generatedFiles),
        filesCreated: generatedFiles.length
      };

      return {
        success: true,
        generated: {
          files: generatedFiles,
          summary: this.buildSummary(generatedFiles, request),
          changes: this.buildChangesSummary(generatedFiles)
        },
        metadata
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Code generation failed:', error);
      
      return {
        success: false,
        generated: {
          files: [],
          summary: 'Code generation failed'
        },
        metadata: {
          duration,
          tokensGenerated: 0,
          filesCreated: 0
        },
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private buildGenerationPrompt(request: GenerationRequest): string {
    let prompt = `Generate code based on the following requirements:\n\n`;
    prompt += `**Request**: ${request.prompt}\n\n`;

    // Add context information
    if (request.context) {
      prompt += `**Context**:\n`;
      if (request.context.projectType) {
        prompt += `- Project Type: ${request.context.projectType}\n`;
      }
      if (request.context.language) {
        prompt += `- Language: ${request.context.language}\n`;
      }
      if (request.context.framework) {
        prompt += `- Framework: ${request.context.framework}\n`;
      }
      if (request.context.existingFiles && request.context.existingFiles.length > 0) {
        prompt += `- Related Files: ${request.context.existingFiles.join(', ')}\n`;
      }
      prompt += '\n';
    }

    // Add options
    if (request.options) {
      prompt += `**Requirements**:\n`;
      if (request.options.includeTests) {
        prompt += `- Include comprehensive unit tests\n`;
      }
      if (request.options.includeDocumentation) {
        prompt += `- Include detailed documentation and comments\n`;
      }
      if (request.options.codeStyle) {
        prompt += `- Code Style: ${request.options.codeStyle}\n`;
      }
      if (request.options.outputFiles && request.options.outputFiles.length > 0) {
        prompt += `- Target Files: ${request.options.outputFiles.join(', ')}\n`;
      }
      prompt += '\n';
    }

    prompt += `**Instructions**:\n`;
    prompt += `1. Generate clean, production-ready code following best practices\n`;
    prompt += `2. Include appropriate error handling and validation\n`;
    prompt += `3. Follow consistent naming conventions and code style\n`;
    prompt += `4. Add clear comments explaining complex logic\n`;
    prompt += `5. Ensure code is modular and maintainable\n`;
    
    if (request.options?.includeTests) {
      prompt += `6. Include comprehensive test coverage with different scenarios\n`;
    }
    
    if (request.options?.includeDocumentation) {
      prompt += `7. Include README or documentation explaining usage\n`;
    }

    prompt += `\n**Output Format**:\n`;
    prompt += `Provide the generated code in a structured format with clear file names and paths. `;
    prompt += `For each file, use the following format:\n\n`;
    prompt += `\`\`\`filename: path/to/file.ext\n[file content here]\n\`\`\`\n\n`;
    prompt += `Also provide a brief summary of what was generated and key features implemented.`;

    return prompt;
  }

  private parseGenerationResult(
    result: any, 
    request: GenerationRequest
  ): GenerationResponse['generated']['files'] {
    const files: GenerationResponse['generated']['files'] = [];
    
    let resultText = typeof result === 'string' ? result : String(result);
    
    // Extract files from code blocks with filenames
    const fileBlockRegex = /```(?:filename:\s*(.+?)\n)?([\s\S]*?)```/g;
    let match;
    let fileIndex = 0;

    while ((match = fileBlockRegex.exec(resultText)) !== null) {
      let filePath = match[1]?.trim();
      const content = match[2]?.trim();
      
      if (!content) continue;

      // Generate filename if not provided
      if (!filePath) {
        const extension = this.inferFileExtension(content, request);
        filePath = `generated-file-${fileIndex}${extension}`;
        fileIndex++;
      }

      // Determine file type
      const fileType = this.determineFileType(filePath, content);

      files.push({
        path: filePath,
        content,
        type: fileType
      });
    }

    // If no structured files found, create a single file from the entire result
    if (files.length === 0 && resultText.trim()) {
      const extension = this.inferFileExtension(resultText, request);
      files.push({
        path: `generated-code${extension}`,
        content: resultText,
        type: 'source'
      });
    }

    return files;
  }

  private inferFileExtension(content: string, request: GenerationRequest): string {
    // Check context language first
    if (request.context?.language) {
      const langMap: Record<string, string> = {
        'typescript': '.ts',
        'javascript': '.js',
        'python': '.py',
        'java': '.java',
        'cpp': '.cpp',
        'c': '.c',
        'csharp': '.cs',
        'go': '.go',
        'rust': '.rs',
        'ruby': '.rb',
        'php': '.php'
      };
      
      const ext = langMap[request.context.language.toLowerCase()];
      if (ext) return ext;
    }

    // Analyze content for language hints
    if (content.includes('interface ') || content.includes('type ') || content.includes('import ')) {
      return '.ts';
    }
    if (content.includes('function ') || content.includes('const ') || content.includes('let ')) {
      return '.js';
    }
    if (content.includes('def ') || content.includes('import ')) {
      return '.py';
    }
    if (content.includes('public class ') || content.includes('package ')) {
      return '.java';
    }

    return '.txt';
  }

  private determineFileType(
    filePath: string, 
    content: string
  ): GenerationResponse['generated']['files'][0]['type'] {
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    }
    if (fileName.includes('readme') || fileName.includes('doc') || 
        fileName.endsWith('.md') || fileName.endsWith('.txt')) {
      return 'documentation';
    }
    if (fileName.includes('config') || fileName.includes('settings') ||
        fileName.endsWith('.json') || fileName.endsWith('.yaml') || 
        fileName.endsWith('.yml') || fileName.endsWith('.xml')) {
      return 'config';
    }
    
    return 'source';
  }

  private async saveGeneratedFiles(files: GenerationResponse['generated']['files']): Promise<void> {
    for (const file of files) {
      try {
        // Ensure directory exists
        const dir = dirname(file.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }

        // Write file
        writeFileSync(file.path, file.content, 'utf-8');
        logger.info(`Generated file saved: ${file.path}`);
      } catch (error) {
        logger.error(`Failed to save file ${file.path}:`, error);
        throw new Error(`Failed to save file ${file.path}: ${error}`);
      }
    }
  }

  private buildSummary(
    files: GenerationResponse['generated']['files'],
    request: GenerationRequest
  ): string {
    let summary = `Generated ${files.length} file(s) based on: "${request.prompt}"\n\n`;
    
    const filesByType = files.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    summary += 'Files created:\n';
    Object.entries(filesByType).forEach(([type, count]) => {
      summary += `- ${count} ${type} file(s)\n`;
    });

    if (request.context?.language) {
      summary += `\nLanguage: ${request.context.language}`;
    }
    if (request.context?.framework) {
      summary += `\nFramework: ${request.context.framework}`;
    }

    return summary;
  }

  private buildChangesSummary(files: GenerationResponse['generated']['files']): string[] {
    return files.map(file => `Created ${file.path} (${file.type})`);
  }

  private estimateTokens(files: GenerationResponse['generated']['files']): number {
    // Rough estimation: ~4 characters per token
    return files.reduce((total, file) => total + Math.ceil(file.content.length / 4), 0);
  }
}