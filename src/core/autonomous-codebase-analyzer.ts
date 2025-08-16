import { logger } from './logger.js';
import { timeoutManager } from './timeout-manager.js';
import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, relative } from 'path';
import { glob } from 'glob';

export interface CodebaseAnalysis {
  structure: ProjectStructure;
  architecture: ArchitecturalPatterns;
  technologies: TechnologyStack;
  codeQuality: CodeQualityMetrics;
  suggestions: AnalysisSuggestion[];
}

export interface ProjectStructure {
  totalFiles: number;
  totalLines: number;
  directories: DirectoryInfo[];
  fileTypes: Record<string, number>;
  largestFiles: FileInfo[];
}

export interface DirectoryInfo {
  path: string;
  fileCount: number;
  purpose: string;
  importance: 'high' | 'medium' | 'low';
}

export interface FileInfo {
  path: string;
  size: number;
  lines: number;
  language: string;
  purpose?: string;
}

export interface ArchitecturalPatterns {
  patterns: string[];
  frameworks: string[];
  designPrinciples: string[];
  modularity: 'high' | 'medium' | 'low';
}

export interface TechnologyStack {
  languages: Record<string, number>;
  frameworks: string[];
  tools: string[];
  dependencies: string[];
}

export interface CodeQualityMetrics {
  averageFileSize: number;
  averageComplexity: number;
  testCoverage: number;
  duplicationRate: number;
  maintainabilityIndex: number;
}

export interface AnalysisSuggestion {
  type: 'improvement' | 'refactoring' | 'optimization' | 'security' | 'testing';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  files?: string[];
  estimatedEffort: string;
}

/**
 * Autonomous Codebase Analyzer
 * 
 * Automatically analyzes project structure, identifies patterns,
 * and provides intelligent suggestions without requiring user input
 */
export class AutonomousCodebaseAnalyzer {
  constructor(private projectPath: string) {}

