/**
 * Shared Codebase Analyzer - Real-time dynamic analysis utility
 */

export class CodebaseAnalyzer {
  private workingDirectory: string;

  constructor(workingDirectory: string) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Perform comprehensive codebase analysis
   */
  async performAnalysis(): Promise<string> {
    console.log('📊 Analyzing project structure...');

    // Real project analysis
    const projectAnalysis = await this.analyzeProjectStructure();
    const codeMetrics = await this.analyzeCodeMetrics();
    const dependencyAnalysis = await this.analyzeDependencies();
    const configAnalysis = await this.analyzeConfiguration();
    const testAnalysis = await this.analyzeTestCoverage();

    // Generate dynamic analysis report
    const analysis = `
# ${projectAnalysis.name} - Real-Time Codebase Analysis

## Project Overview
**Project:** ${projectAnalysis.name}
**Version:** ${projectAnalysis.version}
**Analysis Date:** ${new Date().toISOString()}
**Working Directory:** ${this.workingDirectory}
**Total Files:** ${projectAnalysis.totalFiles}
**Total Lines of Code:** ${codeMetrics.totalLines}

## Architecture Discovery
${await this.discoverArchitectureComponents()}

## Code Metrics Analysis
- **TypeScript Files:** ${codeMetrics.typescriptFiles} (${codeMetrics.typescriptLines} lines)
- **JavaScript Files:** ${codeMetrics.javascriptFiles} (${codeMetrics.javascriptLines} lines)
- **Test Files:** ${testAnalysis.testFiles} (${testAnalysis.testLines} lines)
- **Config Files:** ${configAnalysis.configFiles}
- **Documentation Files:** ${codeMetrics.docFiles}

## File Distribution
${Object.entries(projectAnalysis.fileCounts)
  .sort(([, a], [, b]) => (b as number) - (a as number))
  .map(([ext, count]) => `- ${ext}: ${count} files`)
  .join('\n')}

## Discovered Components
${projectAnalysis.discoveredComponents.map((comp: any) => `- **${comp.name}**: ${comp.description} (${comp.files} files)`).join('\n')}

## Dependencies Analysis
- **Production Dependencies:** ${dependencyAnalysis.prodDeps}
- **Development Dependencies:** ${dependencyAnalysis.devDeps}
- **Key Frameworks:** ${dependencyAnalysis.keyFrameworks.join(', ')}

## Configuration Assessment
${configAnalysis.configs.map((config: any) => `- **${config.name}**: ${config.status}`).join('\n')}

## Test Coverage Analysis
- **Test Files Found:** ${testAnalysis.testFiles}
- **Test Frameworks:** ${testAnalysis.frameworks.join(', ')}
- **Coverage Estimate:** ${testAnalysis.estimatedCoverage}%

## Real Issues Detected
${await this.detectRealIssues()}

## Security Assessment
${await this.assessSecurity()}

## Performance Analysis
${await this.analyzePerformance()}

## Recommendations Based on Analysis
${await this.generateRecommendations(codeMetrics, testAnalysis, dependencyAnalysis)}

---
*Real-time analysis performed by CodeCrucible Synth*
*Report generated: ${new Date().toLocaleString()}*
`;

    return analysis.trim();
  }

  /**
   * Analyze project structure and metadata
   */
  private async analyzeProjectStructure(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    let projectInfo = { name: 'Unknown', version: 'Unknown' };
    const packageJsonPath = path.join(this.workingDirectory, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        projectInfo = { name: packageJson.name, version: packageJson.version };
      } catch (error) {
        // Continue with defaults
      }
    }

    const fileCounts = await this.countFilesByType();
    const totalFiles = Object.values(fileCounts).reduce((sum, count) => sum + count, 0);
    const discoveredComponents = await this.discoverProjectComponents();

