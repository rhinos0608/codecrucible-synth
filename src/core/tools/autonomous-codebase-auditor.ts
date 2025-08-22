import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

export interface CodebaseAnalysis {
  overview: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    directories: string[];
  };
  dependencies: {
    production: string[];
    development: string[];
    security: {
      vulnerabilities: number;
      issues: string[];
    };
  };
  codeQuality: {
    complexity: number;
    maintainability: string;
    testCoverage?: number;
    codeSmells: string[];
  };
  architecture: {
    patterns: string[];
    frameworks: string[];
    structure: Record<string, any>;
  };
  security: {
    secrets: string[];
    permissions: string[];
    risks: string[];
  };
  performance: {
    buildTime?: number;
    bundleSize?: number;
    optimizations: string[];
  };
}

export class AutonomousCodebaseAnalyzer {
  private workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  async performComprehensiveAnalysis(): Promise<CodebaseAnalysis> {
    console.log('🔍 Starting comprehensive codebase analysis...');

    const [overview, dependencies, codeQuality, architecture, security, performance] =
      await Promise.allSettled([
        this.analyzeOverview(),
        this.analyzeDependencies(),
        this.analyzeCodeQuality(),
        this.analyzeArchitecture(),
        this.analyzeSecurity(),
        this.analyzePerformance(),
      ]);

    return {
      overview: overview.status === 'fulfilled' ? overview.value : this.getDefaultOverview(),
      dependencies:
        dependencies.status === 'fulfilled' ? dependencies.value : this.getDefaultDependencies(),
      codeQuality:
        codeQuality.status === 'fulfilled' ? codeQuality.value : this.getDefaultCodeQuality(),
      architecture:
        architecture.status === 'fulfilled' ? architecture.value : this.getDefaultArchitecture(),
      security: security.status === 'fulfilled' ? security.value : this.getDefaultSecurity(),
      performance:
        performance.status === 'fulfilled' ? performance.value : this.getDefaultPerformance(),
    };
  }

