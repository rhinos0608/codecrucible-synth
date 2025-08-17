import { logger } from '../logger.js';
import { UnifiedAgent } from '../agent.js';
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname, relative, basename } from 'path';
import { glob } from 'glob';

export interface CodeStructure {
  overview: ProjectOverview;
  keyFiles: FileAnalysis[];
  codeDefinitions: CodeDefinition[];
  dependencies: DependencyMap;
  patterns: ArchitecturalPattern[];
}

export interface ProjectOverview {
  totalFiles: number;
  primaryLanguage: string;
  frameworks: string[];
  buildSystem: string;
  testFramework?: string;
  packageManager?: string;
}

export interface FileAnalysis {
  path: string;
  type: 'source' | 'config' | 'test' | 'documentation' | 'build';
  language: string;
  size: number;
  complexity: number;
  purpose: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  content?: string; // First 2000 characters
  definitions?: CodeDefinition[];
}

export interface CodeDefinition {
  name: string;
  type: 'class' | 'function' | 'interface' | 'type' | 'constant' | 'variable';
  file: string;
  line: number;
  signature: string;
  description?: string;
  isExported: boolean;
  dependencies: string[];
}

export interface DependencyMap {
  internal: Record<string, string[]>; // file -> depends on files
  external: Record<string, string>; // package -> version
  imports: Record<string, string[]>; // file -> imported modules
}

export interface ArchitecturalPattern {
  name: string;
  description: string;
  files: string[];
  confidence: number;
}

/**
 * Autonomous Code Reader - Intelligently traverses and analyzes codebases
 * 
 * Mimics how modern agents like Kilo Code and Claude Code understand projects:
 * 1. Discovers project structure and type
 * 2. Identifies key files and entry points  
 * 3. Reads and analyzes important code files
 * 4. Extracts code definitions and patterns
 * 5. Maps dependencies and relationships
 */
export class AutonomousCodeReader {
  private projectPath: string;
  private maxFilesToRead = 50; // Limit for performance
  private maxFileSize = 100000; // 100KB limit per file

  constructor(projectPath: string) {
    this.projectPath = projectPath;
  }

  /**
   * Perform comprehensive autonomous code analysis
   */
  async analyzeCodeStructure(): Promise<CodeStructure> {
    logger.info('🔍 Starting autonomous code structure analysis...');
    
    try {
      return await (await import("../agent.js")).timeoutManager.executeWithRetry(
        async () => {
          // Phase 1: Project Discovery
          const overview = await this.discoverProjectOverview();
          logger.info(`📋 Discovered ${overview.primaryLanguage} project with ${overview.frameworks.join(', ')}`);

          // Phase 2: Identify Key Files
          const keyFiles = await this.identifyKeyFiles(overview);
          logger.info(`📁 Identified ${keyFiles.length} key files for analysis`);

          // Phase 3: Read and Analyze Files
          const analyzedFiles = await this.readAndAnalyzeFiles(keyFiles);
          logger.info(`📖 Read and analyzed ${analyzedFiles.length} files`);

          // Phase 4: Extract Code Definitions
          const codeDefinitions = await this.extractCodeDefinitions(analyzedFiles);
          logger.info(`🔧 Extracted ${codeDefinitions.length} code definitions`);

          // Phase 5: Map Dependencies
          const dependencies = await this.mapDependencies(analyzedFiles);
          logger.info(`🔗 Mapped dependencies: ${Object.keys(dependencies.external).length} external, ${Object.keys(dependencies.internal).length} internal`);

          // Phase 6: Identify Patterns
          const patterns = await this.identifyArchitecturalPatterns(analyzedFiles, codeDefinitions);
          logger.info(`🏗️ Identified ${patterns.length} architectural patterns`);

          return {
            overview,
            keyFiles: analyzedFiles,
            codeDefinitions,
            dependencies,
            patterns
          };
        },
        'autonomous_code_analysis'
      );
    } catch (error) {
      logger.error('❌ Autonomous code analysis failed:', error);
      throw error;
    }
  }

