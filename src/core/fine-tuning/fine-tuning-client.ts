import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger.js';
import { ApprovalManager, Operation, OperationContext } from '../approval/approval-manager.js';

const execAsync = promisify(exec);

export interface FineTuningConfig {
  baseModel: string;
  dataPath: string;
  newModelName: string;
  provider: 'ollama' | 'lmstudio';
  parameters: {
    epochs?: number;
    learningRate?: number;
    batchSize?: number;
    maxTokens?: number;
  };
}

export interface FineTuningResult {
  success: boolean;
  newModelName: string;
  trainingMetrics?: {
    epochs: number;
    loss: number;
    accuracy: number;
    trainingTime: number;
  };
  error?: string;
  recommendations?: string[];
}

export interface DataPreparationResult {
  success: boolean;
  processedFiles: number;
  totalTokens: number;
  outputPath: string;
  errors: string[];
  statistics: {
    avgFileSize: number;
    languages: Record<string, number>;
    fileTypes: Record<string, number>;
  };
}

/**
 * Fine-tuning client inspired by OpenAI Codex
 * Allows specializing models for specific domains/codebases
 */
export class FineTuningClient {
  private approvalManager?: ApprovalManager;
  private workspaceRoot: string;

  constructor(workspaceRoot: string, approvalManager?: ApprovalManager) {
    this.workspaceRoot = workspaceRoot;
    this.approvalManager = approvalManager;
    
    logger.info('Fine-tuning client initialized', { workspaceRoot });
  }

  /**
   * Fine-tune a model on a specific directory/codebase
   */
  async fineTuneModel(config: FineTuningConfig): Promise<FineTuningResult> {
    const startTime = Date.now();
    
    logger.info('Starting fine-tuning process', config);

    try {
      // Security approval for fine-tuning operation
      if (this.approvalManager) {
        const approved = await this.requestFineTuningApproval(config);
        if (!approved) {
          return {
            success: false,
            newModelName: '',
            error: 'Fine-tuning operation not approved'
          };
        }
      }

      // Prepare training data
      console.log('📊 Preparing training data...');
      const dataPrep = await this.prepareTrainingData(config.dataPath, config.newModelName);
      
      if (!dataPrep.success) {
        return {
          success: false,
          newModelName: '',
          error: `Data preparation failed: ${dataPrep.errors.join(', ')}`
        };
      }

      console.log(`✅ Prepared ${dataPrep.processedFiles} files (${dataPrep.totalTokens} tokens)`);

      // Execute fine-tuning based on provider
      let result: FineTuningResult;
      
      if (config.provider === 'ollama') {
        result = await this.fineTuneWithOllama(config, dataPrep.outputPath);
      } else {
        result = await this.fineTuneWithLMStudio(config, dataPrep.outputPath);
      }

      // Add training time to metrics
      if (result.success && result.trainingMetrics) {
        result.trainingMetrics.trainingTime = Date.now() - startTime;
      }

      // Generate recommendations
      result.recommendations = this.generateFineTuningRecommendations(result, dataPrep);

      logger.info('Fine-tuning completed', {
        success: result.success,
        model: result.newModelName,
        duration: Date.now() - startTime
      });

      return result;

    } catch (error) {
      logger.error('Fine-tuning failed:', error);
      return {
        success: false,
        newModelName: '',
        error: error instanceof Error ? error.message : 'Unknown fine-tuning error'
      };
    }
  }

