/**
 * Project Configuration Loader - Industry Standard Support
 * 
 * Supports project-specific configuration files following industry patterns:
 * - CODECRUCIBLE.md - Human-readable project instructions (like GEMINI.md)
 * - .codecrucible.yaml - Machine-readable configuration (like .qwen-config)
 * 
 * Provides project context, custom instructions, and agent behavior preferences
 * based on analysis of Qwen CLI, Gemini CLI, and other industry leaders.
 */

import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { parse as parseYAML } from 'yaml';
import { logger } from '../../infrastructure/logging/unified-logger.js';

export interface ProjectInstructions {
  projectName?: string;
  description?: string;
  language?: string;
  framework?: string;
  instructions?: string;
  customInstructions?: string[];
  codeStyle?: {
    formatter?: string;
    linter?: string;
    rules?: Record<string, any>;
  };
  preferences?: {
    responseStyle?: 'concise' | 'detailed' | 'educational';
    includeTests?: boolean;
    includeComments?: boolean;
    includeDocumentation?: boolean;
    voiceArchetypes?: string[];
  };
}

export interface ProjectConfiguration {
  // Core project metadata
  name?: string;
  version?: string;
  language?: string;
  framework?: string;
  type?: 'web' | 'api' | 'cli' | 'library' | 'mobile' | 'desktop' | 'other';
  
  // File handling
  include?: string[];
  exclude?: string[];
  watchPatterns?: string[];
  maxFileSize?: number;
  maxTotalSize?: number;
  supportedExtensions?: string[];
  
  // AI behavior configuration
  ai?: {
    model?: string;
    provider?: 'ollama' | 'lm-studio' | 'auto';
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
    voices?: string[];
    responseFormat?: 'markdown' | 'text' | 'structured';
  };
  
  // Development workflow
  workflow?: {
    methodology?: 'living-spiral' | 'agile' | 'waterfall' | 'custom';
    phases?: string[];
    testingStrategy?: 'unit' | 'integration' | 'e2e' | 'all';
    qualityGates?: string[];
  };
  
  // Tool integrations
  tools?: {
    linter?: string;
    formatter?: string;
    testRunner?: string;
    buildCommand?: string;
    devCommand?: string;
    deployCommand?: string;
  };
  
  // Security and permissions
  security?: {
    allowedCommands?: string[];
    restrictedPaths?: string[];
    allowExecution?: boolean;
    allowFileWrite?: boolean;
    allowNetworkAccess?: boolean;
  };
}

export interface CombinedProjectConfig {
  instructions: ProjectInstructions;
  configuration: ProjectConfiguration;
  sources: {
    instructionsFile?: string;
    configFile?: string;
  };
  isLoaded: boolean;
  loadTime: number;
}

/**
 * Project Configuration Loader with industry-standard file support
 */