  /**
   * Phase 1: Discover project type and characteristics
   */
  private async discoverProjectOverview(): Promise<ProjectOverview> {
    const overview: ProjectOverview = {
      totalFiles: 0,
      primaryLanguage: 'Unknown',
      frameworks: [],
      buildSystem: 'Unknown',
      testFramework: undefined,
      packageManager: undefined
    };

    // Count all source files
    const sourceFiles = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs,php,rb,go,rs}', {
      cwd: this.projectPath,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
    });
    overview.totalFiles = sourceFiles.length;

    // Determine primary language
    const languageCount: Record<string, number> = {};
    for (const file of sourceFiles) {
      const lang = this.detectLanguage(extname(file));
      languageCount[lang] = (languageCount[lang] || 0) + 1;
    }
    overview.primaryLanguage = Object.entries(languageCount)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

    // Detect frameworks and tools
    await this.detectFrameworksAndTools(overview);

    return overview;
  }

  /**
   * Phase 2: Identify the most important files to analyze
   */
  private async identifyKeyFiles(overview: ProjectOverview): Promise<FileAnalysis[]> {
    const keyFiles: FileAnalysis[] = [];
    
    // Priority patterns for different file types
    const priorityPatterns = [
      // Entry points and main files
      { pattern: '**/index.{js,ts,jsx,tsx}', importance: 'critical' as const, type: 'source' as const },
      { pattern: '**/main.{js,ts,py,java,cpp,c}', importance: 'critical' as const, type: 'source' as const },
      { pattern: '**/app.{js,ts,py}', importance: 'critical' as const, type: 'source' as const },
      { pattern: 'src/**/*.{js,ts,jsx,tsx}', importance: 'high' as const, type: 'source' as const },
      
      // Configuration files
      { pattern: 'package.json', importance: 'critical' as const, type: 'config' as const },
      { pattern: 'tsconfig.json', importance: 'high' as const, type: 'config' as const },
      { pattern: '*.config.{js,ts}', importance: 'medium' as const, type: 'config' as const },
      
      // Documentation
      { pattern: 'README.{md,txt}', importance: 'high' as const, type: 'documentation' as const },
      { pattern: 'docs/**/*.md', importance: 'medium' as const, type: 'documentation' as const },
      
      // Tests
      { pattern: '**/*.{test,spec}.{js,ts,jsx,tsx}', importance: 'medium' as const, type: 'test' as const },
      { pattern: 'test/**/*.{js,ts}', importance: 'medium' as const, type: 'test' as const }
    ];

    // Find files matching priority patterns
    for (const { pattern, importance, type } of priorityPatterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.projectPath,
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**']
        });

        for (const file of files.slice(0, 10)) { // Limit per pattern
          const fullPath = join(this.projectPath, file);
          const stats = await stat(fullPath);
          
          if (stats.isFile() && stats.size <= this.maxFileSize) {
            keyFiles.push({
              path: file,
              type,
              language: this.detectLanguage(extname(file)),
              size: stats.size,
              complexity: 0, // Will calculate when reading
              purpose: this.inferFilePurpose(file),
              importance
            });
          }
        }
      } catch (error) {
        logger.debug(`Failed to process pattern ${pattern}:`, error);
      }

      if (keyFiles.length >= this.maxFilesToRead) {
        break;
      }
    }

    // Sort by importance and size
    return keyFiles
      .sort((a, b) => {
        const importanceOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aScore = importanceOrder[a.importance];
        const bScore = importanceOrder[b.importance];
        if (aScore !== bScore) return bScore - aScore;
        return a.size - b.size; // Prefer smaller files for speed
      })
      .slice(0, this.maxFilesToRead);
  }

  /**
   * Phase 3: Read and analyze file contents
   */
  private async readAndAnalyzeFiles(keyFiles: FileAnalysis[]): Promise<FileAnalysis[]> {
    const analyzedFiles: FileAnalysis[] = [];

    for (const file of keyFiles) {
      try {
        const fullPath = join(this.projectPath, file.path);
        const content = await readFile(fullPath, 'utf-8');
        
        // Store truncated content for analysis
        file.content = content.substring(0, 2000);
        
        // Calculate complexity (simple line-based metric)
        file.complexity = this.calculateComplexity(content);
        
        // Extract code definitions for source files
        if (file.type === 'source' && this.isAnalyzableSourceFile(file.language)) {
          file.definitions = await this.extractDefinitionsFromContent(content, file.path);
        }

        analyzedFiles.push(file);
        logger.debug(`📖 Read ${file.path} (${file.size} bytes, complexity: ${file.complexity})`);
        
      } catch (error) {
        logger.warn(`Failed to read ${file.path}:`, error);
      }
    }

    return analyzedFiles;
  }

  /**
   * Phase 4: Extract code definitions using simple parsing
   */
  private async extractCodeDefinitions(files: FileAnalysis[]): Promise<CodeDefinition[]> {
    const definitions: CodeDefinition[] = [];

    for (const file of files) {
      if (file.definitions) {
        definitions.push(...file.definitions);
      }
    }

    return definitions;
  }

  /**
   * Phase 5: Map dependencies between files and external packages
   */
  private async mapDependencies(files: FileAnalysis[]): Promise<DependencyMap> {
    const dependencies: DependencyMap = {
      internal: {},
      external: {},
      imports: {}
    };

    // Extract external dependencies from package.json
    const packageJsonFile = files.find(f => f.path.endsWith('package.json'));
    if (packageJsonFile?.content) {
      try {
        const pkg = JSON.parse(packageJsonFile.content);
        dependencies.external = {
          ...pkg.dependencies,
          ...pkg.devDependencies
        };
      } catch (error) {
        logger.debug('Failed to parse package.json:', error);
      }
    }

    // Extract imports from source files
    for (const file of files) {
      if (file.content && file.type === 'source') {
        const imports = this.extractImports(file.content, file.language);
        if (imports.length > 0) {
          dependencies.imports[file.path] = imports;
        }
      }
    }

    return dependencies;
  }

  /**
   * Phase 6: Identify architectural patterns
   */
  private async identifyArchitecturalPatterns(
    files: FileAnalysis[], 
    definitions: CodeDefinition[]
  ): Promise<ArchitecturalPattern[]> {
    const patterns: ArchitecturalPattern[] = [];

    // MVC Pattern Detection
    const models = files.filter(f => f.path.includes('model') || f.purpose.includes('Model'));
    const views = files.filter(f => f.path.includes('view') || f.path.includes('component'));
    const controllers = files.filter(f => f.path.includes('controller') || f.path.includes('handler'));

    if (models.length > 0 && views.length > 0 && controllers.length > 0) {
      patterns.push({
        name: 'MVC (Model-View-Controller)',
        description: 'Classic MVC architecture separating data, presentation, and logic',
        files: [...models, ...views, ...controllers].map(f => f.path),
        confidence: 0.8
      });
    }

    // Component-Based Architecture
    const components = files.filter(f => 
      f.path.includes('component') || 
      f.path.includes('widget') ||
      definitions.some(d => d.file === f.path && d.name.includes('Component'))
    );

    if (components.length > 3) {
      patterns.push({
        name: 'Component-Based Architecture',
        description: 'Modular architecture using reusable components',
        files: components.map(f => f.path),
        confidence: 0.7
      });
    }

    // Service Layer Pattern
    const services = files.filter(f => 
      f.path.includes('service') || 
      f.path.includes('api') ||
      definitions.some(d => d.file === f.path && d.name.includes('Service'))
    );

    if (services.length > 2) {
      patterns.push({
        name: 'Service Layer',
        description: 'Business logic organized in service classes',
        files: services.map(f => f.path),
        confidence: 0.6
      });
    }

    return patterns;
  }

  /**
   * Helper Methods
   */

  private async detectFrameworksAndTools(overview: ProjectOverview): Promise<void> {
    const configChecks = [
      { file: 'package.json', detect: async (content: string) => {
        try {
          const pkg = JSON.parse(content);
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          
          // Detect frameworks
          if (deps.react) overview.frameworks.push('React');
          if (deps.vue) overview.frameworks.push('Vue');
          if (deps['@angular/core']) overview.frameworks.push('Angular');
          if (deps.express) overview.frameworks.push('Express');
          if (deps.next) overview.frameworks.push('Next.js');
          
          // Detect build systems
          if (deps.webpack) overview.buildSystem = 'Webpack';
          if (deps.vite) overview.buildSystem = 'Vite';
          if (deps.rollup) overview.buildSystem = 'Rollup';
          
          // Detect test frameworks
          if (deps.jest) overview.testFramework = 'Jest';
          if (deps.mocha) overview.testFramework = 'Mocha';
          if (deps.vitest) overview.testFramework = 'Vitest';
          
          // Package manager
          overview.packageManager = 'npm';
        } catch (error) {
          logger.debug('Failed to parse package.json:', error);
        }
      }},
      { file: 'yarn.lock', detect: async () => { overview.packageManager = 'yarn'; }},
      { file: 'pnpm-lock.yaml', detect: async () => { overview.packageManager = 'pnpm'; }},
      { file: 'Cargo.toml', detect: async () => { overview.buildSystem = 'Cargo'; }},
      { file: 'requirements.txt', detect: async () => { overview.packageManager = 'pip'; }},
    ];

    for (const { file, detect } of configChecks) {
      try {
        const content = await readFile(join(this.projectPath, file), 'utf-8');
        await detect(content);
      } catch (error) {
        // File doesn't exist, skip
      }
    }
  }

  private detectLanguage(ext: string): string {
    const langMap: Record<string, string> = {
      '.js': 'JavaScript',
      '.ts': 'TypeScript', 
      '.jsx': 'JSX',
      '.tsx': 'TSX',
      '.py': 'Python',
      '.java': 'Java',
      '.cpp': 'C++',
      '.c': 'C',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.md': 'Markdown',
      '.json': 'JSON'
    };
    return langMap[ext.toLowerCase()] || 'Unknown';
  }

  private inferFilePurpose(filePath: string): string {
    const fileName = basename(filePath).toLowerCase();
    const dirPath = filePath.toLowerCase();
    
    if (fileName === 'index.js' || fileName === 'index.ts') return 'Entry Point';
    if (fileName === 'main.js' || fileName === 'main.ts') return 'Main Module';
    if (fileName === 'app.js' || fileName === 'app.ts') return 'Application Core';
    if (fileName.includes('config')) return 'Configuration';
    if (fileName.includes('test') || fileName.includes('spec')) return 'Testing';
    if (fileName.includes('util') || fileName.includes('helper')) return 'Utility Functions';
    if (dirPath.includes('component')) return 'UI Component';
    if (dirPath.includes('service')) return 'Business Service';
    if (dirPath.includes('model')) return 'Data Model';
    if (dirPath.includes('controller')) return 'Request Handler';
    if (dirPath.includes('route') || dirPath.includes('api')) return 'API Endpoint';
    if (fileName === 'readme.md') return 'Documentation';
    
    return 'Source Code';
  }

  private calculateComplexity(content: string): number {
    const lines = content.split('\n');
    let complexity = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      // Simple complexity metrics
      if (trimmed.includes('if ') || trimmed.includes('if(')) complexity++;
      if (trimmed.includes('for ') || trimmed.includes('for(')) complexity++;
      if (trimmed.includes('while ') || trimmed.includes('while(')) complexity++;
      if (trimmed.includes('switch ') || trimmed.includes('switch(')) complexity++;
      if (trimmed.includes('catch ') || trimmed.includes('catch(')) complexity++;
    }
    
    return Math.max(1, Math.round(complexity / lines.length * 100));
  }

  private isAnalyzableSourceFile(language: string): boolean {
    return ['JavaScript', 'TypeScript', 'JSX', 'TSX'].includes(language);
  }

  private async extractDefinitionsFromContent(content: string, filePath: string): Promise<CodeDefinition[]> {
    const definitions: CodeDefinition[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Simple regex-based extraction (would use AST in production)
      const patterns = [
        { regex: /^export\s+class\s+(\w+)/, type: 'class' as const },
        { regex: /^class\s+(\w+)/, type: 'class' as const },
        { regex: /^export\s+function\s+(\w+)/, type: 'function' as const },
        { regex: /^function\s+(\w+)/, type: 'function' as const },
        { regex: /^export\s+interface\s+(\w+)/, type: 'interface' as const },
        { regex: /^interface\s+(\w+)/, type: 'interface' as const },
        { regex: /^export\s+type\s+(\w+)/, type: 'type' as const },
        { regex: /^const\s+(\w+)\s*=\s*\(/, type: 'function' as const },
        { regex: /^export\s+const\s+(\w+)/, type: 'constant' as const },
      ];

      for (const { regex, type } of patterns) {
        const match = line.match(regex);
        if (match) {
          definitions.push({
            name: match[1],
            type,
            file: filePath,
            line: i + 1,
            signature: line,
            isExported: line.includes('export'),
            dependencies: this.extractImports(content, 'TypeScript')
          });
        }
      }
    }
    
    return definitions;
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (language === 'TypeScript' || language === 'JavaScript') {
        // import statements
        const importMatch = trimmed.match(/import.*from\s+['"]([^'"]+)['"]/);
        if (importMatch) {
          imports.push(importMatch[1]);
        }
        
        // require statements
        const requireMatch = trimmed.match(/require\s*\(\s*['"]([^'"]+)['"]\s*\)/);
        if (requireMatch) {
          imports.push(requireMatch[1]);
        }
      }
    }
    
    return imports;
  }
}