  private async analyzeOverview() {
    const files = await this.findAllFiles();
    const languages = this.detectLanguages(files);
    const directories = this.getDirectoryStructure();

    let totalLines = 0;
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.workingDirectory, file), 'utf-8');
        totalLines += content.split('\n').length;
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return {
      totalFiles: files.length,
      totalLines,
      languages,
      directories: directories.slice(0, 20), // Limit for performance
    };
  }

  private async analyzeDependencies() {
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    let production: string[] = [];
    let development: string[] = [];
    let vulnerabilities = 0;
    let issues: string[] = [];

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        production = Object.keys(packageJson.dependencies || {});
        development = Object.keys(packageJson.devDependencies || {});

        // Try to run npm audit
        try {
          const { stdout } = await execAsync('npm audit --json', {
            cwd: this.workingDirectory,
            timeout: 30000,
          });
          const auditResult = JSON.parse(stdout);
          vulnerabilities = auditResult.metadata?.vulnerabilities?.total || 0;
          issues = Object.keys(auditResult.advisories || {}).slice(0, 10);
        } catch (auditError) {
          // npm audit failed, continue without security info
        }
      } catch (parseError) {
        // Invalid package.json
      }
    }

    return {
      production,
      development,
      security: { vulnerabilities, issues },
    };
  }

  private async analyzeCodeQuality() {
    let complexity = 1;
    let maintainability = 'good';
    const codeSmells: string[] = [];

    // Basic heuristic analysis
    const files = await this.findAllFiles(['.ts', '.js', '.jsx', '.tsx']);
    let totalFunctions = 0;
    let longFunctions = 0;

    for (const file of files.slice(0, 50)) {
      // Limit for performance
      try {
        const content = fs.readFileSync(path.join(this.workingDirectory, file), 'utf-8');
        const functionMatches =
          content.match(/function\s+\w+|const\s+\w+\s*=.*=>|class\s+\w+/g) || [];
        totalFunctions += functionMatches.length;

        // Check for long functions (basic heuristic)
        const lines = content.split('\n');
        let inFunction = false;
        let functionLength = 0;

        for (const line of lines) {
          if (line.includes('function ') || line.includes('=>') || line.includes('class ')) {
            if (inFunction && functionLength > 50) {
              longFunctions++;
            }
            inFunction = true;
            functionLength = 0;
          } else if (line.includes('}') && inFunction) {
            inFunction = false;
          }

          if (inFunction) functionLength++;
        }

        // Detect code smells
        if (content.includes('console.log')) codeSmells.push('Debug statements');
        if (content.includes('TODO') || content.includes('FIXME')) codeSmells.push('TODOs/FIXMEs');
        if (content.match(/\w{50,}/)) codeSmells.push('Long identifiers');
      } catch (error) {
        // Skip problematic files
      }
    }

    complexity =
      totalFunctions > 0 ? Math.min(10, Math.ceil((longFunctions / totalFunctions) * 10)) : 1;
    maintainability = complexity < 3 ? 'excellent' : complexity < 6 ? 'good' : 'needs improvement';

    return {
      complexity,
      maintainability,
      codeSmells: [...new Set(codeSmells)].slice(0, 10),
    };
  }

  private async analyzeArchitecture() {
    const patterns: string[] = [];
    const frameworks: string[] = [];
    const structure: Record<string, any> = {};

    // Detect frameworks and patterns
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

        if (allDeps.react) frameworks.push('React');
        if (allDeps.vue) frameworks.push('Vue');
        if (allDeps.angular) frameworks.push('Angular');
        if (allDeps.express) frameworks.push('Express');
        if (allDeps.typescript) frameworks.push('TypeScript');
        if (allDeps.jest) frameworks.push('Jest');
        if (allDeps.webpack) frameworks.push('Webpack');

        // Detect patterns based on directory structure
        const dirs = this.getDirectoryStructure();
        if (dirs.includes('src/components')) patterns.push('Component Architecture');
        if (dirs.includes('src/services')) patterns.push('Service Layer');
        if (dirs.includes('src/utils')) patterns.push('Utility Pattern');
        if (dirs.includes('tests') || dirs.includes('__tests__'))
          patterns.push('Test Organization');
        if (dirs.includes('docs')) patterns.push('Documentation');
      } catch (error) {
        // Continue without package.json analysis
      }
    }

    return { patterns, frameworks, structure };
  }

  private async analyzeSecurity() {
    const secrets: string[] = [];
    const permissions: string[] = [];
    const risks: string[] = [];

    // Basic secret detection
    const files = await this.findAllFiles(['.js', '.ts', '.json', '.env']);
    const secretPatterns = [/api[_-]?key/i, /secret/i, /password/i, /token/i, /auth/i];

    for (const file of files.slice(0, 30)) {
      // Limit for performance
      try {
        const content = fs.readFileSync(path.join(this.workingDirectory, file), 'utf-8');

        for (const pattern of secretPatterns) {
          if (pattern.test(content)) {
            secrets.push(file);
            break;
          }
        }

        // Check for common security risks
        if (content.includes('eval(')) risks.push('Dynamic code execution');
        if (content.includes('innerHTML')) risks.push('XSS vulnerability');
        if (content.includes('document.write')) risks.push('DOM manipulation');
      } catch (error) {
        // Skip problematic files
      }
    }

    return {
      secrets: [...new Set(secrets)].slice(0, 10),
      permissions: permissions.slice(0, 10),
      risks: [...new Set(risks)].slice(0, 10),
    };
  }

  private async analyzePerformance() {
    const optimizations: string[] = [];

    // Check for common optimization opportunities
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        if (!packageJson.scripts?.build) optimizations.push('Add build script');
        if (!packageJson.scripts?.test) optimizations.push('Add test script');
        if (packageJson.dependencies && Object.keys(packageJson.dependencies).length > 50) {
          optimizations.push('Consider dependency reduction');
        }
      } catch (error) {
        // Continue without package.json analysis
      }
    }

    // Check for large files
    const files = await this.findAllFiles();
    for (const file of files) {
      try {
        const stats = fs.statSync(path.join(this.workingDirectory, file));
        if (stats.size > 100000) {
          // > 100KB
          optimizations.push('Large file detected: ' + file);
        }
      } catch (error) {
        // Skip problematic files
      }
    }

    return {
      optimizations: optimizations.slice(0, 10),
    };
  }

  private async findAllFiles(extensions?: string[]): Promise<string[]> {
    const files: string[] = [];

    const walkDir = (dir: string, relativePath: string = '') => {
      try {
        const items = fs.readdirSync(path.join(this.workingDirectory, dir));

        for (const item of items) {
          if (item.startsWith('.') || item === 'node_modules') continue;

          const fullPath = path.join(dir, item);
          const relativeFilePath = path.join(relativePath, item);
          const stat = fs.statSync(path.join(this.workingDirectory, fullPath));

          if (stat.isDirectory()) {
            walkDir(fullPath, relativeFilePath);
          } else if (stat.isFile()) {
            if (!extensions || extensions.some(ext => item.endsWith(ext))) {
              files.push(relativeFilePath);
            }
          }
        }
      } catch (error) {
        // Skip directories that can't be read
      }
    };

    walkDir('.');
    return files.slice(0, 1000); // Limit for performance
  }

  private detectLanguages(files: string[]): Record<string, number> {
    const languages: Record<string, number> = {};

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      let language = 'Other';

      switch (ext) {
        case '.js':
        case '.jsx':
          language = 'JavaScript';
          break;
        case '.ts':
        case '.tsx':
          language = 'TypeScript';
          break;
        case '.py':
          language = 'Python';
          break;
        case '.java':
          language = 'Java';
          break;
        case '.cpp':
        case '.cc':
        case '.cxx':
          language = 'C++';
          break;
        case '.c':
          language = 'C';
          break;
        case '.cs':
          language = 'C#';
          break;
        case '.go':
          language = 'Go';
          break;
        case '.rs':
          language = 'Rust';
          break;
        case '.php':
          language = 'PHP';
          break;
        case '.rb':
          language = 'Ruby';
          break;
        case '.swift':
          language = 'Swift';
          break;
        case '.kt':
          language = 'Kotlin';
          break;
        case '.html':
          language = 'HTML';
          break;
        case '.css':
          language = 'CSS';
          break;
        case '.scss':
        case '.sass':
          language = 'SCSS';
          break;
        case '.json':
          language = 'JSON';
          break;
        case '.xml':
          language = 'XML';
          break;
        case '.yaml':
        case '.yml':
          language = 'YAML';
          break;
        case '.md':
          language = 'Markdown';
          break;
      }

      languages[language] = (languages[language] || 0) + 1;
    }

    return languages;
  }

  private getDirectoryStructure(): string[] {
    const dirs: string[] = [];

    const walkDirs = (dir: string, depth = 0) => {
      if (depth > 3) return; // Limit depth

      try {
        const items = fs.readdirSync(path.join(this.workingDirectory, dir));

        for (const item of items) {
          if (item.startsWith('.') || item === 'node_modules') continue;

          const fullPath = path.join(dir, item);
          const stat = fs.statSync(path.join(this.workingDirectory, fullPath));

          if (stat.isDirectory()) {
            dirs.push(fullPath);
            walkDirs(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip problematic directories
      }
    };

    walkDirs('.');
    return dirs;
  }

  // Default fallback methods
  private getDefaultOverview() {
    return {
      totalFiles: 0,
      totalLines: 0,
      languages: {},
      directories: [],
    };
  }

  private getDefaultDependencies() {
    return {
      production: [],
      development: [],
      security: { vulnerabilities: 0, issues: [] },
    };
  }

  private getDefaultCodeQuality() {
    return {
      complexity: 1,
      maintainability: 'unknown',
      codeSmells: [],
    };
  }

  private getDefaultArchitecture() {
    return {
      patterns: [],
      frameworks: [],
      structure: {},
    };
  }

  private getDefaultSecurity() {
    return {
      secrets: [],
      permissions: [],
      risks: [],
    };
  }

  private getDefaultPerformance() {
    return {
      optimizations: [],
    };
  }
}
