#!/usr/bin/env node

import { join, extname, relative, dirname, basename } from 'path';
import { existsSync, readFileSync, statSync } from 'fs';
import { marked } from 'marked';
import readingTime from 'reading-time';
import Fuse from 'fuse.js';
import lunr from 'lunr';
import { glob } from 'glob';
import ignore from 'ignore';
import { createHash } from 'crypto';
import picocolors from 'picocolors';
import { performance } from 'perf_hooks';

export interface PackageData {
  name?: string;
  version?: string;
  description?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface ProjectFile {
  path: string;
  relativePath: string;
  size: number;
  type: 'source' | 'config' | 'docs' | 'test' | 'asset' | 'build' | 'other';
  language: string;
  lastModified: Date;
  hash: string;
  lines: number;
  complexity?: number;
  dependencies?: string[];
  exports?: string[];
  imports?: string[];
}

export interface DocumentationFile extends ProjectFile {
  title: string;
  content: string;
  htmlContent: string;
  readingTime: {
    text: string;
    minutes: number;
    time: number;
    words: number;
  };
  headings: Array<{
    level: number;
    text: string;
    anchor: string;
  }>;
  codeBlocks: Array<{
    language: string;
    code: string;
    lineNumber: number;
  }>;
}

export interface ProjectIndex {
  metadata: {
    name: string;
    version: string;
    description?: string;
    type: 'npm' | 'python' | 'generic';
    rootPath: string;
    indexedAt: Date;
    totalFiles: number;
    totalSize: number;
    languages: Record<string, number>;
    frameworks: string[];
    dependencies: Record<string, string>;
  };
  files: Record<string, ProjectFile>;
  documentation: Record<string, DocumentationFile>;
  structure: {
    directories: string[];
    mainFiles: string[];
    entryPoints: string[];
    configFiles: string[];
    testDirectories: string[];
    buildOutputs: string[];
  };
  searchIndex: {
    lunr: lunr.Index;
    fuse: Fuse<ProjectFile>;
  };
  analysis: {
    complexity: {
      total: number;
      average: number;
      highest: Array<{ file: string; complexity: number }>;
    };
    dependencies: {
      internal: string[];
      external: string[];
      circular: string[];
    };
    coverage: {
      documented: number;
      tested: number;
      total: number;
    };
    patterns: {
      frameworksDetected: string[];
      architecturePattern: string;
      qualityScore: number;
    };
  };
}

export class EnhancedStartupIndexer {
  private rootPath: string;
  private gitignorePatterns: ReturnType<typeof ignore>;
  private supportedExtensions = new Set([
    '.ts', '.js', '.tsx', '.jsx', '.py', '.md', '.json', '.yaml', '.yml',
    '.html', '.css', '.scss', '.less', '.vue', '.svelte', '.go', '.rs',
    '.java', '.cpp', '.c', '.h', '.hpp', '.php', '.rb', '.sh', '.bat',
    '.dockerfile', '.sql', '.graphql', '.proto'
  ]);

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.gitignorePatterns = this.loadGitignore();
  }

  async indexProject(): Promise<ProjectIndex> {
    const startTime = performance.now();
    
    console.log(picocolors.cyan('🔍 Starting enhanced project indexing...'));
    
    // Step 1: Discover files
    const allFiles = await this.discoverFiles();
    console.log(picocolors.blue(`📁 Discovered ${allFiles.length} files`));

    // Step 2: Analyze files
    const files: Record<string, ProjectFile> = {};
    const documentation: Record<string, DocumentationFile> = {};
    
    let processed = 0;
    for (const filePath of allFiles) {
      const file = await this.analyzeFile(filePath);
      files[file.relativePath] = file;
      
      if (file.type === 'docs' && file.path.endsWith('.md')) {
        const docFile = await this.analyzeDocumentation(file);
        documentation[docFile.relativePath] = docFile;
      }
      
      processed++;
      if (processed % 50 === 0) {
        console.log(picocolors.gray(`  Processed ${processed}/${allFiles.length} files...`));
      }
    }

    // Step 3: Build metadata
    const metadata = await this.buildMetadata(files);
    
    // Step 4: Analyze structure
    const structure = this.analyzeStructure(files);
    
    // Step 5: Build search indices
    const searchIndex = this.buildSearchIndices(files);
    
    // Step 6: Perform analysis
    const analysis = await this.performAnalysis(files, documentation);
    
    const endTime = performance.now();
    const indexTime = Math.round(endTime - startTime);
    
    console.log(picocolors.green(`✅ Project indexed in ${indexTime}ms`));
    console.log(picocolors.gray(`   ${Object.keys(files).length} files, ${Object.keys(documentation).length} docs`));
    
    return {
      metadata,
      files,
      documentation,
      structure,
      searchIndex,
      analysis
    };
  }