export class ProjectConfigurationLoader {
  private configFileNames = ['.codecrucible.yaml', '.codecrucible.yml', 'codecrucible.yaml'];
  private instructionFileNames = ['CODECRUCIBLE.md', 'codecrucible.md'];
  private cache: Map<string, CombinedProjectConfig> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  /**
   * Load complete project configuration for a directory
   */
  async loadProjectConfig(projectPath: string = process.cwd()): Promise<CombinedProjectConfig> {
    const startTime = Date.now();
    const normalizedPath = resolve(projectPath);
    
    // Check cache first
    const cached = this.cache.get(normalizedPath);
    if (cached && (Date.now() - cached.loadTime) < this.cacheTimeout) {
      return cached;
    }

    logger.info(`🔍 Loading project configuration from ${normalizedPath}`);

    const config: CombinedProjectConfig = {
      instructions: {},
      configuration: {},
      sources: {},
      isLoaded: false,
      loadTime: startTime
    };

    try {
      // Load instruction file (CODECRUCIBLE.md)
      const instructions = await this.loadInstructionFile(normalizedPath);
      if (instructions) {
        config.instructions = instructions.content;
        config.sources.instructionsFile = instructions.filePath;
        logger.info(`📝 Loaded project instructions from ${instructions.filePath}`);
      }

      // Load configuration file (.codecrucible.yaml)
      const configuration = await this.loadConfigurationFile(normalizedPath);
      if (configuration) {
        config.configuration = configuration.content;
        config.sources.configFile = configuration.filePath;
        logger.info(`⚙️  Loaded project configuration from ${configuration.filePath}`);
      }

      // Load package.json for additional context
      const packageInfo = await this.loadPackageInfo(normalizedPath);
      if (packageInfo) {
        // Merge package.json info into configuration
        config.configuration.name = config.configuration.name || packageInfo.name;
        config.configuration.version = config.configuration.version || packageInfo.version;
        config.configuration.language = config.configuration.language || this.detectLanguageFromPackage(packageInfo);
        config.configuration.framework = config.configuration.framework || this.detectFrameworkFromPackage(packageInfo);
        config.configuration.type = config.configuration.type || this.detectProjectTypeFromPackage(packageInfo);
      }

      config.isLoaded = !!(instructions || configuration || packageInfo);
      config.loadTime = Date.now();

      // Cache the result
      this.cache.set(normalizedPath, config);

      if (config.isLoaded) {
        logger.info(`✅ Project configuration loaded in ${Date.now() - startTime}ms`);
      } else {
        logger.info(`ℹ️ No project configuration files found, using defaults`);
      }

      return config;

    } catch (error) {
      logger.warn('❌ Failed to load project configuration:', error);
      config.loadTime = Date.now();
      return config;
    }
  }

  /**
   * Load instruction file (CODECRUCIBLE.md)
   */
  private async loadInstructionFile(projectPath: string): Promise<{content: ProjectInstructions, filePath: string} | null> {
    for (const fileName of this.instructionFileNames) {
      const filePath = join(projectPath, fileName);
      
      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        const instructions = this.parseInstructionFile(content, fileName);
        return { content: instructions, filePath };
      } catch {
        // File doesn't exist, try next
        continue;
      }
    }
    
