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

import { access, readFile } from 'fs/promises';
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
    rules?: Record<string, unknown>;
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

export interface PackageJson {
  bin?: unknown;
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Project Configuration Loader with industry-standard file support
 */
export class ProjectConfigurationLoader {
  private readonly configFileNames = [
    '.codecrucible.yaml',
    '.codecrucible.yml',
    'codecrucible.yaml',
  ];
  private readonly instructionFileNames = ['CODECRUCIBLE.md', 'codecrucible.md'];
  private readonly cache: Map<string, CombinedProjectConfig> = new Map();
  private readonly cacheTimeout = 30000; // 30 seconds

  /**
   * Load complete project configuration for a directory
   */
  public async loadProjectConfig(
    projectPath: string = process.cwd()
  ): Promise<CombinedProjectConfig> {
    const startTime = Date.now();
    const normalizedPath = resolve(projectPath);

    // Check cache first
    const cached = this.cache.get(normalizedPath);
    if (cached && Date.now() - cached.loadTime < this.cacheTimeout) {
      return cached;
    }

    logger.info(`🔍 Loading project configuration from ${normalizedPath}`);

    const config: CombinedProjectConfig = {
      instructions: {},
      configuration: {},
      sources: {},
      isLoaded: false,
      loadTime: startTime,
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
      if (packageInfo && typeof packageInfo === 'object' && packageInfo !== null) {
        // Merge package.json info into configuration
        config.configuration.name =
          config.configuration.name ?? (packageInfo as { name?: string }).name;
        config.configuration.version =
          config.configuration.version ?? (packageInfo as { version?: string }).version;
        config.configuration.language =
          config.configuration.language ??
          this.detectLanguageFromPackage(
            packageInfo as {
              [key: string]: unknown;
              dependencies?: Record<string, unknown>;
              devDependencies?: Record<string, unknown>;
            }
          );
        config.configuration.framework =
          config.configuration.framework ?? this.detectFrameworkFromPackage(packageInfo);
        config.configuration.type =
          config.configuration.type ?? this.detectProjectTypeFromPackage(packageInfo);
      }

      config.isLoaded = Boolean(instructions ?? configuration ?? packageInfo);
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
  private async loadInstructionFile(
    projectPath: string
  ): Promise<{ content: ProjectInstructions; filePath: string } | null> {
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
  private async loadConfigurationFile(
    projectPath: string
  ): Promise<{ content: ProjectConfiguration; filePath: string } | null> {
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
  private async loadPackageInfo(projectPath: string): Promise<PackageJson | null> {
    try {
      const filePath = join(projectPath, 'package.json');
      await access(filePath);
      const content = await readFile(filePath, 'utf-8');

      // Parse into unknown and validate the shape before casting to avoid unsafe `any`
      const parsed: unknown = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as PackageJson;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parse instruction file content (CODECRUCIBLE.md)
   */
  private parseInstructionFile(content: string, _fileName: string): ProjectInstructions {
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
    const styleMatch = content.match(
      /##?\s+(?:Code\s+Style|Coding\s+Guidelines?)\s*\n((?:(?!##).|\n)*)/i
    );
    if (styleMatch) {
      instructions.codeStyle = {
        rules: { customGuidelines: styleMatch[1].trim() },
      };
    }

    // Look for ## Preferences section
    const prefMatch = content.match(/##?\s+Preferences?\s*\n((?:(?!##).|\n)*)/i);
    if (prefMatch) {
      const prefText = prefMatch[1].trim().toLowerCase();
      instructions.preferences = {
        responseStyle: prefText.includes('concise')
          ? 'concise'
          : prefText.includes('detailed')
            ? 'detailed'
            : prefText.includes('educational')
              ? 'educational'
              : 'detailed',
        includeTests: prefText.includes('test'),
        includeComments: prefText.includes('comment'),
        includeDocumentation: prefText.includes('doc'),
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
  private detectLanguageFromPackage(packageJson: {
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
    [key: string]: unknown;
  }): string {
    if (packageJson && (packageJson.dependencies || packageJson.devDependencies)) {
      const deps: Record<string, unknown> = {};

      if (packageJson.dependencies && typeof packageJson.dependencies === 'object') {
        Object.assign(deps, packageJson.dependencies);
      }
      if (packageJson.devDependencies && typeof packageJson.devDependencies === 'object') {
        Object.assign(deps, packageJson.devDependencies);
      }

      if ('typescript' in deps || '@types/node' in deps) return 'typescript';
      if ('react' in deps || '@types/react' in deps) return 'javascript';
      if ('vue' in deps) return 'javascript';
      if ('angular' in deps || '@angular/core' in deps) return 'typescript';
    }

    // Fallback default when no clear language can be detected
    return 'javascript';
  }

  /**
   * Detect framework from package.json
   */
  private detectFrameworkFromPackage(packageJson: PackageJson): string | undefined {
    const dependencies =
      typeof packageJson.dependencies === 'object' && packageJson.dependencies !== null
        ? packageJson.dependencies
        : {};
    const devDependencies =
      typeof packageJson.devDependencies === 'object' && packageJson.devDependencies !== null
        ? packageJson.devDependencies
        : {};
    const deps = { ...dependencies, ...devDependencies };

    if ('react' in deps || '@types/react' in deps) return 'react';
    if ('vue' in deps) return 'vue';
    if ('angular' in deps || '@angular/core' in deps) return 'angular';
    if ('svelte' in deps) return 'svelte';
    if ('express' in deps) return 'express';
    if ('fastify' in deps) return 'fastify';
    if ('next' in deps) return 'nextjs';
    if ('nuxt' in deps) return 'nuxtjs';

    return undefined;
  }

  /**
   * Detect project type from package.json
   */
  private detectProjectTypeFromPackage(packageJson: PackageJson): ProjectConfiguration['type'] {
    // Check for CLI tools
    if ('bin' in packageJson && packageJson.bin !== undefined) return 'cli';

    // Check for common web frameworks
    const dependencies =
      typeof packageJson.dependencies === 'object' && packageJson.dependencies !== null
        ? packageJson.dependencies
        : {};
    const devDependencies =
      typeof packageJson.devDependencies === 'object' && packageJson.devDependencies !== null
        ? packageJson.devDependencies
        : {};
    const deps = { ...dependencies, ...devDependencies };

    if ('react' in deps || 'vue' in deps || 'angular' in deps || 'svelte' in deps) return 'web';
    if ('express' in deps || 'fastify' in deps || 'koa' in deps) return 'api';
    if ('electron' in deps) return 'desktop';
    if ('react-native' in deps || 'expo' in deps) return 'mobile';

    // Check scripts for project type hints
    if (
      'scripts' in packageJson &&
      typeof packageJson.scripts === 'object' &&
      packageJson.scripts !== null
    ) {
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