  /**
   * Perform comprehensive autonomous analysis
   */
  async analyzeCodebase(): Promise<CodebaseAnalysis> {
    logger.info('🔍 Starting autonomous codebase analysis...');
    
    try {
      const analysis = await timeoutManager.executeWithRetry(
        async () => {
          // Run analysis in parallel for efficiency
          const [structure, technologies] = await Promise.all([
            this.analyzeProjectStructure(),
            this.analyzeTechnologyStack()
          ]);

          const architecture = await this.identifyArchitecturalPatterns(structure);
          const codeQuality = await this.assessCodeQuality(structure);
          const suggestions = await this.generateSuggestions(structure, architecture, technologies, codeQuality);

          return {
            structure,
            architecture,
            technologies,
            codeQuality,
            suggestions
          };
        },
        'codebase_analysis',
        { maxRetries: 2, timeoutMs: 60000 }
      );

      logger.info('✅ Codebase analysis completed successfully');
      return analysis;
    } catch (error) {
      logger.error('❌ Codebase analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze project structure autonomously
   */
  private async analyzeProjectStructure(): Promise<ProjectStructure> {
    const structure: ProjectStructure = {
      totalFiles: 0,
      totalLines: 0,
      directories: [],
      fileTypes: {},
      largestFiles: []
    };

    // Use glob to find all relevant files
    const patterns = [
      '**/*.{js,ts,jsx,tsx,py,java,cpp,c,h,cs,php,rb,go,rs}',
      '**/*.{json,yaml,yml,xml,html,css,scss,md}',
      '**/*.{config,env,lock}'
    ];

    const allFiles: string[] = [];
    for (const pattern of patterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.projectPath,
          ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**', 'coverage/**']
        });
        allFiles.push(...files);
      } catch (error) {
        logger.warn(`Failed to glob pattern ${pattern}:`, error);
      }
    }

    // Remove duplicates
    const uniqueFiles = [...new Set(allFiles)];
    structure.totalFiles = uniqueFiles.length;

    // Analyze each file
    const fileInfos: FileInfo[] = [];
    const directoryMap = new Map<string, number>();

    for (const file of uniqueFiles.slice(0, 200)) { // Limit to first 200 files for performance
      try {
        const fullPath = join(this.projectPath, file);
        const stats = await stat(fullPath);
        
        if (stats.isFile()) {
          const ext = extname(file);
          const language = this.detectLanguage(ext);
          
          // Count file type
          structure.fileTypes[language] = (structure.fileTypes[language] || 0) + 1;
          
          // Count lines for text files
          let lines = 0;
          if (this.isTextFile(ext)) {
            try {
              const content = await readFile(fullPath, 'utf-8');
              lines = content.split('\n').length;
              structure.totalLines += lines;
            } catch {
              // Skip files that can't be read
            }
          }

          fileInfos.push({
            path: file,
            size: stats.size,
            lines,
            language,
            purpose: this.inferFilePurpose(file, language)
          });

          // Count directory
          const dir = file.split('/')[0] || '.';
          directoryMap.set(dir, (directoryMap.get(dir) || 0) + 1);
        }
      } catch (error) {
        // Skip files that can't be accessed
        continue;
      }
    }

    // Get largest files
    structure.largestFiles = fileInfos
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    // Analyze directories
    for (const [dirPath, fileCount] of directoryMap.entries()) {
      structure.directories.push({
        path: dirPath,
        fileCount,
        purpose: this.inferDirectoryPurpose(dirPath),
        importance: this.assessDirectoryImportance(dirPath, fileCount)
      });
    }

    return structure;
  }

  /**
   * Analyze technology stack
   */
  private async analyzeTechnologyStack(): Promise<TechnologyStack> {
    const technologies: TechnologyStack = {
      languages: {},
      frameworks: [],
      tools: [],
      dependencies: []
    };

    try {
      // Check for package.json
      const packageJsonPath = join(this.projectPath, 'package.json');
      try {
        const packageContent = await readFile(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        
        // Extract dependencies
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        };
        
        technologies.dependencies = Object.keys(deps);
        
        // Identify frameworks from dependencies
        const frameworkPatterns = {
          'react': /^react$/,
          'vue': /^vue$/,
          'angular': /^@angular/,
          'express': /^express$/,
          'next': /^next$/,
          'gatsby': /^gatsby$/,
          'nuxt': /^nuxt$/,
          'svelte': /^svelte$/
        };

        for (const [framework, pattern] of Object.entries(frameworkPatterns)) {
          if (technologies.dependencies.some(dep => pattern.test(dep))) {
            technologies.frameworks.push(framework);
          }
        }
      } catch {
        // No package.json or failed to parse
      }

      // Check for other config files to identify tools
      const configFiles = [
        { file: 'tsconfig.json', tool: 'TypeScript' },
        { file: 'webpack.config.js', tool: 'Webpack' },
        { file: 'vite.config.js', tool: 'Vite' },
        { file: 'jest.config.js', tool: 'Jest' },
        { file: '.eslintrc', tool: 'ESLint' },
        { file: 'prettier.config.js', tool: 'Prettier' },
        { file: 'docker-compose.yml', tool: 'Docker' },
        { file: 'Dockerfile', tool: 'Docker' }
      ];

      for (const { file, tool } of configFiles) {
        try {
          await stat(join(this.projectPath, file));
          technologies.tools.push(tool);
        } catch {
          // File doesn't exist
        }
      }

    } catch (error) {
      logger.warn('Failed to analyze technology stack:', error);
    }

    return technologies;
  }

  /**
   * Identify architectural patterns
   */
  private async identifyArchitecturalPatterns(structure: ProjectStructure): Promise<ArchitecturalPatterns> {
    const patterns: string[] = [];
    const designPrinciples: string[] = [];
    
    // Analyze directory structure for patterns
    const directories = structure.directories.map(d => d.path);
    
    // MVC Pattern
    if (directories.some(d => d.includes('models')) &&
        directories.some(d => d.includes('views')) &&
        directories.some(d => d.includes('controllers'))) {
      patterns.push('MVC (Model-View-Controller)');
    }

    // Microservices
    if (directories.filter(d => d.includes('service')).length > 2) {
      patterns.push('Microservices Architecture');
    }

    // Component-based
    if (directories.some(d => d.includes('components'))) {
      patterns.push('Component-Based Architecture');
    }

    // Layered Architecture
    if (directories.some(d => d.includes('layers') || d.includes('core')) &&
        directories.some(d => d.includes('api') || d.includes('services'))) {
      patterns.push('Layered Architecture');
    }

    // Assess modularity
    const moduleScore = this.assessModularity(structure);
    const modularity = moduleScore > 0.7 ? 'high' : moduleScore > 0.4 ? 'medium' : 'low';

    return {
      patterns,
      frameworks: [], // Will be filled from technology analysis
      designPrinciples,
      modularity
    };
  }

  /**
   * Assess code quality metrics
   */
  private async assessCodeQuality(structure: ProjectStructure): Promise<CodeQualityMetrics> {
    const avgFileSize = structure.largestFiles.reduce((sum, f) => sum + f.size, 0) / 
                       Math.max(structure.largestFiles.length, 1);
    
    // Simple heuristics for code quality
    const testFiles = structure.directories.filter(d => 
      d.path.includes('test') || d.path.includes('spec') || d.path.includes('__tests__')
    );
    
    const testCoverage = testFiles.length > 0 ? 
      Math.min((testFiles.reduce((sum, d) => sum + d.fileCount, 0) / structure.totalFiles) * 100, 100) : 0;

    return {
      averageFileSize: avgFileSize,
      averageComplexity: this.estimateComplexity(structure),
      testCoverage,
      duplicationRate: 0, // Would need more sophisticated analysis
      maintainabilityIndex: this.calculateMaintainabilityIndex(structure)
    };
  }

  /**
   * Generate intelligent suggestions
   */
  private async generateSuggestions(
    structure: ProjectStructure,
    architecture: ArchitecturalPatterns,
    technologies: TechnologyStack,
    quality: CodeQualityMetrics
  ): Promise<AnalysisSuggestion[]> {
    const suggestions: AnalysisSuggestion[] = [];

    // Test coverage suggestions
    if (quality.testCoverage < 30) {
      suggestions.push({
        type: 'testing',
        priority: 'high',
        title: 'Improve Test Coverage',
        description: `Test coverage is ${quality.testCoverage.toFixed(1)}%. Consider adding unit tests for core functionality.`,
        estimatedEffort: '2-4 hours'
      });
    }

    // Large file suggestions
    const largeFiles = structure.largestFiles.filter(f => f.size > 100000); // > 100KB
    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'refactoring',
        priority: 'medium',
        title: 'Break Down Large Files',
        description: `${largeFiles.length} files are over 100KB. Consider splitting them for better maintainability.`,
        files: largeFiles.map(f => f.path),
        estimatedEffort: '1-2 hours per file'
      });
    }

    // Architecture suggestions
    if (architecture.modularity === 'low') {
      suggestions.push({
        type: 'improvement',
        priority: 'medium',
        title: 'Improve Code Modularity',
        description: 'Project shows low modularity. Consider organizing code into clearer modules and separating concerns.',
        estimatedEffort: '4-8 hours'
      });
    }

    // Technology suggestions
    if (technologies.frameworks.length === 0 && structure.totalFiles > 20) {
      suggestions.push({
        type: 'improvement',
        priority: 'low',
        title: 'Consider Using a Framework',
        description: 'Large project without a clear framework. Consider adopting a framework for better structure.',
        estimatedEffort: '1-2 days'
      });
    }

    return suggestions;
  }

  /**
   * Helper methods
   */
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
      '.h': 'C Header',
      '.cs': 'C#',
      '.php': 'PHP',
      '.rb': 'Ruby',
      '.go': 'Go',
      '.rs': 'Rust',
      '.json': 'JSON',
      '.yaml': 'YAML',
      '.yml': 'YAML',
      '.xml': 'XML',
      '.html': 'HTML',
      '.css': 'CSS',
      '.scss': 'SCSS',
      '.md': 'Markdown'
    };
    return langMap[ext.toLowerCase()] || 'Unknown';
  }

