import { z } from 'zod';
import { BaseTool } from './base-tool.js';
import { promises as fs, existsSync } from 'fs';
import { join, extname, dirname, basename } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Comprehensive Code Analysis Tool
 */
export class CodeAnalysisTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      analysis: z.enum([
        'complexity',
        'dependencies',
        'structure',
        'patterns',
        'quality',
        'security',
        'performance',
        'documentation',
        'tests',
        'refactor',
      ]),
      files: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe('Specific files to analyze'),
      includePatterns: z
        .array(z.string())
        .optional()
        .describe('File patterns to include (e.g., ["*.ts", "*.js"])'),
      excludePatterns: z.array(z.string()).optional().describe('Patterns to exclude'),
      language: z
        .string()
        .optional()
        .describe('Programming language (auto-detect if not specified)'),
      depth: z.enum(['surface', 'detailed', 'comprehensive']).optional().default('detailed'),
    });

    super({
      name: 'analyzeCode',
      description:
        'Comprehensive code analysis: complexity, dependencies, structure, patterns, quality',
      category: 'Code Analysis',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      switch (args.analysis) {
        case 'complexity':
          return await this.analyzeComplexity(args);

        case 'dependencies':
          return await this.analyzeDependencies(args);

        case 'structure':
          return await this.analyzeStructure(args);

        case 'patterns':
          return await this.analyzePatterns(args);

        case 'quality':
          return await this.analyzeQuality(args);

        case 'security':
          return await this.analyzeSecurity(args);

        case 'performance':
          return await this.analyzePerformance(args);

        case 'documentation':
          return await this.analyzeDocumentation(args);

        case 'tests':
          return await this.analyzeTests(args);

        case 'refactor':
          return await this.analyzeRefactorOpportunities(args);

        default:
          return { error: `Unknown analysis type: ${args.analysis}` };
      }
    } catch (error) {
      return {
        error: `Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async analyzeComplexity(args: any): Promise<any> {
    const files = await this.getFilesToAnalyze(args);
    const results = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const analysis = this.calculateComplexity(content, file);
        results.push({ file, ...analysis });
      } catch (error) {
        results.push({
          file,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      analysis: 'complexity',
      results,
      summary: this.summarizeComplexity(results),
    };
  }

  private calculateComplexity(content: string, file: string): any {
    const lines = content.split('\n');
    const ext = extname(file);

    // Basic metrics
    const totalLines = lines.length;
    const codeLines = lines.filter(
      line =>
        line.trim() &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*') &&
        !line.trim().startsWith('/*')
    ).length;

    // Cyclomatic complexity indicators
    const complexityKeywords = [
      'if',
      'else',
      'while',
      'for',
      'switch',
      'case',
      'catch',
      'try',
      '&&',
      '||',
      '?',
      ':',
      'forEach',
      'map',
      'filter',
      'reduce',
    ];

    let cyclomaticComplexity = 1; // Base complexity
    const regex = new RegExp(`\\b(${complexityKeywords.join('|')})\\b`, 'g');
    const matches = content.match(regex);
    if (matches) {
      cyclomaticComplexity += matches.length;
    }

    // Function/method count
    const functionRegex = /function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*:\s*\(|class\s+\w+/g;
    const functions = content.match(functionRegex) || [];

    // Nesting level
    const maxNesting = this.calculateMaxNesting(content);

    return {
      metrics: {
        totalLines,
        codeLines,
        cyclomaticComplexity,
        functions: functions.length,
        maxNesting,
        complexityPerFunction: functions.length > 0 ? cyclomaticComplexity / functions.length : 0,
      },
      score: this.calculateComplexityScore(cyclomaticComplexity, totalLines, maxNesting),
      recommendations: this.getComplexityRecommendations(
        cyclomaticComplexity,
        maxNesting,
        functions.length
      ),
    };
  }

  private calculateMaxNesting(content: string): number {
    let maxNesting = 0;
    let currentNesting = 0;

    for (const char of content) {
      if (char === '{') {
        currentNesting++;
        maxNesting = Math.max(maxNesting, currentNesting);
      } else if (char === '}') {
        currentNesting--;
      }
    }

    return maxNesting;
  }

  private async analyzeDependencies(args: any): Promise<any> {
    try {
      const packageJsonPath = join(this.agentContext.workingDirectory, 'package.json');
      let packageInfo = null;

      if (existsSync(packageJsonPath)) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        packageInfo = JSON.parse(packageContent);
      }

      // Analyze import statements in code files
      const files = await this.getFilesToAnalyze(args);
      const importAnalysis = await this.analyzeImports(files);

      return {
        analysis: 'dependencies',
        packageDependencies: packageInfo
          ? {
              dependencies: Object.keys(packageInfo.dependencies || {}),
              devDependencies: Object.keys(packageInfo.devDependencies || {}),
              peerDependencies: Object.keys(packageInfo.peerDependencies || {}),
              totalDeps: Object.keys({
                ...packageInfo.dependencies,
                ...packageInfo.devDependencies,
              }).length,
            }
          : null,
        codeImports: importAnalysis,
        recommendations: this.getDependencyRecommendations(packageInfo, importAnalysis),
      };
    } catch (error) {
      return {
        error: `Dependency analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async analyzeImports(files: string[]): Promise<any> {
    const imports = new Map<string, Set<string>>();
    const localImports: string[] = [];
    const externalImports: string[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileImports = this.extractImports(content);

        imports.set(file, new Set(fileImports));

        for (const imp of fileImports) {
          if (imp.startsWith('.') || imp.startsWith('/')) {
            localImports.push(imp);
          } else {
            externalImports.push(imp);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return {
      byFile: Object.fromEntries(
        Array.from(imports.entries()).map(([file, imps]) => [file, Array.from(imps)])
      ),
      summary: {
        totalFiles: files.length,
        localImports: [...new Set(localImports)],
        externalImports: [...new Set(externalImports)],
        mostImported: this.getMostImported(Array.from(imports.values())),
      },
    };
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];

    // ES6 imports
    const es6Regex = /import\s+.*?\s+from\s+['"](.*?)['"];?/g;
    let match;
    while ((match = es6Regex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // CommonJS requires
    const cjsRegex = /require\s*\(\s*['"](.*?)['"];?\s*\)/g;
    while ((match = cjsRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Dynamic imports
    const dynamicRegex = /import\s*\(\s*['"](.*?)['"];?\s*\)/g;
    while ((match = dynamicRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return imports;
  }

  private async analyzeStructure(args: any): Promise<any> {
    const files = await this.getFilesToAnalyze(args);
    const structure = {
      directories: new Set<string>(),
      fileTypes: new Map<string, number>(),
      totalFiles: files.length,
      largestFiles: [] as any[],
      deepestNesting: 0,
    };

    const fileSizes: any[] = [];

    for (const file of files) {
      try {
        const stats = await fs.stat(file);
        const dir = dirname(file);
        const ext = extname(file) || 'no-extension';

        structure.directories.add(dir);
        structure.fileTypes.set(ext, (structure.fileTypes.get(ext) || 0) + 1);

        const depth = file.split('/').length - 1;
        structure.deepestNesting = Math.max(structure.deepestNesting, depth);

        fileSizes.push({
          file,
          size: stats.size,
          lines: 0, // Will be calculated if needed
        });
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    // Sort and get largest files
    fileSizes.sort((a, b) => b.size - a.size);
    structure.largestFiles = fileSizes.slice(0, 10);

    return {
      analysis: 'structure',
      structure: {
        ...structure,
        directories: Array.from(structure.directories),
        fileTypes: Object.fromEntries(structure.fileTypes),
      },
      recommendations: this.getStructureRecommendations(structure),
    };
  }

  private async analyzeQuality(args: any): Promise<any> {
    const files = await this.getFilesToAnalyze(args);
    const qualityMetrics = {
      overallScore: 0,
      issues: [] as any[],
      suggestions: [] as string[],
    };

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const fileQuality = await this.assessFileQuality(content, file);
        qualityMetrics.issues.push(...fileQuality.issues);
        qualityMetrics.suggestions.push(...fileQuality.suggestions);
      } catch (error) {
        qualityMetrics.issues.push({
          file,
          type: 'access_error',
          message: `Could not analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    qualityMetrics.overallScore = this.calculateQualityScore(qualityMetrics.issues);

    return {
      analysis: 'quality',
      metrics: qualityMetrics,
      recommendations: this.getQualityRecommendations(qualityMetrics),
    };
  }

  private async assessFileQuality(content: string, file: string): Promise<any> {
    const issues: any[] = [];
    const suggestions: string[] = [];
    const lines = content.split('\n');

    // Check for common quality issues

    // Long lines
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          file,
          line: index + 1,
          type: 'long_line',
          message: `Line too long (${line.length} characters)`,
        });
      }
    });

    // TODO comments
    const todoRegex = /\/\/\s*TODO|\/\*\s*TODO|\#\s*TODO/gi;
    let match;
    while ((match = todoRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        file,
        line: lineNum,
        type: 'todo',
        message: 'TODO comment found',
      });
    }

    // Console.log statements (in production code)
    const consoleRegex = /console\.(log|debug|info|warn|error)/g;
    while ((match = consoleRegex.exec(content)) !== null) {
      const lineNum = content.substring(0, match.index).split('\n').length;
      issues.push({
        file,
        line: lineNum,
        type: 'console_log',
        message: 'Console statement found (consider using proper logging)',
      });
    }

    // Large functions (rough heuristic)
    const functionRegex = /function\s+\w+\s*\([^)]*\)\s*\{|const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{/g;
    while ((match = functionRegex.exec(content)) !== null) {
      const startIndex = match.index;
      const endIndex = this.findClosingBrace(content, startIndex + match[0].length - 1);
      if (endIndex !== -1) {
        const functionContent = content.substring(startIndex, endIndex);
        const functionLines = functionContent.split('\n').length;

        if (functionLines > 50) {
          const lineNum = content.substring(0, startIndex).split('\n').length;
          issues.push({
            file,
            line: lineNum,
            type: 'large_function',
            message: `Function is very large (${functionLines} lines)`,
          });
        }
      }
    }

    // Missing error handling
    if (content.includes('async ') && !content.includes('try') && !content.includes('catch')) {
      suggestions.push('Consider adding error handling for async operations');
    }

    return { issues, suggestions };
  }

  private findClosingBrace(content: string, startIndex: number): number {
    let braceCount = 1;
    for (let i = startIndex + 1; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      else if (content[i] === '}') braceCount--;

      if (braceCount === 0) return i;
    }
    return -1;
  }

  private async getFilesToAnalyze(args: any): Promise<string[]> {
    if (args.files) {
      return Array.isArray(args.files) ? args.files : [args.files];
    }

    // Default file patterns for code analysis
    const defaultPatterns = [
      '**/*.ts',
      '**/*.js',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.py',
      '**/*.java',
      '**/*.cpp',
      '**/*.c',
    ];
    const patterns = args.includePatterns || defaultPatterns;

    // Use glob to find files (simplified implementation)
    const files: string[] = [];

    try {
      const { glob } = await import('glob');
      for (const pattern of patterns) {
        const matches = await glob(pattern, {
          cwd: this.agentContext.workingDirectory,
          ignore: args.excludePatterns || ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
        });
        files.push(...matches);
      }
    } catch (error) {
      // Fallback to reading directory
      return [];
    }

    return [...new Set(files)];
  }

  // Helper methods for calculations and recommendations
  private calculateComplexityScore(complexity: number, lines: number, nesting: number): number {
    const complexityScore = Math.max(0, 100 - complexity * 2);
    const lineScore = Math.max(0, 100 - lines / 10);
    const nestingScore = Math.max(0, 100 - nesting * 10);

    return Math.round((complexityScore + lineScore + nestingScore) / 3);
  }

  private getComplexityRecommendations(
    complexity: number,
    nesting: number,
    functions: number
  ): string[] {
    const recommendations: string[] = [];

    if (complexity > 15) {
      recommendations.push('Consider breaking down complex functions');
    }
    if (nesting > 4) {
      recommendations.push('Reduce nesting levels for better readability');
    }
    if (functions === 0) {
      recommendations.push('Consider organizing code into functions');
    }

    return recommendations;
  }

  private summarizeComplexity(results: any[]): any {
    const validResults = results.filter(r => !r.error);

    if (validResults.length === 0) {
      return { error: 'No files could be analyzed' };
    }

    const totalComplexity = validResults.reduce(
      (sum, r) => sum + r.metrics.cyclomaticComplexity,
      0
    );
    const avgComplexity = totalComplexity / validResults.length;
    const maxComplexity = Math.max(...validResults.map(r => r.metrics.cyclomaticComplexity));

    return {
      filesAnalyzed: validResults.length,
      averageComplexity: Math.round(avgComplexity * 100) / 100,
      maxComplexity,
      overallScore: Math.round(
        validResults.reduce((sum, r) => sum + r.score, 0) / validResults.length
      ),
    };
  }

  private getDependencyRecommendations(packageInfo: any, importAnalysis: any): string[] {
    const recommendations: string[] = [];

    if (packageInfo && packageInfo.dependencies) {
      const depCount = Object.keys(packageInfo.dependencies).length;
      if (depCount > 50) {
        recommendations.push('Consider reducing the number of dependencies');
      }
    }

    if (
      importAnalysis.summary.externalImports.length >
      importAnalysis.summary.localImports.length * 2
    ) {
      recommendations.push('High external dependency usage - consider code organization');
    }

    return recommendations;
  }

  private getMostImported(importSets: Set<string>[]): string[] {
    const importCounts = new Map<string, number>();

    for (const importSet of importSets) {
      for (const imp of importSet) {
        importCounts.set(imp, (importCounts.get(imp) || 0) + 1);
      }
    }

    return Array.from(importCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([imp]) => imp);
  }

  private getStructureRecommendations(structure: any): string[] {
    const recommendations: string[] = [];

    if (structure.deepestNesting > 5) {
      recommendations.push('Consider flattening the directory structure');
    }

    if (structure.totalFiles > 100 && structure.directories.size < 5) {
      recommendations.push('Consider organizing files into more directories');
    }

    return recommendations;
  }

  private calculateQualityScore(issues: any[]): number {
    const severityWeights = {
      critical: -20,
      high: -10,
      medium: -5,
      low: -2,
      info: -1,
    };

    let score = 100;
    for (const issue of issues) {
      const weight = severityWeights[issue.severity as keyof typeof severityWeights] || -1;
      score += weight;
    }

    return Math.max(0, score);
  }

  private getQualityRecommendations(metrics: any): string[] {
    const recommendations: string[] = [];

    if (metrics.overallScore < 70) {
      recommendations.push('Code quality needs improvement');
    }

    const todoCount = metrics.issues.filter((i: any) => i.type === 'todo').length;
    if (todoCount > 10) {
      recommendations.push('Consider addressing TODO comments');
    }

    return recommendations;
  }

  // Placeholder implementations for remaining analysis types
  private async analyzePatterns(args: any): Promise<any> {
    return { analysis: 'patterns', message: 'Pattern analysis implementation in progress' };
  }

  private async analyzeSecurity(args: any): Promise<any> {
    return { analysis: 'security', message: 'Security analysis implementation in progress' };
  }

  private async analyzePerformance(args: any): Promise<any> {
    return { analysis: 'performance', message: 'Performance analysis implementation in progress' };
  }

  private async analyzeDocumentation(args: any): Promise<any> {
    return {
      analysis: 'documentation',
      message: 'Documentation analysis implementation in progress',
    };
  }

  private async analyzeTests(args: any): Promise<any> {
    return { analysis: 'tests', message: 'Test analysis implementation in progress' };
  }

  private async analyzeRefactorOpportunities(args: any): Promise<any> {
    return { analysis: 'refactor', message: 'Refactor analysis implementation in progress' };
  }
}

/**
 * Code Generation Tool
 */
export class CodeGenerationTool extends BaseTool {
  constructor(private agentContext: { workingDirectory: string }) {
    const parameters = z.object({
      task: z.enum([
        'function',
        'class',
        'component',
        'module',
        'test',
        'documentation',
        'api',
        'schema',
        'config',
        'script',
      ]),
      language: z.string().describe('Programming language (e.g., typescript, javascript, python)'),
      name: z.string().describe('Name of the item to generate'),
      description: z.string().describe('Description of what to generate'),
      requirements: z.array(z.string()).optional().describe('Specific requirements'),
      style: z
        .enum(['functional', 'object-oriented', 'minimal', 'comprehensive'])
        .optional()
        .default('comprehensive'),
      dependencies: z.array(z.string()).optional().describe('Dependencies to include'),
      outputPath: z.string().optional().describe('Where to save the generated code'),
    });

    super({
      name: 'generateCode',
      description: 'Generate code: functions, classes, components, tests, documentation, APIs',
      category: 'Code Generation',
      parameters,
    });
  }

  async execute(args: z.infer<typeof this.definition.parameters>): Promise<any> {
    try {
      switch (args.task) {
        case 'function':
          return this.generateFunction(args);

        case 'class':
          return this.generateClass(args);

        case 'component':
          return this.generateComponent(args);

        case 'module':
          return this.generateModule(args);

        case 'test':
          return this.generateTest(args);

        case 'documentation':
          return this.generateDocumentation(args);

        case 'api':
          return this.generateAPI(args);

        case 'schema':
          return this.generateSchema(args);

        case 'config':
          return this.generateConfig(args);

        case 'script':
          return this.generateScript(args);

        default:
          return { error: `Unknown generation task: ${args.task}` };
      }
    } catch (error) {
      return {
        error: `Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private generateFunction(args: any): any {
    const templates = {
      typescript: this.generateTypeScriptFunction(args),
      javascript: this.generateJavaScriptFunction(args),
      python: this.generatePythonFunction(args),
    };

    const code = templates[args.language as keyof typeof templates] || templates.typescript;

    return {
      task: 'function',
      name: args.name,
      language: args.language,
      code,
      description: args.description,
      suggestions: this.getFunctionSuggestions(args),
    };
  }

  private generateTypeScriptFunction(args: any): string {
    const params = args.requirements?.join(', ') || 'params: any';

    return `/**
 * ${args.description}
 */
export function ${args.name}(${params}): any {
  // TODO: Implement ${args.description.toLowerCase()}
  
  try {
    // Implementation goes here
    
    return result;
  } catch (error) {
    throw new Error(\`Failed to ${args.name}: \${error instanceof Error ? error.message : 'Unknown error'}\`);
  }
}`;
  }

  private generateJavaScriptFunction(args: any): string {
    const params = args.requirements?.join(', ') || 'params';

    return `/**
 * ${args.description}
 */
function ${args.name}(${params}) {
  // TODO: Implement ${args.description.toLowerCase()}
  
  try {
    // Implementation goes here
    
    return result;
  } catch (error) {
    throw new Error(\`Failed to ${args.name}: \${error.message}\`);
  }
}

module.exports = { ${args.name} };`;
  }

  private generatePythonFunction(args: any): string {
    const params = args.requirements?.join(', ') || 'params';

    return `def ${args.name}(${params}):
    """
    ${args.description}
    
    Args:
        ${params}: Parameters for the function
        
    Returns:
        Result of the operation
        
    Raises:
        Exception: If the operation fails
    """
    try:
        # TODO: Implement ${args.description.toLowerCase()}
        
        # Implementation goes here
        
        return result
    except Exception as error:
        raise Exception(f"Failed to ${args.name}: {str(error)}")`;
  }

  private generateClass(args: any): any {
    // Similar pattern for class generation
    return {
      task: 'class',
      name: args.name,
      language: args.language,
      code: `// Generated ${args.name} class\n// TODO: Implement class structure`,
      description: args.description,
    };
  }

  // Placeholder implementations for other generation types
  private generateComponent(args: any): any {
    return { task: 'component', message: 'Component generation implementation in progress' };
  }

  private generateModule(args: any): any {
    return { task: 'module', message: 'Module generation implementation in progress' };
  }

  private generateTest(args: any): any {
    return { task: 'test', message: 'Test generation implementation in progress' };
  }

  private generateDocumentation(args: any): any {
    return {
      task: 'documentation',
      message: 'Documentation generation implementation in progress',
    };
  }

  private generateAPI(args: any): any {
    return { task: 'api', message: 'API generation implementation in progress' };
  }

  private generateSchema(args: any): any {
    return { task: 'schema', message: 'Schema generation implementation in progress' };
  }

  private generateConfig(args: any): any {
    return { task: 'config', message: 'Config generation implementation in progress' };
  }

  private generateScript(args: any): any {
    return { task: 'script', message: 'Script generation implementation in progress' };
  }

  private getFunctionSuggestions(args: any): string[] {
    return [
      'Add input validation',
      'Include error handling',
      'Add unit tests',
      'Document parameters and return values',
    ];
  }
}