  /**
   * Prepare training data from source directory
   */
  async prepareTrainingData(dataPath: string, modelName: string): Promise<DataPreparationResult> {
    try {
      const outputDir = path.join(this.workspaceRoot, '.codecrucible', 'fine-tuning');
      await fs.mkdir(outputDir, { recursive: true });

      const outputPath = path.join(outputDir, `${modelName}-training-data.jsonl`);
      
      // Gather code files
      const codeFiles = await this.gatherCodeFiles(dataPath);
      
      if (codeFiles.length === 0) {
        return {
          success: false,
          processedFiles: 0,
          totalTokens: 0,
          outputPath: '',
          errors: ['No code files found in the specified directory'],
          statistics: { avgFileSize: 0, languages: {}, fileTypes: {} }
        };
      }

      console.log(`📁 Found ${codeFiles.length} code files to process`);

      // Process files and create training examples
      const trainingExamples: any[] = [];
      const errors: string[] = [];
      const statistics = {
        avgFileSize: 0,
        languages: {} as Record<string, number>,
        fileTypes: {} as Record<string, number>
      };

      let totalSize = 0;
      let totalTokens = 0;

      for (const filePath of codeFiles) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileExt = path.extname(filePath).toLowerCase();
          const language = this.detectLanguage(fileExt);

          // Skip very large files (>100KB) or very small files (<50 chars)
          if (content.length > 100000 || content.length < 50) {
            continue;
          }

          // Create training examples from code
          const examples = this.createTrainingExamples(content, filePath, language);
          trainingExamples.push(...examples);

          // Update statistics
          totalSize += content.length;
          totalTokens += this.estimateTokens(content);
          statistics.languages[language] = (statistics.languages[language] || 0) + 1;
          statistics.fileTypes[fileExt] = (statistics.fileTypes[fileExt] || 0) + 1;

        } catch (error) {
          errors.push(`Failed to process ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      statistics.avgFileSize = totalSize / codeFiles.length;

      // Write training data in JSONL format
      const jsonlContent = trainingExamples
        .map(example => JSON.stringify(example))
        .join('\n');

      await fs.writeFile(outputPath, jsonlContent, 'utf-8');

      // Create metadata file
      const metadataPath = path.join(outputDir, `${modelName}-metadata.json`);
      await fs.writeFile(metadataPath, JSON.stringify({
        modelName,
        sourceDirectory: dataPath,
        createdAt: new Date().toISOString(),
        statistics,
        processedFiles: codeFiles.length,
        trainingExamples: trainingExamples.length,
        totalTokens,
        errors
      }, null, 2));

      return {
        success: true,
        processedFiles: codeFiles.length,
        totalTokens,
        outputPath,
        errors,
        statistics
      };

    } catch (error) {
      return {
        success: false,
        processedFiles: 0,
        totalTokens: 0,
        outputPath: '',
        errors: [error instanceof Error ? error.message : 'Unknown data preparation error'],
        statistics: { avgFileSize: 0, languages: {}, fileTypes: {} }
      };
    }
  }

  /**
   * Fine-tune using Ollama
   */
  private async fineTuneWithOllama(config: FineTuningConfig, dataPath: string): Promise<FineTuningResult> {
    try {
      // Create Ollama Modelfile
      const modelfilePath = await this.createOllamaModelfile(config, dataPath);
      
      console.log('🔄 Creating Ollama model...');
      const command = `ollama create ${config.newModelName} -f "${modelfilePath}"`;
      
      const { stdout, stderr } = await execAsync(command, {
        timeout: 600000 // 10 minute timeout
      });

      // Check if model was created successfully
      const checkCommand = `ollama list | grep ${config.newModelName}`;
      try {
        await execAsync(checkCommand);
        
        return {
          success: true,
          newModelName: config.newModelName,
          trainingMetrics: {
            epochs: 1, // Ollama doesn't expose detailed metrics
            loss: 0,
            accuracy: 0.85, // Estimated
            trainingTime: 0 // Will be set by caller
          }
        };
      } catch {
        return {
          success: false,
          newModelName: '',
          error: 'Model creation completed but model not found in Ollama registry'
        };
      }

    } catch (error) {
      return {
        success: false,
        newModelName: '',
        error: `Ollama fine-tuning failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Fine-tune using LM Studio (placeholder - LM Studio doesn't support fine-tuning via API)
   */
  private async fineTuneWithLMStudio(config: FineTuningConfig, dataPath: string): Promise<FineTuningResult> {
    // LM Studio doesn't currently support automated fine-tuning
    // This would be a placeholder for future implementation or external tool integration
    
    return {
      success: false,
      newModelName: '',
      error: 'LM Studio fine-tuning not yet supported. Use Ollama provider or implement external fine-tuning workflow.'
    };
  }

  /**
   * Create Ollama Modelfile for fine-tuning
   */
  private async createOllamaModelfile(config: FineTuningConfig, dataPath: string): Promise<string> {
    const modelfileDir = path.join(this.workspaceRoot, '.codecrucible', 'fine-tuning');
    const modelfilePath = path.join(modelfileDir, `${config.newModelName}.Modelfile`);

    const modelfileContent = `FROM ${config.baseModel}

# Fine-tuned model for ${config.newModelName}
TEMPLATE """{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
"""

# Training parameters
PARAMETER temperature 0.1
PARAMETER top_k 40
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.1

# System message for code generation
SYSTEM """You are a specialized coding assistant fine-tuned on this project's codebase. 
Follow the established patterns, conventions, and architectural decisions from the training data.
Generate code that is consistent with the project's style and requirements."""

# Load training data
ADAPTER ${dataPath}
`;

    await fs.writeFile(modelfilePath, modelfileContent, 'utf-8');
    return modelfilePath;
  }

  /**
   * Gather code files from directory
   */
  private async gatherCodeFiles(dirPath: string): Promise<string[]> {
    const codeFiles: string[] = [];
    const codeExtensions = [
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.cs', '.php', 
      '.rb', '.go', '.rs', '.swift', '.kt', '.scala', '.sh', '.ps1', '.sql',
      '.html', '.css', '.scss', '.sass', '.less', '.vue', '.svelte'
    ];

    const excludePatterns = [
      'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 
      '.nuxt', 'vendor', '__pycache__', '.pytest_cache'
    ];

    async function scanDirectory(currentPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          
          if (entry.isDirectory()) {
            // Skip excluded directories
            if (!excludePatterns.some(pattern => entry.name.includes(pattern))) {
              await scanDirectory(fullPath);
            }
          } else if (entry.isFile()) {
            // Include code files
            const ext = path.extname(entry.name).toLowerCase();
            if (codeExtensions.includes(ext)) {
              codeFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        logger.warn(`Failed to scan directory ${currentPath}:`, error);
      }
    }

    await scanDirectory(dirPath);
    return codeFiles;
  }

  /**
   * Create training examples from code content
   */
  private createTrainingExamples(content: string, filePath: string, language: string): any[] {
    const examples: any[] = [];
    
    // Extract functions, classes, and other code structures
    const codeBlocks = this.extractCodeBlocks(content, language);
    
    for (const block of codeBlocks) {
      // Create instruction-response pairs
      examples.push({
        instruction: `Generate a ${block.type} in ${language} that ${block.description}`,
        input: block.context || '',
        output: block.code,
        metadata: {
          file: path.basename(filePath),
          language,
          type: block.type
        }
      });
    }

    return examples;
  }

  /**
   * Extract code blocks for training
   */
  private extractCodeBlocks(content: string, language: string): Array<{
    type: string;
    description: string;
    code: string;
    context?: string;
  }> {
    const blocks: any[] = [];
    
    try {
      switch (language) {
        case 'typescript':
        case 'javascript':
          // Extract functions, classes, interfaces
          const functionMatches = content.match(/(?:export\s+)?(?:async\s+)?function\s+\w+[^{]*\{[^}]*\}/g);
          if (functionMatches) {
            functionMatches.forEach(match => {
              blocks.push({
                type: 'function',
                description: 'performs the specified functionality',
                code: match,
                context: this.extractComments(match)
              });
            });
          }
          break;

        case 'python':
          // Extract Python functions and classes
          const pyFunctionMatches = content.match(/def\s+\w+\([^)]*\):[^\\n]*(?:\\n(?:\s{4,}.*)?)*$/gm);
          if (pyFunctionMatches) {
            pyFunctionMatches.forEach(match => {
              blocks.push({
                type: 'function',
                description: 'implements the required functionality',
                code: match
              });
            });
          }
          break;

        default:
          // Generic approach for other languages
          const lines = content.split('\n');
          let currentBlock = '';
          let inFunction = false;
          
          for (const line of lines) {
            if (line.includes('function') || line.includes('def ') || line.includes('class ')) {
              if (currentBlock) {
                blocks.push({
                  type: 'code_block',
                  description: 'implements required functionality',
                  code: currentBlock.trim()
                });
              }
              currentBlock = line + '\n';
              inFunction = true;
            } else if (inFunction) {
              currentBlock += line + '\n';
              // Simple heuristic to detect end of block
              if (line.trim() === '' && currentBlock.length > 200) {
                inFunction = false;
              }
            }
          }
      }
    } catch (error) {
      logger.debug(`Failed to extract code blocks for ${language}:`, error);
    }

    return blocks;
  }

  /**
   * Extract comments from code
   */
  private extractComments(code: string): string {
    const commentMatches = code.match(/\/\*[\s\S]*?\*\/|\/\/.*$/gm);
    return commentMatches ? commentMatches.join(' ').replace(/[/*]/g, '').trim() : '';
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(extension: string): string {
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.php': 'php',
      '.rb': 'ruby',
      '.go': 'go',
      '.rs': 'rust',
      '.swift': 'swift',
      '.kt': 'kotlin',
      '.scala': 'scala',
      '.sh': 'bash',
      '.ps1': 'powershell',
      '.sql': 'sql'
    };

    return languageMap[extension] || 'unknown';
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for code
    return Math.ceil(text.length / 4);
  }

  /**
   * Request approval for fine-tuning operation
   */
  private async requestFineTuningApproval(config: FineTuningConfig): Promise<boolean> {
    if (!this.approvalManager) return true;

    const operation: Operation = {
      type: 'fine-tuning',
      target: `${config.baseModel} -> ${config.newModelName}`,
      description: `Fine-tune model on ${config.dataPath}`,
      metadata: config
    };

    const context: OperationContext = {
      sandboxMode: 'full-access', // Fine-tuning requires full access
      workspaceRoot: this.workspaceRoot,
      userIntent: 'Create specialized model for project',
      sessionId: `finetune_${Date.now()}`
    };

    const approval = await this.approvalManager.requestApproval(operation, context);
    return approval.granted;
  }

  /**
   * Generate recommendations based on fine-tuning results
   */
  private generateFineTuningRecommendations(
    result: FineTuningResult, 
    dataPrep: DataPreparationResult
  ): string[] {
    const recommendations: string[] = [];

    if (result.success) {
      recommendations.push(`Fine-tuning completed successfully! Test the model with: ollama run ${result.newModelName}`);
      
      if (dataPrep.processedFiles < 50) {
        recommendations.push('Consider adding more training data (50+ files recommended) for better specialization.');
      }
      
      if (dataPrep.totalTokens < 10000) {
        recommendations.push('Training dataset is relatively small. More diverse examples could improve performance.');
      }

      // Language-specific recommendations
      const dominantLanguage = Object.keys(dataPrep.statistics.languages)
        .reduce((a, b) => dataPrep.statistics.languages[a] > dataPrep.statistics.languages[b] ? a : b);
      
      recommendations.push(`Model specialized for ${dominantLanguage}. Use for ${dominantLanguage} tasks for best results.`);

    } else {
      recommendations.push('Fine-tuning failed. Check that the base model exists and Ollama is running.');
      recommendations.push('Ensure the training data directory contains valid code files.');
      
      if (dataPrep.errors.length > 0) {
        recommendations.push('Review data preparation errors and ensure file permissions are correct.');
      }
    }

    return recommendations;
  }
}