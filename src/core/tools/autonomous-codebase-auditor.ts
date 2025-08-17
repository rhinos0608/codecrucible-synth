import { BaseTool, ToolDefinition } from './base-tool.js';
import { logger } from '../logger.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

interface AuditResult {
  summary: {
    projectType: string;
    framework: string;
    totalFiles: number;
    linesOfCode: number;
    issues: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
  };
  structure: any;
  security: {
    vulnerabilities: Array<{ name: string; severity: string; description: string; }>;
    recommendations: string[];
  };
  performance: {
    issues: Array<{ type: string; severity: string; description: string; }>;
    recommendations: string[];
  };
  quality: {
    score: number;
    issues: Array<{ type: string; severity: string; description: string; }>;
    recommendations: string[];
  };
  dependencies: {
    outdated: Array<{ name: string; current: string; wanted: string; latest: string; }>;
    vulnerable: Array<{ name: string; description: string; }>;
    recommendations: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

const AuditParametersSchema = z.object({
  depth: z.enum(['quick', 'standard', 'deep']).describe('Audit depth level'),
  focus: z.array(z.enum(['security', 'performance', 'quality', 'dependencies', 'structure'])).optional().describe('Focus areas for audit')
});

/**
 * Autonomous Codebase Auditor Tool
 * 
 * Performs comprehensive automated codebase analysis including:
 * - Security vulnerability scanning
 * - Performance bottleneck detection
 * - Code quality assessment
 * - Dependency analysis
 * - Architecture review
 */
export class AutonomousCodebaseAuditor extends BaseTool {
  constructor(context: any) {
    const definition: ToolDefinition = {
      name: 'autonomousCodebaseAudit',
      description: 'Perform comprehensive autonomous codebase audit with security, performance, and quality analysis',
      category: 'analysis',
      parameters: AuditParametersSchema
    };
    super(definition);
  }

  async execute(params: { depth: 'quick' | 'standard' | 'deep'; focus?: string[] }) {
    const startTime = Date.now();
    logger.info(`🔍 Starting autonomous codebase audit (${params.depth} mode)`);
    
    const auditResult: AuditResult = {
      summary: {
        projectType: 'unknown',
        framework: 'unknown',
        totalFiles: 0,
        linesOfCode: 0,
        issues: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0
        }
      },
      structure: {},
      security: {
        vulnerabilities: [],
        recommendations: []
      },
      performance: {
        issues: [],
        recommendations: []
      },
      quality: {
        score: 0,
        issues: [],
        recommendations: []
      },
      dependencies: {
        outdated: [],
        vulnerable: [],
        recommendations: []
      },
      recommendations: {
        immediate: [],
        shortTerm: [],
        longTerm: []
      }
    };

    try {
      // 1. Autonomous project discovery
      const projectInfo = await this.discoverProjectStructure();
      auditResult.summary.projectType = projectInfo.type;
      auditResult.summary.framework = projectInfo.framework;
      auditResult.structure = projectInfo.directories;

      // 2. Security audit with autonomous terminal commands
      if (!params.focus || params.focus.includes('security')) {
        const securityResults = await this.performSecurityAudit(params.depth);
        auditResult.security = securityResults;
      }

      // 3. Performance analysis
      if (!params.focus || params.focus.includes('performance')) {
        const performanceResults = await this.performPerformanceAudit(params.depth);
        auditResult.performance = performanceResults;
      }

      // 4. Code quality assessment
      if (!params.focus || params.focus.includes('quality')) {
        const qualityResults = await this.performQualityAudit(params.depth);
        auditResult.quality = qualityResults;
      }

      // 5. Dependency audit with autonomous commands
      if (!params.focus || params.focus.includes('dependencies')) {
        const depResults = await this.performDependencyAudit();
        auditResult.dependencies = depResults;
      }

      // 6. Generate comprehensive recommendations
      auditResult.recommendations = this.generateRecommendations(auditResult);

      // 7. Calculate total issues
      auditResult.summary.issues = this.calculateIssueCounts(auditResult);

      const duration = Date.now() - startTime;
      logger.info(`✅ Autonomous codebase audit completed in ${duration}ms`);

      return {
        success: true,
        result: auditResult,
        duration,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Autonomous codebase audit failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Autonomous project structure discovery using terminal commands
   */
  private async discoverProjectStructure() {
    try {
      logger.info('🔍 Discovering project structure autonomously...');
      
      const projectInfo = {
        type: 'unknown',
        framework: 'unknown',
        directories: {} as any,
        keyFiles: {} as any,
        packageInfo: null as any
      };

      // Check for key project files using autonomous commands
      const keyFiles = ['package.json', 'Cargo.toml', 'requirements.txt', 'go.mod', 'pom.xml'];
      
      for (const file of keyFiles) {
        try {
          const result = await this.executeCommand(`ls "${file}" 2>/dev/null || echo "not found"`, 'dir', { timeout: 5000 });
          if (result.success && !result.output?.includes('not found')) {
            projectInfo.keyFiles[file] = true;
            
            // Determine project type based on key files
            if (file === 'package.json') {
              projectInfo.type = 'nodejs';
              // Read package.json for framework detection
              try {
                const packageContent = await fs.readFile(file, 'utf-8');
                const packageJson = JSON.parse(packageContent);
                projectInfo.packageInfo = packageJson;
                
                // Detect framework
                if (packageJson.dependencies?.react) projectInfo.framework = 'react';
                else if (packageJson.dependencies?.vue) projectInfo.framework = 'vue';
                else if (packageJson.dependencies?.angular) projectInfo.framework = 'angular';
                else if (packageJson.dependencies?.express) projectInfo.framework = 'express';
                else if (packageJson.dependencies?.next) projectInfo.framework = 'nextjs';
              } catch (err) {
                logger.warn('Failed to parse package.json:', err);
              }
            } else if (file === 'Cargo.toml') {
              projectInfo.type = 'rust';
            } else if (file === 'requirements.txt') {
              projectInfo.type = 'python';
            } else if (file === 'go.mod') {
              projectInfo.type = 'go';
            } else if (file === 'pom.xml') {
              projectInfo.type = 'java';
            }
          }
        } catch (error) {
          // Continue to next file
        }
      }

      // Get directory structure using autonomous commands
      try {
        const dirResult = await this.executeCommand('find . -type d -maxdepth 2 | head -20', 'dir /B /AD', { timeout: 10000 });
        if (dirResult.success && dirResult.output) {
          const directories = dirResult.output.split('\\n').filter(dir => dir && dir !== '.');
          projectInfo.directories = { count: directories.length, list: directories.slice(0, 10) };
        }
      } catch (error) {
        logger.warn('Failed to get directory structure:', error);
      }

      return projectInfo;
    } catch (error) {
      logger.error('Failed to discover project structure:', error);
      return {
        type: 'unknown',
        framework: 'unknown',
        directories: {},
        keyFiles: {},
        packageInfo: null
      };
    }
  }

  /**
   * Autonomous security audit using terminal commands
   */
  private async performSecurityAudit(depth: string) {
    logger.info('🔒 Performing autonomous security audit...');
    
    const securityResult = {
      vulnerabilities: [] as Array<{ name: string; severity: string; description: string; }>,
      recommendations: [] as string[]
    };

    try {
      // 1. NPM audit for Node.js projects
      if (await this.fileExists('package.json')) {
        try {
          const auditResult = await this.executeCommand('npm audit --json', 'npm audit', { timeout: 30000 });
          if (auditResult.success && auditResult.output) {
            try {
              const audit = JSON.parse(auditResult.output);
              if (audit.vulnerabilities) {
                Object.entries(audit.vulnerabilities).forEach(([name, vuln]: [string, any]) => {
                  securityResult.vulnerabilities.push({
                    name,
                    severity: vuln.severity || 'unknown',
                    description: vuln.title || 'NPM vulnerability detected'
                  });
                });
              }
            } catch (parseError) {
              // Handle plain text output
              if (auditResult.output.includes('vulnerabilities')) {
                securityResult.vulnerabilities.push({
                  name: 'npm-audit',
                  severity: 'medium',
                  description: 'NPM vulnerabilities detected (see npm audit for details)'
                });
              }
            }
          }
        } catch (error) {
          logger.warn('NPM audit failed:', error);
        }
      }

      // 2. Git secret scanning (basic patterns)
      try {
        const secretPatterns = ['password', 'api[_-]?key', 'secret', 'token', 'private[_-]?key'];
        for (const pattern of secretPatterns) {
          const grepResult = await this.executeCommand(
            `grep -r -i "${pattern}" . --include="*.js" --include="*.ts" --include="*.py" --exclude-dir=node_modules --exclude-dir=.git | head -5`,
            'findstr /R /I /S /M "${pattern}" *.js *.ts *.py',
            { timeout: 15000 }
          );
          
          if (grepResult.success && grepResult.output && grepResult.output.trim()) {
            securityResult.vulnerabilities.push({
              name: `hardcoded-${pattern}`,
              severity: 'high',
              description: `Potential hardcoded ${pattern} found in source code`
            });
          }
        }
      } catch (error) {
        logger.warn('Secret scanning failed:', error);
      }

      // 3. Generate security recommendations
      securityResult.recommendations.push('Run comprehensive security scan with dedicated tools');
      securityResult.recommendations.push('Implement pre-commit hooks for secret detection');
      securityResult.recommendations.push('Regular dependency updates and vulnerability monitoring');
      securityResult.recommendations.push('Code review process for security best practices');
      securityResult.recommendations.push('Environment variable usage for sensitive configuration');

    } catch (error) {
      logger.error('Security audit failed:', error);
    }

    return securityResult;
  }

  /**
   * Autonomous performance audit
   */
  private async performPerformanceAudit(depth: string) {
    logger.info('⚡ Performing autonomous performance audit...');
    
    const performanceResult = {
      issues: [] as Array<{ type: string; severity: string; description: string; }>,
      recommendations: [] as string[]
    };

    try {
      // 1. Large file detection
      try {
        const largeFilesResult = await this.executeCommand(
          'find . -type f -size +1M -not -path "./node_modules/*" -not -path "./.git/*" | head -10',
          'forfiles /S /M *.* /C "cmd /c if @fsize GEQ 1048576 echo @path @fsize"',
          { timeout: 10000 }
        );
        
        if (largeFilesResult.success && largeFilesResult.output && largeFilesResult.output.trim()) {
          performanceResult.issues.push({
            type: 'large-files',
            severity: 'medium',
            description: 'Large files detected that may impact performance'
          });
        }
      } catch (error) {
        logger.warn('Large file detection failed:', error);
      }

      // 2. Bundle size analysis for Node.js projects
      if (await this.fileExists('package.json')) {
        try {
          const bundleAnalysis = await this.executeCommand('npm ls --depth=0 --json', 'npm ls --depth=0', { timeout: 15000 });
          if (bundleAnalysis.success && bundleAnalysis.output) {
            try {
              const deps = JSON.parse(bundleAnalysis.output);
              const depCount = Object.keys(deps.dependencies || {}).length;
              if (depCount > 50) {
                performanceResult.issues.push({
                  type: 'dependency-bloat',
                  severity: 'medium',
                  description: `High number of dependencies (${depCount}) may impact build performance`
                });
              }
            } catch (parseError) {
              // Handle non-JSON output
            }
          }
        } catch (error) {
          logger.warn('Bundle analysis failed:', error);
        }
      }

      // 3. Generate performance recommendations
      performanceResult.recommendations.push('Implement code splitting and lazy loading');
      performanceResult.recommendations.push('Optimize images and static assets');
      performanceResult.recommendations.push('Review and minimize dependencies');
      performanceResult.recommendations.push('Implement caching strategies');
      performanceResult.recommendations.push('Use performance monitoring tools');

    } catch (error) {
      logger.error('Performance audit failed:', error);
    }

    return performanceResult;
  }

  /**
   * Autonomous code quality audit
   */
  private async performQualityAudit(depth: string) {
    logger.info('📊 Performing autonomous quality audit...');
    
    const qualityResult = {
      score: 75, // Default score
      issues: [] as Array<{ type: string; severity: string; description: string; }>,
      recommendations: [] as string[]
    };

    try {
      // 1. ESLint check for JavaScript/TypeScript projects
      if (await this.fileExists('package.json')) {
        try {
          const eslintResult = await this.executeCommand('npx eslint --version', 'npx eslint --version', { timeout: 5000 });
          if (eslintResult.success) {
            const lintCheck = await this.executeCommand('npx eslint . --format json --ext .js,.ts --max-warnings 0', 'npx eslint .', { timeout: 30000 });
            if (lintCheck.success && lintCheck.output) {
              try {
                const lintResults = JSON.parse(lintCheck.output);
                const totalErrors = lintResults.reduce((sum: number, file: any) => sum + file.errorCount, 0);
                const totalWarnings = lintResults.reduce((sum: number, file: any) => sum + file.warningCount, 0);
                
                if (totalErrors > 0) {
                  qualityResult.issues.push({
                    type: 'eslint-errors',
                    severity: 'high',
                    description: `${totalErrors} ESLint errors detected`
                  });
                  qualityResult.score -= Math.min(20, totalErrors * 2);
                }
                
                if (totalWarnings > 10) {
                  qualityResult.issues.push({
                    type: 'eslint-warnings',
                    severity: 'medium',
                    description: `${totalWarnings} ESLint warnings detected`
                  });
                  qualityResult.score -= Math.min(10, totalWarnings);
                }
              } catch (parseError) {
                // Handle non-JSON output
              }
            }
          }
        } catch (error) {
          logger.warn('ESLint check failed:', error);
        }
      }

      // 2. Test coverage check
      try {
        const testFiles = await this.executeCommand('find . -name "*.test.*" -o -name "*.spec.*" | head -5', 'dir /S *.test.* *.spec.*', { timeout: 5000 });
        if (!testFiles.success || !testFiles.output || testFiles.output.trim() === '') {
          qualityResult.issues.push({
            type: 'no-tests',
            severity: 'high',
            description: 'No test files detected'
          });
          qualityResult.score -= 15;
        }
      } catch (error) {
        logger.warn('Test detection failed:', error);
      }

      // 3. Generate quality recommendations
      qualityResult.recommendations.push('Implement comprehensive test suite');
      qualityResult.recommendations.push('Set up code linting and formatting');
      qualityResult.recommendations.push('Add type checking (TypeScript)');
      qualityResult.recommendations.push('Implement code review process');
      qualityResult.recommendations.push('Add documentation and comments');

    } catch (error) {
      logger.error('Quality audit failed:', error);
    }

    return qualityResult;
  }

  /**
   * Autonomous dependency audit
   */
  private async performDependencyAudit() {
    logger.info('📦 Performing autonomous dependency audit...');
    
    const dependencyResult = {
      outdated: [] as Array<{ name: string; current: string; wanted: string; latest: string; }>,
      vulnerable: [] as Array<{ name: string; description: string; }>,
      recommendations: [] as string[]
    };

    try {
      // 1. Check for outdated packages in Node.js projects
      if (await this.fileExists('package.json')) {
        try {
          const outdatedResult = await this.executeCommand('npm outdated --json', 'npm outdated', { timeout: 30000 });
          if (outdatedResult.success && outdatedResult.output) {
            try {
              const outdated = JSON.parse(outdatedResult.output);
              Object.entries(outdated).forEach(([name, info]: [string, any]) => {
                dependencyResult.outdated.push({
                  name,
                  current: info.current || 'unknown',
                  wanted: info.wanted || 'unknown',
                  latest: info.latest || 'unknown'
                });
              });
            } catch (parseError) {
              // Handle non-JSON output
            }
          }
        } catch (error) {
          logger.warn('Outdated package check failed:', error);
        }

        // 2. Vulnerability check (already covered in security audit, but add to dependencies)
        try {
          const auditResult = await this.executeCommand('npm audit --json', 'npm audit', { timeout: 30000 });
          if (auditResult.success && auditResult.output) {
            try {
              const audit = JSON.parse(auditResult.output);
              if (audit.vulnerabilities) {
                Object.entries(audit.vulnerabilities).forEach(([name, vuln]: [string, any]) => {
                  dependencyResult.vulnerable.push({
                    name,
                    description: vuln.title || 'Vulnerability detected'
                  });
                });
              }
            } catch (parseError) {
              // Handle non-JSON output
            }
          }
        } catch (error) {
          logger.warn('Dependency vulnerability check failed:', error);
        }
      }

      // 3. Generate dependency recommendations
      dependencyResult.recommendations.push('Regular dependency updates and security monitoring');
      dependencyResult.recommendations.push('Use package-lock.json or yarn.lock for version consistency');
      dependencyResult.recommendations.push('Audit and remove unused dependencies');
      dependencyResult.recommendations.push('Consider using dependency vulnerability scanning tools');
      dependencyResult.recommendations.push('Implement automated dependency update workflows');

    } catch (error) {
      logger.error('Dependency audit failed:', error);
    }

    return dependencyResult;
  }

  /**
   * Generate comprehensive recommendations based on audit results
   */
  private generateRecommendations(auditResult: AuditResult) {
    const recommendations = {
      immediate: [] as string[],
      shortTerm: [] as string[],
      longTerm: [] as string[]
    };

    // Immediate actions (critical issues)
    if (auditResult.security.vulnerabilities.some(v => v.severity === 'critical' || v.severity === 'high')) {
      recommendations.immediate.push('Address critical security vulnerabilities immediately');
    }

    if (auditResult.quality.issues.some(i => i.type === 'no-tests')) {
      recommendations.immediate.push('Implement basic test coverage');
    }

    // Short-term improvements
    if (auditResult.dependencies.outdated.length > 5) {
      recommendations.shortTerm.push('Update outdated dependencies');
    }

    if (auditResult.performance.issues.length > 0) {
      recommendations.shortTerm.push('Address performance optimization opportunities');
    }

    // Long-term strategic improvements
    recommendations.longTerm.push('Establish comprehensive CI/CD pipeline');
    recommendations.longTerm.push('Implement automated code quality gates');
    recommendations.longTerm.push('Set up continuous security monitoring');

    return recommendations;
  }

  /**
   * Calculate total issue counts across all audit areas
   */
  private calculateIssueCounts(auditResult: AuditResult) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };

    // Count security issues
    auditResult.security.vulnerabilities.forEach(vuln => {
      if (vuln.severity === 'critical') counts.critical++;
      else if (vuln.severity === 'high') counts.high++;
      else if (vuln.severity === 'medium') counts.medium++;
      else counts.low++;
    });

    // Count performance issues
    auditResult.performance.issues.forEach(issue => {
      if (issue.severity === 'critical') counts.critical++;
      else if (issue.severity === 'high') counts.high++;
      else if (issue.severity === 'medium') counts.medium++;
      else counts.low++;
    });

    // Count quality issues
    auditResult.quality.issues.forEach(issue => {
      if (issue.severity === 'critical') counts.critical++;
      else if (issue.severity === 'high') counts.high++;
      else if (issue.severity === 'medium') counts.medium++;
      else counts.low++;
    });

    return counts;
  }

  /**
   * Execute terminal command with platform detection
   */
  private async executeCommand(unixCommand: string, windowsCommand: string, options: { timeout?: number } = {}) {
    const command = process.platform === 'win32' ? windowsCommand : unixCommand;
    const timeout = options.timeout || 10000;

    try {
      const { stdout, stderr } = await execAsync(command, { timeout, cwd: process.cwd() });
      return {
        success: true,
        output: stdout.trim(),
        error: stderr.trim()
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}