  private isTextFile(ext: string): boolean {
    const textExts = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', 
                     '.php', '.rb', '.go', '.rs', '.json', '.yaml', '.yml', '.xml', '.html', 
                     '.css', '.scss', '.md', '.txt'];
    return textExts.includes(ext.toLowerCase());
  }

  private inferFilePurpose(filePath: string, language: string): string {
    const fileName = filePath.toLowerCase();
    
    if (fileName.includes('test') || fileName.includes('spec')) return 'Testing';
    if (fileName.includes('config')) return 'Configuration';
    if (fileName.includes('util') || fileName.includes('helper')) return 'Utility';
    if (fileName.includes('component')) return 'Component';
    if (fileName.includes('service')) return 'Service';
    if (fileName.includes('model')) return 'Data Model';
    if (fileName.includes('controller')) return 'Controller';
    if (fileName.includes('route')) return 'Routing';
    if (fileName.includes('api')) return 'API';
    if (fileName.includes('readme')) return 'Documentation';
    
    return 'Core Logic';
  }

  private inferDirectoryPurpose(dirPath: string): string {
    const dir = dirPath.toLowerCase();
    
    if (dir.includes('src') || dir.includes('source')) return 'Source Code';
    if (dir.includes('test')) return 'Testing';
    if (dir.includes('config')) return 'Configuration';
    if (dir.includes('docs')) return 'Documentation';
    if (dir.includes('components')) return 'UI Components';
    if (dir.includes('services')) return 'Business Logic';
    if (dir.includes('utils') || dir.includes('helpers')) return 'Utilities';
    if (dir.includes('assets') || dir.includes('static')) return 'Static Assets';
    if (dir.includes('build') || dir.includes('dist')) return 'Build Output';
    
    return 'General';
  }

  private assessDirectoryImportance(dirPath: string, fileCount: number): 'high' | 'medium' | 'low' {
    const dir = dirPath.toLowerCase();
    
    if (dir.includes('src') || dir.includes('source') || dir.includes('components')) return 'high';
    if (fileCount > 10) return 'high';
    if (dir.includes('test') || dir.includes('config') || dir.includes('services')) return 'medium';
    if (fileCount > 5) return 'medium';
    
    return 'low';
  }

  private assessModularity(structure: ProjectStructure): number {
    // Simple modularity score based on directory organization and file distribution
    const totalDirs = structure.directories.length;
    const avgFilesPerDir = structure.totalFiles / Math.max(totalDirs, 1);
    
    // Good modularity: reasonable number of directories with balanced file distribution
    if (totalDirs > 3 && avgFilesPerDir < 20 && avgFilesPerDir > 2) {
      return 0.8;
    } else if (totalDirs > 1 && avgFilesPerDir < 30) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  private estimateComplexity(structure: ProjectStructure): number {
    // Rough complexity estimation based on file sizes and types
    const avgLines = structure.totalLines / Math.max(structure.totalFiles, 1);
    return Math.min(avgLines / 50, 10); // Normalize to 0-10 scale
  }

  private calculateMaintainabilityIndex(structure: ProjectStructure): number {
    // Simplified maintainability index
    const fileCountScore = Math.max(0, 100 - structure.totalFiles); // Penalty for too many files
    const avgSizeScore = Math.max(0, 100 - (structure.largestFiles[0]?.size || 0) / 1000); // Penalty for large files
    
    return Math.max(0, Math.min(100, (fileCountScore + avgSizeScore) / 2));
  }
}