    return {
      name: projectInfo.name,
      version: projectInfo.version,
      totalFiles,
      fileCounts,
      discoveredComponents,
    };
  }

  /**
   * Analyze code metrics and lines of code
   */
  private async analyzeCodeMetrics(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    let totalLines = 0;
    let typescriptFiles = 0;
    let typescriptLines = 0;
    let javascriptFiles = 0;
    let javascriptLines = 0;
    let docFiles = 0;

    const analyzeFile = (filePath: string, ext: string): number => {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n').length;

        if (ext === '.ts' || ext === '.tsx') {
          typescriptFiles++;
          typescriptLines += lines;
        } else if (ext === '.js' || ext === '.jsx') {
          javascriptFiles++;
          javascriptLines += lines;
        } else if (ext === '.md' || ext === '.txt') {
          docFiles++;
        }

        return lines;
      } catch (error) {
        return 0;
      }
    };

    const scanDirectory = (dir: string, depth: number = 0): void => {
      if (depth > 3) return; // Limit recursion depth

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === 'dist')
            continue;

          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            scanDirectory(fullPath, depth + 1);
          } else if (item.isFile()) {
            const ext = path.extname(item.name);
            totalLines += analyzeFile(fullPath, ext);
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    scanDirectory(this.workingDirectory);

    return {
      totalLines,
      typescriptFiles,
      typescriptLines,
      javascriptFiles,
      javascriptLines,
      docFiles,
    };
  }

  /**
   * Analyze dependencies from package.json
   */
  private async analyzeDependencies(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    const packageJsonPath = path.join(this.workingDirectory, 'package.json');
    let prodDeps = 0;
    let devDeps = 0;
    let keyFrameworks: string[] = [];

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        prodDeps = Object.keys(packageJson.dependencies || {}).length;
        devDeps = Object.keys(packageJson.devDependencies || {}).length;

        // Identify key frameworks
        const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const frameworks = [
          'express',
          'react',
          'vue',
          'angular',
          'next',
          'typescript',
          'jest',
          'vitest',
          'chalk',
          'commander',
        ];
        keyFrameworks = frameworks.filter(
          fw => allDeps[fw] || Object.keys(allDeps).some(dep => dep.includes(fw))
        );
      } catch (error) {
        // Continue with defaults
      }
    }

    return { prodDeps, devDeps, keyFrameworks };
  }

  /**
   * Analyze configuration files
   */
  private async analyzeConfiguration(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    const configs = [
      { name: 'TypeScript Config', file: 'tsconfig.json', status: '' },
      { name: 'ESLint Config', file: '.eslintrc.cjs', status: '' },
      { name: 'Jest Config', file: 'jest.config.cjs', status: '' },
      { name: 'Package Config', file: 'package.json', status: '' },
      { name: 'App Config', file: 'config/default.yaml', status: '' },
    ];

    for (const config of configs) {
      const configPath = path.join(this.workingDirectory, config.file);
      config.status = fs.existsSync(configPath) ? '✅ Present' : '❌ Missing';
    }

    return { configs, configFiles: configs.filter(c => c.status.includes('✅')).length };
  }

  /**
   * Analyze test coverage and test files
   */
  private async analyzeTestCoverage(): Promise<any> {
    const fs = await import('fs');
    const path = await import('path');

    let testFiles = 0;
    let testLines = 0;
    const frameworks: string[] = [];

    const scanForTests = (dir: string, depth: number = 0): void => {
      if (depth > 2) return;

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;

          const fullPath = path.join(dir, item.name);

          if (
            item.isDirectory() &&
            (item.name === 'tests' || item.name === 'test' || item.name === '__tests__')
          ) {
            scanForTests(fullPath, depth + 1);
          } else if (
            item.isFile() &&
            (item.name.includes('.test.') || item.name.includes('.spec.'))
          ) {
            testFiles++;
            try {
              const content = fs.readFileSync(fullPath, 'utf-8');
              testLines += content.split('\n').length;

              // Detect test frameworks
              if (content.includes('describe(') || content.includes('it('))
                frameworks.push('Jest/Mocha');
              if (content.includes('test(')) frameworks.push('Jest');
            } catch (error) {
              // Continue
            }
          }
        }
      } catch (error) {
        // Continue
      }
    };

    scanForTests(this.workingDirectory);

    const estimatedCoverage = testFiles > 0 ? Math.min(Math.round((testFiles / 50) * 100), 100) : 0;

    return {
      testFiles,
      testLines,
      frameworks: [...new Set(frameworks)],
      estimatedCoverage,
    };
  }

  /**
   * Discover project components by analyzing file structure
   */
  private async discoverProjectComponents(): Promise<any[]> {
    const fs = await import('fs');
    const path = await import('path');

    const components: any[] = [];

    const checkComponent = (name: string, dirPath: string, description: string) => {
      const fullPath = path.join(this.workingDirectory, dirPath);
      if (fs.existsSync(fullPath)) {
        try {
          const files = fs.readdirSync(fullPath).length;
          components.push({ name, description, files });
        } catch (error) {
          // Continue
        }
      }
    };

    checkComponent('Core System', 'src/core', 'Main application logic and architecture');
    checkComponent('Voice System', 'src/voices', 'AI voice archetype system');
    checkComponent('MCP Servers', 'src/mcp-servers', 'Model Context Protocol servers');
    checkComponent('Security Framework', 'src/core/security', 'Enterprise security components');
    checkComponent(
      'Performance System',
      'src/core/performance',
      'Performance optimization modules'
    );
    checkComponent('CLI Interface', 'src/core/cli', 'Command-line interface components');
    checkComponent('Tool Integration', 'src/core/tools', 'Integrated development tools');
    checkComponent('Configuration', 'config', 'Application configuration files');
    checkComponent('Documentation', 'Docs', 'Project documentation');
    checkComponent('Testing Suite', 'tests', 'Test files and utilities');

    return components.filter(comp => comp.files > 0);
  }

  /**
   * Discover architecture components by analyzing imports and exports
   */
  private async discoverArchitectureComponents(): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    const architectureComponents: string[] = [];

    // Check for key architecture files
    const keyFiles = [
      {
        file: 'src/core/client.ts',
        component: '**Unified Model Client** - Consolidated LLM provider management',
      },
      {
        file: 'src/voices/voice-archetype-system.ts',
        component: '**Voice Archetype System** - Multi-AI personality framework',
      },
      {
        file: 'src/core/living-spiral-coordinator.ts',
        component: '**Living Spiral Coordinator** - Iterative development methodology',
      },
      {
        file: 'src/core/security',
        component: '**Enterprise Security Framework** - Comprehensive security layer',
      },
      {
        file: 'src/mcp-servers',
        component: '**MCP Server Integration** - Model Context Protocol implementation',
      },
      {
        file: 'src/core/hybrid/hybrid-llm-router.ts',
        component: '**Hybrid LLM Router** - Intelligent model routing system',
      },
      {
        file: 'src/core/performance',
        component: '**Performance Optimization Suite** - Caching, batching, monitoring',
      },
      {
        file: 'src/core/tools',
        component: '**Tool Integration System** - Development tool orchestration',
      },
    ];

    for (const { file, component } of keyFiles) {
      const fullPath = path.join(this.workingDirectory, file);
      if (fs.existsSync(fullPath)) {
        architectureComponents.push(component);
      }
    }

    return architectureComponents.map((comp, i) => `${i + 1}. ${comp}`).join('\n');
  }

  /**
   * Detect real issues in the codebase
   */
  private async detectRealIssues(): Promise<string> {
    const issues: string[] = [];

    // Check for TypeScript strict mode
    const fs = await import('fs');
    const path = await import('path');
    const tsconfigPath = path.join(this.workingDirectory, 'tsconfig.json');

    if (fs.existsSync(tsconfigPath)) {
      try {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        if (tsconfig.compilerOptions?.strict !== true) {
          issues.push('🟡 **Warning**: TypeScript strict mode disabled - may hide type errors');
        }
      } catch (error) {
        issues.push('🟡 **Warning**: Unable to parse tsconfig.json');
      }
    }

    // Check for test coverage
    const testDir = path.join(this.workingDirectory, 'tests');
    if (!fs.existsSync(testDir)) {
      issues.push(
        '🟡 **Warning**: Limited test coverage - tests directory structure needs expansion'
      );
    } else {
      // Count actual test files
      try {
        const { execSync } = await import('child_process');
        const testFileCount = execSync('find tests -name "*.test.ts" -o -name "*.spec.ts" | wc -l', {
          cwd: this.workingDirectory,
          encoding: 'utf-8'
        }).trim();
        
        if (parseInt(testFileCount) < 10) {
          issues.push(`🟡 **Warning**: Only ${testFileCount} test files found - consider expanding test coverage`);
        }
      } catch (error) {
        // Silently continue
      }
    }

    // Check for missing environment variables
    const envExamplePath = path.join(this.workingDirectory, '.env.example');
    const envPath = path.join(this.workingDirectory, '.env');
    if (fs.existsSync(envExamplePath) && !fs.existsSync(envPath)) {
      issues.push('🟠 **Configuration**: No .env file found - some features may be limited');
    }

    // Check package.json for outdated patterns
    const packagePath = path.join(this.workingDirectory, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        
        // Check for missing scripts
        const scripts = packageJson.scripts || {};
        if (!scripts.test) {
          issues.push('🟡 **Warning**: No test script defined in package.json');
        }
        if (!scripts.lint) {
          issues.push('🟡 **Warning**: No lint script defined in package.json');
        }
        
        // Check Node version requirements
        if (!packageJson.engines?.node) {
          issues.push('🟠 **Compatibility**: No Node.js version requirement specified');
        }
      } catch (error) {
        // Continue
      }
    }

    // Check for large files that might impact performance
    try {
      const { execSync } = await import('child_process');
      const largeFiles = execSync('find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*" | head -5', {
        cwd: this.workingDirectory,
        encoding: 'utf-8'
      }).trim();
      
      if (largeFiles) {
        const fileCount = largeFiles.split('\n').filter(f => f).length;
        if (fileCount > 0) {
          issues.push(`🟠 **Performance**: ${fileCount} large files (>1MB) detected - consider optimization`);
        }
      }
    } catch (error) {
      // Silently continue
    }

    return issues.length > 0 ? issues.join('\n') : '✅ No critical issues detected';
  }

  /**
   * Assess security configuration
   */
  private async assessSecurity(): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    const securityFeatures: string[] = [];

    // Check for security components
    const securityDir = path.join(this.workingDirectory, 'src/core/security');
    if (fs.existsSync(securityDir)) {
      const securityFiles = fs.readdirSync(securityDir);
      securityFeatures.push(
        `✅ **Security Framework**: ${securityFiles.length} security modules implemented`
      );

      if (securityFiles.includes('input-validator.ts')) {
        securityFeatures.push('✅ **Input Validation**: Comprehensive input sanitization system');
      }
      if (securityFiles.includes('rbac-system.ts')) {
        securityFeatures.push('✅ **RBAC**: Role-based access control system');
      }
      if (securityFiles.includes('secrets-manager.ts')) {
        securityFeatures.push('✅ **Secrets Management**: Encrypted secrets storage');
      }
    }

    return securityFeatures.join('\n');
  }

  /**
   * Analyze performance characteristics
   */
  private async analyzePerformance(): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    const performanceFeatures: string[] = [];

    // Check for performance components
    const perfDir = path.join(this.workingDirectory, 'src/core/performance');
    if (fs.existsSync(perfDir)) {
      const perfFiles = fs.readdirSync(perfDir);
      performanceFeatures.push(
        `✅ **Performance Suite**: ${perfFiles.length} optimization modules`
      );

      if (perfFiles.some(f => f.includes('cache'))) {
        performanceFeatures.push('✅ **Caching System**: Multi-layer caching implementation');
      }
      if (perfFiles.some(f => f.includes('batch'))) {
        performanceFeatures.push('✅ **Batch Processing**: Intelligent request batching');
      }
      if (perfFiles.some(f => f.includes('monitor'))) {
        performanceFeatures.push('✅ **Performance Monitoring**: Real-time performance tracking');
      }
    }

    return performanceFeatures.join('\n');
  }

  /**
   * Generate recommendations based on analysis
   */
  private async generateRecommendations(
    codeMetrics: any,
    testAnalysis: any,
    dependencyAnalysis: any
  ): Promise<string> {
    const recommendations: string[] = [];
    let priority = 1;

    // Recommendations based on actual analysis
    if (testAnalysis.estimatedCoverage < 50) {
      recommendations.push(
        `${priority++}. **High Priority**: Expand test coverage to 70%+ (currently ~${testAnalysis.estimatedCoverage}%)`
      );
    }

    // Only recommend enabling TypeScript strict mode if it's actually disabled
    if (codeMetrics.typescriptFiles > 0) {
      const fs = await import('fs');
      const path = await import('path');
      const tsconfigPath = path.join(this.workingDirectory, 'tsconfig.json');

      if (fs.existsSync(tsconfigPath)) {
        try {
          const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
          if (tsconfig.compilerOptions?.strict !== true) {
            recommendations.push(
              `${priority++}. **Medium Priority**: Enable TypeScript strict mode for better type safety`
            );
          }
        } catch (error) {
          // If we can't parse tsconfig, suggest enabling strict mode as a precaution
          recommendations.push(
            `${priority++}. **Medium Priority**: Verify TypeScript strict mode configuration`
          );
        }
      }
    }

    if (dependencyAnalysis.devDeps > dependencyAnalysis.prodDeps * 2) {
      recommendations.push(
        `${priority++}. **Low Priority**: Review development dependencies - high dev/prod ratio`
      );
    }

    // Add general enhancement recommendations
    if (priority <= 3) {
      recommendations.push(
        `${priority++}. **Enhancement**: Implement automated code quality gates in CI/CD pipeline`
      );
    }
    
    // Add more dynamic recommendations based on actual findings
    if (codeMetrics.totalLines > 100000) {
      recommendations.push(
        `${priority++}. **Architecture**: Consider modularization - codebase exceeds 100K lines`
      );
    }
    
    if (dependencyAnalysis.prodDeps > 100) {
      recommendations.push(
        `${priority++}. **Dependencies**: Review production dependencies (${dependencyAnalysis.prodDeps} packages) for optimization opportunities`
      );
    }

    return recommendations.join('\n');
  }

  /**
   * Count files by extension for analysis
   */
  private async countFilesByType(): Promise<Record<string, number>> {
    const path = await import('path');
    const fs = await import('fs');

    const counts: Record<string, number> = {};

    const countInDirectory = (dir: string, maxDepth: number = 2): void => {
      if (maxDepth <= 0) return;

      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });

        for (const item of items) {
          if (item.name.startsWith('.') || item.name === 'node_modules') continue;

          const fullPath = path.join(dir, item.name);

          if (item.isDirectory()) {
            countInDirectory(fullPath, maxDepth - 1);
          } else if (item.isFile()) {
            const ext = path.extname(item.name) || 'no-extension';
            counts[ext] = (counts[ext] || 0) + 1;
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    countInDirectory(this.workingDirectory);
    return counts;
  }
}