  private async discoverFiles(): Promise<string[]> {
    const patterns = [
      '**/*.{ts,js,tsx,jsx,py,md,json,yaml,yml}',
      '**/*.{html,css,scss,less,vue,svelte}',
      '**/*.{go,rs,java,cpp,c,h,hpp,php,rb}',
      '**/*.{sh,bat,dockerfile,sql,graphql,proto}',
      '**/package.json',
      '**/requirements.txt',
      '**/Cargo.toml',
      '**/go.mod',
      '**/composer.json',
      '**/README*',
      '**/LICENSE*',
      '**/CHANGELOG*'
    ];

    const files: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: this.rootPath,
        absolute: true,
        ignore: [
          'node_modules/**',
          '.git/**',
          'dist/**',
          'build/**',
          '.next/**',
          '.nuxt/**',
          '__pycache__/**',
          '*.pyc',
          '.pytest_cache/**',
          'target/**',
          'vendor/**'
        ]
      });
      files.push(...matches);
    }

    return [...new Set(files)].filter(file => {
      const relativePath = relative(this.rootPath, file);
      return !this.gitignorePatterns.ignores(relativePath);
    });
  }

  private async analyzeFile(filePath: string): Promise<ProjectFile> {
    const stats = statSync(filePath);
    const relativePath = relative(this.rootPath, filePath);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const hash = createHash('md5').update(content).digest('hex');
    
    return {
      path: filePath,
      relativePath,
      size: stats.size,
      type: this.determineFileType(filePath),
      language: this.determineLanguage(filePath),
      lastModified: stats.mtime,
      hash,
      lines,
      complexity: await this.calculateComplexity(filePath, content),
      dependencies: this.extractDependencies(filePath, content),
      exports: this.extractExports(filePath, content),
      imports: this.extractImports(filePath, content)
    };
  }

  private async analyzeDocumentation(file: ProjectFile): Promise<DocumentationFile> {
    const content = readFileSync(file.path, 'utf-8');
    const htmlContent = await marked(content);
    const readingTimeData = readingTime(content);
    
    const headings = this.extractHeadings(content);
    const codeBlocks = this.extractCodeBlocks(content);
    
    return {
      ...file,
      title: this.extractTitle(content, file.relativePath),
      content,
      htmlContent,
      readingTime: readingTimeData,
      headings,
      codeBlocks
    };
  }

  private determineFileType(filePath: string): ProjectFile['type'] {
    const name = basename(filePath).toLowerCase();
    const dir = dirname(filePath).toLowerCase();
    
    if (name.includes('test') || name.includes('spec') || dir.includes('test')) {
      return 'test';
    }
    
    if (name.endsWith('.md') || name.startsWith('readme') || name.startsWith('changelog')) {
      return 'docs';
    }
    
    if (name.includes('config') || name.startsWith('.') || name.endsWith('.json') || name.endsWith('.yml') || name.endsWith('.yaml')) {
      return 'config';
    }
    
    if (dir.includes('dist') || dir.includes('build') || dir.includes('out')) {
      return 'build';
    }
    
    if (['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c'].some(ext => name.endsWith(ext))) {
      return 'source';
    }
    
    if (['.css', '.scss', '.less', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico'].some(ext => name.endsWith(ext))) {
      return 'asset';
    }
    
    return 'other';
  }

  private determineLanguage(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.php': 'php',
      '.rb': 'ruby',
      '.sh': 'bash',
      '.bat': 'batch',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.less': 'less',
      '.sql': 'sql',
      '.json': 'json',
      '.yaml': 'yaml',
      '.yml': 'yaml'
    };
    
    return languageMap[ext] || 'text';
  }

  private async calculateComplexity(filePath: string, content: string): Promise<number> {
    // Simple complexity calculation based on cyclomatic complexity indicators
    const complexityIndicators = [
      /\bif\b/g,
      /\belse\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bdo\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\btry\b/g,
      /\?\s*:/g, // ternary operator
      /&&/g,
      /\|\|/g
    ];
    
    let complexity = 1; // Base complexity
    for (const indicator of complexityIndicators) {
      const matches = content.match(indicator);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private extractDependencies(filePath: string, content: string): string[] {
    const dependencies: string[] = [];
    
    // Import statements
    const importMatches = [
      ...content.matchAll(/import\s+.*?from\s+['"`]([^'"`]+)['"`]/g),
      ...content.matchAll(/require\(['"`]([^'"`]+)['"`]\)/g),
      ...content.matchAll(/from\s+(['"`])([^'"`]+)\1/g)
    ];
    
    for (const match of importMatches) {
      const dep = match[1] || match[2];
      if (dep && !dep.startsWith('.')) {
        dependencies.push(dep);
      }
    }
    
    return [...new Set(dependencies)];
  }

  private extractExports(filePath: string, content: string): string[] {
    const exports: string[] = [];
    
    const exportMatches = [
      ...content.matchAll(/export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g),
      ...content.matchAll(/export\s*{\s*([^}]+)\s*}/g)
    ];
    
    for (const match of exportMatches) {
      if (match[1]) {
        if (match[1].includes(',')) {
          exports.push(...match[1].split(',').map(e => e.trim()));
        } else {
          exports.push(match[1]);
        }
      }
    }
    
    return [...new Set(exports)];
  }

  private extractImports(filePath: string, content: string): string[] {
    const imports: string[] = [];
    
    const importMatches = [
      ...content.matchAll(/import\s+(?:{\s*([^}]+)\s*}|(\w+))/g)
    ];
    
    for (const match of importMatches) {
      if (match[1]) {
        imports.push(...match[1].split(',').map(i => i.trim()));
      } else if (match[2]) {
        imports.push(match[2]);
      }
    }
    
    return [...new Set(imports)];
  }

  private extractHeadings(content: string): Array<{ level: number; text: string; anchor: string }> {
    const headings: Array<{ level: number; text: string; anchor: string }> = [];
    const headingMatches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);
    
    for (const match of headingMatches) {
      const level = match[1].length;
      const text = match[2].trim();
      const anchor = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ level, text, anchor });
    }
    
    return headings;
  }

  private extractCodeBlocks(content: string): Array<{ language: string; code: string; lineNumber: number }> {
    const codeBlocks: Array<{ language: string; code: string; lineNumber: number }> = [];
    const lines = content.split('\n');
    let inCodeBlock = false;
    let currentBlock: { language: string; code: string; lineNumber: number } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const codeBlockMatch = line.match(/^```(\w+)?/);
      
      if (codeBlockMatch && !inCodeBlock) {
        inCodeBlock = true;
        currentBlock = {
          language: codeBlockMatch[1] || 'text',
          code: '',
          lineNumber: i + 1
        };
      } else if (line.match(/^```$/) && inCodeBlock && currentBlock) {
        inCodeBlock = false;
        codeBlocks.push(currentBlock);
        currentBlock = null;
      } else if (inCodeBlock && currentBlock) {
        currentBlock.code += line + '\n';
      }
    }
    
    return codeBlocks;
  }

  private extractTitle(content: string, filePath: string): string {
    // Try to extract title from first heading
    const firstHeading = content.match(/^#\s+(.+)$/m);
    if (firstHeading) {
      return firstHeading[1].trim();
    }
    
    // Fallback to filename
    return basename(filePath, extname(filePath));
  }

  private async buildMetadata(files: Record<string, ProjectFile>): Promise<ProjectIndex['metadata']> {
    const packageJsonPath = join(this.rootPath, 'package.json');
    let packageData: PackageData = {};
    
    if (existsSync(packageJsonPath)) {
      packageData = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as PackageData;
    }
    
    const languages: Record<string, number> = {};
    let totalSize = 0;
    
    for (const file of Object.values(files)) {
      languages[file.language] = (languages[file.language] || 0) + 1;
      totalSize += file.size;
    }
    
    const frameworks = this.detectFrameworks(files, packageData);
    
    return {
      name: packageData.name || basename(this.rootPath),
      version: packageData.version || '0.0.0',
      description: packageData.description,
      type: existsSync(packageJsonPath) ? 'npm' : existsSync(join(this.rootPath, 'requirements.txt')) ? 'python' : 'generic',
      rootPath: this.rootPath,
      indexedAt: new Date(),
      totalFiles: Object.keys(files).length,
      totalSize,
      languages,
      frameworks,
      dependencies: packageData.dependencies || {}
    };
  }

  private detectFrameworks(files: Record<string, ProjectFile>, packageData: PackageData): string[] {
    const frameworks: string[] = [];
    const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };
    
    // Framework detection based on dependencies
    const frameworkMap: Record<string, string> = {
      'react': 'React',
      'vue': 'Vue.js',
      'angular': 'Angular',
      'svelte': 'Svelte',
      'next': 'Next.js',
      'nuxt': 'Nuxt.js',
      'express': 'Express.js',
      'fastify': 'Fastify',
      'nest': 'NestJS',
      'electron': 'Electron',
      'jest': 'Jest',
      'vitest': 'Vitest',
      'cypress': 'Cypress',
      'playwright': 'Playwright'
    };
    
    for (const [dep, framework] of Object.entries(frameworkMap)) {
      if (dependencies && Object.keys(dependencies).some(d => d.includes(dep))) {
        frameworks.push(framework);
      }
    }
    
    // Framework detection based on file patterns
    if (Object.keys(files).some(f => f.endsWith('.tsx') || f.endsWith('.jsx'))) {
      if (!frameworks.includes('React')) frameworks.push('React');
    }
    
    if (Object.keys(files).some(f => f.endsWith('.vue'))) {
      if (!frameworks.includes('Vue.js')) frameworks.push('Vue.js');
    }
    
    return frameworks;
  }

  private analyzeStructure(files: Record<string, ProjectFile>): ProjectIndex['structure'] {
    const directories = new Set<string>();
    const mainFiles: string[] = [];
    const entryPoints: string[] = [];
    const configFiles: string[] = [];
    const testDirectories = new Set<string>();
    const buildOutputs: string[] = [];
    
    for (const file of Object.values(files)) {
      // Add directory
      const dir = dirname(file.relativePath);
      if (dir !== '.') {
        directories.add(dir);
      }
      
      // Identify special files
      const name = basename(file.relativePath).toLowerCase();
      
      if (['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'].includes(name)) {
        mainFiles.push(file.relativePath);
      }
      
      if (name.startsWith('index.') || name === 'main.ts' || name === 'main.js') {
        entryPoints.push(file.relativePath);
      }
      
      if (file.type === 'config') {
        configFiles.push(file.relativePath);
      }
      
      if (file.type === 'test') {
        testDirectories.add(dirname(file.relativePath));
      }
      
      if (file.type === 'build') {
        buildOutputs.push(file.relativePath);
      }
    }
    
    return {
      directories: Array.from(directories).sort(),
      mainFiles,
      entryPoints,
      configFiles,
      testDirectories: Array.from(testDirectories).sort(),
      buildOutputs
    };
  }

  private buildSearchIndices(files: Record<string, ProjectFile>): ProjectIndex['searchIndex'] {
    const fileArray = Object.values(files);
    
    // Build Lunr index for full-text search
    const lunrIndex = lunr(function() {
      this.ref('relativePath');
      this.field('relativePath');
      this.field('language');
      this.field('type');
      this.field('exports');
      this.field('imports');
      
      fileArray.forEach(file => {
        this.add({
          relativePath: file.relativePath,
          language: file.language,
          type: file.type,
          exports: file.exports?.join(' ') || '',
          imports: file.imports?.join(' ') || ''
        });
      });
    });
    
    // Build Fuse.js index for fuzzy search
    const fuseIndex = new Fuse(fileArray, {
      keys: [
        'relativePath',
        'language',
        'type',
        'exports',
        'imports'
      ],
      threshold: 0.3,
      includeScore: true
    });
    
    return {
      lunr: lunrIndex,
      fuse: fuseIndex
    };
  }

  private async performAnalysis(files: Record<string, ProjectFile>, documentation: Record<string, DocumentationFile>): Promise<ProjectIndex['analysis']> {
    const fileArray = Object.values(files);
    
    // Complexity analysis
    const complexities = fileArray
      .filter(f => f.complexity)
      .map(f => ({ file: f.relativePath, complexity: f.complexity! }));
    
    const totalComplexity = complexities.reduce((sum, c) => sum + c.complexity, 0);
    const averageComplexity = complexities.length > 0 ? totalComplexity / complexities.length : 0;
    const highestComplexity = complexities
      .sort((a, b) => b.complexity - a.complexity)
      .slice(0, 10);
    
    // Dependency analysis
    const allDependencies = new Set<string>();
    const internalDeps = new Set<string>();
    const externalDeps = new Set<string>();
    
    for (const file of fileArray) {
      if (file.dependencies) {
        for (const dep of file.dependencies) {
          allDependencies.add(dep);
          if (dep.startsWith('.') || dep.startsWith('/')) {
            internalDeps.add(dep);
          } else {
            externalDeps.add(dep);
          }
        }
      }
    }
    
    // Coverage analysis
    const sourceFiles = fileArray.filter(f => f.type === 'source');
    const documentedFiles = Object.values(documentation).length;
    const testedFiles = fileArray.filter(f => f.type === 'test').length;
    
    // Quality scoring
    let qualityScore = 0;
    qualityScore += Math.min(documentedFiles / Math.max(sourceFiles.length, 1) * 30, 30); // 30% for docs
    qualityScore += Math.min(testedFiles / Math.max(sourceFiles.length, 1) * 40, 40); // 40% for tests
    qualityScore += Math.min((1 - averageComplexity / 50) * 20, 20); // 20% for low complexity
    qualityScore += 10; // 10% baseline
    
    return {
      complexity: {
        total: totalComplexity,
        average: averageComplexity,
        highest: highestComplexity
      },
      dependencies: {
        internal: Array.from(internalDeps),
        external: Array.from(externalDeps),
        circular: [] // TODO: Implement circular dependency detection
      },
      coverage: {
        documented: documentedFiles,
        tested: testedFiles,
        total: sourceFiles.length
      },
      patterns: {
        frameworksDetected: [], // TODO: Implement pattern detection
        architecturePattern: this.detectArchitecturePattern(files),
        qualityScore: Math.round(qualityScore)
      }
    };
  }

  private detectArchitecturePattern(files: Record<string, ProjectFile>): string {
    const paths = Object.keys(files);
    
    if (paths.some(p => p.includes('src/components') && p.includes('src/pages'))) {
      return 'Component-Based (React/Vue)';
    }
    
    if (paths.some(p => p.includes('src/controllers') && p.includes('src/models'))) {
      return 'MVC (Model-View-Controller)';
    }
    
    if (paths.some(p => p.includes('src/services') && p.includes('src/repositories'))) {
      return 'Service-Repository Pattern';
    }
    
    if (paths.some(p => p.includes('src/modules') || p.includes('src/features'))) {
      return 'Feature-Based Modules';
    }
    
    if (paths.some(p => p.includes('lib/') || p.includes('packages/'))) {
      return 'Monorepo/Multi-package';
    }
    
    return 'Custom/Unknown';
  }

  private loadGitignore(): ReturnType<typeof ignore> {
    const ig = ignore();
    const gitignorePath = join(this.rootPath, '.gitignore');
    
    if (existsSync(gitignorePath)) {
      const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
      ig.add(gitignoreContent);
    }
    
    // Add common patterns
    ig.add([
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '__pycache__',
      '*.pyc',
      '.pytest_cache',
      'target',
      'vendor'
    ]);
    
    return ig;
  }
}

// Utility function for external use
export async function indexProject(rootPath: string = process.cwd()): Promise<ProjectIndex> {
  const indexer = new EnhancedStartupIndexer(rootPath);
  return await indexer.indexProject();
}
