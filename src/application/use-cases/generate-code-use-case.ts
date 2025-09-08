/**
 * Generate Code Use Case - Application Layer
 *
 * Handles code generation operations following clean architecture principles.
 * Contains application logic for generating code based on user prompts and context.
 */

import { performance } from 'perf_hooks';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import {
  GenerationRequest,
  GenerationResponse,
  IGenerateCodeUseCase,
} from '../../domain/interfaces/use-cases.js';
import {
  IWorkflowOrchestrator,
  WorkflowRequest,
} from '../../domain/interfaces/workflow-orchestrator.js';
import { logger } from '../../infrastructure/logging/logger.js';
import { toErrorOrUndefined } from '../../utils/type-guards.js';

export class GenerateCodeUseCase implements IGenerateCodeUseCase {
  public constructor(private readonly orchestrator: IWorkflowOrchestrator) {}

  public async execute(request: Readonly<GenerationRequest>): Promise<GenerationResponse> {
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
          options: request.options,
        },
        context: {
          sessionId: `generation-${Date.now()}`,
          workingDirectory: process.cwd(),
          permissions: ['read', 'write', 'generate'],
          securityLevel: 'high' as const,
        },
      };

      const workflowResponse = await this.orchestrator.processRequest(workflowRequest);

      if (!workflowResponse.success) {
        throw new Error(workflowResponse.error?.message || 'Code generation failed');
      }

      // Parse and structure the generation result
      const generatedFiles = this.parseGenerationResult(workflowResponse.result, request);

      logger.debug('Dry run mode configuration', {
        dryRun: request.options?.dryRun,
        willSaveFiles: !request.options?.dryRun,
      });

      // Check if AI chose inline display
      const inlineFiles = generatedFiles.filter(f => f.path.startsWith('__INLINE_DISPLAY__'));
      const actualFiles = generatedFiles.filter(f => !f.path.startsWith('__INLINE_DISPLAY__'));

      let smartFiles: GenerationResponse['generated']['files'] = [];

      if (inlineFiles.length > 0) {
        logger.debug('AI chose inline display mode', { filesSkipped: true });
        smartFiles = []; // Empty array indicates inline display
      } else if (actualFiles.length > 0) {
        logger.debug('AI chose file creation mode', { filesProvided: smartFiles?.length || 0 });
        smartFiles = actualFiles; // Use AI-provided file paths directly
      }

      // Save files if not dry run and files were intended to be saved
      if (!request.options?.dryRun && smartFiles.length > 0) {
        logger.info('Saving AI-generated files', { fileCount: smartFiles.length });
        this.saveGeneratedFiles(smartFiles);
      } else if (inlineFiles.length > 0 || smartFiles.length === 0) {
        logger.debug('Content displayed inline, no files saved', { mode: 'inline' });
      } else {
        logger.debug('Skipping file save in dry run mode', { dryRun: true });
      }

      const metadata = {
        duration: performance.now() - startTime,
        tokensGenerated: this.estimateTokens(generatedFiles),
        filesCreated: smartFiles.length,
      };

      return {
        success: true,
        generated: {
          files: smartFiles,
          summary: this.buildSummary(smartFiles, request, inlineFiles),
          changes: this.buildChangesSummary(smartFiles),
        },
        metadata,
      };
    } catch (error) {
      const duration = performance.now() - startTime;
      logger.error('Code generation failed', toErrorOrUndefined(error));

      return {
        success: false,
        generated: {
          files: [],
          summary: 'Code generation failed',
        },
        metadata: {
          duration,
          tokensGenerated: 0,
          filesCreated: 0,
        },
        error: error instanceof Error ? error.message : String(error),
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

    // AI-Guided File Placement Questions
    prompt += `**CRITICAL: File Placement Decision**:\n`;
    prompt += `Before generating code, you MUST consider these questions and respond accordingly:\n\n`;
    prompt += `1. **Should this be displayed inline or saved as files?**\n`;
    prompt += `   - Is this a simple example, interface, or type that can be shown in the chat? → Use INLINE_DISPLAY format\n`;
    prompt += `   - Does the request lack clear context about WHERE files should go? → Use INLINE_DISPLAY format\n`;
    prompt += `   - Is this a complete implementation that belongs in a project structure? → Use FILE format\n\n`;
    prompt += `2. **What should the filename be?**\n`;
    prompt += `   - Extract the main entity name from the request (e.g., "User" from "Create interface for User")\n`;
    prompt += `   - Use appropriate suffixes: .interface.ts, .types.ts, .component.tsx, .service.ts\n`;
    prompt += `   - If no clear entity name exists, ask for clarification or use INLINE_DISPLAY\n\n`;
    prompt += `3. **Where should files be placed?**\n`;
    prompt += `   - Analyze project structure to determine appropriate directories\n`;
    prompt += `   - Use src/types/ for interfaces/types, src/components/ for components, etc.\n`;
    prompt += `   - If uncertain about project structure, use current directory or ask for clarification\n\n`;

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

    prompt += `\n**Output Format Options**:\n`;
    prompt += `\n**Option A - INLINE_DISPLAY (for simple examples, unclear context):**\n`;
    prompt += `Just provide the code directly in a markdown code block without filename headers:\n`;
    prompt += `\`\`\`typescript\n[code here]\n\`\`\`\n\n`;

    prompt += `**Option B - FILE (for complete implementations with clear placement):**\n`;
    prompt += `Use this format for each file:\n`;
    prompt += `\`\`\`filename: path/to/file.ext\n[file content here]\n\`\`\`\n\n`;

    prompt += `**Decision Logic:**\n`;
    prompt += `- Choose INLINE_DISPLAY if: simple request, no clear file location, example code, or uncertain context\n`;
    prompt += `- Choose FILE if: complete implementation, clear entity names, obvious project structure fit\n\n`;

    prompt += `Also provide a brief summary of what was generated and key features implemented.`;

    return prompt;
  }

  private parseGenerationResult(
    result: unknown,
    _request: Readonly<GenerationRequest>
  ): GenerationResponse['generated']['files'] {
    const files: GenerationResponse['generated']['files'] = [];

    let resultText: string;
    if (typeof result === 'string') {
      resultText = result;
    } else if (result && typeof result === 'object') {
      // Properly handle object responses by extracting meaningful content
      const obj = result as Record<string, unknown>;
      if (typeof obj.content === 'string') {
        resultText = obj.content;
      } else if (typeof obj.text === 'string') {
        resultText = obj.text;
      } else if (typeof obj.response === 'string') {
        resultText = obj.response;
      } else if (
        obj.message &&
        typeof obj.message === 'object' &&
        typeof (obj.message as { content?: unknown }).content === 'string'
      ) {
        resultText = (obj.message as { content: string }).content;
      } else {
        // If no standard content field found, try to stringify but log for debugging
        logger.error('Unexpected result format in generate-code-use-case', new Error(JSON.stringify({ result })));
        resultText = JSON.stringify(result, null, 2);
      }
    } else {
      resultText = String(result);
    }

    // DEBUG: Log the result being parsed
    logger.debug('Parsing generation result', {
      resultType: typeof result,
      textLength: resultText.length,
      preview: resultText.substring(0, 500),
    });

    // Check if AI chose INLINE_DISPLAY format (code blocks without filename headers)
    const inlineCodeRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const fileCodeRegex = /```filename:\s*(.+?)\n([\s\S]*?)```/g;

    const hasFileHeaders = fileCodeRegex.test(resultText);
    fileCodeRegex.lastIndex = 0; // Reset regex

    if (hasFileHeaders) {
      // AI chose FILE format - extract files with explicit paths
      logger.debug('AI chose FILE format for output', { extractionMode: 'explicit_paths' });
      let match;
      while ((match = fileCodeRegex.exec(resultText)) !== null) {
        const filePath = match[1].trim();
        const content = match[2].trim();

        logger.debug('Found generated file', { filePath, contentLength: content.length });

        if (content && filePath) {
          const fileType = this.determineFileType(filePath, content);
          files.push({
            path: filePath,
            content,
            type: fileType,
          });
        }
      }
    } else {
      // AI chose INLINE_DISPLAY format - extract code blocks without filenames
      logger.debug('AI chose INLINE_DISPLAY format', { displayMode: 'inline' });
      let match;
      while ((match = inlineCodeRegex.exec(resultText)) !== null) {
        const language = match[1] || 'typescript';
        const content = match[2].trim();

        logger.debug('Found inline code block', {
          language,
          contentLength: content.length,
        });

        if (content) {
          // Mark as inline display by using special path
          files.push({
            path: `__INLINE_DISPLAY__.${language}`,
            content,
            type: 'inline',
          });
        }
      }
    }

    // Fallback: if no code blocks found, treat entire result as inline display
    if (files.length === 0 && resultText.trim()) {
      logger.debug('No code blocks found, using inline display', { fallback: true });
      files.push({
        path: '__INLINE_DISPLAY__.txt',
        content: resultText.trim(),
        type: 'inline',
      });
    }

    logger.debug('Files parsed successfully', {
      fileCount: files.length,
      files: files.map(f => ({ path: f.path, type: f.type, contentLength: f.content.length })),
    });

    return files;
  }

  private determineFileType(
    filePath: string,
    _content: string
  ): GenerationResponse['generated']['files'][0]['type'] {
    const fileName = filePath.toLowerCase();

    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'test';
    }
    if (
      fileName.includes('readme') ||
      fileName.includes('doc') ||
      fileName.endsWith('.md') ||
      fileName.endsWith('.txt')
    ) {
      return 'documentation';
    }
    if (
      fileName.includes('config') ||
      fileName.includes('settings') ||
      fileName.endsWith('.json') ||
      fileName.endsWith('.yaml') ||
      fileName.endsWith('.yml') ||
      fileName.endsWith('.xml')
    ) {
      return 'config';
    }

    return 'source';
  }

  private saveGeneratedFiles(files: Readonly<GenerationResponse['generated']['files']>): void {
    logger.debug('Starting file save operation', { fileCount: files.length });

    for (const file of files) {
      try {
        logger.debug('Saving generated file', {
          path: file.path,
          contentLength: file.content.length,
        });

        // Ensure directory exists
        const dir = dirname(file.path);
        logger.debug('Directory check', { directory: dir, exists: existsSync(dir) });
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
          logger.debug('Created directory', { directory: dir });
        }

        // Write file
        writeFileSync(file.path, file.content, 'utf-8');
        logger.debug('File written successfully', { path: file.path });
        logger.info(`Generated file saved: ${file.path}`);
      } catch (error) {
        logger.error(`Failed to save file ${file.path}`, toErrorOrUndefined(error));
        throw new Error(`Failed to save file ${file.path}: ${error}`);
      }
    }
    logger.debug('File save operation completed', { filesProcessed: files.length });
  }

  private buildSummary(
    files: GenerationResponse['generated']['files'],
    request: GenerationRequest,
    inlineFiles?: GenerationResponse['generated']['files']
  ): string {
    // Handle inline display case
    if (inlineFiles && inlineFiles.length > 0) {
      let summary = `Generated code (AI chose inline display):\n\n`;

      for (const file of inlineFiles) {
        // Extract language from the special path
        const language = file.path.split('.').pop() || 'typescript';
        summary += `\`\`\`${language}\n${file.content}\n\`\`\`\n\n`;
      }

      summary += `Based on: "${request.prompt}"\n`;
      if (request.context?.language) {
        summary += `Language: ${request.context.language}`;
      }

      return summary;
    }

    // Handle file creation case
    let summary = `Generated ${files.length} file(s) based on: "${request.prompt}"\n\n`;

    const filesByType = files.reduce<Record<string, number>>(
      (acc, file) => {
        acc[file.type] = (acc[file.type] || 0) + 1;
        return acc;
      },
      {}
    );

    if (files.length > 0) {
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

      // Show file locations
      summary += `\n\nFiles:\n`;
      files.forEach(file => {
        summary += `- ${file.path} (${file.type}, ${file.content.length} chars)\n`;
      });
    } else {
      summary += 'AI determined this should be displayed inline rather than saved as files.';
    }

    return summary;
  }

  private buildChangesSummary(files: Readonly<GenerationResponse['generated']['files']>): string[] {
    return files.map(file => `Created ${file.path} (${file.type})`);
  }

  private estimateTokens(files: Readonly<GenerationResponse['generated']['files']>): number {
    // Rough estimation: ~4 characters per token
    return files.reduce((total, file) => total + Math.ceil(file.content.length / 4), 0);
  }

  // Note: File placement logic has been replaced with AI-guided decision making.
  // The AI now decides whether to display code inline or create files with appropriate names and locations.
  // This approach leverages the AI's understanding rather than brittle rule-based logic.
}