    return null;
  }

  /**
   * Load configuration file (.codecrucible.yaml)
   */
  private async loadConfigurationFile(projectPath: string): Promise<{content: ProjectConfiguration, filePath: string} | null> {
    for (const fileName of this.configFileNames) {
      const filePath = join(projectPath, fileName);
      
      try {
        await access(filePath);
        const content = await readFile(filePath, 'utf-8');
        const config = parseYAML(content) as ProjectConfiguration;
        return { content: config || {}, filePath };
      } catch (error) {
        // File doesn't exist or invalid YAML, try next
        continue;
      }
    }
    
    return null;
  }

  /**
   * Load package.json for additional project context
   */
  private async loadPackageInfo(projectPath: string): Promise<any | null> {
    try {
      const filePath = join(projectPath, 'package.json');
      await access(filePath);
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Parse instruction file content (CODECRUCIBLE.md)
   */
  private parseInstructionFile(content: string, fileName: string): ProjectInstructions {
    const instructions: ProjectInstructions = {};
    
    // Extract title/project name from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      instructions.projectName = titleMatch[1].trim();
    }

    // Extract project description from content after title
    const descMatch = content.match(/^#\s+.+\n\n(.+?)(?:\n\n|\n#|$)/m);
    if (descMatch) {
      instructions.description = descMatch[1].trim();
    }

    // Store full content as custom instructions
    instructions.instructions = content;

    // Parse specific sections if they exist
    const customInstructions = [];
    
    // Look for ## Instructions section
    const instructMatch = content.match(/##?\s+Instructions?\s*\n((?:(?!##).|\n)*)/i);
    if (instructMatch) {
      customInstructions.push(instructMatch[1].trim());
    }

    // Look for ## Code Style section
    const styleMatch = content.match(/##?\s+(?:Code\s+Style|Coding\s+Guidelines?)\s*\n((?:(?!##).|\n)*)/i);
    if (styleMatch) {
      instructions.codeStyle = {
        rules: { customGuidelines: styleMatch[1].trim() }
      };
    }

    // Look for ## Preferences section  
    const prefMatch = content.match(/##?\s+Preferences?\s*\n((?:(?!##).|\n)*)/i);
    if (prefMatch) {
      const prefText = prefMatch[1].trim().toLowerCase();
      instructions.preferences = {
        responseStyle: prefText.includes('concise') ? 'concise' : 
                     prefText.includes('detailed') ? 'detailed' : 
                     prefText.includes('educational') ? 'educational' : 'detailed',
        includeTests: prefText.includes('test'),
        includeComments: prefText.includes('comment'),
        includeDocumentation: prefText.includes('doc')
      };
    }

    if (customInstructions.length > 0) {
      instructions.customInstructions = customInstructions;
    }

    return instructions;
  }

  /**
   * Detect language from package.json
   */
  private detectLanguageFromPackage(packageJson: any): string {
    if (packageJson.dependencies || packageJson.devDependencies) {
      const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
      
      if (deps.typescript || deps['@types/node']) return 'typescript';
      if (deps.react || deps['@types/react']) return 'javascript';
      if (deps.vue) return 'javascript';
      if (deps.angular || deps['@angular/core']) return 'typescript';
    }
    
    return 'javascript'; // Default
  }

  /**
   * Detect framework from package.json
   */
  private detectFrameworkFromPackage(packageJson: any): string | undefined {
    if (packageJson.dependencies || packageJson.devDependencies) {
      const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
      
      if (deps.react || deps['@types/react']) return 'react';
      if (deps.vue) return 'vue';
      if (deps.angular || deps['@angular/core']) return 'angular';
      if (deps.svelte) return 'svelte';
      if (deps.express) return 'express';
      if (deps.fastify) return 'fastify';
      if (deps.next) return 'nextjs';
      if (deps.nuxt) return 'nuxtjs';
    }
    
    return undefined;
  }

  /**
   * Detect project type from package.json
   */
  private detectProjectTypeFromPackage(packageJson: any): ProjectConfiguration['type'] {
    // Check for CLI tools
    if (packageJson.bin) return 'cli';
    
    // Check for common web frameworks
    if (packageJson.dependencies || packageJson.devDependencies) {
      const deps = { ...(packageJson.dependencies || {}), ...(packageJson.devDependencies || {}) };
      
      if (deps.react || deps.vue || deps.angular || deps.svelte) return 'web';
      if (deps.express || deps.fastify || deps.koa) return 'api';
      if (deps.electron) return 'desktop';
      if (deps['react-native'] || deps.expo) return 'mobile';
    }

    // Check scripts for project type hints
    if (packageJson.scripts) {
      const scripts = Object.keys(packageJson.scripts).join(' ').toLowerCase();
      if (scripts.includes('start') && scripts.includes('build')) return 'web';
      if (scripts.includes('dev') || scripts.includes('serve')) return 'web';
      if (scripts.includes('test')) return 'library';
    }

    return 'other';
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Check if project has configuration files
   */
  async hasProjectConfig(projectPath: string = process.cwd()): Promise<boolean> {
    const normalizedPath = resolve(projectPath);
    
    // Check for instruction files
    for (const fileName of this.instructionFileNames) {
      try {
        await access(join(normalizedPath, fileName));
        return true;
      } catch {
        continue;
      }
    }
    
    // Check for configuration files
    for (const fileName of this.configFileNames) {
      try {
        await access(join(normalizedPath, fileName));
        return true;
      } catch {
        continue;
      }
    }
    
    return false;
  }
}

// Export singleton instance
export const projectConfigurationLoader = new ProjectConfigurationLoader();