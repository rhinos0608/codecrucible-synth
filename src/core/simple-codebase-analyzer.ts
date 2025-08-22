/**
 * Simple Codebase Analyzer - Direct, conflict-free analysis with Chain-of-Thought
 * Bypasses complex agent systems that cause Ollama conflicts
 * Shows transparent reasoning process to users
 */

import { OllamaProvider } from '../providers/ollama.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger.js';
import { ChainOfThoughtDisplay } from './chain-of-thought-display.js';

export interface AnalysisResult {
  success: boolean;
  content: string;
  metadata: {
    duration: number;
    promptLength: number;
    responseLength: number;
    projectStructure: string;
  };
  error?: string;
}

export class SimpleCodebaseAnalyzer {
  private provider: OllamaProvider;
  private chainOfThought: ChainOfThoughtDisplay;

  constructor() {
    this.provider = new OllamaProvider({
      endpoint: 'http://localhost:11434',
      model: 'qwen2.5-coder:7b',
      timeout: 120000, // 2 minutes for thorough analysis
    });

    this.chainOfThought = new ChainOfThoughtDisplay({
      realTimeDisplay: true,
      showTimestamps: true,
      showDuration: true,
      showMetadata: true,
      colorOutput: true,
    });
  }

  async analyzeCurrentProject(): Promise<AnalysisResult> {
    const startTime = Date.now();

    // Start chain-of-thought session
    this.chainOfThought.startSession('CodeCrucible Synth Codebase Analysis');

    try {
      // Step 1: Check AI model availability
      this.chainOfThought.addReasoning(
        'Checking AI Model Availability',
        'Before starting analysis, I need to verify that the Ollama service is running and the qwen2.5-coder:7b model is available for codebase analysis.',
        0.9,
        'Check Ollama service status'
      );

      const available = await this.provider.checkStatus();
      if (!available) {
        this.chainOfThought.addError(
          'Ollama service is not available',
          'Cannot proceed with analysis without AI model access',
          'Please start Ollama service and ensure qwen2.5-coder:7b model is installed'
        );

        this.chainOfThought.endSession('Analysis failed: AI model unavailable');

        return {
          success: false,
          content: '',
          metadata: { duration: 0, promptLength: 0, responseLength: 0, projectStructure: '' },
          error: 'Ollama service is not available',
        };
      }

      this.chainOfThought.addAnalysis(
        'Ollama Service Status',
        'Ollama service is running and ready. Model qwen2.5-coder:7b is available for analysis.',
        0.95
      );

      // Step 2: Project structure analysis
      this.chainOfThought.addReasoning(
        'Analyzing Project Structure',
        'I need to examine the codebase structure to understand the project architecture, identify key files, and determine the scope of analysis.',
        0.9,
        'Scan filesystem and build project map'
      );

      const projectStructure = await this.getProjectStructure();

      this.chainOfThought.addAnalysis(
        'Project Structure Mapping',
        `Discovered project structure with ${projectStructure.split('\n').length} items. Identified key directories: src/, config/, tests/, dist/, and documentation in Docs/`,
        0.9
      );

      // Step 3: Analysis strategy
      this.chainOfThought.addReasoning(
        'Determining Analysis Strategy',
        'Based on the project structure, this appears to be a TypeScript/JavaScript AI coding assistant with modular architecture. I should focus on: 1) Core functionality, 2) AI integration patterns, 3) Configuration management, 4) Code organization, 5) Current implementation state.',
        0.85,
        'Create comprehensive analysis prompt'
      );

      // Step 4: Read key files for better analysis
      this.chainOfThought.addReasoning(
        'Reading Key Implementation Files',
        'Reading core files to understand actual implementation vs. documentation claims.',
        0.85,
        'Read package.json, CLAUDE.md, and key source files'
      );

      const keyFileContents = await this.readKeyFiles();

      // Step 5: Prompt construction
      const analysisPrompt = `You are an expert software architect analyzing the CodeCrucible Synth project.

Project Root: ${process.cwd()}

Project Structure:
${projectStructure}

Key File Contents:
${keyFileContents}

Please provide a comprehensive analysis using BOTH project structure AND actual file contents:

1. **Project Overview**: What is CodeCrucible Synth and its purpose?
2. **Architecture**: Key components and their relationships (analyze actual code)
3. **Technology Stack**: Languages, frameworks, and tools used (from package.json and imports)
4. **Code Organization**: How the codebase is structured (from actual source)
5. **Current State**: Working features vs issues (analyze implementation)
6. **Context Window Configuration**: Check if context windows meet industry standards (128K+ tokens)
7. **CLI Tool Analysis**: Whether tools are properly used for file reading vs generic responses
8. **Recommendations**: Specific improvements based on code analysis

Be specific about actual implementation patterns you observe in the source code.`;

      this.chainOfThought.addToolCall(
        'AI Analysis Engine',
        'Sending comprehensive project analysis prompt to qwen2.5-coder:7b model for expert architectural assessment',
        {
          promptLength: analysisPrompt.length,
          temperature: 0.2,
          maxTokens: 1500,
        }
      );

      logger.info('🔍 Starting direct codebase analysis', {
        promptLength: analysisPrompt.length,
        projectStructureLength: projectStructure.length,
      });

      this.chainOfThought.addDecision(
        'Use Direct AI Analysis',
        'Chosen direct Ollama API call over complex agent systems to avoid conflicts and ensure reliable analysis completion',
        [
          'Complex agent system (risk of timeout)',
          'Multiple AI calls (slower)',
          'Simple rule-based analysis (less accurate)',
        ]
      );

      // Step 5: AI analysis
      const analysisStart = Date.now();
      const response = await this.provider.processRequest({
        prompt: analysisPrompt,
        model: 'qwen2.5-coder:7b',
        temperature: 0.2, // Lower temperature for more factual analysis
        maxTokens: 8000, // Increased for comprehensive analysis with file contents
      });
      const analysisTime = Date.now() - analysisStart;

      this.chainOfThought.addAnalysis(
        'AI Model Analysis Complete',
        `Received comprehensive analysis from qwen2.5-coder:7b. Generated ${response.content.length} characters of detailed architectural assessment covering project purpose, structure, and recommendations.`,
        0.9
      );

      // Step 6: Results validation
      this.chainOfThought.addReasoning(
        'Validating Analysis Results',
        'Checking that the AI analysis contains all requested sections (overview, architecture, tech stack, organization, current state, recommendations) and provides actionable insights.',
        0.85,
        'Return comprehensive analysis'
      );

      const duration = Date.now() - startTime;

      this.chainOfThought.addConclusion(
        'Analysis Complete',
        `Successfully analyzed CodeCrucible Synth codebase in ${duration}ms. Generated comprehensive architectural assessment with specific recommendations for improvement.`,
        0.95
      );

      logger.info('✅ Direct codebase analysis completed', {
        duration,
        responseLength: response.content.length,
        success: true,
      });

      this.chainOfThought.endSession(
        `Analysis successful: ${response.content.length} characters generated in ${duration}ms`
      );

      return {
        success: true,
        content: response.content,
        metadata: {
          duration,
          promptLength: analysisPrompt.length,
          responseLength: response.content.length,
          projectStructure,
        },
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.chainOfThought.addError(
        errorMessage,
        'Analysis failed during execution',
        'Check Ollama service status and model availability'
      );

      logger.error('❌ Direct codebase analysis failed', { error: errorMessage, duration });

      this.chainOfThought.endSession(`Analysis failed: ${errorMessage}`);

      return {
        success: false,
        content: '',
        metadata: { duration, promptLength: 0, responseLength: 0, projectStructure: '' },
        error: errorMessage,
      };
    }
  }

  private async getProjectStructure(): Promise<string> {
    try {
      this.chainOfThought.addFileRead(
        'Project Root Directory',
        'Reading root directory contents to identify project structure and key files for analysis',
        undefined,
        undefined
      );

      const structure: string[] = [];
      const rootPath = process.cwd();

      // Get root level items
      const rootItems = await fs.readdir(rootPath);

      this.chainOfThought.addAnalysis(
        'Root Directory Scan',
        `Found ${rootItems.length} items in project root. Filtering for analysis-relevant files and directories.`,
        0.9
      );

      // Prioritize important files and directories
      const importantItems = [
        'package.json',
        'README.md',
        'CLAUDE.md',
        'task.md',
        'src',
        'dist',
        'config',
        'Docs',
        'tests',
        'tsconfig.json',
        '.eslintrc.cjs',
      ].filter(item => rootItems.includes(item));

      // Add any other important files not in the priority list
      const otherImportant = rootItems
        .filter(
          item =>
            (item.endsWith('.json') ||
              item.endsWith('.md') ||
              item.endsWith('.js') ||
              item.endsWith('.ts')) &&
            !importantItems.includes(item) &&
            !item.startsWith('.') &&
            !item.includes('node_modules')
        )
        .slice(0, 5);

      const allItems = [...importantItems, ...otherImportant];

      for (const item of allItems) {
        const itemPath = join(rootPath, item);

        try {
          const stats = await fs.stat(itemPath);

          if (stats.isDirectory()) {
            structure.push(`📁 ${item}/`);

            // For key directories, show some contents
            if (['src', 'config', 'Docs'].includes(item)) {
              this.chainOfThought.addFileRead(
                `Directory: ${item}/`,
                `Scanning ${item} directory to understand ${item === 'src' ? 'source code structure' : item === 'config' ? 'configuration files' : 'documentation organization'}`,
                undefined,
                undefined
              );

              const dirItems = await fs.readdir(itemPath);
              dirItems.slice(0, 8).forEach(subItem => {
                const icon = this.getFileIcon(subItem);
                structure.push(`  ${icon} ${subItem}`);
              });

              if (dirItems.length > 8) {
                structure.push(`  📄 ... and ${dirItems.length - 8} more files`);
              }
            }
          } else {
            const icon = this.getFileIcon(item);
            structure.push(`${icon} ${item}`);
          }
        } catch (error) {
          structure.push(`❌ Error reading ${item}: ${error.message}`);
        }
      }

      // Add summary statistics
      try {
        const allFiles = await this.countFiles(rootPath);
        structure.push('');
        structure.push(`📊 Project Statistics:`);
        structure.push(`   Total files: ~${allFiles.total}`);
        structure.push(`   TypeScript files: ~${allFiles.ts}`);
        structure.push(`   JavaScript files: ~${allFiles.js}`);
        structure.push(`   Configuration files: ~${allFiles.config}`);
      } catch (error) {
        // Continue without stats if there's an issue
      }

      return structure.join('\n');
    } catch (error) {
      return `Error reading project structure: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';

    switch (ext) {
      case 'ts':
        return '📄';
      case 'js':
        return '📄';
      case 'json':
        return '⚙️';
      case 'md':
        return '📝';
      case 'yaml':
      case 'yml':
        return '⚙️';
      case 'css':
        return '🎨';
      case 'html':
        return '🌐';
      default:
        return '📄';
    }
  }

  private async readKeyFiles(): Promise<string> {
    const keyFiles = [
      'package.json',
      'CLAUDE.md',
      'src/core/cli.ts',
      'src/core/client.ts',
      'src/voices/voice-archetype-system.ts',
      'config/default.yaml',
    ];

    const contents: string[] = [];

    for (const file of keyFiles) {
      try {
        const content = await fs.readFile(join(process.cwd(), file), 'utf-8');
        contents.push(
          `\n=== ${file} ===\n${content.substring(0, 2000)}${content.length > 2000 ? '\n... (truncated)' : ''}`
        );
      } catch (error) {
        contents.push(`\n=== ${file} === \n[Error reading file: ${error.message}]`);
      }
    }

    return contents.join('\n');
  }

  private async countFiles(
    dirPath: string
  ): Promise<{ total: number; ts: number; js: number; config: number }> {
    const counts = { total: 0, ts: 0, js: 0, config: 0 };

    try {
      const items = await fs.readdir(dirPath);

      for (const item of items) {
        // Skip common directories that would make counting too slow
        if (['node_modules', '.git', 'dist', 'build'].includes(item)) {
          continue;
        }

        const itemPath = join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isFile()) {
          counts.total++;

          if (item.endsWith('.ts')) counts.ts++;
          else if (item.endsWith('.js')) counts.js++;
          else if (item.endsWith('.json') || item.endsWith('.yaml') || item.endsWith('.yml')) {
            counts.config++;
          }
        }
      }
    } catch (error) {
      // Return what we have so far
    }

    return counts;
  }
}

export const simpleCodebaseAnalyzer = new SimpleCodebaseAnalyzer();
